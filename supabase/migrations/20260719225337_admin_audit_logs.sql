create table if not exists public.admin_audit_logs (
  id uuid primary key default gen_random_uuid(),
  actor_user_id uuid references auth.users (id) on delete set null,
  actor_email text,
  actor_role text,
  target_user_id uuid references auth.users (id) on delete set null,
  target_email text,
  action text not null,
  resource_type text not null,
  resource_id text,
  before_data jsonb,
  after_data jsonb,
  reason text,
  ip_hash text,
  user_agent text,
  metadata jsonb,
  created_at timestamptz not null default now(),
  constraint admin_audit_logs_action_check check (length(action) between 1 and 100),
  constraint admin_audit_logs_resource_type_check check (length(resource_type) between 1 and 100),
  constraint admin_audit_logs_before_data_size_check check (before_data is null or pg_column_size(before_data) <= 32768),
  constraint admin_audit_logs_after_data_size_check check (after_data is null or pg_column_size(after_data) <= 32768),
  constraint admin_audit_logs_metadata_size_check check (metadata is null or pg_column_size(metadata) <= 32768)
);

comment on table public.admin_audit_logs is
  'Append-only administrative audit trail. Writes are restricted to the server-side admin client.';

create index if not exists admin_audit_logs_created_at_idx
  on public.admin_audit_logs (created_at desc);

create index if not exists admin_audit_logs_actor_created_at_idx
  on public.admin_audit_logs (actor_user_id, created_at desc)
  where actor_user_id is not null;

create index if not exists admin_audit_logs_action_created_at_idx
  on public.admin_audit_logs (action, created_at desc);

alter table public.admin_audit_logs enable row level security;

revoke all privileges on table public.admin_audit_logs from public, anon, authenticated;
revoke all privileges on table public.admin_audit_logs from service_role;

grant select on table public.admin_audit_logs to authenticated;
grant select, insert on table public.admin_audit_logs to service_role;

create policy "admin_audit_logs_select_admin_owner"
on public.admin_audit_logs
for select
to authenticated
using ((select private.current_user_role()) in ('admin', 'owner'));
