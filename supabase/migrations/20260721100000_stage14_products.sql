-- Stage 14: product database foundation.
-- Adds public.products with draft/published/archived lifecycle, a public read policy for
-- published rows only, and service-role-only write access. This migration does not create
-- orders, payments, carts, coupons, downloads, or any checkout flow, and never touches
-- profiles, points, tiers, admin_audit_logs, or their RLS.

create table if not exists public.products (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  subtitle text,
  description text,
  product_type text not null default 'other',
  category text,
  price_cents integer not null default 0,
  compare_at_price_cents integer,
  currency text not null default 'TWD',
  image_url text,
  status text not null default 'draft',
  stock_status text not null default 'in_stock',
  inventory_quantity integer,
  is_featured boolean not null default false,
  sort_order integer not null default 0,
  metadata jsonb not null default '{}'::jsonb,
  created_by uuid references auth.users (id) on delete set null,
  updated_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint products_slug_format_check check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$' and char_length(slug) between 1 and 160),
  constraint products_name_length_check check (char_length(name) between 1 and 200),
  constraint products_subtitle_length_check check (subtitle is null or char_length(subtitle) <= 200),
  constraint products_description_length_check check (description is null or char_length(description) <= 5000),
  constraint products_category_length_check check (category is null or char_length(category) <= 100),
  constraint products_product_type_check check (
    product_type in ('course', 'digital', 'physical', 'service', 'food', 'other')
  ),
  constraint products_status_check check (status in ('draft', 'published', 'archived')),
  constraint products_stock_status_check check (
    stock_status in ('in_stock', 'out_of_stock', 'preorder', 'unlimited')
  ),
  constraint products_price_cents_nonnegative_check check (price_cents >= 0),
  constraint products_compare_at_price_cents_nonnegative_check check (
    compare_at_price_cents is null or compare_at_price_cents >= 0
  ),
  constraint products_inventory_quantity_nonnegative_check check (
    inventory_quantity is null or inventory_quantity >= 0
  ),
  constraint products_currency_check check (currency = 'TWD'),
  constraint products_metadata_size_check check (pg_column_size(metadata) <= 16384)
);

comment on table public.products is
  'Stage 14 product catalog. Public read is limited to published rows; all writes go through the server-side admin client. No orders, payments, or entitlements are stored here.';
comment on column public.products.price_cents is
  'Price in the smallest currency unit (TWD stored as dollars x 100).';
comment on column public.products.status is
  'Lifecycle: draft (hidden), published (public), archived (soft-deleted, never hard-deleted).';

create index if not exists products_status_sort_idx
  on public.products (status, is_featured desc, sort_order, created_at desc);
create index if not exists products_product_type_idx
  on public.products (product_type);
create index if not exists products_status_created_at_idx
  on public.products (status, created_at desc);

alter table public.products enable row level security;

revoke all privileges on table public.products from public, anon, authenticated;
grant select on table public.products to anon, authenticated;
grant all privileges on table public.products to service_role;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'products'
      and policyname = 'products_select_published'
  ) then
    create policy "products_select_published"
    on public.products
    for select
    to anon, authenticated
    using (status = 'published');
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'products'
      and policyname = 'products_service_role_all'
  ) then
    create policy "products_service_role_all"
    on public.products
    for all
    to service_role
    using (true)
    with check (true);
  end if;
end $$;
