
CREATE OR REPLACE FUNCTION public.handle_pedido_estado_entregado()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_estados_finales text[] := ARRAY['Entregado', 'entregado', 'Liquidado', 'liquidado'];
  v_estados_devolucion text[] := ARRAY['Devolución', 'devolucion', 'Devolucion', 'DEVUELTO', 'devuelto'];
  v_monto numeric;
  v_recaudar numeric;
  v_flete numeric;
  v_producto numeric;
  v_costo_devolucion numeric;
BEGIN
  -- No-op if estado didn't change
  IF NEW.estado = OLD.estado THEN RETURN NEW; END IF;

  -- ═══ BRANCH 1: Entregado / Liquidado → Credit utility ═══
  IF NEW.estado = ANY(v_estados_finales) THEN
    IF LOWER(COALESCE(NEW.metodo_pago, '')) = 'anticipado' THEN RETURN NEW; END IF;
    IF NEW.valor_recaudar IS NULL THEN RETURN NEW; END IF;
    IF NEW.client_user_id IS NULL THEN RETURN NEW; END IF;

    v_recaudar := COALESCE(NEW.valor_recaudar, 0);
    v_flete    := COALESCE(NEW.valor_flete, 0);
    v_producto := COALESCE(NEW.valor_producto, 0);
    v_monto    := v_recaudar - v_flete - v_producto;

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
  END IF;

  -- ═══ BRANCH 2: Devolución → Debit shipping cost ═══
  IF NEW.estado = ANY(v_estados_devolucion) THEN
    IF NEW.client_user_id IS NULL THEN RETURN NEW; END IF;

    -- Use costo_devolucion if set, otherwise fall back to valor_flete
    v_costo_devolucion := COALESCE(NEW.costo_devolucion, NEW.valor_flete, 0);

    IF v_costo_devolucion <= 0 THEN RETURN NEW; END IF;

    -- Prevent duplicate debit for the same pedido
    IF EXISTS (
      SELECT 1 FROM public.transacciones_billetera
      WHERE pedido_id = NEW.id AND tipo = 'DEBITO_DEVOLUCION'
    ) THEN
      RETURN NEW;
    END IF;

    INSERT INTO public.transacciones_billetera (
      client_user_id, organizacion_id, pedido_id, tipo, monto, concepto,
      metadata, saldo_anterior, saldo_nuevo, notas, created_by
    ) VALUES (
      NEW.client_user_id, NEW.organizacion_id, NEW.id, 'DEBITO_DEVOLUCION', v_costo_devolucion,
      'Cobro de flete por devolución - Guía #' || COALESCE(NEW.numero_guia, CAST(NEW.id AS text)),
      jsonb_build_object(
        'pedido_id', NEW.id, 'numero_guia', NEW.numero_guia,
        'estado_anterior', OLD.estado, 'estado_nuevo', NEW.estado,
        'trigger_automatico', true, 'costo_devolucion', v_costo_devolucion,
        'valor_flete', COALESCE(NEW.valor_flete, 0),
        'timestamp_colombia', TO_CHAR(TIMEZONE('America/Bogota', NOW()), 'YYYY-MM-DD HH24:MI:SS TZ')
      ),
      0, 0,
      'Débito por devolución: flete $' || v_costo_devolucion,
      NULL
    );

    -- Mark devolucion_cobrada flag on the pedido
    NEW.devolucion_cobrada := true;

    RETURN NEW;
  END IF;

  RETURN NEW;
END;
$function$;
