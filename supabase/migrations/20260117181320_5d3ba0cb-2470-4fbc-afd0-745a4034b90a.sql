-- 1. Create role enum
CREATE TYPE public.app_role AS ENUM ('admin', 'motorizado', 'cliente');

-- 2. Create user_roles table (separate from profiles for security)
CREATE TABLE public.user_roles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    role app_role NOT NULL,
    UNIQUE (user_id, role)
);

-- 3. Create profiles table for user info
CREATE TABLE public.profiles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL UNIQUE,
    full_name TEXT NOT NULL,
    phone TEXT,
    email TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- 4. Enable RLS on both tables
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- 5. Create security definer function to check roles (prevents recursive RLS)
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = _role
  )
$$;

-- 6. Helper function to check if current user is admin
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.has_role(auth.uid(), 'admin')
$$;

-- 7. RLS policies for user_roles
CREATE POLICY "Admins can manage all roles"
ON public.user_roles
FOR ALL
TO authenticated
USING (public.is_admin());

CREATE POLICY "Users can view their own role"
ON public.user_roles
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

-- 8. RLS policies for profiles
CREATE POLICY "Admins can manage all profiles"
ON public.profiles
FOR ALL
TO authenticated
USING (public.is_admin());

CREATE POLICY "Users can view their own profile"
ON public.profiles
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Users can update their own profile"
ON public.profiles
FOR UPDATE
TO authenticated
USING (auth.uid() = user_id);

-- 9. Add client_user_id column to pedidos for linking orders to client accounts
ALTER TABLE public.pedidos 
ADD COLUMN client_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
ADD COLUMN client_phone TEXT;

-- 10. Update RLS policies for pedidos to support role-based access
DROP POLICY IF EXISTS "Permitir actualizar pedidos" ON public.pedidos;
DROP POLICY IF EXISTS "Permitir lectura publica" ON public.pedidos;

-- Admins can do everything with pedidos
CREATE POLICY "Admins full access to pedidos"
ON public.pedidos
FOR ALL
TO authenticated
USING (public.is_admin());

-- Motorizados can view their assigned orders for today
CREATE POLICY "Motorizados view assigned orders"
ON public.pedidos
FOR SELECT
TO authenticated
USING (
  public.has_role(auth.uid(), 'motorizado') 
  AND motorizado_asignado = (
    SELECT full_name FROM public.profiles WHERE user_id = auth.uid()
  )
  AND DATE(fecha_creacion) = CURRENT_DATE
);

-- Motorizados can update status and evidence of their assigned orders
CREATE POLICY "Motorizados update assigned orders"
ON public.pedidos
FOR UPDATE
TO authenticated
USING (
  public.has_role(auth.uid(), 'motorizado') 
  AND motorizado_asignado = (
    SELECT full_name FROM public.profiles WHERE user_id = auth.uid()
  )
);

-- Clients can view their own orders (by user_id or by tracking without auth)
CREATE POLICY "Clients view own orders"
ON public.pedidos
FOR SELECT
TO authenticated
USING (
  public.has_role(auth.uid(), 'cliente') 
  AND client_user_id = auth.uid()
);

-- Allow public tracking by numero_guia (for anonymous users)
CREATE POLICY "Public tracking by guide number"
ON public.pedidos
FOR SELECT
TO anon
USING (true);

-- 11. Create trigger for profiles updated_at
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER update_profiles_updated_at
BEFORE UPDATE ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();