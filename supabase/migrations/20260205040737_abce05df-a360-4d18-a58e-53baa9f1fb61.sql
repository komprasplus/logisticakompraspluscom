-- Añadir campos de auditoría SLA para integración Dropi
ALTER TABLE public.pedidos 
ADD COLUMN IF NOT EXISTS fecha_recoleccion_real TIMESTAMP WITH TIME ZONE DEFAULT NULL,
ADD COLUMN IF NOT EXISTS primer_intento_fecha TIMESTAMP WITH TIME ZONE DEFAULT NULL,
ADD COLUMN IF NOT EXISTS fecha_cierre_logistico TIMESTAMP WITH TIME ZONE DEFAULT NULL,
ADD COLUMN IF NOT EXISTS indicador_trayecto TEXT DEFAULT 'Local' CHECK (indicador_trayecto IN ('Local', 'Nacional', 'Zonal', 'Especial')),
ADD COLUMN IF NOT EXISTS novedad_tipo_clasificacion TEXT DEFAULT NULL CHECK (novedad_tipo_clasificacion IN ('Automática', 'Manual', NULL)),
ADD COLUMN IF NOT EXISTS novedad_resuelta BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS dias_en_transito INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS sla_cumplido BOOLEAN DEFAULT NULL,
ADD COLUMN IF NOT EXISTS dropi_sync_status TEXT DEFAULT 'pending' CHECK (dropi_sync_status IN ('pending', 'synced', 'error')),
ADD COLUMN IF NOT EXISTS dropi_guia_id TEXT DEFAULT NULL;

-- Crear índices para mejorar rendimiento de consultas Dropi
CREATE INDEX IF NOT EXISTS idx_pedidos_dropi_sync ON public.pedidos(dropi_sync_status);
CREATE INDEX IF NOT EXISTS idx_pedidos_fecha_recoleccion ON public.pedidos(fecha_recoleccion_real);
CREATE INDEX IF NOT EXISTS idx_pedidos_indicador_trayecto ON public.pedidos(indicador_trayecto);
CREATE INDEX IF NOT EXISTS idx_pedidos_novedad_clasificacion ON public.pedidos(novedad_tipo_clasificacion);

-- Función para calcular automáticamente SLA y días en tránsito
CREATE OR REPLACE FUNCTION public.calculate_sla_metrics()
RETURNS TRIGGER AS $$
DECLARE
  sla_days INTEGER;
  actual_days INTEGER;
BEGIN
  -- Calcular días en tránsito si hay fecha de recolección
  IF NEW.fecha_recoleccion_real IS NOT NULL THEN
    IF NEW.estado = 'Entregado' AND NEW.fecha_actualizacion IS NOT NULL THEN
      NEW.dias_en_transito := EXTRACT(DAY FROM (NEW.fecha_actualizacion - NEW.fecha_recoleccion_real));
    ELSIF NEW.estado = 'Devolución' AND NEW.fecha_actualizacion IS NOT NULL THEN
      NEW.dias_en_transito := EXTRACT(DAY FROM (NEW.fecha_actualizacion - NEW.fecha_recoleccion_real));
      NEW.fecha_cierre_logistico := NEW.fecha_actualizacion;
    ELSE
      NEW.dias_en_transito := EXTRACT(DAY FROM (NOW() - NEW.fecha_recoleccion_real));
    END IF;
  END IF;

  -- Determinar SLA según tipo de trayecto
  CASE NEW.indicador_trayecto
    WHEN 'Local' THEN sla_days := 2;
    WHEN 'Zonal' THEN sla_days := 3;
    WHEN 'Nacional' THEN sla_days := 5;
    WHEN 'Especial' THEN sla_days := 7;
    ELSE sla_days := 3;
  END CASE;

  -- Calcular si cumple SLA
  IF NEW.estado = 'Entregado' AND NEW.dias_en_transito IS NOT NULL THEN
    NEW.sla_cumplido := NEW.dias_en_transito <= sla_days;
    NEW.fecha_cierre_logistico := NEW.fecha_actualizacion;
  END IF;

  -- Clasificar tipo de novedad automáticamente
  IF NEW.estado ILIKE '%novedad%' AND NEW.tipo_novedad IS NOT NULL THEN
    IF NEW.tipo_novedad IN ('Dirección errónea', 'Teléfono erróneo', 'Datos incompletos', 'Zona de difícil acceso') THEN
      NEW.novedad_tipo_clasificacion := 'Automática';
    ELSE
      NEW.novedad_tipo_clasificacion := 'Manual';
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Crear trigger para calcular métricas SLA automáticamente
DROP TRIGGER IF EXISTS trigger_calculate_sla ON public.pedidos;
CREATE TRIGGER trigger_calculate_sla
BEFORE INSERT OR UPDATE ON public.pedidos
FOR EACH ROW
EXECUTE FUNCTION public.calculate_sla_metrics();

-- Crear tabla de cola para procesamiento en background de API
CREATE TABLE IF NOT EXISTS public.api_queue (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  payload JSONB NOT NULL,
  source TEXT NOT NULL DEFAULT 'dropi',
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
  attempts INTEGER NOT NULL DEFAULT 0,
  max_attempts INTEGER NOT NULL DEFAULT 3,
  error_message TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  processed_at TIMESTAMP WITH TIME ZONE,
  priority INTEGER NOT NULL DEFAULT 5 CHECK (priority BETWEEN 1 AND 10)
);

-- Índices para la cola
CREATE INDEX IF NOT EXISTS idx_api_queue_status ON public.api_queue(status);
CREATE INDEX IF NOT EXISTS idx_api_queue_priority ON public.api_queue(priority DESC, created_at ASC);

-- RLS para api_queue
ALTER TABLE public.api_queue ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage api_queue" ON public.api_queue
FOR ALL USING (is_admin());

-- Vista materializada para indicadores Dropi (se refresca periódicamente)
CREATE OR REPLACE VIEW public.dropi_indicators AS
SELECT 
  COUNT(*) AS total_guias,
  COUNT(*) FILTER (WHERE estado IS NOT NULL AND estado != 'Pendiente') AS guias_movilizadas,
  COUNT(*) FILTER (WHERE estado = 'Entregado') AS guias_entregadas,
  COUNT(*) FILTER (WHERE estado = 'Devolución') AS guias_devueltas,
  COUNT(*) FILTER (WHERE estado ILIKE '%novedad%') AS guias_con_novedad,
  COUNT(*) FILTER (WHERE novedad_tipo_clasificacion = 'Automática') AS novedades_automaticas,
  COUNT(*) FILTER (WHERE novedad_tipo_clasificacion = 'Manual') AS novedades_manuales,
  COUNT(*) FILTER (WHERE sla_cumplido = TRUE) AS entregas_en_sla,
  COUNT(*) FILTER (WHERE intentos_entrega = 1 AND estado = 'Entregado') AS primer_intento_exitoso,
  COUNT(*) FILTER (WHERE valor_recaudar > 0) AS guias_con_recaudo,
  ROUND(AVG(dias_en_transito) FILTER (WHERE dias_en_transito > 0), 1) AS promedio_dias_transito,
  ROUND(100.0 * COUNT(*) FILTER (WHERE estado = 'Entregado') / NULLIF(COUNT(*) FILTER (WHERE estado IS NOT NULL AND estado != 'Pendiente'), 0), 2) AS porcentaje_entregas,
  ROUND(100.0 * COUNT(*) FILTER (WHERE sla_cumplido = TRUE) / NULLIF(COUNT(*) FILTER (WHERE estado = 'Entregado'), 0), 2) AS porcentaje_sla_cumplido
FROM public.pedidos
WHERE fecha_creacion >= NOW() - INTERVAL '30 days';