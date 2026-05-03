
-- 1) Permitir a proveedores leer order_items de pedidos en preparación de su organización
DROP POLICY IF EXISTS "Proveedores view order_items en_preparacion" ON public.order_items;
CREATE POLICY "Proveedores view order_items en_preparacion"
ON public.order_items
FOR SELECT
TO authenticated
USING (
  public.is_proveedor_account(auth.uid())
  AND organizacion_id = public.get_user_org_id()
  AND EXISTS (
    SELECT 1 FROM public.pedidos p
    WHERE p.id = order_items.pedido_id
      AND p.estado = 'en_preparacion'
      AND p.organizacion_id = public.get_user_org_id()
  )
);

-- 2) Reemplazar política de UPDATE en pedidos con WITH CHECK más permisivo para transiciones
DROP POLICY IF EXISTS "Proveedores update en_preparacion pedidos" ON public.pedidos;
CREATE POLICY "Proveedores update en_preparacion pedidos"
ON public.pedidos
FOR UPDATE
TO authenticated
USING (
  public.is_proveedor_account(auth.uid())
  AND estado = 'en_preparacion'
  AND organizacion_id = public.get_user_org_id()
)
WITH CHECK (
  public.is_proveedor_account(auth.uid())
  AND organizacion_id = public.get_user_org_id()
  AND estado IN ('despachado','en_preparacion','listo_despacho','Recibido en Bodega')
);
