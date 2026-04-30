-- Add tipo_cuenta and direccion fields to profiles for public signup flow
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS tipo_cuenta TEXT CHECK (tipo_cuenta IN ('dropshipper', 'proveedor')),
  ADD COLUMN IF NOT EXISTS direccion TEXT;

-- Allow new authenticated users to insert their own profile row (needed for public signup)
DROP POLICY IF EXISTS "Users can insert their own profile" ON public.profiles;
CREATE POLICY "Users can insert their own profile"
  ON public.profiles FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- Allow new authenticated users to assign themselves the 'cliente' role at signup
DROP POLICY IF EXISTS "Users can self-assign cliente role at signup" ON public.user_roles;
CREATE POLICY "Users can self-assign cliente role at signup"
  ON public.user_roles FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id AND role = 'cliente'::app_role);

-- Public read of proveedor cards (name, store, phone, logo) for product detail page
DROP POLICY IF EXISTS "Public can view proveedor contact cards" ON public.profiles;
CREATE POLICY "Public can view proveedor contact cards"
  ON public.profiles FOR SELECT
  TO anon, authenticated
  USING (tipo_cuenta = 'proveedor');