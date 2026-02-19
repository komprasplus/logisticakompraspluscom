
-- ═══════════════════════════════════════════════════════════════════
-- MIGRACIÓN: Sincronización automática Billetera ↔ Pedidos
-- ═══════════════════════════════════════════════════════════════════

-- 1. Agregar columna pedido_id a transacciones_billetera (nullable para retiros manuales)
ALTER TABLE public.transacciones_billetera
  ADD COLUMN IF NOT EXISTS pedido_id bigint REFERENCES public.pedidos(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS concepto text,
  ADD COLUMN IF NOT EXISTS metadata jsonb;

-- 2. Índice único parcial en pedido_id (solo cuando no es null) — IDEMPOTENCIA total
CREATE UNIQUE INDEX IF NOT EXISTS idx_transacciones_billetera_pedido_id
  ON public.transacciones_billetera (pedido_id)
  WHERE pedido_id IS NOT NULL;

-- 3. Índice de búsqueda rápida por client_user_id + tipo
CREATE INDEX IF NOT EXISTS idx_transacciones_billetera_client_tipo
  ON public.transacciones_billetera (client_user_id, tipo);

-- 4. Función que se ejecuta al cambiar estado de un pedido
CREATE OR REPLACE FUNCTION public.handle_pedido_estado_entregado()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_estados_finales text[] := ARRAY['Entregado', 'entregado', 'Liquidado', 'liquidado'];
  v_monto numeric;
BEGIN
  -- Solo actuar cuando el estado cambia a uno de los estados finales
  IF NEW.estado = OLD.estado THEN
    RETURN NEW;
  END IF;

  IF NOT (NEW.estado = ANY(v_estados_finales)) THEN
    RETURN NEW;
  END IF;

  -- No procesar pedidos anticipados (ya están pagados de antemano)
  IF LOWER(NEW.metodo_pago) = 'anticipado' THEN
    RETURN NEW;
  END IF;

  -- valor_recaudar puede ser 0 (válido), pero no null
  IF NEW.valor_recaudar IS NULL THEN
    RETURN NEW;
  END IF;

  -- client_user_id debe existir para saber a qué tienda acreditar
  IF NEW.client_user_id IS NULL THEN
    RETURN NEW;
  END IF;

  v_monto := COALESCE(NEW.valor_recaudar, 0);

  -- Insertar transacción idempotente
  INSERT INTO public.transacciones_billetera (
    client_user_id,
    organizacion_id,
    pedido_id,
    tipo,
    monto,
    concepto,
    metadata,
    saldo_anterior,
    saldo_nuevo,
    notas,
    created_by
  ) VALUES (
    NEW.client_user_id,
    NEW.organizacion_id,
    NEW.id,
    'CREDITO_ENTREGA',
    v_monto,
    'Entrega confirmada - Guía ' || COALESCE(NEW.numero_guia, CAST(NEW.id AS text)),
    jsonb_build_object(
      'pedido_id', NEW.id,
      'numero_guia', NEW.numero_guia,
      'motorizado_id', NEW.motorizado_id,
      'estado_anterior', OLD.estado,
      'estado_nuevo', NEW.estado,
      'trigger_automatico', true,
      'timestamp_colombia', TO_CHAR(TIMEZONE('America/Bogota', NOW()), 'YYYY-MM-DD HH24:MI:SS TZ')
    ),
    0,  -- saldo_anterior: se calculará en la app
    0,  -- saldo_nuevo: se calculará en la app
    'Generado automáticamente por cambio de estado: ' || OLD.estado || ' → ' || NEW.estado,
    NULL  -- sistema
  )
  ON CONFLICT ON CONSTRAINT idx_transacciones_billetera_pedido_id DO NOTHING;

  RETURN NEW;
END;
$$;

-- 5. Crear el trigger en la tabla pedidos
DROP TRIGGER IF EXISTS trg_pedido_entregado_billetera ON public.pedidos;

CREATE TRIGGER trg_pedido_entregado_billetera
  AFTER UPDATE OF estado ON public.pedidos
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_pedido_estado_entregado();

-- 6. Función RPC para recalcular billeteras faltantes (super_admin only)
CREATE OR REPLACE FUNCTION public.recalcular_billeteras_faltantes(
  p_desde_fecha text DEFAULT '2025-01-01',
  p_dry_run boolean DEFAULT false
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_procesados int := 0;
  v_creadas int := 0;
  v_errores int := 0;
  v_skipped int := 0;
  pedido_rec RECORD;
  v_monto numeric;
  v_inserted boolean;
BEGIN
  -- Verificar que el usuario es super_admin
  IF NOT public.is_super_admin() THEN
    RAISE EXCEPTION 'Acceso denegado: solo super_admin puede ejecutar esta función';
  END IF;

  -- Buscar pedidos entregados/liquidados sin transacción correspondiente
  FOR pedido_rec IN
    SELECT
      p.id,
      p.numero_guia,
      p.client_user_id,
      p.organizacion_id,
      p.valor_recaudar,
      p.metodo_pago,
      p.motorizado_id,
      p.estado,
      p.fecha_actualizacion
    FROM public.pedidos p
    WHERE p.estado IN ('Entregado', 'entregado', 'Liquidado', 'liquidado')
      AND LOWER(COALESCE(p.metodo_pago, '')) != 'anticipado'
      AND p.valor_recaudar IS NOT NULL
      AND p.client_user_id IS NOT NULL
      AND NOT EXISTS (
        SELECT 1 FROM public.transacciones_billetera tb
        WHERE tb.pedido_id = p.id
      )
      AND p.fecha_creacion >= p_desde_fecha::timestamptz
    ORDER BY p.fecha_creacion ASC
    LIMIT 10000
  LOOP
    v_procesados := v_procesados + 1;
    v_monto := COALESCE(pedido_rec.valor_recaudar, 0);

    IF NOT p_dry_run THEN
      BEGIN
        INSERT INTO public.transacciones_billetera (
          client_user_id,
          organizacion_id,
          pedido_id,
          tipo,
          monto,
          concepto,
          metadata,
          saldo_anterior,
          saldo_nuevo,
          notas,
          created_by
        ) VALUES (
          pedido_rec.client_user_id,
          pedido_rec.organizacion_id,
          pedido_rec.id,
          'CREDITO_ENTREGA',
          v_monto,
          'Recalculación - Guía ' || COALESCE(pedido_rec.numero_guia, CAST(pedido_rec.id AS text)),
          jsonb_build_object(
            'pedido_id', pedido_rec.id,
            'numero_guia', pedido_rec.numero_guia,
            'estado', pedido_rec.estado,
            'recalculacion', true,
            'timestamp_colombia', TO_CHAR(TIMEZONE('America/Bogota', NOW()), 'YYYY-MM-DD HH24:MI:SS TZ')
          ),
          0,
          0,
          'Generado por recalcular_billeteras_faltantes - pedido previamente sin transacción',
          NULL
        )
        ON CONFLICT ON CONSTRAINT idx_transacciones_billetera_pedido_id DO NOTHING;

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
      -- dry_run: solo contar sin insertar
      v_creadas := v_creadas + 1;
    END IF;
  END LOOP;

  RETURN jsonb_build_object(
    'pedidos_procesados', v_procesados,
    'transacciones_creadas', v_creadas,
    'skipped', v_skipped,
    'errores', v_errores,
    'dry_run', p_dry_run,
    'timestamp', TO_CHAR(TIMEZONE('America/Bogota', NOW()), 'YYYY-MM-DD HH24:MI:SS')
  );
END;
$$;
