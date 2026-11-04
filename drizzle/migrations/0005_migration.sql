create or replace function public.hub_oauth_client_name(_client_id uuid)
returns text language sql stable security definer set search_path = public, auth as $$
  select c.client_name from auth.oauth_clients c
  where c.id = _client_id and public.is_hub_owner(auth.uid())
$$;
revoke all on function public.hub_oauth_client_name(uuid) from public, anon;
grant execute on function public.hub_oauth_client_name(uuid) to authenticated;