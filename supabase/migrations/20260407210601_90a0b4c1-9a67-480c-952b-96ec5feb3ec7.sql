-- Drop the overly permissive admin policy on profiles
DROP POLICY IF EXISTS "Admins can manage all profiles" ON public.profiles;

-- Admin can SELECT only own org profiles
CREATE POLICY "Admins can view own org profiles"
  ON public.profiles FOR SELECT TO authenticated
  USING (
    has_role(auth.uid(), 'admin'::app_role)
    AND organizacion_id = get_user_org_id()
  );

-- Admin can UPDATE only own org profiles
CREATE POLICY "Admins can update own org profiles"
  ON public.profiles FOR UPDATE TO authenticated
  USING (
    has_role(auth.uid(), 'admin'::app_role)
    AND organizacion_id = get_user_org_id()
  );

-- Admin can INSERT only own org profiles
CREATE POLICY "Admins can insert own org profiles"
  ON public.profiles FOR INSERT TO authenticated
  WITH CHECK (
    has_role(auth.uid(), 'admin'::app_role)
    AND organizacion_id = get_user_org_id()
  );

-- Admin can DELETE only own org profiles
CREATE POLICY "Admins can delete own org profiles"
  ON public.profiles FOR DELETE TO authenticated
  USING (
    has_role(auth.uid(), 'admin'::app_role)
    AND organizacion_id = get_user_org_id()
  );

-- Super admin retains full access
CREATE POLICY "Super admins full access to profiles"
  ON public.profiles FOR ALL TO authenticated
  USING (is_super_admin())
  WITH CHECK (is_super_admin());

-- Also scope the user_roles admin policy to own org
DROP POLICY IF EXISTS "Admins can manage all roles" ON public.user_roles;

CREATE POLICY "Admins can manage own org roles"
  ON public.user_roles FOR ALL TO authenticated
  USING (
    has_role(auth.uid(), 'admin'::app_role)
    AND organizacion_id = get_user_org_id()
  )
  WITH CHECK (
    has_role(auth.uid(), 'admin'::app_role)
    AND organizacion_id = get_user_org_id()
  );

CREATE POLICY "Super admins full access to user_roles"
  ON public.user_roles FOR ALL TO authenticated
  USING (is_super_admin())
  WITH CHECK (is_super_admin());