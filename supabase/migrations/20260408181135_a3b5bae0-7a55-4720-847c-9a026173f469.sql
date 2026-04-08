
-- Step 1: Rename the enum value
ALTER TYPE public.app_role RENAME VALUE 'coordinador_rutas' TO 'aliado_logistico';

-- Step 2: Drop old RLS policies that referenced coordinador_rutas
DROP POLICY IF EXISTS "Coordinadores can view orders" ON public.pedidos;
DROP POLICY IF EXISTS "Coordinadores can update orders" ON public.pedidos;
DROP POLICY IF EXISTS "Coordinadores can view status logs" ON public.pedido_status_logs;
DROP POLICY IF EXISTS "Coordinadores can insert status logs" ON public.pedido_status_logs;
DROP POLICY IF EXISTS "Coordinadores can view profiles" ON public.profiles;
DROP POLICY IF EXISTS "Coordinadores can view user roles" ON public.user_roles;

-- Step 3: Recreate policies with aliado_logistico + cross-tenant visibility

-- Aliados can view ALL pedidos (cross-tenant for 4PL dispatch)
CREATE POLICY "Aliados logisticos can view all pedidos"
  ON public.pedidos FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'aliado_logistico'::app_role));

-- Aliados can update pedidos in their org (for assignment)
CREATE POLICY "Aliados logisticos can update orders"
  ON public.pedidos FOR UPDATE TO authenticated
  USING (has_role(auth.uid(), 'aliado_logistico'::app_role) AND organizacion_id = get_user_org_id())
  WITH CHECK (has_role(auth.uid(), 'aliado_logistico'::app_role) AND organizacion_id = get_user_org_id());

-- Aliados can view status logs in their org
CREATE POLICY "Aliados logisticos can view status logs"
  ON public.pedido_status_logs FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'aliado_logistico'::app_role) AND organizacion_id = get_user_org_id());

-- Aliados can insert status logs
CREATE POLICY "Aliados logisticos can insert status logs"
  ON public.pedido_status_logs FOR INSERT TO authenticated
  WITH CHECK (has_role(auth.uid(), 'aliado_logistico'::app_role));

-- Aliados can view ALL profiles (cross-tenant for dispatch)
CREATE POLICY "Aliados logisticos can view all profiles"
  ON public.profiles FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'aliado_logistico'::app_role));

-- Aliados can view user roles in their org
CREATE POLICY "Aliados logisticos can view user roles"
  ON public.user_roles FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'aliado_logistico'::app_role) AND organizacion_id = get_user_org_id());
