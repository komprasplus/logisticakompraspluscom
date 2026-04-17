-- 1. Add columns
ALTER TABLE public.pedidos
  ADD COLUMN IF NOT EXISTS proveedor_logistico_id uuid;

CREATE INDEX IF NOT EXISTS idx_pedidos_proveedor_logistico
  ON public.pedidos(proveedor_logistico_id)
  WHERE proveedor_logistico_id IS NOT NULL;

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS integration_provider text;

COMMENT ON COLUMN public.profiles.integration_provider IS
  'Identifica integraciones API automáticas para aliados logísticos. Valores: ''dropium'' (Jamv Drive), NULL (manual, ej. Go Milla).';

COMMENT ON COLUMN public.pedidos.proveedor_logistico_id IS
  'UUID del aliado logístico (perfil con rol aliado_logistico) al que se enrutó el pedido en el modelo Multi-Carrier.';

-- 2. Replace SELECT policy for aliado_logistico on pedidos (strict)
DROP POLICY IF EXISTS "Aliados logisticos can view all pedidos" ON public.pedidos;

CREATE POLICY "Aliados logisticos view assigned pedidos"
ON public.pedidos
FOR SELECT
TO authenticated
USING (
  has_role(auth.uid(), 'aliado_logistico'::app_role)
  AND proveedor_logistico_id = auth.uid()
);

-- 3. Update aliado UPDATE policy to also restrict by assignment
DROP POLICY IF EXISTS "Aliados logisticos can update orders" ON public.pedidos;

CREATE POLICY "Aliados logisticos update assigned pedidos"
ON public.pedidos
FOR UPDATE
TO authenticated
USING (
  has_role(auth.uid(), 'aliado_logistico'::app_role)
  AND proveedor_logistico_id = auth.uid()
)
WITH CHECK (
  has_role(auth.uid(), 'aliado_logistico'::app_role)
  AND proveedor_logistico_id = auth.uid()
);

-- 4. Restrict order_items SELECT for aliado to only their assigned pedidos
DROP POLICY IF EXISTS "Aliados logisticos can view order_items" ON public.order_items;

CREATE POLICY "Aliados logisticos view assigned order_items"
ON public.order_items
FOR SELECT
TO authenticated
USING (
  has_role(auth.uid(), 'aliado_logistico'::app_role)
  AND pedido_id IN (
    SELECT id FROM public.pedidos WHERE proveedor_logistico_id = auth.uid()
  )
);

-- 5. Restrict pedido_status_logs SELECT for aliado to assigned pedidos
DROP POLICY IF EXISTS "Aliados logisticos can view status logs" ON public.pedido_status_logs;

CREATE POLICY "Aliados logisticos view assigned status logs"
ON public.pedido_status_logs
FOR SELECT
TO authenticated
USING (
  has_role(auth.uid(), 'aliado_logistico'::app_role)
  AND pedido_id IN (
    SELECT id FROM public.pedidos WHERE proveedor_logistico_id = auth.uid()
  )
);