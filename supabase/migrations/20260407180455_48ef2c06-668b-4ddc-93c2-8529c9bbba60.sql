
-- Drop overly permissive admin policies on pedidos
DROP POLICY IF EXISTS "Admins full access to pedidos" ON public.pedidos;
DROP POLICY IF EXISTS "Admins can insert any order" ON public.pedidos;

-- Super Admins: full access to ALL pedidos (cross-tenant)
CREATE POLICY "Super admins full access to pedidos"
  ON public.pedidos
  FOR ALL
  TO authenticated
  USING (public.is_super_admin())
  WITH CHECK (public.is_super_admin());

-- Regular Admins: scoped to their own organization
CREATE POLICY "Admins can view own org pedidos"
  ON public.pedidos
  FOR SELECT
  TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin'::app_role)
    AND organizacion_id = public.get_user_org_id()
  );

CREATE POLICY "Admins can insert own org pedidos"
  ON public.pedidos
  FOR INSERT
  TO authenticated
  WITH CHECK (
    public.has_role(auth.uid(), 'admin'::app_role)
    AND organizacion_id = public.get_user_org_id()
  );

CREATE POLICY "Admins can update own org pedidos"
  ON public.pedidos
  FOR UPDATE
  TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin'::app_role)
    AND organizacion_id = public.get_user_org_id()
  )
  WITH CHECK (
    public.has_role(auth.uid(), 'admin'::app_role)
    AND organizacion_id = public.get_user_org_id()
  );

CREATE POLICY "Admins can delete own org pedidos"
  ON public.pedidos
  FOR DELETE
  TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin'::app_role)
    AND organizacion_id = public.get_user_org_id()
  );
