CREATE TABLE public.hub_chat_threads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL,
  title text NOT NULL DEFAULT 'New chat',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.hub_chat_threads TO authenticated;
GRANT ALL ON public.hub_chat_threads TO service_role;
ALTER TABLE public.hub_chat_threads ENABLE ROW LEVEL SECURITY;
CREATE POLICY "owner manages chat threads" ON public.hub_chat_threads FOR ALL TO authenticated
  USING (owner_id = public.hub_owner_uid()) WITH CHECK (owner_id = public.hub_owner_uid());
CREATE INDEX hub_chat_threads_owner_idx ON public.hub_chat_threads(owner_id, updated_at DESC);

CREATE TABLE public.hub_chat_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  thread_id uuid NOT NULL REFERENCES public.hub_chat_threads(id) ON DELETE CASCADE,
  owner_id uuid NOT NULL,
  message_id text NOT NULL,
  role text NOT NULL,
  parts jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (thread_id, message_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.hub_chat_messages TO authenticated;
GRANT ALL ON public.hub_chat_messages TO service_role;
ALTER TABLE public.hub_chat_messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "owner manages chat messages" ON public.hub_chat_messages FOR ALL TO authenticated
  USING (owner_id = public.hub_owner_uid()) WITH CHECK (owner_id = public.hub_owner_uid());
CREATE INDEX hub_chat_messages_thread_idx ON public.hub_chat_messages(thread_id, created_at);