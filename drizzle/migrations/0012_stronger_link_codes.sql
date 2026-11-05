CREATE TABLE public.hub_link_attempts (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id uuid NOT NULL,
  attempted_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.hub_link_attempts TO service_role;
ALTER TABLE public.hub_link_attempts ENABLE ROW LEVEL SECURITY;
CREATE INDEX hub_link_attempts_user_at ON public.hub_link_attempts (user_id, attempted_at);
CREATE INDEX hub_link_attempts_at ON public.hub_link_attempts (attempted_at);

-- 20 characters from a 32-letter alphabet (no 0/O/1/I) = 100 bits, shown as XXXXX-XXXXX-XXXXX-XXXXX.
CREATE OR REPLACE FUNCTION public.create_link_code()
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, extensions AS $$
DECLARE oid uuid := public.hub_owner_uid(); code text := ''; b bytea; alphabet text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; i int;
BEGIN
  IF oid IS NULL THEN RAISE EXCEPTION 'Only the owner can create link codes'; END IF;
  b := extensions.gen_random_bytes(20);
  FOR i IN 0..19 LOOP
    IF i > 0 AND i % 5 = 0 THEN code := code || '-'; END IF;
    code := code || substr(alphabet, (get_byte(b, i) % 32) + 1, 1);
  END LOOP;
  DELETE FROM public.hub_link_codes WHERE owner_id = oid AND used_at IS NULL;
  INSERT INTO public.hub_link_codes (code_hash, owner_id, expires_at)
    VALUES (encode(extensions.digest(code, 'sha256'), 'hex'), oid, now() + interval '10 minutes');
  RETURN code;
END $$;
REVOKE ALL ON FUNCTION public.create_link_code() FROM public, anon;
GRANT EXECUTE ON FUNCTION public.create_link_code() TO authenticated;

-- Wrong codes return false (so the failed attempt is kept); 5 misses per account per 15 min locks out,
-- and 20 misses across everyone in 10 min cancels any unused code.
CREATE OR REPLACE FUNCTION public.redeem_link_code(_code text)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, extensions AS $$
DECLARE uid uuid := auth.uid(); confirmed timestamptz; em text; prov text; c public.hub_link_codes; norm text;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'Sign in first'; END IF;
  IF public.is_hub_owner(uid) THEN RETURN true; END IF;
  SELECT email_confirmed_at, email, raw_app_meta_data->>'provider' INTO confirmed, em, prov FROM auth.users WHERE id = uid;
  IF confirmed IS NULL THEN RAISE EXCEPTION 'Confirm your email first'; END IF;
  DELETE FROM public.hub_link_attempts WHERE attempted_at < now() - interval '1 day';
  IF (SELECT count(*) FROM public.hub_link_attempts WHERE user_id = uid AND attempted_at > now() - interval '15 minutes') >= 5 THEN
    RAISE EXCEPTION 'Too many wrong codes. Wait 15 minutes and ask for a new code.';
  END IF;
  norm := upper(regexp_replace(coalesce(_code, ''), '\s', '', 'g'));
  SELECT * INTO c FROM public.hub_link_codes
    WHERE code_hash = encode(extensions.digest(norm, 'sha256'), 'hex') FOR UPDATE;
  IF c.code_hash IS NULL OR c.used_at IS NOT NULL OR c.expires_at < now() THEN
    INSERT INTO public.hub_link_attempts (user_id) VALUES (uid);
    IF (SELECT count(*) FROM public.hub_link_attempts WHERE attempted_at > now() - interval '10 minutes') >= 20 THEN
      DELETE FROM public.hub_link_codes WHERE used_at IS NULL;
    END IF;
    RETURN false;
  END IF;
  UPDATE public.hub_link_codes SET used_at = now() WHERE code_hash = c.code_hash;
  INSERT INTO public.hub_linked_logins (user_id, owner_id, provider, email) VALUES (uid, c.owner_id, prov, em);
  RETURN true;
END $$;
REVOKE ALL ON FUNCTION public.redeem_link_code(text) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.redeem_link_code(text) TO authenticated;

-- Old short codes stop working right away.
DELETE FROM public.hub_link_codes WHERE used_at IS NULL;