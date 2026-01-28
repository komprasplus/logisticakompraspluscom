import { useState, useMemo } from "react";
import { motion } from "framer-motion";
import { 
  FileSpreadsheet, 
  Download, 
  Calendar, 
  Loader2,
  Package,
  CheckCircle2,
  AlertTriangle,
  TrendingUp
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import * as XLSX from "xlsx";
import { toast } from "sonner";
import { format, startOfMonth, endOfMonth, isWithinInterval, parseISO } from "date-fns";
import { es } from "date-fns/locale";

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

const ReportesView = ({ pedidos }: ReportesViewProps) => {
  const today = new Date();
  const [startDate, setStartDate] = useState(format(startOfMonth(today), "yyyy-MM-dd"));
  const [endDate, setEndDate] = useState(format(endOfMonth(today), "yyyy-MM-dd"));
  const [isGenerating, setIsGenerating] = useState(false);

  // Filter pedidos by date range
  const filteredPedidos = useMemo(() => {
    if (!startDate || !endDate) return pedidos;
    
    return pedidos.filter((p) => {
      if (!p.fecha_creacion) return false;
      const fecha = parseISO(p.fecha_creacion);
      return isWithinInterval(fecha, {
        start: parseISO(startDate),
        end: parseISO(endDate + "T23:59:59"),
      });
    });
  }, [pedidos, startDate, endDate]);

  // Calculate stats for filtered period
  const stats = useMemo(() => {
    const total = filteredPedidos.length;
    const entregados = filteredPedidos.filter(
      (p) => p.estado?.toLowerCase() === "entregado" || p.estado?.toLowerCase() === "liquidado"
    ).length;
    const novedades = filteredPedidos.filter(
      (p) => p.estado?.toLowerCase() === "novedad"
    ).length;
    const valorTotal = filteredPedidos.reduce((sum, p) => sum + (p.valor_recaudar || 0), 0);
    
    return { total, entregados, novedades, valorTotal };
  }, [filteredPedidos]);

  const handleDownloadExcel = async () => {
    if (filteredPedidos.length === 0) {
      toast.error("No hay pedidos en el rango seleccionado");
      return;
    }

    setIsGenerating(true);

    try {
      // Prepare data for Excel with financial breakdown
      const excelData = filteredPedidos.map((p) => {
        const recaudo = p.valor_recaudar || 0;
        const costoProducto = p.valor_producto || 0;
        const flete = p.valor_flete || 0;
        const fulfillment = p.fulfillment_cost || 0;
        const utilidadNeta = recaudo - costoProducto - flete - fulfillment;

        return {
          "Fecha": p.fecha_creacion 
            ? format(parseISO(p.fecha_creacion), "dd/MM/yyyy", { locale: es }) 
            : "-",
          "Guía": p.numero_guia || "-",
          "Cliente Final": p.cliente_nombre || "-",
          "Ciudad/Zona": p.zona || p.barrio || "-",
          "Dirección": p.direccion_entrega || "-",
          "Valor Recaudo": recaudo,
          "Costo Producto": costoProducto,
          "Valor Flete": flete,
          "Valor Fulfillment": fulfillment,
          "Utilidad Neta": utilidadNeta,
          "Estado": p.estado || "-",
          "Motivo Novedad": p.tipo_novedad || "-",
        };
      });

      // Calculate totals row
      const totals = {
        "Fecha": "",
        "Guía": "",
        "Cliente Final": "",
        "Ciudad/Zona": "",
        "Dirección": "TOTALES",
        "Valor Recaudo": excelData.reduce((sum, row) => sum + (row["Valor Recaudo"] || 0), 0),
        "Costo Producto": excelData.reduce((sum, row) => sum + (row["Costo Producto"] || 0), 0),
        "Valor Flete": excelData.reduce((sum, row) => sum + (row["Valor Flete"] || 0), 0),
        "Valor Fulfillment": excelData.reduce((sum, row) => sum + (row["Valor Fulfillment"] || 0), 0),
        "Utilidad Neta": excelData.reduce((sum, row) => sum + (row["Utilidad Neta"] || 0), 0),
        "Estado": "",
        "Motivo Novedad": "",
      };

      // Combine data with totals
      const dataWithTotals = [...excelData, totals];

      // Create workbook and worksheet
      const wb = XLSX.utils.book_new();
      const ws = XLSX.utils.json_to_sheet(dataWithTotals);

      // Set column widths
      ws["!cols"] = [
        { wch: 12 }, // Fecha
        { wch: 15 }, // Guía
        { wch: 25 }, // Cliente
        { wch: 15 }, // Ciudad
        { wch: 35 }, // Dirección
        { wch: 15 }, // Recaudo
        { wch: 15 }, // Costo Producto
        { wch: 12 }, // Flete
        { wch: 15 }, // Fulfillment
        { wch: 15 }, // Utilidad
        { wch: 12 }, // Estado
        { wch: 25 }, // Motivo
      ];

      XLSX.utils.book_append_sheet(wb, ws, "Pedidos");

      // Generate filename
      const filename = `Reporte_Pedidos_${format(parseISO(startDate), "ddMMyyyy")}_${format(parseISO(endDate), "ddMMyyyy")}.xlsx`;

      // Download
      XLSX.writeFile(wb, filename);
      toast.success("Reporte descargado exitosamente");
    } catch (error) {
      console.error("Error generating Excel:", error);
      toast.error("Error al generar el reporte");
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-6"
    >
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-500 to-emerald-600 shadow-lg shadow-emerald-500/30">
          <FileSpreadsheet className="h-6 w-6 text-white" />
        </div>
        <div>
          <h2 className="text-xl font-bold text-foreground">Reportes</h2>
          <p className="text-sm text-muted-foreground">Descarga informes de tus pedidos</p>
        </div>
      </div>

      {/* Date Range Selector */}
      <div className="rounded-2xl border border-border bg-white p-6 shadow-sm">
        <div className="flex items-center gap-2 mb-4">
          <Calendar className="h-5 w-5 text-primary" />
          <h3 className="font-semibold text-foreground">Seleccionar Rango de Fechas</h3>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
          <div>
            <Label htmlFor="start-date" className="text-sm text-muted-foreground">
              Fecha Inicio
            </Label>
            <Input
              id="start-date"
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="mt-1"
            />
          </div>
          <div>
            <Label htmlFor="end-date" className="text-sm text-muted-foreground">
              Fecha Fin
            </Label>
            <Input
              id="end-date"
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="mt-1"
            />
          </div>
        </div>

        {/* Period Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
          <div className="rounded-xl bg-muted/50 p-3 text-center">
            <Package className="h-5 w-5 mx-auto text-primary mb-1" />
            <p className="text-lg font-bold text-foreground">{stats.total}</p>
            <p className="text-xs text-muted-foreground">Total Pedidos</p>
          </div>
          <div className="rounded-xl bg-green-500/10 p-3 text-center">
            <CheckCircle2 className="h-5 w-5 mx-auto text-green-600 mb-1" />
            <p className="text-lg font-bold text-green-600">{stats.entregados}</p>
            <p className="text-xs text-muted-foreground">Entregados</p>
          </div>
          <div className="rounded-xl bg-orange-500/10 p-3 text-center">
            <AlertTriangle className="h-5 w-5 mx-auto text-orange-600 mb-1" />
            <p className="text-lg font-bold text-orange-600">{stats.novedades}</p>
            <p className="text-xs text-muted-foreground">Novedades</p>
          </div>
          <div className="rounded-xl bg-primary/10 p-3 text-center">
            <TrendingUp className="h-5 w-5 mx-auto text-primary mb-1" />
            <p className="text-lg font-bold text-primary">
              ${stats.valorTotal.toLocaleString("es-CO")}
            </p>
            <p className="text-xs text-muted-foreground">Valor Total</p>
          </div>
        </div>

        {/* Download Button */}
        <motion.div whileHover={{ scale: 1.01 }} whileTap={{ scale: 0.99 }}>
          <Button
            onClick={handleDownloadExcel}
            disabled={isGenerating || filteredPedidos.length === 0}
            className="w-full h-14 text-base font-bold bg-gradient-to-br from-emerald-500 to-emerald-600 hover:from-emerald-600 hover:to-emerald-700 shadow-lg shadow-emerald-500/30"
          >
            {isGenerating ? (
              <>
                <Loader2 className="h-5 w-5 animate-spin mr-2" />
                Generando...
              </>
            ) : (
              <>
                <Download className="h-5 w-5 mr-2" />
                Descargar Informe Excel
              </>
            )}
          </Button>
        </motion.div>

        {filteredPedidos.length === 0 && (
          <p className="text-center text-sm text-muted-foreground mt-4">
            No hay pedidos en el rango seleccionado
          </p>
        )}
      </div>

      {/* Info Card */}
      <div className="rounded-xl bg-primary/5 border border-primary/20 p-4">
        <p className="text-sm text-foreground">
          <strong>El reporte incluye:</strong> Fecha, Guía, Cliente Final, Ciudad/Zona, Dirección, 
          <span className="text-primary font-medium"> Valor Recaudo, Costo Producto, Valor Flete, Valor Fulfillment, Utilidad Neta</span>, Estado y Motivo Novedad.
        </p>
        <p className="text-xs text-muted-foreground mt-2">
          💡 Incluye fila de <strong>TOTALES</strong> al final para facilitar tu liquidación semanal.
        </p>
      </div>
    </motion.div>
  );
};

export default ReportesView;
