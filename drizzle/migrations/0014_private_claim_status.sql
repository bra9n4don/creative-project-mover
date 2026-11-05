REVOKE ALL ON FUNCTION public.hub_is_claimed() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.hub_is_claimed() TO authenticated, service_role;
COMMENT ON FUNCTION public.hub_is_claimed() IS 'Signed-in setup check only; anonymous visitors must not learn workspace claim state.';