-- Fix is_admin() to also return true for super_admin users
-- This ensures super_admin can access all admin-level data through RLS policies
CREATE OR REPLACE FUNCTION public.is_admin()
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $$
  SELECT public.has_role(auth.uid(), 'admin') OR public.is_super_admin()
$$;