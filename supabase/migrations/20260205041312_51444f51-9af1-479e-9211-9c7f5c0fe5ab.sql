-- Corregir vista para usar SECURITY INVOKER (por defecto)
DROP VIEW IF EXISTS public.dropi_indicators;

-- Recrear vista con security_invoker explícito
CREATE VIEW public.dropi_indicators 
WITH (security_invoker = true) AS
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