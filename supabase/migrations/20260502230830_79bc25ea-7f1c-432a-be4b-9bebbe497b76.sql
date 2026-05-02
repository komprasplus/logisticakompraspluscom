-- Allow proveedor (cliente role with tipo_cuenta='proveedor') to view pedidos
-- containing at least one order_item where supplier_user_id = auth.uid().
CREATE POLICY "Proveedores view supplier pedidos"
ON public.pedidos
FOR SELECT
TO authenticated
USING (
  has_role(auth.uid(), 'cliente'::app_role)
  AND EXISTS (
    SELECT 1 FROM public.order_items oi
    WHERE oi.pedido_id = pedidos.id
      AND oi.supplier_user_id = auth.uid()
  )
);

-- Allow proveedor to update those pedidos (e.g. estado -> 'despachado').
CREATE POLICY "Proveedores update supplier pedidos"
ON public.pedidos
FOR UPDATE
TO authenticated
USING (
  has_role(auth.uid(), 'cliente'::app_role)
  AND EXISTS (
    SELECT 1 FROM public.order_items oi
    WHERE oi.pedido_id = pedidos.id
      AND oi.supplier_user_id = auth.uid()
  )
)
WITH CHECK (
  has_role(auth.uid(), 'cliente'::app_role)
  AND EXISTS (
    SELECT 1 FROM public.order_items oi
    WHERE oi.pedido_id = pedidos.id
      AND oi.supplier_user_id = auth.uid()
  )
);