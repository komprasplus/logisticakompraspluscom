-- 1) Update trigger function to include 'Pagado' state
CREATE OR REPLACE FUNCTION public.handle_pedido_estado_entregado()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_estados_finales text[] := ARRAY['Entregado', 'entregado', 'Liquidado', 'liquidado', 'Pagado', 'pagado'];
  v_estados_devolucion text[] := ARRAY['Devolución', 'devolucion', 'Devolucion', 'DEVUELTO', 'devuelto'];
  v_recaudar numeric;
  v_flete numeric;
  v_producto numeric;
  v_costo_devolucion numeric;
  v_total_supplier_cost numeric := 0;
  v_dropshipper_utilidad numeric;
  supplier_rec RECORD;
BEGIN
  IF NEW.estado = OLD.estado THEN RETURN NEW; END IF;

  IF NEW.estado = ANY(v_estados_finales) THEN
    IF LOWER(COALESCE(NEW.metodo_pago, '')) = 'anticipado' THEN RETURN NEW; END IF;
    IF NEW.valor_recaudar IS NULL THEN RETURN NEW; END IF;
    IF NEW.client_user_id IS NULL THEN RETURN NEW; END IF;

    v_recaudar := COALESCE(NEW.valor_recaudar, 0);
    v_flete    := COALESCE(NEW.valor_flete, 0);
    v_producto := COALESCE(NEW.valor_producto, 0);

    FOR supplier_rec IN
      SELECT oi.supplier_user_id,
             SUM(COALESCE(oi.supplier_cost_snapshot, 0) * COALESCE(oi.quantity, 1)) AS total_cost
      FROM public.order_items oi
      WHERE oi.pedido_id = NEW.id
        AND oi.supplier_user_id IS NOT NULL
        AND oi.supplier_cost_snapshot IS NOT NULL
        AND oi.supplier_cost_snapshot > 0
      GROUP BY oi.supplier_user_id
    LOOP
      IF supplier_rec.total_cost > 0 THEN
        v_total_supplier_cost := v_total_supplier_cost + supplier_rec.total_cost;
        INSERT INTO public.transacciones_billetera (
          client_user_id, organizacion_id, pedido_id, tipo, monto, concepto,
          metadata, saldo_anterior, saldo_nuevo, notas, created_by
        ) VALUES (
          supplier_rec.supplier_user_id, NEW.organizacion_id, NEW.id,
          'CREDITO_PROVEEDOR', supplier_rec.total_cost,
          'Venta de Producto - Guía ' || COALESCE(NEW.numero_guia, '#' || NEW.id::text),
          jsonb_build_object('pedido_id', NEW.id, 'numero_guia', NEW.numero_guia, 'split_role','proveedor',
            'dropshipper_id', NEW.client_user_id, 'estado_anterior', OLD.estado, 'estado_nuevo', NEW.estado,
            'trigger_automatico', true,
            'timestamp_colombia', TO_CHAR(TIMEZONE('America/Bogota', NOW()), 'YYYY-MM-DD HH24:MI:SS TZ')),
          0, 0, 'Pago al proveedor por venta entregada', NULL
        );
      END IF;
    END LOOP;

    v_dropshipper_utilidad := v_recaudar - v_flete - v_producto - v_total_supplier_cost;

    IF v_dropshipper_utilidad > 0 THEN
      INSERT INTO public.transacciones_billetera (
        client_user_id, organizacion_id, pedido_id, tipo, monto, concepto,
        metadata, saldo_anterior, saldo_nuevo, notas, created_by
      ) VALUES (
        NEW.client_user_id, NEW.organizacion_id, NEW.id,
        'CREDITO_ENTREGA', v_dropshipper_utilidad,
        CASE WHEN v_total_supplier_cost > 0
             THEN 'Utilidad Venta Dropshipping - Guía ' || COALESCE(NEW.numero_guia, '#' || NEW.id::text)
             ELSE 'Utilidad Guía ' || COALESCE(NEW.numero_guia, CAST(NEW.id AS text))
                  || ' | Recaudo ' || v_recaudar || ' - Envío ' || v_flete || ' - Producto ' || v_producto
        END,
        jsonb_build_object('pedido_id', NEW.id, 'numero_guia', NEW.numero_guia,
          'split_role', CASE WHEN v_total_supplier_cost > 0 THEN 'dropshipper' ELSE 'self' END,
          'motorizado_id', NEW.motorizado_id, 'estado_anterior', OLD.estado, 'estado_nuevo', NEW.estado,
          'trigger_automatico', true, 'valor_recaudar', v_recaudar, 'valor_flete', v_flete,
          'valor_producto', v_producto, 'costo_proveedor_total', v_total_supplier_cost,
          'utilidad', v_dropshipper_utilidad,
          'timestamp_colombia', TO_CHAR(TIMEZONE('America/Bogota', NOW()), 'YYYY-MM-DD HH24:MI:SS TZ')),
        0, 0,
        'Utilidad = Recaudo(' || v_recaudar || ') - Envío(' || v_flete || ') - Producto(' || v_producto || ') - Proveedor(' || v_total_supplier_cost || ')',
        NULL
      )
      ON CONFLICT (pedido_id) WHERE pedido_id IS NOT NULL DO NOTHING;
    END IF;

    RETURN NEW;
  END IF;

  IF NEW.estado = ANY(v_estados_devolucion) THEN
    IF NEW.client_user_id IS NULL THEN RETURN NEW; END IF;
    v_costo_devolucion := COALESCE(NEW.costo_devolucion, NEW.valor_flete, 0);
    IF v_costo_devolucion <= 0 THEN RETURN NEW; END IF;
    IF EXISTS (SELECT 1 FROM public.transacciones_billetera
               WHERE pedido_id = NEW.id AND tipo = 'DEBITO_DEVOLUCION') THEN
      RETURN NEW;
    END IF;
    INSERT INTO public.transacciones_billetera (
      client_user_id, organizacion_id, pedido_id, tipo, monto, concepto,
      metadata, saldo_anterior, saldo_nuevo, notas, created_by
    ) VALUES (
      NEW.client_user_id, NEW.organizacion_id, NEW.id, 'DEBITO_DEVOLUCION', v_costo_devolucion,
      'Cobro de flete por devolución - Guía #' || COALESCE(NEW.numero_guia, CAST(NEW.id AS text)),
      jsonb_build_object('pedido_id', NEW.id, 'numero_guia', NEW.numero_guia,
        'estado_anterior', OLD.estado, 'estado_nuevo', NEW.estado,
        'trigger_automatico', true, 'costo_devolucion', v_costo_devolucion,
        'valor_flete', COALESCE(NEW.valor_flete, 0),
        'timestamp_colombia', TO_CHAR(TIMEZONE('America/Bogota', NOW()), 'YYYY-MM-DD HH24:MI:SS TZ')),
      0, 0, 'Débito por devolución: flete $' || v_costo_devolucion, NULL
    );
    NEW.devolucion_cobrada := true;
    RETURN NEW;
  END IF;

  RETURN NEW;
END;
$function$;

-- 2) BACKFILL: acreditar todos los pedidos Entregado/Liquidado/Pagado pendientes con utilidad positiva
INSERT INTO public.transacciones_billetera (
  client_user_id, organizacion_id, pedido_id, tipo, monto, concepto,
  metadata, saldo_anterior, saldo_nuevo, notas, created_by
)
SELECT
  p.client_user_id,
  p.organizacion_id,
  p.id,
  'CREDITO_ENTREGA',
  (COALESCE(p.valor_recaudar,0) - COALESCE(p.valor_flete,0) - COALESCE(p.valor_producto,0)) AS monto,
  'Backfill Utilidad Guía ' || COALESCE(p.numero_guia, p.id::text)
    || ' | Recaudo ' || COALESCE(p.valor_recaudar,0)
    || ' - Envío ' || COALESCE(p.valor_flete,0)
    || ' - Producto ' || COALESCE(p.valor_producto,0),
  jsonb_build_object(
    'pedido_id', p.id, 'numero_guia', p.numero_guia, 'estado', p.estado,
    'backfill', true, 'split_role', 'self',
    'valor_recaudar', COALESCE(p.valor_recaudar,0),
    'valor_flete', COALESCE(p.valor_flete,0),
    'valor_producto', COALESCE(p.valor_producto,0),
    'utilidad', (COALESCE(p.valor_recaudar,0) - COALESCE(p.valor_flete,0) - COALESCE(p.valor_producto,0)),
    'timestamp_colombia', TO_CHAR(TIMEZONE('America/Bogota', NOW()), 'YYYY-MM-DD HH24:MI:SS TZ')
  ),
  0, 0,
  'Backfill automático: trigger no se ejecutó en su momento (estado Pagado no estaba contemplado o pedido pre-existente al trigger)',
  NULL
FROM public.pedidos p
WHERE p.estado IN ('Entregado','entregado','Liquidado','liquidado','Pagado','pagado')
  AND LOWER(COALESCE(p.metodo_pago,'')) <> 'anticipado'
  AND p.valor_recaudar IS NOT NULL
  AND p.client_user_id IS NOT NULL
  AND (COALESCE(p.valor_recaudar,0) - COALESCE(p.valor_flete,0) - COALESCE(p.valor_producto,0)) > 0
  AND NOT EXISTS (SELECT 1 FROM public.transacciones_billetera tb WHERE tb.pedido_id = p.id)
ON CONFLICT (pedido_id) WHERE pedido_id IS NOT NULL DO NOTHING;