create table public.profiles (
  user_id uuid primary key references auth.users (id) on delete cascade,
  email text,
  display_name text,
  role text not null default 'pending_member',
  email_verified boolean not null default false,
  points_balance integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint profiles_role_check check (role in ('pending_member', 'member', 'admin', 'owner'))
);

comment on table public.profiles is 'Member identity and role foundation. Points are reserved for a later ledger-backed phase.';

alter table public.profiles enable row level security;

revoke all privileges on table public.profiles from anon, authenticated;
grant select on table public.profiles to authenticated;
grant update (display_name) on table public.profiles to authenticated;

create function public.current_user_role()
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

revoke all on function public.current_user_role() from public, anon;
grant execute on function public.current_user_role() to authenticated;

create policy "profiles_select_own"
on public.profiles
for select
to authenticated
using ((select auth.uid()) = user_id);

create policy "profiles_select_admin_owner"
on public.profiles
for select
to authenticated
using ((select public.current_user_role()) in ('admin', 'owner'));

create policy "profiles_update_own_display_name"
on public.profiles
for update
to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

create function public.get_current_user_profile()
returns setof public.profiles
language sql
stable
security invoker
set search_path = ''
as $function$
  select profile.*
  from public.profiles as profile
  where profile.user_id = (select auth.uid())
  limit 1;
$function$;

revoke all on function public.get_current_user_profile() from public, anon;
grant execute on function public.get_current_user_profile() to authenticated;

create function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
begin
  insert into public.profiles (
    user_id,
    email,
    display_name,
    role,
    email_verified,
    points_balance
  )
  values (
    new.id,
    new.email,
    nullif(trim(new.raw_user_meta_data ->> 'display_name'), ''),
    'pending_member',
    false,
    0
  )
  on conflict (user_id) do nothing;

  return new;
end;
$function$;

revoke all on function public.handle_new_user() from public, anon, authenticated;

create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

create function public.set_profiles_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $function$
begin
  new.updated_at = now();
  return new;
end;
$function$;

revoke all on function public.set_profiles_updated_at() from public, anon, authenticated;

create trigger profiles_set_updated_at
before update on public.profiles
for each row execute function public.set_profiles_updated_at();

insert into public.profiles (
  user_id,
  email,
  display_name,
  role,
  email_verified,
  points_balance
)
select
  auth_user.id,
  auth_user.email,
  nullif(trim(auth_user.raw_user_meta_data ->> 'display_name'), ''),
  'pending_member',
  false,
  0
from auth.users as auth_user
on conflict (user_id) do nothing;
