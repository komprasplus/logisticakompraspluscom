-- Fix multi-tenant leak: restrict proveedor profile visibility to same organization
DROP POLICY IF EXISTS "Public can view proveedor contact cards" ON public.profiles;

CREATE POLICY "Same-org users can view proveedor profiles"
ON public.profiles
FOR SELECT
TO authenticated
USING (
  tipo_cuenta = 'proveedor'
  AND organizacion_id IS NOT NULL
  AND organizacion_id = public.get_user_org_id()
);