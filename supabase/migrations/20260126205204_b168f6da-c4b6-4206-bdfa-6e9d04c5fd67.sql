-- Create RLS policies for despachador role on pedidos table
-- Despachadores can view all orders (like admin) for dispatch management
CREATE POLICY "Despachadores can view all orders for dispatch"
ON public.pedidos
FOR SELECT
TO authenticated
USING (
  public.has_role(auth.uid(), 'despachador')
);

-- Despachadores can update orders (for assignment only - application will restrict fields)
CREATE POLICY "Despachadores can update orders for assignment"
ON public.pedidos
FOR UPDATE
TO authenticated
USING (public.has_role(auth.uid(), 'despachador'))
WITH CHECK (public.has_role(auth.uid(), 'despachador'));

-- Despachadores can view profiles (needed for motorizado list)
CREATE POLICY "Despachadores can view profiles"
ON public.profiles
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'despachador'));

-- Despachadores can view user roles (needed to filter motorizados)
CREATE POLICY "Despachadores can view user roles"
ON public.user_roles
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'despachador'));