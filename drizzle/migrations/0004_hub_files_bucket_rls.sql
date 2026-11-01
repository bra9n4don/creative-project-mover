CREATE POLICY "owner reads hub files"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'hub-files' AND public.is_hub_owner(auth.uid()));

CREATE POLICY "owner uploads hub files"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'hub-files' AND public.is_hub_owner(auth.uid()));

CREATE POLICY "owner updates hub files"
ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'hub-files' AND public.is_hub_owner(auth.uid()))
WITH CHECK (bucket_id = 'hub-files' AND public.is_hub_owner(auth.uid()));

CREATE POLICY "owner deletes hub files"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'hub-files' AND public.is_hub_owner(auth.uid()));