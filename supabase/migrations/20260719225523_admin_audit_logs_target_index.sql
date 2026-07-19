create index if not exists admin_audit_logs_target_created_at_idx
  on public.admin_audit_logs (target_user_id, created_at desc)
  where target_user_id is not null;
