
CREATE OR REPLACE FUNCTION public.delete_user_completely(target_user_id UUID)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller_org UUID;
  v_target_org UUID;
  v_target_name TEXT;
  v_is_super BOOLEAN;
BEGIN
  -- Check caller is admin or super_admin
  v_is_super := public.is_super_admin();
  
  IF NOT v_is_super AND NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Acceso denegado: solo administradores pueden eliminar usuarios';
  END IF;

  -- Get target user org and name
  SELECT organizacion_id, full_name INTO v_target_org, v_target_name
  FROM public.profiles WHERE user_id = target_user_id;

  IF v_target_name IS NULL THEN
    RAISE EXCEPTION 'Usuario no encontrado';
  END IF;

  -- Multi-tenant check: non-super admins can only delete users in their own org
  IF NOT v_is_super THEN
    v_caller_org := public.get_user_org_id();
    IF v_target_org IS DISTINCT FROM v_caller_org THEN
      RAISE EXCEPTION 'No puedes eliminar usuarios de otra organización';
    END IF;
  END IF;

  -- Prevent deleting yourself
  IF auth.uid() = target_user_id THEN
    RAISE EXCEPTION 'No puedes eliminarte a ti mismo';
  END IF;

  -- Prevent deleting super_admins (unless you are super_admin)
  IF NOT v_is_super AND EXISTS (
    SELECT 1 FROM public.user_roles WHERE user_id = target_user_id AND role::text = 'super_admin'
  ) THEN
    RAISE EXCEPTION 'No puedes eliminar un Super Admin';
  END IF;

  -- Delete in order: roles, profile, then auth user
  DELETE FROM public.user_roles WHERE user_id = target_user_id;
  DELETE FROM public.profiles WHERE user_id = target_user_id;
  DELETE FROM auth.users WHERE id = target_user_id;

  RETURN jsonb_build_object(
    'success', true,
    'deleted_user', v_target_name,
    'timestamp', TO_CHAR(TIMEZONE('America/Bogota', NOW()), 'YYYY-MM-DD HH24:MI:SS')
  );
END;
$$;
