REVOKE EXECUTE ON FUNCTION public.is_hub_owner(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_hub_owner(uuid) TO authenticated, service_role;