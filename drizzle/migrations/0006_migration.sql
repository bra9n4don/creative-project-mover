alter table public.hub_owner
  add column if not exists backup_repo text,
  add column if not exists backup_shas jsonb not null default '{}'::jsonb,
  add column if not exists last_backup_at timestamptz,
  add column if not exists last_backup_ok boolean,
  add column if not exists last_backup_message text;