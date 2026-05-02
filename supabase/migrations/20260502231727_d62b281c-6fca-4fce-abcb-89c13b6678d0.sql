-- Fix infinite recursion: pedidos policy referenced order_items whose own policy
-- referenced pedidos back. Replace with SECURITY DEFINER helper.

DROP POLICY IF EXISTS "Proveedores view supplier pedidos" ON public.pedidos;
DROP POLICY IF EXISTS "Proveedores update supplier pedidos" ON public.pedidos;

CREATE OR REPLACE FUNCTION public.is_supplier_of_pedido(_pedido_id bigint, _user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.order_items
    WHERE pedido_id = _pedido_id
      AND supplier_user_id = _user_id
  );
$$;

CREATE POLICY "Proveedores view supplier pedidos"
ON public.pedidos
FOR SELECT
TO authenticated
USING (
  has_role(auth.uid(), 'cliente'::app_role)
  AND public.is_supplier_of_pedido(pedidos.id, auth.uid())
);

CREATE POLICY "Proveedores update supplier pedidos"
ON public.pedidos
FOR UPDATE
TO authenticated
USING (
  has_role(auth.uid(), 'cliente'::app_role)
  AND public.is_supplier_of_pedido(pedidos.id, auth.uid())
)
WITH CHECK (
  has_role(auth.uid(), 'cliente'::app_role)
  AND public.is_supplier_of_pedido(pedidos.id, auth.uid())
);