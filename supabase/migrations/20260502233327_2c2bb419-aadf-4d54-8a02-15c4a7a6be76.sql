-- Helper: detect proveedor accounts without recursion
CREATE OR REPLACE FUNCTION public.is_proveedor_account(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE user_id = _user_id
      AND tipo_cuenta = 'proveedor'
  );
$$;

-- Allow proveedores to SEE pedidos en_preparacion in their org
DROP POLICY IF EXISTS "Proveedores view en_preparacion pedidos" ON public.pedidos;
CREATE POLICY "Proveedores view en_preparacion pedidos"
ON public.pedidos
FOR SELECT
TO authenticated
USING (
  public.is_proveedor_account(auth.uid())
  AND estado = 'en_preparacion'
  AND organizacion_id = public.get_user_org_id()
);

-- Allow proveedores to UPDATE pedidos en_preparacion in their org (to mark as despachado)
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
);