create table public.auth_security_state (
  user_id uuid primary key references auth.users (id) on delete cascade,
  failed_login_count integer not null default 0,
  requires_reverification boolean not null default false,
  locked_until timestamptz,
  last_failed_login_at timestamptz,
  last_successful_login_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint auth_security_state_failed_login_count_check check (failed_login_count >= 0)
);

comment on table public.auth_security_state is
  'Server-managed login security state. Members may read only their own row.';

create table public.login_attempts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users (id) on delete set null,
  email_hash text not null,
  ip_hash text,
  user_agent text,
  success boolean not null default false,
  reason text,
  created_at timestamptz not null default now(),
  constraint login_attempts_email_hash_check check (email_hash ~ '^[0-9a-f]{64}$'),
  constraint login_attempts_ip_hash_check check (ip_hash is null or ip_hash ~ '^[0-9a-f]{64}$')
);

comment on table public.login_attempts is
  'Server-only authentication attempt log. Raw email addresses and IP addresses are never stored.';

create index login_attempts_email_hash_created_at_idx
  on public.login_attempts (email_hash, created_at desc);

create index login_attempts_user_id_created_at_idx
  on public.login_attempts (user_id, created_at desc)
  where user_id is not null;

create table public.auth_security_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users (id) on delete set null,
  event_type text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint auth_security_events_event_type_check check (
    event_type in (
      'login_success',
      'login_failed',
      'require_reverification',
      'reverification_requested',
      'reverification_failed',
      'reverification_passed',
      'password_reset_requested',
      'verification_code_requested',
      'verification_code_failed',
      'verification_code_verified'
    )
  ),
  constraint auth_security_events_metadata_size_check check (pg_column_size(metadata) <= 8192)
);

comment on table public.auth_security_events is
  'Server-only authentication security audit events.';

create index auth_security_events_user_id_created_at_idx
  on public.auth_security_events (user_id, created_at desc)
  where user_id is not null;

create index auth_security_events_event_type_created_at_idx
  on public.auth_security_events (event_type, created_at desc);

create table public.email_verification_codes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  purpose text not null,
  code_hash text not null,
  expires_at timestamptz not null,
  consumed_at timestamptz,
  attempts integer not null default 0,
  max_attempts integer not null default 5,
  created_at timestamptz not null default now(),
  constraint email_verification_codes_purpose_check check (
    purpose in ('login_reverification', 'email_verification', 'password_reset')
  ),
  constraint email_verification_codes_attempts_check check (attempts >= 0),
  constraint email_verification_codes_max_attempts_check check (max_attempts between 1 and 10)
);

comment on table public.email_verification_codes is
  'Server-only hashed six-digit verification code foundation. Plaintext codes are never stored.';

create index email_verification_codes_active_lookup_idx
  on public.email_verification_codes (user_id, purpose, created_at desc)
  where consumed_at is null;

alter table public.auth_security_state enable row level security;
alter table public.login_attempts enable row level security;
alter table public.auth_security_events enable row level security;
alter table public.email_verification_codes enable row level security;

revoke all privileges on table public.auth_security_state from public, anon, authenticated;
revoke all privileges on table public.login_attempts from public, anon, authenticated;
revoke all privileges on table public.auth_security_events from public, anon, authenticated;
revoke all privileges on table public.email_verification_codes from public, anon, authenticated;

grant select on table public.auth_security_state to authenticated;
grant all privileges on table public.auth_security_state to service_role;
grant all privileges on table public.login_attempts to service_role;
grant all privileges on table public.auth_security_events to service_role;
grant all privileges on table public.email_verification_codes to service_role;

create policy "auth_security_state_select_own"
on public.auth_security_state
for select
to authenticated
using ((select auth.uid()) = user_id);

create policy "auth_security_state_service_role_all"
on public.auth_security_state
for all
to service_role
using (true)
with check (true);

create policy "login_attempts_service_role_all"
on public.login_attempts
for all
to service_role
using (true)
with check (true);

create policy "auth_security_events_service_role_all"
on public.auth_security_events
for all
to service_role
using (true)
with check (true);

create policy "email_verification_codes_service_role_all"
on public.email_verification_codes
for all
to service_role
using (true)
with check (true);

grant usage on schema private to service_role;

create function private.set_auth_security_state_updated_at()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $function$
begin
  new.updated_at = now();
  return new;
end;
$function$;

revoke all on function private.set_auth_security_state_updated_at() from public, anon, authenticated;

create trigger auth_security_state_set_updated_at
before update on public.auth_security_state
for each row execute function private.set_auth_security_state_updated_at();

create function private.handle_new_auth_security_state()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
begin
  insert into public.auth_security_state (user_id)
  values (new.id)
  on conflict (user_id) do nothing;

  return new;
end;
$function$;

revoke all on function private.handle_new_auth_security_state() from public, anon, authenticated;

create trigger on_auth_user_security_state_created
after insert on auth.users
for each row execute function private.handle_new_auth_security_state();

insert into public.auth_security_state (user_id)
select auth_user.id
from auth.users as auth_user
on conflict (user_id) do nothing;

create function private.record_auth_security_event(
  p_user_id uuid,
  p_event_type text,
  p_metadata jsonb default '{}'::jsonb
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $function$
declare
  event_id uuid;
begin
  if p_event_type not in (
    'login_success',
    'login_failed',
    'require_reverification',
    'reverification_requested',
    'reverification_failed',
    'reverification_passed',
    'password_reset_requested',
    'verification_code_requested',
    'verification_code_failed',
    'verification_code_verified'
  ) then
    raise exception 'Unsupported security event type';
  end if;

  if pg_column_size(coalesce(p_metadata, '{}'::jsonb)) > 8192 then
    raise exception 'Security event metadata is too large';
  end if;

  insert into public.auth_security_events (user_id, event_type, metadata)
  values (p_user_id, p_event_type, coalesce(p_metadata, '{}'::jsonb))
  returning id into event_id;

  return event_id;
end;
$function$;

revoke all on function private.record_auth_security_event(uuid, text, jsonb) from public, anon, authenticated;
grant execute on function private.record_auth_security_event(uuid, text, jsonb) to service_role;

create function public.record_auth_security_event(
  p_user_id uuid,
  p_event_type text,
  p_metadata jsonb default '{}'::jsonb
)
returns uuid
language sql
security invoker
set search_path = ''
as $function$
  select private.record_auth_security_event(p_user_id, p_event_type, p_metadata);
$function$;

revoke all on function public.record_auth_security_event(uuid, text, jsonb) from public, anon, authenticated;
grant execute on function public.record_auth_security_event(uuid, text, jsonb) to service_role;

create function private.record_login_failure(
  p_email_hash text,
  p_ip_hash text,
  p_user_agent text,
  p_reason text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  target_user_id uuid;
  was_reverification_required boolean := false;
  next_failed_login_count integer := 0;
  next_requires_reverification boolean := false;
  safe_reason text := left(coalesce(nullif(trim(p_reason), ''), 'invalid_credentials'), 100);
begin
  if p_email_hash is null or p_email_hash !~ '^[0-9a-f]{64}$' then
    raise exception 'Invalid email hash';
  end if;

  if p_ip_hash is not null and p_ip_hash !~ '^[0-9a-f]{64}$' then
    raise exception 'Invalid IP hash';
  end if;

  select auth_user.id
  into target_user_id
  from auth.users as auth_user
  where encode(extensions.digest(lower(trim(coalesce(auth_user.email, ''))), 'sha256'), 'hex') = p_email_hash
  limit 1;

  insert into public.login_attempts (
    user_id,
    email_hash,
    ip_hash,
    user_agent,
    success,
    reason
  )
  values (
    target_user_id,
    p_email_hash,
    p_ip_hash,
    left(p_user_agent, 512),
    false,
    safe_reason
  );

  perform private.record_auth_security_event(
    target_user_id,
    'login_failed',
    jsonb_build_object('reason', safe_reason)
  );

  if target_user_id is not null then
    select state.requires_reverification
    into was_reverification_required
    from public.auth_security_state as state
    where state.user_id = target_user_id;

    insert into public.auth_security_state (
      user_id,
      failed_login_count,
      requires_reverification,
      last_failed_login_at
    )
    values (
      target_user_id,
      1,
      false,
      now()
    )
    on conflict (user_id) do update
    set
      failed_login_count = least(public.auth_security_state.failed_login_count + 1, 2147483647),
      requires_reverification = public.auth_security_state.requires_reverification
        or public.auth_security_state.failed_login_count + 1 >= 3,
      last_failed_login_at = now()
    returning failed_login_count, requires_reverification
    into next_failed_login_count, next_requires_reverification;

    if next_requires_reverification and not coalesce(was_reverification_required, false) then
      perform private.record_auth_security_event(
        target_user_id,
        'require_reverification',
        jsonb_build_object('failed_login_count', next_failed_login_count)
      );
    end if;
  end if;

  return jsonb_build_object(
    'recorded', true,
    'failed_login_count', next_failed_login_count,
    'requires_reverification', next_requires_reverification
  );
end;
$function$;

revoke all on function private.record_login_failure(text, text, text, text) from public, anon, authenticated;
grant execute on function private.record_login_failure(text, text, text, text) to service_role;

create function public.record_login_failure(
  p_email_hash text,
  p_ip_hash text,
  p_user_agent text,
  p_reason text
)
returns jsonb
language sql
security invoker
set search_path = ''
as $function$
  select private.record_login_failure(p_email_hash, p_ip_hash, p_user_agent, p_reason);
$function$;

revoke all on function public.record_login_failure(text, text, text, text) from public, anon, authenticated;
grant execute on function public.record_login_failure(text, text, text, text) to service_role;

create function private.record_login_success(
  p_user_id uuid,
  p_email_hash text,
  p_ip_hash text,
  p_user_agent text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  current_requires_reverification boolean;
begin
  if p_email_hash is null or p_email_hash !~ '^[0-9a-f]{64}$' then
    raise exception 'Invalid email hash';
  end if;

  if p_ip_hash is not null and p_ip_hash !~ '^[0-9a-f]{64}$' then
    raise exception 'Invalid IP hash';
  end if;

  if not exists (
    select 1
    from auth.users as auth_user
    where auth_user.id = p_user_id
      and encode(extensions.digest(lower(trim(coalesce(auth_user.email, ''))), 'sha256'), 'hex') = p_email_hash
  ) then
    raise exception 'Authenticated user mismatch';
  end if;

  insert into public.login_attempts (
    user_id,
    email_hash,
    ip_hash,
    user_agent,
    success,
    reason
  )
  values (
    p_user_id,
    p_email_hash,
    p_ip_hash,
    left(p_user_agent, 512),
    true,
    'password_authenticated'
  );

  insert into public.auth_security_state (
    user_id,
    failed_login_count,
    requires_reverification,
    locked_until,
    last_successful_login_at
  )
  values (
    p_user_id,
    0,
    false,
    null,
    now()
  )
  on conflict (user_id) do update
  set
    failed_login_count = 0,
    locked_until = null,
    last_successful_login_at = now()
  returning requires_reverification
  into current_requires_reverification;

  perform private.record_auth_security_event(
    p_user_id,
    'login_success',
    jsonb_build_object('requires_reverification', current_requires_reverification)
  );

  return jsonb_build_object(
    'recorded', true,
    'requires_reverification', current_requires_reverification
  );
end;
$function$;

revoke all on function private.record_login_success(uuid, text, text, text) from public, anon, authenticated;
grant execute on function private.record_login_success(uuid, text, text, text) to service_role;

create function public.record_login_success(
  p_user_id uuid,
  p_email_hash text,
  p_ip_hash text,
  p_user_agent text
)
returns jsonb
language sql
security invoker
set search_path = ''
as $function$
  select private.record_login_success(p_user_id, p_email_hash, p_ip_hash, p_user_agent);
$function$;

revoke all on function public.record_login_success(uuid, text, text, text) from public, anon, authenticated;
grant execute on function public.record_login_success(uuid, text, text, text) to service_role;

create function private.clear_reverification(p_user_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
begin
  insert into public.auth_security_state (
    user_id,
    failed_login_count,
    requires_reverification,
    locked_until
  )
  values (
    p_user_id,
    0,
    false,
    null
  )
  on conflict (user_id) do update
  set
    failed_login_count = 0,
    requires_reverification = false,
    locked_until = null;

  perform private.record_auth_security_event(
    p_user_id,
    'reverification_passed',
    '{}'::jsonb
  );

  return jsonb_build_object('cleared', true);
end;
$function$;

revoke all on function private.clear_reverification(uuid) from public, anon, authenticated;
grant execute on function private.clear_reverification(uuid) to service_role;

create function public.clear_reverification(p_user_id uuid)
returns jsonb
language sql
security invoker
set search_path = ''
as $function$
  select private.clear_reverification(p_user_id);
$function$;

revoke all on function public.clear_reverification(uuid) from public, anon, authenticated;
grant execute on function public.clear_reverification(uuid) to service_role;

create function private.create_email_verification_code(
  p_user_id uuid,
  p_purpose text,
  p_plain_code text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $function$
declare
  verification_code_id uuid;
begin
  if p_purpose not in ('login_reverification', 'email_verification', 'password_reset') then
    raise exception 'Unsupported verification purpose';
  end if;

  if p_plain_code is null or p_plain_code !~ '^[0-9]{6}$' then
    raise exception 'Verification code must contain exactly six digits';
  end if;

  update public.email_verification_codes
  set consumed_at = now()
  where user_id = p_user_id
    and purpose = p_purpose
    and consumed_at is null;

  insert into public.email_verification_codes (
    user_id,
    purpose,
    code_hash,
    expires_at
  )
  values (
    p_user_id,
    p_purpose,
    extensions.crypt(p_plain_code, extensions.gen_salt('bf', 10)),
    now() + interval '10 minutes'
  )
  returning id into verification_code_id;

  perform private.record_auth_security_event(
    p_user_id,
    'verification_code_requested',
    jsonb_build_object('purpose', p_purpose)
  );

  return verification_code_id;
end;
$function$;

revoke all on function private.create_email_verification_code(uuid, text, text) from public, anon, authenticated;
grant execute on function private.create_email_verification_code(uuid, text, text) to service_role;

create function public.create_email_verification_code(
  p_user_id uuid,
  p_purpose text,
  p_plain_code text
)
returns uuid
language sql
security invoker
set search_path = ''
as $function$
  select private.create_email_verification_code(p_user_id, p_purpose, p_plain_code);
$function$;

revoke all on function public.create_email_verification_code(uuid, text, text) from public, anon, authenticated;
grant execute on function public.create_email_verification_code(uuid, text, text) to service_role;

create function private.verify_email_verification_code(
  p_user_id uuid,
  p_purpose text,
  p_plain_code text
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $function$
declare
  verification_code public.email_verification_codes%rowtype;
  code_matches boolean := false;
begin
  if p_plain_code is null or p_plain_code !~ '^[0-9]{6}$' then
    return false;
  end if;

  select code.*
  into verification_code
  from public.email_verification_codes as code
  where code.user_id = p_user_id
    and code.purpose = p_purpose
    and code.consumed_at is null
    and code.expires_at > now()
    and code.attempts < code.max_attempts
  order by code.created_at desc
  limit 1
  for update;

  if not found then
    return false;
  end if;

  code_matches := extensions.crypt(p_plain_code, verification_code.code_hash) = verification_code.code_hash;

  if code_matches then
    update public.email_verification_codes
    set consumed_at = now()
    where id = verification_code.id;

    if p_purpose = 'login_reverification' then
      perform private.clear_reverification(p_user_id);
    end if;

    perform private.record_auth_security_event(
      p_user_id,
      'verification_code_verified',
      jsonb_build_object('purpose', p_purpose)
    );

    return true;
  end if;

  update public.email_verification_codes
  set
    attempts = attempts + 1,
    consumed_at = case when attempts + 1 >= max_attempts then now() else consumed_at end
  where id = verification_code.id;

  perform private.record_auth_security_event(
    p_user_id,
    'verification_code_failed',
    jsonb_build_object('purpose', p_purpose)
  );

  return false;
end;
$function$;

revoke all on function private.verify_email_verification_code(uuid, text, text) from public, anon, authenticated;
grant execute on function private.verify_email_verification_code(uuid, text, text) to service_role;

create function public.verify_email_verification_code(
  p_user_id uuid,
  p_purpose text,
  p_plain_code text
)
returns boolean
language sql
security invoker
set search_path = ''
as $function$
  select private.verify_email_verification_code(p_user_id, p_purpose, p_plain_code);
$function$;

revoke all on function public.verify_email_verification_code(uuid, text, text) from public, anon, authenticated;
grant execute on function public.verify_email_verification_code(uuid, text, text) to service_role;
