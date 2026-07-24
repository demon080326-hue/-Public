-- Stage 16: disabled checkout and payment-record foundation.
-- This migration intentionally does not create a live provider, payment URL, paid order,
-- points reward, product entitlement, inventory mutation, refund, invoice, or email flow.

create table if not exists public.payment_sessions (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders (id) on delete cascade,
  user_id uuid references auth.users (id) on delete set null,
  provider text not null default 'disabled',
  mode text not null default 'disabled',
  status text not null default 'created',
  amount_cents integer not null default 0,
  currency text not null default 'TWD',
  provider_session_id text,
  provider_payment_url text,
  idempotency_key text not null,
  expires_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint payment_sessions_amount_nonnegative_check check (amount_cents >= 0),
  constraint payment_sessions_currency_check check (currency = 'TWD'),
  constraint payment_sessions_provider_check check (
    provider in ('disabled', 'mock', 'ecpay', 'line_pay', 'manual')
  ),
  constraint payment_sessions_mode_check check (mode in ('disabled', 'test', 'live')),
  constraint payment_sessions_status_check check (
    status in ('created', 'pending', 'authorized', 'paid', 'failed', 'cancelled', 'expired', 'refunded')
  ),
  constraint payment_sessions_disabled_mode_check check (
    mode <> 'disabled' or (provider = 'disabled' and provider_payment_url is null)
  ),
  constraint payment_sessions_provider_session_id_length_check check (
    provider_session_id is null or char_length(provider_session_id) <= 500
  ),
  constraint payment_sessions_provider_payment_url_length_check check (
    provider_payment_url is null or char_length(provider_payment_url) <= 2048
  ),
  constraint payment_sessions_idempotency_key_length_check check (
    char_length(idempotency_key) between 1 and 200
  ),
  constraint payment_sessions_metadata_size_check check (pg_column_size(metadata) <= 16384),
  constraint payment_sessions_idempotency_key_unique unique (idempotency_key)
);

create table if not exists public.payment_events (
  id uuid primary key default gen_random_uuid(),
  payment_session_id uuid not null references public.payment_sessions (id) on delete cascade,
  order_id uuid not null references public.orders (id) on delete cascade,
  event_type text not null,
  before_status text,
  after_status text,
  amount_cents integer,
  provider text,
  provider_event_id text,
  reason text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint payment_events_event_type_length_check check (char_length(event_type) between 1 and 100),
  constraint payment_events_amount_nonnegative_check check (amount_cents is null or amount_cents >= 0),
  constraint payment_events_provider_length_check check (provider is null or char_length(provider) <= 100),
  constraint payment_events_provider_event_id_length_check check (
    provider_event_id is null or char_length(provider_event_id) <= 500
  ),
  constraint payment_events_reason_length_check check (reason is null or char_length(reason) <= 1000),
  constraint payment_events_metadata_size_check check (pg_column_size(metadata) <= 16384)
);

create table if not exists public.payment_webhook_events (
  id uuid primary key default gen_random_uuid(),
  provider text not null,
  provider_event_id text not null,
  event_type text not null,
  received_at timestamptz not null default now(),
  processed_at timestamptz,
  status text not null default 'received',
  order_id uuid references public.orders (id) on delete set null,
  payment_session_id uuid references public.payment_sessions (id) on delete set null,
  payload jsonb not null default '{}'::jsonb,
  error_message text,
  idempotency_key text,
  metadata jsonb not null default '{}'::jsonb,
  constraint payment_webhook_events_provider_length_check check (char_length(provider) between 1 and 100),
  constraint payment_webhook_events_provider_event_id_length_check check (
    char_length(provider_event_id) between 1 and 500
  ),
  constraint payment_webhook_events_event_type_length_check check (char_length(event_type) between 1 and 100),
  constraint payment_webhook_events_status_check check (
    status in ('received', 'processed', 'ignored', 'failed')
  ),
  constraint payment_webhook_events_error_message_length_check check (
    error_message is null or char_length(error_message) <= 2000
  ),
  constraint payment_webhook_events_idempotency_key_length_check check (
    idempotency_key is null or char_length(idempotency_key) <= 200
  ),
  constraint payment_webhook_events_payload_size_check check (pg_column_size(payload) <= 16384),
  constraint payment_webhook_events_metadata_size_check check (pg_column_size(metadata) <= 16384),
  constraint payment_webhook_events_provider_event_unique unique (provider, provider_event_id)
);

comment on table public.payment_sessions is
  'Stage 16 checkout preparation. Disabled mode only; no live payment URL or provider credential is stored.';
comment on table public.payment_events is
  'Stage 16 payment session event history. No paid event is created in this stage.';
comment on table public.payment_webhook_events is
  'Stage 16 idempotency structure only. Do not store Authorization headers, cookies, secrets, card data, or CVV.';

create index if not exists payment_sessions_order_created_at_idx
  on public.payment_sessions (order_id, created_at desc);
create index if not exists payment_sessions_user_created_at_idx
  on public.payment_sessions (user_id, created_at desc);
create index if not exists payment_sessions_status_created_at_idx
  on public.payment_sessions (status, created_at desc);
create index if not exists payment_events_session_created_at_idx
  on public.payment_events (payment_session_id, created_at desc);
create index if not exists payment_events_order_created_at_idx
  on public.payment_events (order_id, created_at desc);
create index if not exists payment_webhook_events_order_received_at_idx
  on public.payment_webhook_events (order_id, received_at desc);
create index if not exists payment_webhook_events_session_received_at_idx
  on public.payment_webhook_events (payment_session_id, received_at desc);

create function public.set_payment_sessions_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $function$
begin
  new.updated_at = now();
  return new;
end;
$function$;

revoke all on function public.set_payment_sessions_updated_at() from public, anon, authenticated;

create trigger payment_sessions_set_updated_at
before update on public.payment_sessions
for each row execute function public.set_payment_sessions_updated_at();

alter table public.payment_sessions enable row level security;
alter table public.payment_events enable row level security;
alter table public.payment_webhook_events enable row level security;

revoke all privileges on table public.payment_sessions from public, anon, authenticated;
revoke all privileges on table public.payment_events from public, anon, authenticated;
revoke all privileges on table public.payment_webhook_events from public, anon, authenticated;

grant select (
  id, order_id, user_id, provider, mode, status, amount_cents, currency,
  expires_at, created_at, updated_at
) on table public.payment_sessions to authenticated;

grant select (
  id, payment_session_id, order_id, event_type, before_status, after_status,
  amount_cents, provider, reason, created_at
) on table public.payment_events to authenticated;

grant all privileges on table public.payment_sessions to service_role;
grant all privileges on table public.payment_events to service_role;
grant all privileges on table public.payment_webhook_events to service_role;

create policy "payment_sessions_select_own"
on public.payment_sessions
for select
to authenticated
using ((select auth.uid()) is not null and user_id = (select auth.uid()));

create policy "payment_events_select_own_order"
on public.payment_events
for select
to authenticated
using (
  exists (
    select 1
    from public.orders
    where orders.id = payment_events.order_id
      and orders.user_id = (select auth.uid())
  )
);

create policy "payment_sessions_service_role_all"
on public.payment_sessions
for all
to service_role
using (true)
with check (true);

create policy "payment_events_service_role_all"
on public.payment_events
for all
to service_role
using (true)
with check (true);

create policy "payment_webhook_events_service_role_all"
on public.payment_webhook_events
for all
to service_role
using (true)
with check (true);

create function public.create_disabled_checkout_session(
  p_order_id uuid,
  p_user_id uuid
)
returns table (payment_session_id uuid, was_created boolean)
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_order public.orders%rowtype;
  v_session_id uuid;
  v_idempotency_key text;
begin
  if p_order_id is null or p_user_id is null then
    raise exception using errcode = 'P0001', message = 'CHECKOUT_INVALID_INPUT';
  end if;

  select *
  into v_order
  from public.orders
  where id = p_order_id
  for update;

  if not found then
    raise exception using errcode = 'P0001', message = 'CHECKOUT_ORDER_NOT_FOUND';
  end if;

  if v_order.user_id is distinct from p_user_id then
    raise exception using errcode = 'P0001', message = 'CHECKOUT_ORDER_FORBIDDEN';
  end if;

  if v_order.status not in ('draft', 'pending_payment')
    or v_order.payment_status not in ('unpaid', 'pending')
    or v_order.total_cents < 0 then
    raise exception using errcode = 'P0001', message = 'CHECKOUT_ORDER_NOT_ELIGIBLE';
  end if;

  v_idempotency_key := 'stage16-disabled-checkout:' || p_order_id::text;

  insert into public.payment_sessions (
    order_id,
    user_id,
    provider,
    mode,
    status,
    amount_cents,
    currency,
    provider_payment_url,
    idempotency_key,
    metadata
  ) values (
    v_order.id,
    v_order.user_id,
    'disabled',
    'disabled',
    'created',
    v_order.total_cents,
    v_order.currency,
    null,
    v_idempotency_key,
    jsonb_build_object('stage', 'stage16_payment_foundation')
  )
  on conflict (idempotency_key) do nothing
  returning id into v_session_id;

  if v_session_id is null then
    select id
    into v_session_id
    from public.payment_sessions
    where idempotency_key = v_idempotency_key;

    return query select v_session_id, false;
    return;
  end if;

  insert into public.payment_events (
    payment_session_id,
    order_id,
    event_type,
    before_status,
    after_status,
    amount_cents,
    provider,
    reason,
    metadata
  ) values (
    v_session_id,
    v_order.id,
    'checkout_session_created',
    null,
    'created',
    v_order.total_cents,
    'disabled',
    'Stage 16 disabled checkout preparation only.',
    jsonb_build_object('mode', 'disabled')
  );

  insert into public.order_events (
    order_id,
    actor_user_id,
    event_type,
    reason,
    metadata
  ) values (
    v_order.id,
    p_user_id,
    'checkout_session_created',
    'Stage 16 disabled checkout preparation only.',
    jsonb_build_object('payment_session_id', v_session_id, 'mode', 'disabled')
  );

  return query select v_session_id, true;
end;
$function$;

revoke all on function public.create_disabled_checkout_session(uuid, uuid) from public, anon, authenticated;
grant execute on function public.create_disabled_checkout_session(uuid, uuid) to service_role;
