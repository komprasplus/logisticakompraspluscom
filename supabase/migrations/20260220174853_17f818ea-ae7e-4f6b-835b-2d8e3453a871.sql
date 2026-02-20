
-- ============================================================
-- 1. Fix trigger: credit UTILIDAD instead of full valor_recaudar
-- ============================================================
CREATE OR REPLACE FUNCTION public.handle_pedido_estado_entregado()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_estados_finales text[] := ARRAY['Entregado', 'entregado', 'Liquidado', 'liquidado'];
  v_monto numeric;
  v_recaudar numeric;
  v_flete numeric;
  v_producto numeric;
BEGIN
  IF NEW.estado = OLD.estado THEN RETURN NEW; END IF;
  IF NOT (NEW.estado = ANY(v_estados_finales)) THEN RETURN NEW; END IF;
  IF LOWER(COALESCE(NEW.metodo_pago, '')) = 'anticipado' THEN RETURN NEW; END IF;
  IF NEW.valor_recaudar IS NULL THEN RETURN NEW; END IF;
  IF NEW.client_user_id IS NULL THEN RETURN NEW; END IF;

  v_recaudar := COALESCE(NEW.valor_recaudar, 0);
  v_flete    := COALESCE(NEW.valor_flete, 0);
  v_producto := COALESCE(NEW.valor_producto, 0);
  v_monto    := v_recaudar - v_flete - v_producto;

  -- If utility is zero or negative, skip credit
  IF v_monto <= 0 THEN RETURN NEW; END IF;

  INSERT INTO public.transacciones_billetera (
    client_user_id, organizacion_id, pedido_id, tipo, monto, concepto,
    metadata, saldo_anterior, saldo_nuevo, notas, created_by
  ) VALUES (
    NEW.client_user_id, NEW.organizacion_id, NEW.id, 'CREDITO_ENTREGA', v_monto,
    'Utilidad Guía ' || COALESCE(NEW.numero_guia, CAST(NEW.id AS text))
      || ' | Recaudo ' || v_recaudar || ' - Envío ' || v_flete || ' - Producto ' || v_producto,
    jsonb_build_object(
      'pedido_id', NEW.id, 'numero_guia', NEW.numero_guia,
      'motorizado_id', NEW.motorizado_id, 'estado_anterior', OLD.estado,
      'estado_nuevo', NEW.estado, 'trigger_automatico', true,
      'valor_recaudar', v_recaudar, 'valor_flete', v_flete,
      'valor_producto', v_producto, 'utilidad', v_monto,
      'timestamp_colombia', TO_CHAR(TIMEZONE('America/Bogota', NOW()), 'YYYY-MM-DD HH24:MI:SS TZ')
    ),
    0, 0,
    'Utilidad = Recaudo(' || v_recaudar || ') - Envío(' || v_flete || ') - Producto(' || v_producto || ')',
    NULL
  )
  ON CONFLICT (pedido_id) WHERE pedido_id IS NOT NULL DO NOTHING;

  RETURN NEW;
END;
$function$;

-- ============================================================
-- 2. Fix recalcular_billeteras_faltantes: same utility formula
-- ============================================================
CREATE OR REPLACE FUNCTION public.recalcular_billeteras_faltantes(
  p_desde_fecha text DEFAULT '2025-01-01'::text,
  p_dry_run boolean DEFAULT false
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_procesados int := 0;
  v_creadas int := 0;
  v_errores int := 0;
  v_skipped int := 0;
  pedido_rec RECORD;
  v_monto numeric;
  v_recaudar numeric;
  v_flete numeric;
  v_producto numeric;
  v_inserted boolean;
BEGIN
  IF NOT public.is_super_admin() THEN
    RAISE EXCEPTION 'Acceso denegado: solo super_admin puede ejecutar esta función';
  END IF;

  FOR pedido_rec IN
    SELECT p.id, p.numero_guia, p.client_user_id, p.organizacion_id,
           p.valor_recaudar, p.valor_flete, p.valor_producto,
           p.metodo_pago, p.motorizado_id, p.estado, p.fecha_actualizacion
    FROM public.pedidos p
    WHERE p.estado IN ('Entregado', 'entregado', 'Liquidado', 'liquidado')
      AND LOWER(COALESCE(p.metodo_pago, '')) != 'anticipado'
      AND p.valor_recaudar IS NOT NULL
      AND p.client_user_id IS NOT NULL
      AND NOT EXISTS (SELECT 1 FROM public.transacciones_billetera tb WHERE tb.pedido_id = p.id)
      AND p.fecha_creacion >= p_desde_fecha::timestamptz
    ORDER BY p.fecha_creacion ASC
    LIMIT 10000
  LOOP
    v_procesados := v_procesados + 1;
    v_recaudar := COALESCE(pedido_rec.valor_recaudar, 0);
    v_flete    := COALESCE(pedido_rec.valor_flete, 0);
    v_producto := COALESCE(pedido_rec.valor_producto, 0);
    v_monto    := v_recaudar - v_flete - v_producto;

    -- Skip if utility is zero or negative
    IF v_monto <= 0 THEN
      v_skipped := v_skipped + 1;
      CONTINUE;
    END IF;

    IF NOT p_dry_run THEN
      BEGIN
        INSERT INTO public.transacciones_billetera (
          client_user_id, organizacion_id, pedido_id, tipo, monto, concepto,
          metadata, saldo_anterior, saldo_nuevo, notas, created_by
        ) VALUES (
          pedido_rec.client_user_id, pedido_rec.organizacion_id, pedido_rec.id,
          'CREDITO_ENTREGA', v_monto,
          'Recalculación Guía ' || COALESCE(pedido_rec.numero_guia, CAST(pedido_rec.id AS text))
            || ' | Recaudo ' || v_recaudar || ' - Envío ' || v_flete || ' - Producto ' || v_producto,
          jsonb_build_object(
            'pedido_id', pedido_rec.id, 'numero_guia', pedido_rec.numero_guia,
            'estado', pedido_rec.estado, 'recalculacion', true,
            'valor_recaudar', v_recaudar, 'valor_flete', v_flete,
            'valor_producto', v_producto, 'utilidad', v_monto,
            'timestamp_colombia', TO_CHAR(TIMEZONE('America/Bogota', NOW()), 'YYYY-MM-DD HH24:MI:SS TZ')
          ),
          0, 0,
          'Utilidad = Recaudo(' || v_recaudar || ') - Envío(' || v_flete || ') - Producto(' || v_producto || ')',
          NULL
        )
        ON CONFLICT (pedido_id) WHERE pedido_id IS NOT NULL DO NOTHING;

        GET DIAGNOSTICS v_inserted = ROW_COUNT;
        IF v_inserted THEN
          v_creadas := v_creadas + 1;
        ELSE
          v_skipped := v_skipped + 1;
        END IF;
      EXCEPTION WHEN OTHERS THEN
        v_errores := v_errores + 1;
      END;
    ELSE
      v_creadas := v_creadas + 1;
    END IF;
  END LOOP;

  RETURN jsonb_build_object(
    'pedidos_procesados', v_procesados, 'transacciones_creadas', v_creadas,
    'skipped', v_skipped, 'errores', v_errores, 'dry_run', p_dry_run,
    'timestamp', TO_CHAR(TIMEZONE('America/Bogota', NOW()), 'YYYY-MM-DD HH24:MI:SS')
  );
END;
$function$;
