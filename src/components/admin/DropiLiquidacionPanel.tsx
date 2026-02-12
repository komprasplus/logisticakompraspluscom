import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { motion } from "framer-motion";
import {
  DollarSign,
  TrendingUp,
  Package,
  AlertTriangle,
  CheckCircle2,
  Loader2,
  RefreshCw,
  Clock,
  Truck,
  AlertCircle,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { usePagination } from "@/hooks/usePagination";
import PaginationControls from "@/components/PaginationControls";

// ─── Tipos ────────────────────────────────────────────────────────────────────

interface DropiIndicators {
  total_guias: number;
  guias_movilizadas: number;
  guias_entregadas: number;
  guias_devueltas: number;
  guias_con_novedad: number;
  novedades_automaticas: number;
  novedades_manuales: number;
  entregas_en_sla: number;
  primer_intento_exitoso: number;
  guias_con_recaudo: number;
  promedio_dias_transito: number | null;
  porcentaje_entregas: number | null;
  porcentaje_sla_cumplido: number | null;
}

interface LiquidacionDropi {
  id: number;
  numero_guia: string | null;
  estado: string | null;
  valor_recaudar: number | null;
  valor_flete: number | null;
  valor_producto: number | null;
  utilidad: number | null;
  sla_cumplido: boolean | null;
  dias_en_transito: number | null;
  fecha_cierre_logistico: string | null;
  cliente_nombre: string | null;
  municipio: string | null;
  store_name?: string | null;
}

// ─── Constantes ───────────────────────────────────────────────────────────────

/** Límite de registros por carga. Se avisa al usuario si se alcanza. */
const FETCH_LIMIT = 500;

/** Formatea un número como COP */
const formatCOP = (value: number): string => `$${value.toLocaleString("es-CO")}`;

/** Formatea un porcentaje con fallback */
const formatPct = (value: number | null | undefined): string => (value != null ? `${value.toFixed(1)}%` : "—");

// ─── Componente ───────────────────────────────────────────────────────────────

const DropiLiquidacionPanel = () => {
  const [indicators, setIndicators] = useState<DropiIndicators | null>(null);
  const [pedidos, setPedidos] = useState<LiquidacionDropi[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [hasError, setHasError] = useState(false);

  /*
    FIX: ref para cancelar setState si el componente se desmonta
    mientras hay una petición en vuelo (evita memory leak).
  */
  const cancelRef = useRef(false);

  const {
    paginatedItems,
    currentPage,
    totalPages,
    startIndex,
    endIndex,
    totalItems,
    itemsPerPage,
    goToPage,
    setItemsPerPage,
  } = usePagination({ items: pedidos, itemsPerPage: 15 });

  // ── Fetch ──────────────────────────────────────────────────────────────────

  /*
    FIX: fetchData en useCallback para poder incluirla en el useEffect
    sin generar un loop infinito y sin el warning de exhaustive-deps.
  */
  const fetchData = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    setHasError(false);

    try {
      // Las dos queries se lanzan en paralelo — antes eran secuenciales
      const [indicatorsResult, pedidosResult] = await Promise.all([
        supabase.from("dropi_indicators").select("*").single(),

        supabase
          .from("pedidos")
          .select(
            `
            id,
            numero_guia,
            estado,
            valor_recaudar,
            valor_flete,
            valor_producto,
            utilidad,
            sla_cumplido,
            dias_en_transito,
            fecha_cierre_logistico,
            cliente_nombre,
            municipio,
            client_user_id
          `,
          )
          .in("estado", ["Entregado", "Liquidado"])
          .gt("valor_recaudar", 0)
          .order("fecha_cierre_logistico", { ascending: false })
          .limit(FETCH_LIMIT),
      ]);

      if (cancelRef.current) return;

      if (indicatorsResult.error) {
        console.error("Error fetching indicators:", indicatorsResult.error);
      } else {
        setIndicators(indicatorsResult.data);
      }

      if (pedidosResult.error) {
        console.error("Error fetching pedidos:", pedidosResult.error);
        setHasError(true);
        toast.error("Error al cargar guías de liquidación");
      } else {
        setPedidos(pedidosResult.data ?? []);

        /*
          FIX: avisar al usuario si se alcanzó el límite de registros,
          porque los totales financieros serían incorrectos sin este aviso.
          Antes el .limit(200) truncaba silenciosamente los datos.
        */
        if ((pedidosResult.data?.length ?? 0) >= FETCH_LIMIT) {
          toast.warning(`Se muestran los primeros ${FETCH_LIMIT} registros. Los totales reflejan solo esta muestra.`);
        }
      }
    } catch (error) {
      if (cancelRef.current) return;
      console.error("Error:", error);
      setHasError(true);
      toast.error("Error al cargar datos de liquidación");
    } finally {
      if (!cancelRef.current) {
        setLoading(false);
        setRefreshing(false);
      }
    }
  }, []);

  useEffect(() => {
    cancelRef.current = false;
    fetchData();
    return () => {
      cancelRef.current = true;
    };
  }, [fetchData]);

  const handleRefresh = useCallback(() => fetchData(true), [fetchData]);

  // ── Totales financieros memoizados ─────────────────────────────────────────

  /*
    FIX: useMemo para no recalcular en cada render.
    FIX: tipado correcto — los campos son number | null en la interfaz,
    así que usamos ?? 0 (nullish) en lugar de || 0 para no ignorar el 0.
  */
  const financials = useMemo(() => {
    const totalRecaudo = pedidos.reduce((sum, p) => sum + (p.valor_recaudar ?? 0), 0);
    const totalFletes = pedidos.reduce((sum, p) => sum + (p.valor_flete ?? 0), 0);
    return {
      totalRecaudo,
      totalFletes,
      saldoNeto: totalRecaudo - totalFletes,
    };
  }, [pedidos]);

  // ── Estados de UI ──────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  /*
    FIX: estado de error explícito en lugar de pantalla vacía sin contexto.
    Antes, si ambas queries fallaban, el usuario veía una tabla vacía sin saber qué pasó.
  */
  if (hasError && pedidos.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 gap-3 text-center">
        <AlertCircle className="h-10 w-10 text-destructive" />
        <p className="font-medium text-foreground">Error al cargar los datos</p>
        <p className="text-sm text-muted-foreground">No se pudieron obtener las guías de liquidación</p>
        <Button variant="outline" onClick={handleRefresh} className="gap-2">
          <RefreshCw className="h-4 w-4" />
          Reintentar
        </Button>
      </div>
    );
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-foreground">Liquidación Dropi</h2>
          <p className="text-sm text-muted-foreground">Cruce de guías con recaudo vs fletes para reporte a Dropi</p>
        </div>
        <Button variant="outline" size="sm" onClick={handleRefresh} disabled={refreshing} className="gap-2">
          <RefreshCw className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`} />
          Actualizar
        </Button>
      </div>

      {/* KPI Cards */}
      {indicators && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Card className="bg-gradient-to-br from-blue-500 to-blue-600 text-white border-0">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2 opacity-90">
                <Package className="h-4 w-4" />
                Guías Movilizadas
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">{indicators.guias_movilizadas}</p>
              {/* FIX: formatPct maneja null con "—" en lugar de mostrar vacío */}
              <p className="text-xs opacity-75">{formatPct(indicators.porcentaje_entregas)} entregadas</p>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-green-500 to-green-600 text-white border-0">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2 opacity-90">
                <CheckCircle2 className="h-4 w-4" />
                Entregas en SLA
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">{indicators.entregas_en_sla}</p>
              <p className="text-xs opacity-75">{formatPct(indicators.porcentaje_sla_cumplido)} cumplimiento</p>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-orange-500 to-orange-600 text-white border-0">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2 opacity-90">
                <AlertTriangle className="h-4 w-4" />
                Novedades
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">{indicators.guias_con_novedad}</p>
              <p className="text-xs opacity-75">
                {indicators.novedades_automaticas} auto / {indicators.novedades_manuales} manual
              </p>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-purple-500 to-purple-600 text-white border-0">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2 opacity-90">
                <Clock className="h-4 w-4" />
                Días Promedio
              </CardTitle>
            </CardHeader>
            <CardContent>
              {/*
                FIX: usamos ?? "—" en lugar de || "—".
                Con ||, el valor 0 también mostraba "—", lo cual es incorrecto
                si el promedio real es 0 días.
              */}
              <p className="text-2xl font-bold">{indicators.promedio_dias_transito ?? "—"}</p>
              <p className="text-xs opacity-75">tiempo en tránsito</p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Resumen financiero */}
      <div className="grid grid-cols-3 gap-4">
        <Card className="border-blue-200 bg-blue-50 dark:bg-blue-950/20">
          <CardContent className="pt-4">
            <div className="flex items-center gap-2 text-blue-600 dark:text-blue-400 mb-1">
              <DollarSign className="h-4 w-4" />
              <span className="text-sm font-medium">Total Recaudo</span>
            </div>
            <p className="text-2xl font-bold text-blue-700 dark:text-blue-300">{formatCOP(financials.totalRecaudo)}</p>
          </CardContent>
        </Card>

        <Card className="border-orange-200 bg-orange-50 dark:bg-orange-950/20">
          <CardContent className="pt-4">
            <div className="flex items-center gap-2 text-orange-600 dark:text-orange-400 mb-1">
              <Truck className="h-4 w-4" />
              <span className="text-sm font-medium">Total Fletes</span>
            </div>
            <p className="text-2xl font-bold text-orange-700 dark:text-orange-300">
              {formatCOP(financials.totalFletes)}
            </p>
          </CardContent>
        </Card>

        <Card className="border-green-200 bg-green-50 dark:bg-green-950/20">
          <CardContent className="pt-4">
            <div className="flex items-center gap-2 text-green-600 dark:text-green-400 mb-1">
              <TrendingUp className="h-4 w-4" />
              <span className="text-sm font-medium">Saldo Neto</span>
            </div>
            <p className="text-2xl font-bold text-green-700 dark:text-green-300">{formatCOP(financials.saldoNeto)}</p>
          </CardContent>
        </Card>
      </div>

      {/* Tabla de guías */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-lg">Guías con Recaudo ({totalItems})</CardTitle>
        </CardHeader>
        <CardContent>
          {pedidos.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Package className="h-12 w-12 mx-auto mb-3 opacity-30" />
              <p>No hay guías con recaudo pendiente</p>
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/50">
                      <TableHead>Guía</TableHead>
                      <TableHead>Estado</TableHead>
                      <TableHead>Municipio</TableHead>
                      <TableHead className="text-right">Recaudo</TableHead>
                      <TableHead className="text-right">Flete</TableHead>
                      <TableHead className="text-right">Neto</TableHead>
                      <TableHead className="text-center">SLA</TableHead>
                      <TableHead className="text-center">Días</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {paginatedItems.map((pedido) => {
                      // FIX: ?? 0 para no ignorar valores legítimos de 0
                      const recaudo = pedido.valor_recaudar ?? 0;
                      const flete = pedido.valor_flete ?? 0;
                      const neto = recaudo - flete;

                      return (
                        <TableRow key={pedido.id} className="hover:bg-muted/30">
                          <TableCell className="font-mono text-sm">{pedido.numero_guia || `#${pedido.id}`}</TableCell>

                          <TableCell>
                            <span
                              className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${
                                pedido.estado === "Entregado"
                                  ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
                                  : "bg-teal-100 text-teal-700 dark:bg-teal-900/30 dark:text-teal-400"
                              }`}
                            >
                              {pedido.estado}
                            </span>
                          </TableCell>

                          <TableCell className="text-sm">{pedido.municipio || "—"}</TableCell>

                          <TableCell className="text-right font-medium">{formatCOP(recaudo)}</TableCell>

                          <TableCell className="text-right text-orange-600 dark:text-orange-400">
                            {formatCOP(flete)}
                          </TableCell>

                          {/* FIX: color dinámico — rojo si neto negativo */}
                          <TableCell
                            className={`text-right font-bold ${
                              neto >= 0 ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"
                            }`}
                          >
                            {formatCOP(neto)}
                          </TableCell>

                          <TableCell className="text-center">
                            {pedido.sla_cumplido === true ? (
                              <CheckCircle2 className="h-4 w-4 text-green-500 mx-auto" />
                            ) : pedido.sla_cumplido === false ? (
                              <AlertTriangle className="h-4 w-4 text-orange-500 mx-auto" />
                            ) : (
                              <span className="text-muted-foreground">—</span>
                            )}
                          </TableCell>

                          {/*
                            FIX: ?? "—" en lugar de || "—".
                            0 días en tránsito es un valor válido que no debe
                            mostrarse como "—".
                          */}
                          <TableCell className="text-center">{pedido.dias_en_transito ?? "—"}</TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>

              {totalPages > 1 && (
                <div className="mt-4">
                  <PaginationControls
                    currentPage={currentPage}
                    totalPages={totalPages}
                    startIndex={startIndex}
                    endIndex={endIndex}
                    totalItems={totalItems}
                    itemsPerPage={itemsPerPage}
                    onPageChange={goToPage}
                    onItemsPerPageChange={setItemsPerPage}
                  />
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </motion.div>
  );
};

export default DropiLiquidacionPanel;
