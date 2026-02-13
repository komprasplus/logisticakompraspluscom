import { useState, useMemo, useCallback, useRef, useId } from "react";
import { motion, useReducedMotion } from "framer-motion";
import {
  FileSpreadsheet,
  Download,
  Calendar,
  Loader2,
  Package,
  CheckCircle2,
  AlertTriangle,
  TrendingUp,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import * as XLSX from "xlsx";
import { toast } from "sonner";
import { formatCOP } from "@/lib/tarifas";
import { format, startOfMonth, endOfMonth, endOfDay, isWithinInterval, parseISO, isBefore, isAfter } from "date-fns";
import { es } from "date-fns/locale";

// ─── Constantes ───────────────────────────────────────────────────────────────

const FLETE_DEFAULT = 12000;

// ─── Tipos ────────────────────────────────────────────────────────────────────

interface Pedido {
  id: number;
  numero_guia: string | null;
  cliente_nombre: string | null;
  direccion_entrega: string | null;
  barrio: string | null;
  zona: string | null;
  valor_recaudar: number | null;
  valor_producto?: number | null;
  valor_flete?: number | null;
  fulfillment_cost?: number | null;
  estado: string | null;
  tipo_novedad: string | null;
  fecha_creacion: string | null;
}

interface ReportesViewProps {
  pedidos: Pedido[];
}

// ─── Componente ───────────────────────────────────────────────────────────────

const ReportesView = ({ pedidos }: ReportesViewProps) => {
  const today = new Date();
  const [startDate, setStartDate] = useState(format(startOfMonth(today), "yyyy-MM-dd"));
  const [endDate, setEndDate] = useState(format(endOfMonth(today), "yyyy-MM-dd"));
  const [isGenerating, setIsGenerating] = useState(false);

  const cancelRef = useRef(false);
  const prefersReducedMotion = useReducedMotion();
  const uid = useId();

  useCallback(
    () => () => {
      cancelRef.current = true;
    },
    [],
  );

  // ── Validación del rango de fechas ─────────────────────────────────────────

  /*
    FIX: detectar rango invertido en lugar de producir resultados vacíos sin aviso.
    Igual que PedidosView — si startDate > endDate el filtro retornaba 0 pedidos.
  */
  const dateRangeInverted = useMemo(() => {
    if (!startDate || !endDate) return false;
    try {
      return isAfter(parseISO(startDate), parseISO(endDate));
    } catch {
      return false;
    }
  }, [startDate, endDate]);

  // ── Filtrado por rango ─────────────────────────────────────────────────────

  const filteredPedidos = useMemo(() => {
    if (!startDate || !endDate || dateRangeInverted) return [];

    try {
      const from = parseISO(startDate);
      /*
        FIX: `endDate + "T23:59:59"` → `endOfDay(parseISO(endDate))`.
        Concatenar la cadena literal "T23:59:59" era frágil e inconsistente
        con el resto del código que usa date-fns. `endOfDay` ya estaba importado.
      */
      const to = endOfDay(parseISO(endDate));

      return pedidos.filter((p) => {
        if (!p.fecha_creacion) return false;
        try {
          return isWithinInterval(parseISO(p.fecha_creacion), { start: from, end: to });
        } catch {
          return false;
        }
      });
    } catch {
      return pedidos;
    }
  }, [pedidos, startDate, endDate, dateRangeInverted]);

  // ── Estadísticas del periodo ───────────────────────────────────────────────

  const stats = useMemo(() => {
    const total = filteredPedidos.length;
    const entregados = filteredPedidos.filter(
      (p) => p.estado?.toLowerCase() === "entregado" || p.estado?.toLowerCase() === "liquidado",
    ).length;
    const novedades = filteredPedidos.filter((p) => p.estado?.toLowerCase() === "novedad").length;
    /*
      FIX: `|| 0` → `?? 0` en la sumatoria de valor total.
      Un pedido con `valor_recaudar: 0` no debe sumarse como "sin valor".
    */
    const valorTotal = filteredPedidos.reduce((sum, p) => sum + (p.valor_recaudar ?? 0), 0);

    return { total, entregados, novedades, valorTotal };
  }, [filteredPedidos]);

  // ── Generación del Excel ───────────────────────────────────────────────────

  const handleDownloadExcel = useCallback(async () => {
    if (filteredPedidos.length === 0) {
      toast.error("No hay pedidos en el rango seleccionado");
      return;
    }

    setIsGenerating(true);
    try {
      const excelData = filteredPedidos.map((p) => {
        /*
          FIX: `|| 0` → `?? 0` en TODOS los campos financieros del Excel.
          Un pedido exonerado con `valor_flete: 0` mostraba `12000` en el
          reporte, distorsionando la utilidad neta. Mismo bug que en
          DevolucionesView, NovedadesView y PedidosView.

          FIX: `valor_flete ?? FLETE_DEFAULT` solo si `valor_flete` es null/undefined;
          si el campo existe explícitamente como 0 (exonerado), se respeta.
        */
        const recaudo = p.valor_recaudar ?? 0;
        const costoProducto = p.valor_producto ?? 0;
        const flete = p.valor_flete ?? FLETE_DEFAULT;
        const fulfillment = p.fulfillment_cost ?? 0;
        const utilidadNeta = recaudo - costoProducto - flete - fulfillment;

        return {
          Fecha: p.fecha_creacion ? format(parseISO(p.fecha_creacion), "dd/MM/yyyy", { locale: es }) : "-",
          Guía: p.numero_guia || "-",
          "Cliente Final": p.cliente_nombre || "-",
          "Ciudad/Zona": p.zona || p.barrio || "-",
          Dirección: p.direccion_entrega || "-",
          "Valor Recaudo": recaudo,
          "Costo Producto": costoProducto,
          "Valor Flete": flete,
          "Valor Fulfillment": fulfillment,
          "Utilidad Neta": utilidadNeta,
          Estado: p.estado || "-",
          "Motivo Novedad": p.tipo_novedad || "-",
        };
      });

      const totals = {
        Fecha: "",
        Guía: "",
        "Cliente Final": "",
        "Ciudad/Zona": "",
        Dirección: "TOTALES",
        "Valor Recaudo": excelData.reduce((sum, row) => sum + row["Valor Recaudo"], 0),
        "Costo Producto": excelData.reduce((sum, row) => sum + row["Costo Producto"], 0),
        "Valor Flete": excelData.reduce((sum, row) => sum + row["Valor Flete"], 0),
        "Valor Fulfillment": excelData.reduce((sum, row) => sum + row["Valor Fulfillment"], 0),
        "Utilidad Neta": excelData.reduce((sum, row) => sum + row["Utilidad Neta"], 0),
        Estado: "",
        "Motivo Novedad": "",
      };

      const wb = XLSX.utils.book_new();
      const ws = XLSX.utils.json_to_sheet([...excelData, totals]);

      ws["!cols"] = [
        { wch: 12 },
        { wch: 15 },
        { wch: 25 },
        { wch: 15 },
        { wch: 35 },
        { wch: 15 },
        { wch: 15 },
        { wch: 12 },
        { wch: 15 },
        { wch: 15 },
        { wch: 12 },
        { wch: 25 },
      ];

      XLSX.utils.book_append_sheet(wb, ws, "Pedidos");

      const filename = `Reporte_Pedidos_${format(parseISO(startDate), "ddMMyyyy")}_${format(parseISO(endDate), "ddMMyyyy")}.xlsx`;
      XLSX.writeFile(wb, filename);

      if (cancelRef.current) return;
      toast.success("Reporte descargado exitosamente");
    } catch (error) {
      if (cancelRef.current) return;
      console.error("Error generating Excel:", error);
      toast.error("Error al generar el reporte");
    } finally {
      if (!cancelRef.current) setIsGenerating(false);
    }
  }, [filteredPedidos, startDate, endDate]);

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <motion.div
      initial={{ opacity: 0, y: prefersReducedMotion ? 0 : 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-6"
    >
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-500 to-emerald-600 shadow-lg shadow-emerald-500/30 flex-shrink-0">
          <FileSpreadsheet className="h-6 w-6 text-white" aria-hidden="true" />
        </div>
        <div>
          <h2 className="text-xl font-bold text-foreground">Reportes</h2>
          <p className="text-sm text-muted-foreground">Descarga informes de tus pedidos</p>
        </div>
      </div>

      {/* Selector de rango de fechas */}
      <div className="rounded-2xl border border-border bg-card p-6 shadow-sm">
        {/*
          FIX: `bg-white` → `bg-card`.
          `bg-white` no funciona en modo oscuro — el contenedor era blanco en
          dark mode, rompiendo el diseño. `bg-card` usa el token semántico
          correcto del tema, idéntico al resto de las cards del proyecto.
        */}
        <div className="flex items-center gap-2 mb-4">
          <Calendar className="h-5 w-5 text-primary" aria-hidden="true" />
          <h3 className="font-semibold text-foreground">Seleccionar Rango de Fechas</h3>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
          <div>
            <Label htmlFor={`${uid}-start`} className="text-sm text-muted-foreground">
              Fecha Inicio
            </Label>
            <Input
              id={`${uid}-start`}
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="mt-1"
              aria-describedby={dateRangeInverted ? `${uid}-date-error` : undefined}
            />
          </div>
          <div>
            <Label htmlFor={`${uid}-end`} className="text-sm text-muted-foreground">
              Fecha Fin
            </Label>
            <Input
              id={`${uid}-end`}
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="mt-1"
              aria-describedby={dateRangeInverted ? `${uid}-date-error` : undefined}
            />
          </div>
        </div>

        {/*
          FIX: mensaje de error visible cuando el rango está invertido.
          Antes el filtro retornaba 0 resultados en silencio — el usuario no
          sabía si no había pedidos o si el rango era inválido.
        */}
        {dateRangeInverted && (
          <p id={`${uid}-date-error`} className="text-xs text-destructive mb-4" role="alert">
            La fecha de inicio no puede ser posterior a la fecha de fin.
          </p>
        )}

        {/* Estadísticas del periodo */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
          <div className="rounded-xl bg-muted/50 p-3 text-center">
            <Package className="h-5 w-5 mx-auto text-primary mb-1" aria-hidden="true" />
            <p className="text-lg font-bold text-foreground">{stats.total}</p>
            <p className="text-xs text-muted-foreground">Total Pedidos</p>
          </div>
          <div className="rounded-xl bg-green-500/10 p-3 text-center">
            <CheckCircle2 className="h-5 w-5 mx-auto text-green-600 mb-1" aria-hidden="true" />
            <p className="text-lg font-bold text-green-600">{stats.entregados}</p>
            <p className="text-xs text-muted-foreground">Entregados</p>
          </div>
          <div className="rounded-xl bg-orange-500/10 p-3 text-center">
            <AlertTriangle className="h-5 w-5 mx-auto text-orange-600 mb-1" aria-hidden="true" />
            <p className="text-lg font-bold text-orange-600">{stats.novedades}</p>
            <p className="text-xs text-muted-foreground">Novedades</p>
          </div>
          <div className="rounded-xl bg-primary/10 p-3 text-center">
            <TrendingUp className="h-5 w-5 mx-auto text-primary mb-1" aria-hidden="true" />
            {/*
              FIX: `toLocaleString("es-CO")` → `formatCOP()`.
              `toLocaleString` depende del locale del navegador del usuario y
              puede producir formatos inconsistentes. `formatCOP` es la función
              estandarizada usada en todo el proyecto para valores en pesos COP.
            */}
            <p className="text-lg font-bold text-primary">{formatCOP(stats.valorTotal)}</p>
            <p className="text-xs text-muted-foreground">Valor Total</p>
          </div>
        </div>

        {/* Botón de descarga */}
        {/*
          FIX: `whileHover/whileTap` sin `prefers-reduced-motion`.
          El `scale` del wrapper se aplica siempre. Reemplazado con
          el patrón condicional ya usado en el proyecto.
        */}
        <motion.div
          whileHover={prefersReducedMotion ? undefined : { scale: 1.01 }}
          whileTap={prefersReducedMotion ? undefined : { scale: 0.99 }}
        >
          <Button
            type="button"
            onClick={handleDownloadExcel}
            disabled={isGenerating || filteredPedidos.length === 0 || dateRangeInverted}
            className="w-full h-14 text-base font-bold bg-gradient-to-br from-emerald-500 to-emerald-600 hover:from-emerald-600 hover:to-emerald-700 shadow-lg shadow-emerald-500/30"
            aria-busy={isGenerating}
          >
            {isGenerating ? (
              <>
                <Loader2 className="h-5 w-5 animate-spin mr-2" aria-hidden="true" />
                Generando...
              </>
            ) : (
              <>
                <Download className="h-5 w-5 mr-2" aria-hidden="true" />
                Descargar Informe Excel
              </>
            )}
          </Button>
        </motion.div>

        {filteredPedidos.length === 0 && !dateRangeInverted && (
          <p className="text-center text-sm text-muted-foreground mt-4">No hay pedidos en el rango seleccionado</p>
        )}
      </div>

      {/* Info card */}
      <div className="rounded-xl bg-primary/5 border border-primary/20 p-4" role="note">
        <p className="text-sm text-foreground">
          <strong>El reporte incluye:</strong> Fecha, Guía, Cliente Final, Ciudad/Zona, Dirección,{" "}
          <span className="text-primary font-medium">
            Valor Recaudo, Costo Producto, Valor Flete, Valor Fulfillment, Utilidad Neta
          </span>
          , Estado y Motivo Novedad.
        </p>
        <p className="text-xs text-muted-foreground mt-2">
          💡 Incluye fila de <strong>TOTALES</strong> al final para facilitar tu liquidación semanal.
        </p>
      </div>
    </motion.div>
  );
};

export default ReportesView;
