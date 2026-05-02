-- Permitir que proveedores (clientes con tipo_cuenta='proveedor') gestionen sus propios productos del marketplace.
-- La política existente "Admins full access marketplace_products" sigue vigente.

-- INSERT: proveedor crea productos en su organización y como creador
CREATE POLICY "Proveedores can insert own marketplace_products"
ON public.marketplace_products
FOR INSERT
TO authenticated
WITH CHECK (
  has_role(auth.uid(), 'cliente'::app_role)
  AND created_by = auth.uid()
  AND organizacion_id = get_user_org_id()
  AND EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.user_id = auth.uid() AND p.tipo_cuenta = 'proveedor'
  )
);

-- UPDATE: proveedor actualiza solo sus propios productos
CREATE POLICY "Proveedores can update own marketplace_products"
ON public.marketplace_products
FOR UPDATE
TO authenticated
USING (
  has_role(auth.uid(), 'cliente'::app_role)
  AND created_by = auth.uid()
  AND organizacion_id = get_user_org_id()
)
WITH CHECK (
  has_role(auth.uid(), 'cliente'::app_role)
  AND created_by = auth.uid()
  AND organizacion_id = get_user_org_id()
);

-- SELECT: proveedor ve sus propios productos (incluso si están inactivos / borrados, para gestión)
CREATE POLICY "Proveedores can view own marketplace_products"
ON public.marketplace_products
FOR SELECT
TO authenticated
USING (
  has_role(auth.uid(), 'cliente'::app_role)
  AND created_by = auth.uid()
);

-- product_variants: permitir al proveedor gestionar variantes de SUS productos
CREATE POLICY "Proveedores can insert variants of own products"
ON public.product_variants
FOR INSERT
TO authenticated
WITH CHECK (
  has_role(auth.uid(), 'cliente'::app_role)
  AND organizacion_id = get_user_org_id()
  AND EXISTS (
    SELECT 1 FROM public.marketplace_products mp
    WHERE mp.id = product_variants.product_id
      AND mp.created_by = auth.uid()
  )
);

CREATE POLICY "Proveedores can update variants of own products"
ON public.product_variants
FOR UPDATE
TO authenticated
USING (
  has_role(auth.uid(), 'cliente'::app_role)
  AND EXISTS (
    SELECT 1 FROM public.marketplace_products mp
    WHERE mp.id = product_variants.product_id
      AND mp.created_by = auth.uid()
  )
)
WITH CHECK (
  has_role(auth.uid(), 'cliente'::app_role)
  AND EXISTS (
    SELECT 1 FROM public.marketplace_products mp
    WHERE mp.id = product_variants.product_id
      AND mp.created_by = auth.uid()
  )
);

CREATE POLICY "Proveedores can view variants of own products"
ON public.product_variants
FOR SELECT
TO authenticated
USING (
  has_role(auth.uid(), 'cliente'::app_role)
  AND EXISTS (
    SELECT 1 FROM public.marketplace_products mp
    WHERE mp.id = product_variants.product_id
      AND mp.created_by = auth.uid()
  )
);