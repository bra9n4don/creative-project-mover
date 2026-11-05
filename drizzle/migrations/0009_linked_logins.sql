CREATE TABLE public.hub_linked_logins (
  user_id uuid PRIMARY KEY,
  owner_id uuid NOT NULL,
  provider text,
  email text,
  linked_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.hub_linked_logins TO authenticated;
GRANT ALL ON public.hub_linked_logins TO service_role;
ALTER TABLE public.hub_linked_logins ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.hub_link_codes (
  code_hash text PRIMARY KEY,
  owner_id uuid NOT NULL,
  expires_at timestamptz NOT NULL,
  used_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.hub_link_codes TO service_role;
ALTER TABLE public.hub_link_codes ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.hub_owner_uid()
RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT COALESCE(
    (SELECT user_id FROM public.hub_owner WHERE user_id = auth.uid()),
    (SELECT l.owner_id FROM public.hub_linked_logins l JOIN public.hub_owner o ON o.user_id = l.owner_id WHERE l.user_id = auth.uid())
  )
$$;
REVOKE ALL ON FUNCTION public.hub_owner_uid() FROM public, anon;
GRANT EXECUTE ON FUNCTION public.hub_owner_uid() TO authenticated;

CREATE OR REPLACE FUNCTION public.is_hub_owner(_uid uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.hub_owner WHERE user_id = _uid)
      OR EXISTS (SELECT 1 FROM public.hub_linked_logins l JOIN public.hub_owner o ON o.user_id = l.owner_id WHERE l.user_id = _uid)
$$;

CREATE OR REPLACE FUNCTION public.claim_hub()
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE uid uuid := auth.uid(); confirmed timestamptz;
BEGIN
  IF uid IS NULL THEN RETURN false; END IF;
  IF public.is_hub_owner(uid) THEN RETURN true; END IF;
  SELECT email_confirmed_at INTO confirmed FROM auth.users WHERE id = uid;
  IF confirmed IS NULL THEN RETURN false; END IF;
  INSERT INTO public.hub_owner (id, user_id) VALUES ('personal', uid) ON CONFLICT (id) DO NOTHING;
  RETURN EXISTS (SELECT 1 FROM public.hub_owner WHERE user_id = uid);
END $$;

CREATE POLICY "owner reads linked logins" ON public.hub_linked_logins FOR SELECT TO authenticated USING (owner_id = public.hub_owner_uid());

CREATE OR REPLACE FUNCTION public.create_link_code()
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, extensions AS $$
DECLARE oid uuid := public.hub_owner_uid(); code text;
BEGIN
  IF oid IS NULL THEN RAISE EXCEPTION 'Only the owner can create link codes'; END IF;
  code := upper(substr(encode(extensions.gen_random_bytes(6), 'hex'), 1, 4) || '-' || substr(encode(extensions.gen_random_bytes(6), 'hex'), 1, 4));
  DELETE FROM public.hub_link_codes WHERE owner_id = oid AND used_at IS NULL;
  INSERT INTO public.hub_link_codes (code_hash, owner_id, expires_at)
    VALUES (encode(extensions.digest(code, 'sha256'), 'hex'), oid, now() + interval '10 minutes');
  RETURN code;
END $$;
REVOKE ALL ON FUNCTION public.create_link_code() FROM public, anon;
GRANT EXECUTE ON FUNCTION public.create_link_code() TO authenticated;

CREATE OR REPLACE FUNCTION public.redeem_link_code(_code text)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, extensions AS $$
DECLARE uid uuid := auth.uid(); confirmed timestamptz; em text; prov text; c public.hub_link_codes;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'Sign in first'; END IF;
  IF public.is_hub_owner(uid) THEN RETURN true; END IF;
  SELECT email_confirmed_at, email, raw_app_meta_data->>'provider' INTO confirmed, em, prov FROM auth.users WHERE id = uid;
  IF confirmed IS NULL THEN RAISE EXCEPTION 'Confirm your email first'; END IF;
  SELECT * INTO c FROM public.hub_link_codes
    WHERE code_hash = encode(extensions.digest(upper(trim(_code)), 'sha256'), 'hex') FOR UPDATE;
  IF c.code_hash IS NULL OR c.used_at IS NOT NULL OR c.expires_at < now() THEN
    RAISE EXCEPTION 'That code is wrong, expired or already used';
  END IF;
  UPDATE public.hub_link_codes SET used_at = now() WHERE code_hash = c.code_hash;
  INSERT INTO public.hub_linked_logins (user_id, owner_id, provider, email) VALUES (uid, c.owner_id, prov, em);
  RETURN true;
END $$;
REVOKE ALL ON FUNCTION public.redeem_link_code(text) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.redeem_link_code(text) TO authenticated;

CREATE OR REPLACE FUNCTION public.unlink_login(_user_id uuid)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE oid uuid := public.hub_owner_uid();
BEGIN
  IF oid IS NULL THEN RAISE EXCEPTION 'Only the owner can remove sign-ins'; END IF;
  IF _user_id = oid THEN RAISE EXCEPTION 'The original sign-in cannot be removed'; END IF;
  IF _user_id = auth.uid() THEN RAISE EXCEPTION 'You cannot remove the sign-in you are using'; END IF;
  DELETE FROM public.hub_linked_logins WHERE user_id = _user_id AND owner_id = oid;
  RETURN FOUND;
END $$;
REVOKE ALL ON FUNCTION public.unlink_login(uuid) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.unlink_login(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.list_hub_logins()
RETURNS TABLE (user_id uuid, provider text, email text, linked_at timestamptz, is_primary boolean, is_current boolean)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT o.user_id, u.raw_app_meta_data->>'provider', u.email::text, o.created_at, true, o.user_id = auth.uid()
    FROM public.hub_owner o JOIN auth.users u ON u.id = o.user_id WHERE o.user_id = public.hub_owner_uid()
  UNION ALL
  SELECT l.user_id, l.provider, l.email, l.linked_at, false, l.user_id = auth.uid()
    FROM public.hub_linked_logins l WHERE l.owner_id = public.hub_owner_uid()
$$;
REVOKE ALL ON FUNCTION public.list_hub_logins() FROM public, anon;
GRANT EXECUTE ON FUNCTION public.list_hub_logins() TO authenticated;

DROP POLICY "owner reads owner row" ON public.hub_owner;
CREATE POLICY "owner reads owner row" ON public.hub_owner FOR SELECT TO authenticated USING (user_id = public.hub_owner_uid());
DROP POLICY "owner reads workspace" ON public.hub_workspaces;
DROP POLICY "owner inserts workspace" ON public.hub_workspaces;
DROP POLICY "owner updates workspace" ON public.hub_workspaces;
CREATE POLICY "owner reads workspace" ON public.hub_workspaces FOR SELECT TO authenticated USING (owner_id = public.hub_owner_uid());
CREATE POLICY "owner inserts workspace" ON public.hub_workspaces FOR INSERT TO authenticated WITH CHECK (owner_id = public.hub_owner_uid());
CREATE POLICY "owner updates workspace" ON public.hub_workspaces FOR UPDATE TO authenticated USING (owner_id = public.hub_owner_uid()) WITH CHECK (owner_id = public.hub_owner_uid());
DROP POLICY "owner manages keys" ON public.hub_agent_keys;
CREATE POLICY "owner manages keys" ON public.hub_agent_keys FOR ALL TO authenticated USING (owner_id = public.hub_owner_uid()) WITH CHECK (owner_id = public.hub_owner_uid());