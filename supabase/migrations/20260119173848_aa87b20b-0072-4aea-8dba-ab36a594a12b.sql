-- First, drop the problematic RLS policies that allow everyone to see everything
DROP POLICY IF EXISTS "Public tracking by guide number" ON public.pedidos;
DROP POLICY IF EXISTS "Ver pedidos propios o todos si es admin" ON public.pedidos;
DROP POLICY IF EXISTS "Permitir inserción a usuarios autenticados" ON public.pedidos;
DROP POLICY IF EXISTS "Usuarios pueden crear sus propios pedidos" ON public.pedidos;

-- Recreate a proper INSERT policy for clients
CREATE POLICY "Clients can insert their own orders"
ON public.pedidos
FOR INSERT
TO authenticated
WITH CHECK (
  has_role(auth.uid(), 'cliente') AND client_user_id = auth.uid()
);

-- Create a separate policy for admins to insert orders (for any client)
CREATE POLICY "Admins can insert any order"
ON public.pedidos
FOR INSERT
TO authenticated
WITH CHECK (is_admin());

-- The existing policies that should remain:
-- "Admins full access to pedidos" - is_admin() - GOOD
-- "Clients view own orders" - has_role + client_user_id = auth.uid() - GOOD  
-- "Motorizados view assigned orders" - GOOD
-- "Motorizados update assigned orders" - GOOD

-- Add an UPDATE policy for clients on their own orders
CREATE POLICY "Clients can update their own orders"
ON public.pedidos
FOR UPDATE
TO authenticated
USING (has_role(auth.uid(), 'cliente') AND client_user_id = auth.uid())
WITH CHECK (has_role(auth.uid(), 'cliente') AND client_user_id = auth.uid());