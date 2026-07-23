-- Stage 15: read-only order foundation.
-- This migration creates order storage and member-owned read policies only.
-- It does not implement checkout, payments, refunds, fulfillment, inventory,
-- points, product entitlements, email notifications, or hard deletes.

create table if not exists public.orders (
  id uuid primary key default gen_random_uuid(),
  order_number text not null unique,
  user_id uuid references auth.users (id) on delete set null,
  buyer_email text,
  status text not null default 'draft',
  payment_status text not null default 'unpaid',
  fulfillment_status text not null default 'unfulfilled',
  currency text not null default 'TWD',
  subtotal_cents integer not null default 0,
  discount_cents integer not null default 0,
  total_cents integer not null default 0,
  points_earned integer not null default 0,
  points_redeemed integer not null default 0,
  payment_provider text,
  payment_reference text,
  note text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint orders_order_number_length_check check (char_length(order_number) between 1 and 80),
  constraint orders_buyer_email_length_check check (buyer_email is null or char_length(buyer_email) <= 320),
  constraint orders_status_check check (
    status in ('draft', 'pending_payment', 'paid', 'cancelled', 'refunded', 'fulfilled')
  ),
  constraint orders_payment_status_check check (
    payment_status in ('unpaid', 'pending', 'paid', 'failed', 'refunded')
  ),
  constraint orders_fulfillment_status_check check (
    fulfillment_status in ('unfulfilled', 'partial', 'fulfilled', 'cancelled')
  ),
  constraint orders_currency_check check (currency = 'TWD'),
  constraint orders_amounts_nonnegative_check check (
    subtotal_cents >= 0
    and discount_cents >= 0
    and total_cents >= 0
    and points_earned >= 0
    and points_redeemed >= 0
  ),
  constraint orders_payment_provider_length_check check (
    payment_provider is null or char_length(payment_provider) <= 100
  ),
  constraint orders_payment_reference_length_check check (
    payment_reference is null or char_length(payment_reference) <= 500
  ),
  constraint orders_note_length_check check (note is null or char_length(note) <= 5000),
  constraint orders_metadata_size_check check (pg_column_size(metadata) <= 16384)
);

create table if not exists public.order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders (id) on delete cascade,
  product_id uuid references public.products (id) on delete set null,
  product_name text not null,
  product_slug text,
  quantity integer not null default 1,
  unit_price_cents integer not null default 0,
  total_cents integer not null default 0,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint order_items_product_name_length_check check (char_length(product_name) between 1 and 200),
  constraint order_items_product_slug_length_check check (
    product_slug is null or char_length(product_slug) <= 160
  ),
  constraint order_items_quantity_positive_check check (quantity > 0),
  constraint order_items_amounts_nonnegative_check check (
    unit_price_cents >= 0 and total_cents >= 0
  ),
  constraint order_items_total_consistency_check check (
    total_cents = unit_price_cents * quantity
  ),
  constraint order_items_metadata_size_check check (pg_column_size(metadata) <= 16384)
);

create table if not exists public.order_events (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders (id) on delete cascade,
  actor_user_id uuid references auth.users (id) on delete set null,
  event_type text not null,
  before_data jsonb,
  after_data jsonb,
  reason text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint order_events_event_type_length_check check (char_length(event_type) between 1 and 100),
  constraint order_events_reason_length_check check (reason is null or char_length(reason) <= 1000),
  constraint order_events_before_data_size_check check (
    before_data is null or pg_column_size(before_data) <= 16384
  ),
  constraint order_events_after_data_size_check check (
    after_data is null or pg_column_size(after_data) <= 16384
  ),
  constraint order_events_metadata_size_check check (pg_column_size(metadata) <= 16384)
);

comment on table public.orders is
  'Stage 15 order foundation. No checkout, payment processing, points, inventory, or entitlement behavior is attached.';
comment on table public.order_items is
  'Immutable order line snapshots for Stage 15 read-only order queries.';
comment on table public.order_events is
  'Order lifecycle history. Members receive only a safe read-only column subset.';

create index if not exists orders_user_created_at_idx
  on public.orders (user_id, created_at desc);
create index if not exists orders_status_created_at_idx
  on public.orders (status, created_at desc);
create index if not exists orders_payment_status_created_at_idx
  on public.orders (payment_status, created_at desc);
create index if not exists orders_buyer_email_idx
  on public.orders (lower(buyer_email));
create index if not exists order_items_order_id_idx
  on public.order_items (order_id);
create index if not exists order_items_product_id_idx
  on public.order_items (product_id);
create index if not exists order_events_order_created_at_idx
  on public.order_events (order_id, created_at);
create index if not exists order_events_actor_user_id_idx
  on public.order_events (actor_user_id);

create function public.set_orders_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $function$
begin
  new.updated_at = now();
  return new;
end;
$function$;

revoke all on function public.set_orders_updated_at() from public, anon, authenticated;

create trigger orders_set_updated_at
before update on public.orders
for each row execute function public.set_orders_updated_at();

alter table public.orders enable row level security;
alter table public.order_items enable row level security;
alter table public.order_events enable row level security;

revoke all privileges on table public.orders from public, anon, authenticated;
revoke all privileges on table public.order_items from public, anon, authenticated;
revoke all privileges on table public.order_events from public, anon, authenticated;

grant select (
  id, order_number, user_id, buyer_email, status, payment_status,
  fulfillment_status, currency, subtotal_cents, discount_cents,
  total_cents, points_earned, points_redeemed, created_at, updated_at
) on table public.orders to authenticated;

grant select (
  id, order_id, product_id, product_name, product_slug, quantity,
  unit_price_cents, total_cents, created_at
) on table public.order_items to authenticated;

grant select (
  id, order_id, event_type, reason, created_at
) on table public.order_events to authenticated;

grant all privileges on table public.orders to service_role;
grant all privileges on table public.order_items to service_role;
grant all privileges on table public.order_events to service_role;

create policy "orders_select_own"
on public.orders
for select
to authenticated
using ((select auth.uid()) is not null and (select auth.uid()) = user_id);

create policy "order_items_select_own_order"
on public.order_items
for select
to authenticated
using (
  exists (
    select 1
    from public.orders
    where orders.id = order_items.order_id
      and orders.user_id = (select auth.uid())
  )
);

create policy "order_events_select_own_order"
on public.order_events
for select
to authenticated
using (
  exists (
    select 1
    from public.orders
    where orders.id = order_events.order_id
      and orders.user_id = (select auth.uid())
  )
);

create policy "orders_service_role_all"
on public.orders
for all
to service_role
using (true)
with check (true);

create policy "order_items_service_role_all"
on public.order_items
for all
to service_role
using (true)
with check (true);

create policy "order_events_service_role_all"
on public.order_events
for all
to service_role
using (true)
with check (true);
