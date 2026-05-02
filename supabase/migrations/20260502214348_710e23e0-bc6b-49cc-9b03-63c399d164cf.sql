-- Allow admins to manage (update/delete) connected_stores within their organization
CREATE POLICY "Admins can update org stores"
ON public.connected_stores
FOR UPDATE
USING (public.is_super_admin() OR (public.is_admin() AND organizacion_id = public.get_user_org_id()));

CREATE POLICY "Admins can delete org stores"
ON public.connected_stores
FOR DELETE
USING (public.is_super_admin() OR (public.is_admin() AND organizacion_id = public.get_user_org_id()));