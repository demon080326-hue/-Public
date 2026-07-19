alter table public.profiles
  add column if not exists current_tier text not null default 'super_poor',
  add column if not exists highest_tier text not null default 'super_poor',
  add column if not exists minimum_tier text not null default 'super_poor',
  add column if not exists lifetime_earned_points integer not null default 0,
  add column if not exists lifetime_redeemed_points integer not null default 0,
  add column if not exists total_valid_spend integer not null default 0,
  add column if not exists last_valid_purchase_at timestamptz,
  add column if not exists downgrade_exempt boolean not null default false,
  add column if not exists upgrade_disabled boolean not null default false,
  add column if not exists account_status text not null default 'normal';

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'profiles_current_tier_check'
      and conrelid = 'public.profiles'::regclass
  ) then
    alter table public.profiles
      add constraint profiles_current_tier_check
      check (current_tier in ('super_poor', 'poor', 'commoner', 'merchant', 'noble', 'royal_citizen', 'royal_relative', 'royal_direct', 'king'));
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'profiles_highest_tier_check'
      and conrelid = 'public.profiles'::regclass
  ) then
    alter table public.profiles
      add constraint profiles_highest_tier_check
      check (highest_tier in ('super_poor', 'poor', 'commoner', 'merchant', 'noble', 'royal_citizen', 'royal_relative', 'royal_direct', 'king'));
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'profiles_minimum_tier_check'
      and conrelid = 'public.profiles'::regclass
  ) then
    alter table public.profiles
      add constraint profiles_minimum_tier_check
      check (minimum_tier in ('super_poor', 'poor', 'commoner', 'merchant', 'noble', 'royal_citizen', 'royal_relative', 'royal_direct', 'king'));
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'profiles_points_balance_nonnegative_check'
      and conrelid = 'public.profiles'::regclass
  ) then
    alter table public.profiles
      add constraint profiles_points_balance_nonnegative_check
      check (points_balance >= 0);
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'profiles_lifetime_earned_points_nonnegative_check'
      and conrelid = 'public.profiles'::regclass
  ) then
    alter table public.profiles
      add constraint profiles_lifetime_earned_points_nonnegative_check
      check (lifetime_earned_points >= 0);
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'profiles_lifetime_redeemed_points_nonnegative_check'
      and conrelid = 'public.profiles'::regclass
  ) then
    alter table public.profiles
      add constraint profiles_lifetime_redeemed_points_nonnegative_check
      check (lifetime_redeemed_points >= 0);
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'profiles_total_valid_spend_nonnegative_check'
      and conrelid = 'public.profiles'::regclass
  ) then
    alter table public.profiles
      add constraint profiles_total_valid_spend_nonnegative_check
      check (total_valid_spend >= 0);
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'profiles_account_status_check'
      and conrelid = 'public.profiles'::regclass
  ) then
    alter table public.profiles
      add constraint profiles_account_status_check
      check (account_status in ('normal', 'suspended', 'restricted'));
  end if;
end $$;

comment on column public.profiles.points_balance is
  'Usable member points. Mutated only by server-controlled ledger flows.';
comment on column public.profiles.lifetime_earned_points is
  'Historical earned points used for tier calculations. Redemptions do not reduce this value.';
comment on column public.profiles.total_valid_spend is
  'Reserved valid paid spend total for future payment webhook/admin-controlled flows.';
comment on column public.profiles.current_tier is
  'Current member tier key.';
comment on column public.profiles.highest_tier is
  'Highest tier the member has reached.';
comment on column public.profiles.minimum_tier is
  'Minimum protected tier, for example merchant after valid spend reaches the configured threshold.';

create table if not exists public.member_tier_settings (
  id uuid primary key default gen_random_uuid(),
  tier_key text not null unique,
  tier_name text not null,
  sort_order integer not null,
  required_valid_spend integer not null default 0,
  required_lifetime_points integer not null default 0,
  is_manual_only boolean not null default false,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint member_tier_settings_tier_key_check check (
    tier_key in ('super_poor', 'poor', 'commoner', 'merchant', 'noble', 'royal_citizen', 'royal_relative', 'royal_direct', 'king')
  ),
  constraint member_tier_settings_required_valid_spend_check check (required_valid_spend >= 0),
  constraint member_tier_settings_required_lifetime_points_check check (required_lifetime_points >= 0)
);

comment on table public.member_tier_settings is
  'Member tier configuration. Stage 9 seeds the foundation only; manual-only tiers are not exposed in admin UI.';

insert into public.member_tier_settings (
  tier_key,
  tier_name,
  sort_order,
  required_valid_spend,
  required_lifetime_points,
  is_manual_only,
  is_active
)
values
  ('super_poor', '超級窮', 10, 0, 0, false, true),
  ('poor', '貧民', 20, 0, 0, false, true),
  ('commoner', '平民', 30, 500, 0, false, true),
  ('merchant', '商人', 40, 2000, 0, false, true),
  ('noble', '貴族', 50, 0, 5000, false, true),
  ('royal_citizen', '皇民', 60, 0, 7000, false, true),
  ('royal_relative', '皇親', 70, 0, 0, true, true),
  ('royal_direct', '皇族', 80, 0, 0, true, true),
  ('king', '國王', 90, 0, 0, true, true)
on conflict (tier_key) do update
set
  tier_name = excluded.tier_name,
  sort_order = excluded.sort_order,
  required_valid_spend = excluded.required_valid_spend,
  required_lifetime_points = excluded.required_lifetime_points,
  is_manual_only = excluded.is_manual_only,
  is_active = excluded.is_active,
  updated_at = now();

create table if not exists public.member_tier_history (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  old_tier text,
  new_tier text not null,
  reason text not null,
  changed_by uuid references auth.users (id) on delete set null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint member_tier_history_old_tier_check check (
    old_tier is null or old_tier in ('super_poor', 'poor', 'commoner', 'merchant', 'noble', 'royal_citizen', 'royal_relative', 'royal_direct', 'king')
  ),
  constraint member_tier_history_new_tier_check check (
    new_tier in ('super_poor', 'poor', 'commoner', 'merchant', 'noble', 'royal_citizen', 'royal_relative', 'royal_direct', 'king')
  ),
  constraint member_tier_history_reason_check check (
    reason in ('signup', 'email_verified', 'points_upgrade', 'spend_upgrade', 'inactivity_downgrade', 'manual_adjustment', 'refund_recalculation', 'restore_after_purchase')
  ),
  constraint member_tier_history_metadata_size_check check (pg_column_size(metadata) <= 8192)
);

comment on table public.member_tier_history is
  'Append-only member tier change history. Stage 9 records automatic foundational changes only.';

create index if not exists member_tier_history_user_id_created_at_idx
  on public.member_tier_history (user_id, created_at desc);

create index if not exists member_tier_history_changed_by_idx
  on public.member_tier_history (changed_by)
  where changed_by is not null;

create table if not exists public.member_points_ledger (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  amount integer not null,
  balance_after integer not null,
  lifetime_earned_after integer not null,
  source_type text not null,
  note text,
  checkin_date date,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint member_points_ledger_source_type_check check (
    source_type in (
      'daily_checkin',
      'streak_bonus_7_days',
      'monthly_full_checkin_bonus',
      'yearly_full_checkin_bonus',
      'purchase_reward',
      'admin_adjustment',
      'redemption',
      'refund_reversal',
      'migration'
    )
  ),
  constraint member_points_ledger_balance_after_check check (balance_after >= 0),
  constraint member_points_ledger_lifetime_earned_after_check check (lifetime_earned_after >= 0),
  constraint member_points_ledger_metadata_size_check check (pg_column_size(metadata) <= 8192)
);

comment on table public.member_points_ledger is
  'Append-only points ledger. Stage 9 enables daily check-in and 7-day streak bonus only; other source types are reserved.';

create index if not exists member_points_ledger_user_id_created_at_idx
  on public.member_points_ledger (user_id, created_at desc);

create index if not exists member_points_ledger_user_id_source_type_created_at_idx
  on public.member_points_ledger (user_id, source_type, created_at desc);

create unique index if not exists member_points_ledger_daily_checkin_once_idx
  on public.member_points_ledger (user_id, checkin_date)
  where source_type = 'daily_checkin' and checkin_date is not null;

create unique index if not exists member_points_ledger_streak_bonus_once_idx
  on public.member_points_ledger (user_id, checkin_date)
  where source_type = 'streak_bonus_7_days' and checkin_date is not null;

alter table public.member_tier_settings enable row level security;
alter table public.member_tier_history enable row level security;
alter table public.member_points_ledger enable row level security;

revoke all privileges on table public.member_tier_settings from public, anon, authenticated;
revoke all privileges on table public.member_tier_history from public, anon, authenticated;
revoke all privileges on table public.member_points_ledger from public, anon, authenticated;

grant select on table public.member_tier_settings to authenticated;
grant select on table public.member_tier_history to authenticated;
grant select on table public.member_points_ledger to authenticated;
grant all privileges on table public.member_tier_settings to service_role;
grant all privileges on table public.member_tier_history to service_role;
grant all privileges on table public.member_points_ledger to service_role;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'member_tier_settings'
      and policyname = 'member_tier_settings_select_active'
  ) then
    create policy "member_tier_settings_select_active"
    on public.member_tier_settings
    for select
    to authenticated
    using (is_active = true);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'member_tier_settings'
      and policyname = 'member_tier_settings_service_role_all'
  ) then
    create policy "member_tier_settings_service_role_all"
    on public.member_tier_settings
    for all
    to service_role
    using (true)
    with check (true);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'member_tier_history'
      and policyname = 'member_tier_history_select_own'
  ) then
    create policy "member_tier_history_select_own"
    on public.member_tier_history
    for select
    to authenticated
    using ((select auth.uid()) = user_id);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'member_tier_history'
      and policyname = 'member_tier_history_service_role_all'
  ) then
    create policy "member_tier_history_service_role_all"
    on public.member_tier_history
    for all
    to service_role
    using (true)
    with check (true);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'member_points_ledger'
      and policyname = 'member_points_ledger_select_own'
  ) then
    create policy "member_points_ledger_select_own"
    on public.member_points_ledger
    for select
    to authenticated
    using ((select auth.uid()) = user_id);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'member_points_ledger'
      and policyname = 'member_points_ledger_service_role_all'
  ) then
    create policy "member_points_ledger_service_role_all"
    on public.member_points_ledger
    for all
    to service_role
    using (true)
    with check (true);
  end if;
end $$;

create or replace function public.claim_member_daily_checkin(p_user_id uuid)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $function$
declare
  member_profile public.profiles%rowtype;
  today date := (now() at time zone 'Asia/Taipei')::date;
  already_claimed boolean := false;
  daily_amount integer := 2;
  streak_bonus_amount integer := 0;
  next_balance integer;
  next_lifetime integer;
  streak_days integer := 0;
  eligible_tier text := 'super_poor';
  next_minimum_tier text := 'super_poor';
  next_highest_tier text;
  current_order integer := 0;
  eligible_order integer := 0;
  highest_order integer := 0;
begin
  if p_user_id is null then
    raise exception 'Member user id is required';
  end if;

  select profile.*
  into member_profile
  from public.profiles as profile
  where profile.user_id = p_user_id
  for update;

  if not found then
    raise exception 'Member profile not found';
  end if;

  if member_profile.account_status <> 'normal'
    or member_profile.email_verified is not true
    or member_profile.role = 'pending_member'
  then
    return jsonb_build_object(
      'ok', false,
      'reason', 'NOT_ELIGIBLE',
      'points_balance', member_profile.points_balance,
      'lifetime_earned_points', member_profile.lifetime_earned_points,
      'current_tier', member_profile.current_tier
    );
  end if;

  select exists (
    select 1
    from public.member_points_ledger as ledger
    where ledger.user_id = p_user_id
      and ledger.source_type = 'daily_checkin'
      and ledger.checkin_date = today
  )
  into already_claimed;

  if already_claimed then
    select count(distinct ledger.checkin_date)::integer
    into streak_days
    from public.member_points_ledger as ledger
    where ledger.user_id = p_user_id
      and ledger.source_type = 'daily_checkin'
      and ledger.checkin_date between today - 6 and today;

    return jsonb_build_object(
      'ok', true,
      'claimed', false,
      'already_claimed', true,
      'daily_points', 0,
      'streak_bonus_points', 0,
      'streak_days', coalesce(streak_days, 0),
      'points_balance', member_profile.points_balance,
      'lifetime_earned_points', member_profile.lifetime_earned_points,
      'current_tier', member_profile.current_tier
    );
  end if;

  next_balance := member_profile.points_balance + daily_amount;
  next_lifetime := member_profile.lifetime_earned_points + daily_amount;

  update public.profiles
  set
    points_balance = next_balance,
    lifetime_earned_points = next_lifetime,
    updated_at = now()
  where user_id = p_user_id;

  insert into public.member_points_ledger (
    user_id,
    amount,
    balance_after,
    lifetime_earned_after,
    source_type,
    note,
    checkin_date,
    metadata
  )
  values (
    p_user_id,
    daily_amount,
    next_balance,
    next_lifetime,
    'daily_checkin',
    '每日簽到 +2',
    today,
    jsonb_build_object('taipei_date', today)
  );

  select count(distinct ledger.checkin_date)::integer
  into streak_days
  from public.member_points_ledger as ledger
  where ledger.user_id = p_user_id
    and ledger.source_type = 'daily_checkin'
    and ledger.checkin_date between today - 6 and today;

  if coalesce(streak_days, 0) = 7
    and not exists (
      select 1
      from public.member_points_ledger as ledger
      where ledger.user_id = p_user_id
        and ledger.source_type = 'streak_bonus_7_days'
        and ledger.checkin_date = today
    )
  then
    streak_bonus_amount := 5;
    next_balance := next_balance + streak_bonus_amount;
    next_lifetime := next_lifetime + streak_bonus_amount;

    update public.profiles
    set
      points_balance = next_balance,
      lifetime_earned_points = next_lifetime,
      updated_at = now()
    where user_id = p_user_id;

    insert into public.member_points_ledger (
      user_id,
      amount,
      balance_after,
      lifetime_earned_after,
      source_type,
      note,
      checkin_date,
      metadata
    )
    values (
      p_user_id,
      streak_bonus_amount,
      next_balance,
      next_lifetime,
      'streak_bonus_7_days',
      '連續簽到 7 天 +5',
      today,
      jsonb_build_object('taipei_date', today, 'streak_days', streak_days)
    );
  end if;

  select profile.*
  into member_profile
  from public.profiles as profile
  where profile.user_id = p_user_id
  for update;

  next_minimum_tier := case
    when member_profile.total_valid_spend >= 2000 then 'merchant'
    when member_profile.email_verified is true and member_profile.role <> 'pending_member' then 'poor'
    else 'super_poor'
  end;

  eligible_tier := case
    when member_profile.email_verified is not true or member_profile.role = 'pending_member' then 'super_poor'
    when member_profile.lifetime_earned_points >= 7000 then 'royal_citizen'
    when member_profile.lifetime_earned_points >= 5000 then 'noble'
    when member_profile.total_valid_spend >= 2000 then 'merchant'
    when member_profile.total_valid_spend >= 500 then 'commoner'
    else 'poor'
  end;

  current_order := case member_profile.current_tier
    when 'super_poor' then 10 when 'poor' then 20 when 'commoner' then 30
    when 'merchant' then 40 when 'noble' then 50 when 'royal_citizen' then 60
    when 'royal_relative' then 70 when 'royal_direct' then 80 when 'king' then 90
    else 10
  end;

  eligible_order := case eligible_tier
    when 'super_poor' then 10 when 'poor' then 20 when 'commoner' then 30
    when 'merchant' then 40 when 'noble' then 50 when 'royal_citizen' then 60
    else 10
  end;

  highest_order := case member_profile.highest_tier
    when 'super_poor' then 10 when 'poor' then 20 when 'commoner' then 30
    when 'merchant' then 40 when 'noble' then 50 when 'royal_citizen' then 60
    when 'royal_relative' then 70 when 'royal_direct' then 80 when 'king' then 90
    else 10
  end;

  next_highest_tier := case
    when eligible_order > highest_order then eligible_tier
    else member_profile.highest_tier
  end;

  if member_profile.minimum_tier <> next_minimum_tier then
    update public.profiles
    set
      minimum_tier = next_minimum_tier,
      updated_at = now()
    where user_id = p_user_id;
  end if;

  if member_profile.upgrade_disabled is not true and eligible_order > current_order then
    update public.profiles
    set
      current_tier = eligible_tier,
      highest_tier = next_highest_tier,
      minimum_tier = next_minimum_tier,
      updated_at = now()
    where user_id = p_user_id;

    insert into public.member_tier_history (
      user_id,
      old_tier,
      new_tier,
      reason,
      metadata
    )
    values (
      p_user_id,
      member_profile.current_tier,
      eligible_tier,
      case
        when eligible_tier in ('noble', 'royal_citizen') then 'points_upgrade'
        when eligible_tier in ('commoner', 'merchant') then 'spend_upgrade'
        else 'email_verified'
      end,
      jsonb_build_object(
        'points_balance', next_balance,
        'lifetime_earned_points', next_lifetime,
        'total_valid_spend', member_profile.total_valid_spend,
        'source', 'daily_checkin'
      )
    );
  elsif member_profile.upgrade_disabled is not true and next_highest_tier <> member_profile.highest_tier then
    update public.profiles
    set
      highest_tier = next_highest_tier,
      minimum_tier = next_minimum_tier,
      updated_at = now()
    where user_id = p_user_id;
  end if;

  select profile.*
  into member_profile
  from public.profiles as profile
  where profile.user_id = p_user_id;

  return jsonb_build_object(
    'ok', true,
    'claimed', true,
    'already_claimed', false,
    'daily_points', daily_amount,
    'streak_bonus_points', streak_bonus_amount,
    'streak_days', coalesce(streak_days, 0),
    'points_balance', member_profile.points_balance,
    'lifetime_earned_points', member_profile.lifetime_earned_points,
    'current_tier', member_profile.current_tier,
    'highest_tier', member_profile.highest_tier,
    'minimum_tier', member_profile.minimum_tier
  );
end;
$function$;

comment on function public.claim_member_daily_checkin(uuid) is
  'Service-role-only Stage 9 member check-in flow. Adds +2 daily points and a +5 seven-day streak bonus when eligible.';

revoke all on function public.claim_member_daily_checkin(uuid) from public, anon, authenticated;
grant execute on function public.claim_member_daily_checkin(uuid) to service_role;

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
    lifetime_earned_points = greatest(profile.lifetime_earned_points, profile.points_balance),
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
  'Synchronizes the authenticated caller email verification state, promotes only pending_member to member, and initializes Stage 9 member tier foundation.';

revoke all on function public.sync_own_profile_from_auth() from public, anon, authenticated;
grant execute on function public.sync_own_profile_from_auth() to authenticated;

update public.profiles
set
  lifetime_earned_points = greatest(lifetime_earned_points, points_balance),
  current_tier = case
    when email_verified is true and role <> 'pending_member' and current_tier = 'super_poor' then 'poor'
    else current_tier
  end,
  highest_tier = case
    when email_verified is true and role <> 'pending_member' and highest_tier = 'super_poor' then 'poor'
    else highest_tier
  end,
  minimum_tier = case
    when total_valid_spend >= 2000 then 'merchant'
    when email_verified is true and role <> 'pending_member' and minimum_tier = 'super_poor' then 'poor'
    else minimum_tier
  end,
  updated_at = now()
where true;
