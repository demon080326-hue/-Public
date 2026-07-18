-- Stage 7B extends the existing login-security foundation without rebuilding its tables.
alter table public.auth_security_events
  drop constraint auth_security_events_event_type_check;

alter table public.auth_security_events
  add constraint auth_security_events_event_type_check check (
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
      'verification_code_verified',
      'verification_email_sent',
      'verification_email_failed',
      'verification_rate_limited'
    )
  );

create or replace function private.record_auth_security_event(
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
    'verification_code_verified',
    'verification_email_sent',
    'verification_email_failed',
    'verification_rate_limited'
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

create function private.get_reverification_target(p_email_hash text)
returns table(target_user_id uuid, requires_reverification boolean)
language plpgsql
security definer
set search_path = ''
as $function$
begin
  if p_email_hash is null or p_email_hash !~ '^[0-9a-f]{64}$' then
    return;
  end if;

  return query
  select
    auth_user.id,
    coalesce(state.requires_reverification, false)
  from auth.users as auth_user
  left join public.auth_security_state as state on state.user_id = auth_user.id
  where encode(extensions.digest(lower(trim(coalesce(auth_user.email, ''))), 'sha256'), 'hex') = p_email_hash
  limit 1;
end;
$function$;

revoke all on function private.get_reverification_target(text) from public, anon, authenticated;
grant execute on function private.get_reverification_target(text) to service_role;

create function public.get_reverification_target(p_email_hash text)
returns table(target_user_id uuid, requires_reverification boolean)
language sql
security invoker
set search_path = ''
as $function$
  select * from private.get_reverification_target(p_email_hash);
$function$;

revoke all on function public.get_reverification_target(text) from public, anon, authenticated;
grant execute on function public.get_reverification_target(text) to service_role;

create function private.cancel_email_verification_code(
  p_code_id uuid,
  p_user_id uuid,
  p_purpose text
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $function$
declare
  cancelled boolean := false;
begin
  update public.email_verification_codes
  set consumed_at = now()
  where id = p_code_id
    and user_id = p_user_id
    and purpose = p_purpose
    and consumed_at is null
  returning true into cancelled;

  return coalesce(cancelled, false);
end;
$function$;

revoke all on function private.cancel_email_verification_code(uuid, uuid, text) from public, anon, authenticated;
grant execute on function private.cancel_email_verification_code(uuid, uuid, text) to service_role;

create function public.cancel_email_verification_code(
  p_code_id uuid,
  p_user_id uuid,
  p_purpose text
)
returns boolean
language sql
security invoker
set search_path = ''
as $function$
  select private.cancel_email_verification_code(p_code_id, p_user_id, p_purpose);
$function$;

revoke all on function public.cancel_email_verification_code(uuid, uuid, text) from public, anon, authenticated;
grant execute on function public.cancel_email_verification_code(uuid, uuid, text) to service_role;
