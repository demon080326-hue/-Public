-- Serialize code creation per user so concurrent requests cannot bypass server-side send limits.
create or replace function private.create_email_verification_code(
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
  recent_request_count bigint := 0;
  latest_request_at timestamptz;
  oldest_request_at timestamptz;
  retry_after_seconds integer := 0;
begin
  if p_purpose not in ('login_reverification', 'email_verification', 'password_reset') then
    raise exception 'Unsupported verification purpose';
  end if;

  if p_plain_code is null or p_plain_code !~ '^[0-9]{6}$' then
    raise exception 'Verification code must contain exactly six digits';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(p_user_id::text || ':' || p_purpose, 0)
  );

  select count(*), max(event.created_at), min(event.created_at)
  into recent_request_count, latest_request_at, oldest_request_at
  from public.auth_security_events as event
  where event.user_id = p_user_id
    and event.event_type = 'verification_code_requested'
    and event.metadata ->> 'purpose' = p_purpose
    and event.created_at > now() - interval '10 minutes';

  if latest_request_at > now() - interval '1 minute'
    or recent_request_count >= 3 then
    retry_after_seconds := greatest(
      case
        when latest_request_at > now() - interval '1 minute'
          then ceil(extract(epoch from latest_request_at + interval '1 minute' - now()))::integer
        else 0
      end,
      case
        when recent_request_count >= 3
          then ceil(extract(epoch from oldest_request_at + interval '10 minutes' - now()))::integer
        else 0
      end
    );

    perform private.record_auth_security_event(
      p_user_id,
      'verification_rate_limited',
      jsonb_build_object(
        'purpose', p_purpose,
        'retry_after_seconds', greatest(retry_after_seconds, 1)
      )
    );

    return null;
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
