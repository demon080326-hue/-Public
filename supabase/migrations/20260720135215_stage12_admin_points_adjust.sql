create or replace function public.admin_adjust_member_points(
  p_target_user_id uuid,
  p_adjustment_type text,
  p_points integer,
  p_reason text,
  p_actor_user_id uuid,
  p_actor_email text
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $function$
declare
  member_profile public.profiles%rowtype;
  normalized_reason text := btrim(coalesce(p_reason, ''));
  delta integer;
  next_balance integer;
  ledger_id uuid;
begin
  if p_target_user_id is null then
    raise exception 'MEMBER_NOT_FOUND' using errcode = 'P0002';
  end if;

  if p_actor_user_id is null then
    raise exception 'ADMIN_IDENTITY_REQUIRED' using errcode = '42501';
  end if;

  if p_adjustment_type not in ('add', 'deduct') then
    raise exception 'INVALID_ADJUSTMENT_TYPE' using errcode = '22023';
  end if;

  if p_points is null or p_points < 1 or p_points > 10000 then
    raise exception 'INVALID_POINTS' using errcode = '22023';
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

  delta := case when p_adjustment_type = 'add' then p_points else -p_points end;
  next_balance := member_profile.points_balance + delta;

  if next_balance < 0 then
    raise exception 'INSUFFICIENT_POINTS' using errcode = '22023';
  end if;

  update public.profiles
  set
    points_balance = next_balance,
    updated_at = now()
  where user_id = p_target_user_id;

  insert into public.member_points_ledger (
    user_id,
    amount,
    balance_after,
    lifetime_earned_after,
    source_type,
    note,
    metadata
  )
  values (
    p_target_user_id,
    delta,
    next_balance,
    member_profile.lifetime_earned_points,
    'admin_adjustment',
    normalized_reason,
    jsonb_build_object(
      'adjusted_by_user_id', p_actor_user_id,
      'adjusted_by_email', nullif(btrim(coalesce(p_actor_email, '')), ''),
      'adjustment_type', p_adjustment_type,
      'before_points', member_profile.points_balance,
      'after_points', next_balance,
      'stage', 'stage12_admin_points_adjust'
    )
  )
  returning id into ledger_id;

  return jsonb_build_object(
    'ok', true,
    'member_id', member_profile.user_id,
    'target_email', member_profile.email,
    'before_points', member_profile.points_balance,
    'after_points', next_balance,
    'delta', delta,
    'points', p_points,
    'adjustment_type', p_adjustment_type,
    'ledger_id', ledger_id,
    'lifetime_earned_points', member_profile.lifetime_earned_points,
    'current_tier', member_profile.current_tier,
    'highest_tier', member_profile.highest_tier,
    'minimum_tier', member_profile.minimum_tier
  );
end;
$function$;

comment on function public.admin_adjust_member_points(uuid, text, integer, text, uuid, text) is
  'Service-role-only Stage 12 transaction that adjusts available points and appends the matching ledger row without changing lifetime points or tiers.';

revoke all on function public.admin_adjust_member_points(uuid, text, integer, text, uuid, text)
  from public, anon, authenticated;
grant execute on function public.admin_adjust_member_points(uuid, text, integer, text, uuid, text)
  to service_role;
