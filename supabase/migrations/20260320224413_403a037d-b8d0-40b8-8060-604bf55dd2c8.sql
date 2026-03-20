
-- =============================================
-- FUNCIÓN: process_webhook_log()
-- Traductor Universal de Webhooks Logísticos
-- =============================================
CREATE OR REPLACE FUNCTION public.process_webhook_log()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_tracking TEXT;
  v_raw_status TEXT;
  v_source TEXT;
  v_internal_state TEXT;
  v_pedido_id BIGINT;
  v_old_estado TEXT;
  v_payload JSONB;
BEGIN
  v_payload := NEW.payload;
  v_source  := LOWER(NEW.source);

  -- 1. Extraer tracking y estado crudo según la fuente
  IF v_source = 'dropi' THEN
    v_tracking   := COALESCE(v_payload->>'guia', v_payload->>'tracking', v_payload->>'numero_guia');
    v_raw_status := COALESCE(v_payload->>'status', v_payload->>'estado');
  ELSIF v_source = 'mastershop' THEN
    v_tracking   := COALESCE(v_payload->>'trackingNumber', v_payload->>'tracking', v_payload->>'guia');
    v_raw_status := COALESCE(v_payload->>'statusCode', v_payload->>'status');
  ELSE
    v_tracking   := COALESCE(v_payload->>'tracking', v_payload->>'guia', v_payload->>'numero_guia', v_payload->>'trackingNumber');
    v_raw_status := COALESCE(v_payload->>'status', v_payload->>'estado', v_payload->>'statusCode');
  END IF;

  -- Validar datos mínimos
  IF v_tracking IS NULL OR v_tracking = '' THEN
    UPDATE webhook_logs_incoming
      SET processing_status = 'error', error_message = 'No se encontró número de guía en el payload'
      WHERE id = NEW.id;
    RETURN NEW;
  END IF;

  IF v_raw_status IS NULL OR v_raw_status = '' THEN
    UPDATE webhook_logs_incoming
      SET processing_status = 'error', error_message = 'No se encontró estado en el payload'
      WHERE id = NEW.id;
    RETURN NEW;
  END IF;

  -- 2. Traducir estado externo a interno (primero state_mappings dinámico)
  SELECT sm.internal_state INTO v_internal_state
  FROM state_mappings sm
  WHERE sm.platform = v_source
    AND (LOWER(sm.external_state) = LOWER(v_raw_status) OR sm.external_code = v_raw_status)
    AND sm.is_active = true
  LIMIT 1;

  -- Fallback: mapeo hardcoded
  IF v_internal_state IS NULL THEN
    v_internal_state := CASE LOWER(v_raw_status)
      WHEN 'entregado'       THEN 'Entregado'
      WHEN 'ent'             THEN 'Entregado'
      WHEN 'delivered'       THEN 'Entregado'
      WHEN 'en ruta'         THEN 'En Ruta'
      WHEN 'en_ruta'         THEN 'En Ruta'
      WHEN 'in_transit'      THEN 'En Ruta'
      WHEN 'en camino'       THEN 'En Ruta'
      WHEN 'novedad'         THEN 'Novedad'
      WHEN 'nov'             THEN 'Novedad'
      WHEN 'issue'           THEN 'Novedad'
      WHEN 'devolucion'      THEN 'Devolución'
      WHEN 'returned'        THEN 'Devolución'
      WHEN 'rechazado'       THEN 'Rechazado'
      WHEN 'rejected'        THEN 'Rechazado'
      WHEN 'recibido'        THEN 'Recibido en Bodega'
      WHEN 'received'        THEN 'Recibido en Bodega'
      WHEN 'asignado'        THEN 'Asignado'
      WHEN 'assigned'        THEN 'Asignado'
      WHEN 'liquidado'       THEN 'Liquidado'
      WHEN 'anulado'         THEN 'Anulado'
      WHEN 'cancelled'       THEN 'Anulado'
      ELSE NULL
    END;
  END IF;

  IF v_internal_state IS NULL THEN
    UPDATE webhook_logs_incoming
      SET processing_status = 'error',
          error_message = 'Estado no reconocido: "' || v_raw_status || '" de fuente "' || v_source || '"'
      WHERE id = NEW.id;
    RETURN NEW;
  END IF;

  -- 3. Buscar pedido por número de guía o id_externo
  SELECT id, estado INTO v_pedido_id, v_old_estado
  FROM pedidos WHERE numero_guia = v_tracking LIMIT 1;

  IF v_pedido_id IS NULL THEN
    SELECT id, estado INTO v_pedido_id, v_old_estado
    FROM pedidos WHERE id_externo = v_tracking LIMIT 1;
  END IF;

  IF v_pedido_id IS NULL THEN
    UPDATE webhook_logs_incoming
      SET processing_status = 'error',
          error_message = 'Guía "' || v_tracking || '" no encontrada en pedidos'
      WHERE id = NEW.id;
    RETURN NEW;
  END IF;

  -- No actualizar si ya está en el mismo estado
  IF v_old_estado = v_internal_state THEN
    UPDATE webhook_logs_incoming
      SET processing_status = 'processed',
          error_message = 'Sin cambio: ya estaba en estado "' || v_internal_state || '"'
      WHERE id = NEW.id;
    RETURN NEW;
  END IF;

  -- 4. Actualizar pedido
  UPDATE pedidos
    SET estado = v_internal_state,
        fecha_actualizacion = NOW(),
        dropi_sync_status = 'synced'
    WHERE id = v_pedido_id;

  -- Registrar en log de estados
  INSERT INTO pedido_status_logs (pedido_id, estado_anterior, estado_nuevo, motivo, usuario_nombre)
  VALUES (v_pedido_id, v_old_estado, v_internal_state, 'Webhook automático (' || v_source || ')', 'Sistema Webhook');

  -- 5. Marcar webhook como procesado
  UPDATE webhook_logs_incoming
    SET processing_status = 'processed'
    WHERE id = NEW.id;

  RETURN NEW;

EXCEPTION WHEN OTHERS THEN
  UPDATE webhook_logs_incoming
    SET processing_status = 'error',
        error_message = SQLERRM
    WHERE id = NEW.id;
  RETURN NEW;
END;
$$;

-- =============================================
-- TRIGGER: on_new_webhook_log
-- =============================================
DROP TRIGGER IF EXISTS on_new_webhook_log ON webhook_logs_incoming;

CREATE TRIGGER on_new_webhook_log
  AFTER INSERT ON webhook_logs_incoming
  FOR EACH ROW
  EXECUTE FUNCTION process_webhook_log();
