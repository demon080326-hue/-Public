create or replace function public.sync_own_profile_from_auth()
returns setof public.profiles
language plpgsql
security definer
set search_path = ''
as $function$
declare
  caller_id uuid := (select auth.uid());
  auth_email_verified boolean;
begin
  if caller_id is null then
    raise exception 'Authentication required'
      using errcode = '42501';
  end if;

  select auth_user.email_confirmed_at is not null
  into auth_email_verified
  from auth.users as auth_user
  where auth_user.id = caller_id;

  if not found then
    raise exception 'Authenticated user not found'
      using errcode = '42501';
  end if;

  update public.profiles as profile
  set
    email_verified = auth_email_verified,
    role = case
      when auth_email_verified and profile.role = 'pending_member' then 'member'
      else profile.role
    end,
    updated_at = now()
  where profile.user_id = caller_id;

  return query
  select profile.*
  from public.profiles as profile
  where profile.user_id = caller_id
  limit 1;
end;
$function$;

comment on function public.sync_own_profile_from_auth() is
  'Synchronizes the authenticated caller email verification state and promotes only pending_member to member.';

revoke all on function public.sync_own_profile_from_auth() from public, anon, authenticated;
grant execute on function public.sync_own_profile_from_auth() to authenticated;
