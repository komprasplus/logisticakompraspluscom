
CREATE OR REPLACE FUNCTION public.get_public_tracking_info(search_tracking_number text)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_result jsonb;
BEGIN
  IF search_tracking_number IS NULL OR TRIM(search_tracking_number) = '' THEN
    RETURN NULL;
  END IF;

  SELECT jsonb_build_object(
    'found', true,
    'numero_guia', p.numero_guia,
    'estado', p.estado,
    'producto_nombre', p.producto_nombre,
    'cliente_nombre', p.cliente_nombre,
    'direccion_entrega', p.direccion_entrega,
    'valor_recaudar', p.valor_recaudar,
    'metodo_pago', p.metodo_pago,
    'quantity', COALESCE(p.quantity, 1),
    'fecha_creacion', p.fecha_creacion,
    'fecha_entrega', p.fecha_entrega,
    'fecha_actualizacion', p.fecha_actualizacion,
    'latitud', p.latitud,
    'longitud', p.longitud,
    'motorizado_nombre', pr.full_name,
    'motorizado_avatar', pr.avatar_url,
    'motorizado_phone', pr.phone,
    'motorizado_placa', pr.vehicle_plate,
    'motorizado_lat', pr.last_location_lat,
    'motorizado_lng', pr.last_location_lng,
    'store_logo', sp.logo_url,
    'store_name', sp.store_name
  )
  INTO v_result
  FROM pedidos p
  LEFT JOIN profiles pr ON pr.user_id = p.motorizado_id
  LEFT JOIN profiles sp ON sp.user_id = p.client_user_id
  WHERE p.numero_guia = TRIM(search_tracking_number)
     OR p.id_externo = TRIM(search_tracking_number)
  LIMIT 1;

  RETURN v_result;
END;
$$;

-- Grant execute to anon so unauthenticated users can call it
GRANT EXECUTE ON FUNCTION public.get_public_tracking_info(text) TO anon;
GRANT EXECUTE ON FUNCTION public.get_public_tracking_info(text) TO authenticated;
