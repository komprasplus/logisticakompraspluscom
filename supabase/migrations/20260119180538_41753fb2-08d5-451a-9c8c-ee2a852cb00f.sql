-- Drop existing motorizado policies and recreate with clearer logic
DROP POLICY IF EXISTS "Motorizados view assigned orders" ON public.pedidos;
DROP POLICY IF EXISTS "Motorizados update assigned orders" ON public.pedidos;

-- Create improved policy for motorizados to view their assigned orders (today only)
CREATE POLICY "Motorizados view assigned orders"
ON public.pedidos
FOR SELECT
TO authenticated
USING (
  has_role(auth.uid(), 'motorizado') 
  AND motorizado_asignado = (SELECT full_name FROM profiles WHERE user_id = auth.uid())
  AND date(fecha_creacion) = CURRENT_DATE
);

-- Create improved policy for motorizados to update their assigned orders
CREATE POLICY "Motorizados update assigned orders"
ON public.pedidos
FOR UPDATE
TO authenticated
USING (
  has_role(auth.uid(), 'motorizado') 
  AND motorizado_asignado = (SELECT full_name FROM profiles WHERE user_id = auth.uid())
)
WITH CHECK (
  has_role(auth.uid(), 'motorizado') 
  AND motorizado_asignado = (SELECT full_name FROM profiles WHERE user_id = auth.uid())
);