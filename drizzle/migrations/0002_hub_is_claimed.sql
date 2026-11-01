CREATE OR REPLACE FUNCTION public.hub_is_claimed()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.hub_owner WHERE user_id IS NOT NULL)
$$;
REVOKE ALL ON FUNCTION public.hub_is_claimed() FROM public;
GRANT EXECUTE ON FUNCTION public.hub_is_claimed() TO anon, authenticated, service_role;