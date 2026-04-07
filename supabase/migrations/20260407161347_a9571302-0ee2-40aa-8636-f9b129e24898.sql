
-- Allow coordinador_rutas to view all orders in their org
CREATE POLICY "Coordinadores can view orders"
  ON public.pedidos
  FOR SELECT
  TO authenticated
  USING (
    public.has_role(auth.uid(), 'coordinador_rutas'::app_role)
    AND organizacion_id = public.get_user_org_id()
  );

-- Allow coordinador_rutas to update orders (assign motorizados, change status)
CREATE POLICY "Coordinadores can update orders"
  ON public.pedidos
  FOR UPDATE
  TO authenticated
  USING (
    public.has_role(auth.uid(), 'coordinador_rutas'::app_role)
    AND organizacion_id = public.get_user_org_id()
  )
  WITH CHECK (
    public.has_role(auth.uid(), 'coordinador_rutas'::app_role)
    AND organizacion_id = public.get_user_org_id()
  );

-- Allow coordinador_rutas to view profiles (needed for motorizado names)
CREATE POLICY "Coordinadores can view profiles"
  ON public.profiles
  FOR SELECT
  TO authenticated
  USING (
    public.has_role(auth.uid(), 'coordinador_rutas'::app_role)
    AND organizacion_id = public.get_user_org_id()
  );

-- Allow coordinador_rutas to view user roles (needed for filtering motorizados)
CREATE POLICY "Coordinadores can view user roles"
  ON public.user_roles
  FOR SELECT
  TO authenticated
  USING (
    public.has_role(auth.uid(), 'coordinador_rutas'::app_role)
    AND organizacion_id = public.get_user_org_id()
  );

-- Allow coordinador_rutas to insert status logs when updating orders
CREATE POLICY "Coordinadores can insert status logs"
  ON public.pedido_status_logs
  FOR INSERT
  TO authenticated
  WITH CHECK (
    public.has_role(auth.uid(), 'coordinador_rutas'::app_role)
  );

-- Allow coordinador_rutas to view status logs
CREATE POLICY "Coordinadores can view status logs"
  ON public.pedido_status_logs
  FOR SELECT
  TO authenticated
  USING (
    public.has_role(auth.uid(), 'coordinador_rutas'::app_role)
    AND organizacion_id = public.get_user_org_id()
  );
