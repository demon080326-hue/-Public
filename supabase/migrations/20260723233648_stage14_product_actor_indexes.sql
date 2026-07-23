-- Stage 14 follow-up: cover the product audit actor foreign keys.
-- These indexes improve auth.users delete/update checks without changing product data or access rules.

create index if not exists products_created_by_idx
  on public.products (created_by);

create index if not exists products_updated_by_idx
  on public.products (updated_by);
