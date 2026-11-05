CREATE OR REPLACE FUNCTION public.make_primary_login(_user_id uuid)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE oid uuid := public.hub_owner_uid(); em text; prov text;
BEGIN
  IF oid IS NULL THEN RAISE EXCEPTION 'Only the owner can change the main sign-in'; END IF;
  IF _user_id = oid THEN RETURN true; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.hub_linked_logins WHERE user_id = _user_id AND owner_id = oid) THEN
    RAISE EXCEPTION 'That sign-in is not linked to this workspace';
  END IF;
  SELECT email, raw_app_meta_data->>'provider' INTO em, prov FROM auth.users WHERE id = oid;
  DELETE FROM public.hub_linked_logins WHERE user_id = _user_id;
  UPDATE public.hub_owner SET user_id = _user_id WHERE user_id = oid;
  UPDATE public.hub_workspaces SET owner_id = _user_id WHERE owner_id = oid;
  UPDATE public.hub_agent_keys SET owner_id = _user_id WHERE owner_id = oid;
  UPDATE public.hub_link_codes SET owner_id = _user_id WHERE owner_id = oid;
  UPDATE public.hub_linked_logins SET owner_id = _user_id WHERE owner_id = oid;
  INSERT INTO public.hub_linked_logins (user_id, owner_id, provider, email) VALUES (oid, _user_id, prov, em);
  RETURN true;
END $$;
REVOKE ALL ON FUNCTION public.make_primary_login(uuid) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.make_primary_login(uuid) TO authenticated;