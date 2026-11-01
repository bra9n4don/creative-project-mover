CREATE TABLE public.hub_owner (
  id text PRIMARY KEY DEFAULT 'personal' CHECK (id = 'personal'),
  user_id uuid NOT NULL UNIQUE,
  github_sync_enabled boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.hub_workspaces (
  owner_id uuid PRIMARY KEY,
  data jsonb NOT NULL,
  rev integer NOT NULL DEFAULT 1,
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.hub_agent_keys (
  owner_id uuid NOT NULL,
  client_id text NOT NULL,
  hash text NOT NULL UNIQUE,
  prefix text NOT NULL,
  expires_at timestamptz NOT NULL,
  last_seen timestamptz,
  PRIMARY KEY (owner_id, client_id)
);
-- Maps original Clerk user IDs from the Replit app to Lovable auth users (server-only).
CREATE TABLE public.legacy_user_map (
  legacy_user_id text PRIMARY KEY,
  email text NOT NULL,
  auth_user_id uuid UNIQUE,
  linked_at timestamptz
);

GRANT SELECT ON public.hub_owner TO authenticated;
GRANT ALL ON public.hub_owner TO service_role;
GRANT SELECT, INSERT, UPDATE ON public.hub_workspaces TO authenticated;
GRANT ALL ON public.hub_workspaces TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.hub_agent_keys TO authenticated;
GRANT ALL ON public.hub_agent_keys TO service_role;
GRANT ALL ON public.legacy_user_map TO service_role;

ALTER TABLE public.hub_owner ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hub_workspaces ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hub_agent_keys ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.legacy_user_map ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.is_hub_owner(_uid uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.hub_owner WHERE user_id = _uid)
$$;

-- Single-owner claim: the first verified-email user claims the hub; everyone else is denied.
CREATE OR REPLACE FUNCTION public.claim_hub()
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE uid uuid := auth.uid(); confirmed timestamptz;
BEGIN
  IF uid IS NULL THEN RETURN false; END IF;
  SELECT email_confirmed_at INTO confirmed FROM auth.users WHERE id = uid;
  IF confirmed IS NULL THEN RETURN false; END IF;
  INSERT INTO public.hub_owner (id, user_id) VALUES ('personal', uid) ON CONFLICT (id) DO NOTHING;
  RETURN EXISTS (SELECT 1 FROM public.hub_owner WHERE user_id = uid);
END $$;
REVOKE ALL ON FUNCTION public.claim_hub() FROM public, anon;
GRANT EXECUTE ON FUNCTION public.claim_hub() TO authenticated;

CREATE POLICY "owner reads owner row" ON public.hub_owner FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "owner reads workspace" ON public.hub_workspaces FOR SELECT TO authenticated USING (owner_id = auth.uid() AND public.is_hub_owner(auth.uid()));
CREATE POLICY "owner inserts workspace" ON public.hub_workspaces FOR INSERT TO authenticated WITH CHECK (owner_id = auth.uid() AND public.is_hub_owner(auth.uid()));
CREATE POLICY "owner updates workspace" ON public.hub_workspaces FOR UPDATE TO authenticated USING (owner_id = auth.uid() AND public.is_hub_owner(auth.uid())) WITH CHECK (owner_id = auth.uid());
CREATE POLICY "owner manages keys" ON public.hub_agent_keys FOR ALL TO authenticated USING (owner_id = auth.uid() AND public.is_hub_owner(auth.uid())) WITH CHECK (owner_id = auth.uid() AND public.is_hub_owner(auth.uid()));