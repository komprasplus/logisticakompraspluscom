CREATE OR REPLACE FUNCTION public.proveedor_generar_guia(p_pedido_id bigint)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_org_id uuid;
  v_pedido record;
  v_items_count integer;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Usuario no autenticado';
  END IF;

  IF NOT public.is_proveedor_account(v_user_id) THEN
    RAISE EXCEPTION 'Acceso denegado: solo proveedores pueden generar guías';
  END IF;

  SELECT organizacion_id
    INTO v_org_id
  FROM public.profiles
  WHERE user_id = v_user_id
  LIMIT 1;

  IF v_org_id IS NULL THEN
    RAISE EXCEPTION 'No se encontró la organización del proveedor';
  END IF;

  SELECT p.id, p.numero_guia, p.estado, p.organizacion_id
    INTO v_pedido
  FROM public.pedidos p
  WHERE p.id = p_pedido_id
    AND p.organizacion_id = v_org_id
  FOR UPDATE;

  IF v_pedido.id IS NULL THEN
    RAISE EXCEPTION 'Pedido no encontrado o fuera de tu organización';
  END IF;

  IF v_pedido.estado IS DISTINCT FROM 'en_preparacion' THEN
    RAISE EXCEPTION 'El pedido ya no está en preparación';
  END IF;

  SELECT COUNT(*)
    INTO v_items_count
  FROM public.order_items oi
  WHERE oi.pedido_id = p_pedido_id
    AND oi.organizacion_id = v_org_id
    AND oi.supplier_user_id = v_user_id;

  IF COALESCE(v_items_count, 0) = 0 THEN
    RAISE EXCEPTION 'Este pedido no tiene productos asignados a tu inventario';
  END IF;

  UPDATE public.pedidos
  SET estado = 'despachado',
      fecha_actualizacion = now()
  WHERE id = p_pedido_id
    AND organizacion_id = v_org_id;

  RETURN jsonb_build_object(
    'success', true,
    'pedido_id', p_pedido_id,
    'numero_guia', v_pedido.numero_guia,
    'estado', 'despachado'
  );
END;
$$;

REVOKE ALL ON FUNCTION public.proveedor_generar_guia(bigint) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.proveedor_generar_guia(bigint) TO authenticated;