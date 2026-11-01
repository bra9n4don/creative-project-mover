ALTER TABLE public.hub_owner
  ADD COLUMN last_sync_at timestamptz,
  ADD COLUMN last_sync_ok boolean,
  ADD COLUMN last_sync_message text,
  ADD COLUMN last_sync_trigger text;