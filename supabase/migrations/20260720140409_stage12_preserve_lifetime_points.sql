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
    current_tier = case
      when auth_email_verified and profile.role = 'pending_member' and profile.current_tier = 'super_poor' then 'poor'
      else profile.current_tier
    end,
    highest_tier = case
      when auth_email_verified and profile.role = 'pending_member' and profile.highest_tier = 'super_poor' then 'poor'
      else profile.highest_tier
    end,
    minimum_tier = case
      when auth_email_verified and profile.role = 'pending_member' and profile.minimum_tier = 'super_poor' then 'poor'
      else profile.minimum_tier
    end,
    updated_at = now()
  where profile.user_id = caller_id;

  insert into public.member_tier_history (
    user_id,
    old_tier,
    new_tier,
    reason,
    metadata
  )
  select
    profile.user_id,
    'super_poor',
    'poor',
    'email_verified',
    jsonb_build_object('source', 'sync_own_profile_from_auth')
  from public.profiles as profile
  where profile.user_id = caller_id
    and auth_email_verified
    and profile.role = 'member'
    and profile.current_tier = 'poor'
    and not exists (
      select 1
      from public.member_tier_history as history
      where history.user_id = caller_id
        and history.reason = 'email_verified'
        and history.new_tier = 'poor'
    );

  return query
  select profile.*
  from public.profiles as profile
  where profile.user_id = caller_id
  limit 1;
end;
$function$;

comment on function public.sync_own_profile_from_auth() is
  'Synchronizes authenticated profile verification and initial role/tier state without deriving lifetime points from the spendable balance.';

revoke all on function public.sync_own_profile_from_auth() from public, anon;
grant execute on function public.sync_own_profile_from_auth() to authenticated;
