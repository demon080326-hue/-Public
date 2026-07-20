-- Stage 13: admin manual member tier adjustment.
-- Adds a database-level guarantee that at most one member can hold current_tier = 'king',
-- and a service-role-only transactional RPC that adjusts current_tier, raises highest_tier
-- only upward, and appends a manual member_tier_history row. This migration never touches
-- points_balance, lifetime_earned_points, total_valid_spend, minimum_tier, roles, or RLS.

-- 1. Guard against pre-existing data that would violate the single-king rule.
--    If Production already holds more than one king, fail loudly instead of breaking data.
do $$
declare
  king_count integer;
begin
  select count(*) into king_count
  from public.profiles
  where current_tier = 'king';

  if king_count > 1 then
    raise exception
      'STAGE13_MULTIPLE_KINGS_PRESENT: % profiles currently have current_tier = king; resolve manually before applying the single-king unique index.',
      king_count
      using errcode = '23505';
  end if;
end $$;

-- 2. Database-level king uniqueness: current_tier = 'king' may appear at most once.
create unique index if not exists profiles_single_king_idx
  on public.profiles (current_tier)
  where current_tier = 'king';

comment on index public.profiles_single_king_idx is
  'Stage 13: guarantees at most one member can hold current_tier = king at any time. King is a member tier only, never a system role.';

-- 3. Transactional admin tier adjustment RPC.
create or replace function public.admin_adjust_member_tier(
  p_target_user_id uuid,
  p_target_tier text,
  p_reason text,
  p_actor_user_id uuid,
  p_actor_email text,
  p_actor_role text
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $function$
declare
  member_profile public.profiles%rowtype;
  normalized_reason text := btrim(coalesce(p_reason, ''));
  before_tier text;
  before_highest text;
  before_minimum text;
  next_highest text;
  target_order integer;
  highest_order integer;
  existing_king_count integer;
  history_id uuid;
begin
  if p_target_user_id is null then
    raise exception 'MEMBER_NOT_FOUND' using errcode = 'P0002';
  end if;

  if p_actor_user_id is null then
    raise exception 'ADMIN_IDENTITY_REQUIRED' using errcode = '42501';
  end if;

  if p_actor_role not in ('admin', 'owner') then
    raise exception 'FORBIDDEN_ROLE' using errcode = '42501';
  end if;

  if p_target_tier not in (
    'super_poor', 'poor', 'commoner', 'merchant', 'noble',
    'royal_citizen', 'royal_relative', 'royal_direct', 'king'
  ) then
    raise exception 'INVALID_TIER' using errcode = '22023';
  end if;

  -- Only owner may assign the high-privilege royal tiers.
  if p_target_tier in ('royal_relative', 'royal_direct', 'king')
    and p_actor_role <> 'owner'
  then
    raise exception 'TIER_OWNER_ONLY' using errcode = '42501';
  end if;

  if char_length(normalized_reason) < 5 or char_length(normalized_reason) > 300 then
    raise exception 'INVALID_REASON' using errcode = '22023';
  end if;

  select profile.*
  into member_profile
  from public.profiles as profile
  where profile.user_id = p_target_user_id
  for update;

  if not found then
    raise exception 'MEMBER_NOT_FOUND' using errcode = 'P0002';
  end if;

  before_tier := member_profile.current_tier;
  before_highest := member_profile.highest_tier;
  before_minimum := member_profile.minimum_tier;

  if before_tier = p_target_tier then
    raise exception 'TIER_UNCHANGED' using errcode = '22023';
  end if;

  -- King uniqueness pre-check for a clean error before hitting the unique index.
  if p_target_tier = 'king' then
    select count(*)
    into existing_king_count
    from public.profiles as profile
    where profile.current_tier = 'king'
      and profile.user_id <> p_target_user_id;

    if existing_king_count > 0 then
      raise exception 'KING_ALREADY_EXISTS' using errcode = '23505';
    end if;
  end if;

  target_order := case p_target_tier
    when 'super_poor' then 10 when 'poor' then 20 when 'commoner' then 30
    when 'merchant' then 40 when 'noble' then 50 when 'royal_citizen' then 60
    when 'royal_relative' then 70 when 'royal_direct' then 80 when 'king' then 90
    else 10
  end;

  highest_order := case before_highest
    when 'super_poor' then 10 when 'poor' then 20 when 'commoner' then 30
    when 'merchant' then 40 when 'noble' then 50 when 'royal_citizen' then 60
    when 'royal_relative' then 70 when 'royal_direct' then 80 when 'king' then 90
    else 10
  end;

  -- highest_tier only ever moves upward.
  next_highest := case
    when target_order > highest_order then p_target_tier
    else before_highest
  end;

  update public.profiles
  set
    current_tier = p_target_tier,
    highest_tier = next_highest,
    updated_at = now()
  where user_id = p_target_user_id;

  insert into public.member_tier_history (
    user_id,
    old_tier,
    new_tier,
    reason,
    changed_by,
    metadata
  )
  values (
    p_target_user_id,
    before_tier,
    p_target_tier,
    'manual_adjustment',
    p_actor_user_id,
    jsonb_build_object(
      'source', 'admin_manual_adjustment',
      'adjusted_by_user_id', p_actor_user_id,
      'adjusted_by_email', nullif(btrim(coalesce(p_actor_email, '')), ''),
      'adjusted_by_role', p_actor_role,
      'previous_tier', before_tier,
      'new_tier', p_target_tier,
      'previous_highest_tier', before_highest,
      'new_highest_tier', next_highest,
      'minimum_tier_unchanged', true,
      'points_unchanged', true,
      'lifetime_unchanged', true,
      'stage', 'stage13_admin_tier_adjust'
    )
  )
  returning id into history_id;

  return jsonb_build_object(
    'ok', true,
    'member_id', member_profile.user_id,
    'target_email', member_profile.email,
    'before_tier', before_tier,
    'after_tier', p_target_tier,
    'before_highest_tier', before_highest,
    'highest_tier', next_highest,
    'minimum_tier', before_minimum,
    'highest_tier_raised', (next_highest <> before_highest),
    'history_id', history_id
  );
end;
$function$;

comment on function public.admin_adjust_member_tier(uuid, text, text, uuid, text, text) is
  'Service-role-only Stage 13 transaction: adjusts current_tier, raises highest_tier only upward, enforces single-king and owner-only royal tiers, and appends a manual member_tier_history row. Never mutates points, lifetime points, valid spend, minimum_tier, roles, or RLS.';

revoke all on function public.admin_adjust_member_tier(uuid, text, text, uuid, text, text)
  from public, anon, authenticated;
grant execute on function public.admin_adjust_member_tier(uuid, text, text, uuid, text, text)
  to service_role;
