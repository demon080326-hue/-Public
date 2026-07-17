create schema private;

revoke all on schema private from public, anon;
grant usage on schema private to authenticated;

create function private.current_user_role()
returns text
language sql
stable
security definer
set search_path = ''
as $function$
  select coalesce(
    (
      select profile.role
      from public.profiles as profile
      where profile.user_id = (select auth.uid())
      limit 1
    ),
    'pending_member'
  );
$function$;

revoke all on function private.current_user_role() from public, anon;
grant execute on function private.current_user_role() to authenticated;

drop policy "profiles_select_own" on public.profiles;
drop policy "profiles_select_admin_owner" on public.profiles;

create policy "profiles_select_authorized"
on public.profiles
for select
to authenticated
using (
  (select auth.uid()) = user_id
  or (select private.current_user_role()) in ('admin', 'owner')
);

drop function public.current_user_role();
