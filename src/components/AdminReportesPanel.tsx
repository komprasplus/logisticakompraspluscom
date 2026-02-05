import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { FileSpreadsheet, Store, Calendar, Download, Loader2, Filter, AlertCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import * as XLSX from "xlsx";

interface Tienda {
  user_id: string;
  store_name: string | null;
  full_name: string;
}

interface Pedido {
  id: number;
  numero_guia: string | null;
  cliente_nombre: string | null;
  direccion_entrega: string | null;
  barrio: string | null;
  zona: string | null;
  valor_recaudar: number | null;
  valor_producto: number | null;
  valor_flete: number | null;
  fulfillment_cost: number | null;
  estado: string | null;
  tipo_novedad: string | null;
  metodo_pago: string | null;
  fecha_creacion: string | null;
  motorizado_asignado: string | null;
  client_user_id: string | null;
}

const AdminReportesPanel = () => {
  const [tiendas, setTiendas] = useState<Tienda[]>([]);
  const [selectedTienda, setSelectedTienda] = useState<string>("todas");
  const [startDate, setStartDate] = useState<string>("");
  const [endDate, setEndDate] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [loadingTiendas, setLoadingTiendas] = useState(true);

  useEffect(() => {
    fetchTiendas();
    // Set default date range to current month
    const now = new Date();
    const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
    setStartDate(firstDay.toISOString().split("T")[0]);
    setEndDate(now.toISOString().split("T")[0]);
  }, []);

  const fetchTiendas = async () => {
    try {
      // Get all clients (users with cliente role)
      const { data: roles, error: rolesError } = await supabase
        .from("user_roles")
        .select("user_id")
        .eq("role", "cliente");

      if (rolesError) throw rolesError;

      if (roles && roles.length > 0) {
        const clienteIds = roles.map((r) => r.user_id);
        
        const { data: profiles, error: profilesError } = await supabase
          .from("profiles")
          .select("user_id, store_name, full_name")
          .in("user_id", clienteIds);

        if (profilesError) throw profilesError;
        setTiendas(profiles || []);
      }
    } catch (error) {
      console.error("Error fetching tiendas:", error);
      toast.error("Error al cargar las tiendas");
    } finally {
      setLoadingTiendas(false);
    }
  };

  const handleDownloadExcel = async () => {
    if (!startDate || !endDate) {
      toast.error("Selecciona un rango de fechas");
      return;
    }

    setLoading(true);

    try {
      let query = supabase
        .from("pedidos")
        .select("*")
        .gte("fecha_creacion", `${startDate}T00:00:00`)
        .lte("fecha_creacion", `${endDate}T23:59:59`)
        .order("fecha_creacion", { ascending: false });

      // Filter by tienda if selected
      if (selectedTienda !== "todas") {
        query = query.eq("client_user_id", selectedTienda);
      }

      // Use chunked fetching for "todas" to avoid timeout
      let allPedidos: Pedido[] = [];
      
      if (selectedTienda === "todas") {
        // Fetch in chunks of 500 to prevent timeouts
        const CHUNK_SIZE = 500;
        let offset = 0;
        let hasMore = true;
        
        while (hasMore) {
          const { data: chunk, error: chunkError } = await query
            .range(offset, offset + CHUNK_SIZE - 1);
          
          if (chunkError) throw chunkError;
          
          if (!chunk || chunk.length === 0) {
            hasMore = false;
          } else {
            allPedidos = [...allPedidos, ...chunk];
            offset += CHUNK_SIZE;
            // Stop if we got less than chunk size (last page)
            if (chunk.length < CHUNK_SIZE) {
              hasMore = false;
            }
          }
          
          // Progress toast for large datasets
          if (allPedidos.length > 0 && allPedidos.length % 1000 === 0) {
            toast.info(`Procesando... ${allPedidos.length} registros`);
          }
        }
      } else {
        const { data: pedidos, error } = await query;
        if (error) throw error;
        allPedidos = pedidos || [];
      }

      if (allPedidos.length === 0) {
        toast.error("No hay pedidos en el rango seleccionado");
        setLoading(false);
        return;
      }

      // Find the tienda name for the report
      const tiendaNombre = selectedTienda === "todas" 
        ? "Todas las Tiendas"
        : tiendas.find((t) => t.user_id === selectedTienda)?.store_name ||
          tiendas.find((t) => t.user_id === selectedTienda)?.full_name ||
          "Tienda";

      // Prepare Excel data
      const excelData = allPedidos.map((p: Pedido) => {
        const recaudo = p.valor_recaudar || 0;
        const costoProducto = p.valor_producto || 0;
        const flete = p.valor_flete || 0;
        const fulfillment = p.fulfillment_cost || 0;
        const utilidadNeta = recaudo - costoProducto - flete - fulfillment;

        return {
          "Fecha": p.fecha_creacion 
            ? new Date(p.fecha_creacion).toLocaleDateString("es-CO") 
            : "-",
          "N° Guía": p.numero_guia || `#${p.id}`,
          "Cliente Final": p.cliente_nombre || "-",
          "Ciudad/Zona": p.zona || "-",
          "Barrio": p.barrio || "-",
          "Dirección": p.direccion_entrega || "-",
          "Método Pago": p.metodo_pago === "anticipado" ? "Anticipado" : "Contra Entrega",
          "Valor Recaudo": recaudo,
          "Costo Producto": costoProducto,
          "Valor Flete": flete,
          "Valor Fulfillment": fulfillment,
          "Utilidad Neta": utilidadNeta,
          "Estado": p.estado || "-",
          "Motivo Novedad": p.tipo_novedad || "-",
          "Motorizado": p.motorizado_asignado || "-",
        };
      });

      // Calculate totals
      const totals = {
        "Fecha": "",
        "N° Guía": "",
        "Cliente Final": "",
        "Ciudad/Zona": "",
        "Barrio": "",
        "Dirección": "",
        "Método Pago": "TOTALES",
        "Valor Recaudo": excelData.reduce((sum, row) => sum + (row["Valor Recaudo"] || 0), 0),
        "Costo Producto": excelData.reduce((sum, row) => sum + (row["Costo Producto"] || 0), 0),
        "Valor Flete": excelData.reduce((sum, row) => sum + (row["Valor Flete"] || 0), 0),
        "Valor Fulfillment": excelData.reduce((sum, row) => sum + (row["Valor Fulfillment"] || 0), 0),
        "Utilidad Neta": excelData.reduce((sum, row) => sum + (row["Utilidad Neta"] || 0), 0),
        "Estado": "",
        "Motivo Novedad": "",
        "Motorizado": "",
      };

      // Add totals row
      const dataWithTotals = [...excelData, totals];

      // Create workbook
      const wb = XLSX.utils.book_new();
      const ws = XLSX.utils.json_to_sheet(dataWithTotals);

      // Set column widths
      ws["!cols"] = [
        { wch: 12 }, // Fecha
        { wch: 15 }, // Guía
        { wch: 25 }, // Cliente
        { wch: 12 }, // Zona
        { wch: 20 }, // Barrio
        { wch: 35 }, // Dirección
        { wch: 15 }, // Método Pago
        { wch: 15 }, // Recaudo
        { wch: 15 }, // Costo Producto
        { wch: 12 }, // Flete
        { wch: 15 }, // Fulfillment
        { wch: 15 }, // Utilidad
        { wch: 12 }, // Estado
        { wch: 20 }, // Motivo
        { wch: 20 }, // Motorizado
      ];

      XLSX.utils.book_append_sheet(wb, ws, "Pedidos");

      // Download
      const fileName = `Reporte_${tiendaNombre.replace(/\s+/g, "_")}_${startDate}_${endDate}.xlsx`;
      XLSX.writeFile(wb, fileName);

      toast.success(`Reporte descargado: ${allPedidos.length} pedidos`);
    } catch (error) {
      console.error("Error generating report:", error);
      toast.error("Error al generar el reporte");
    } finally {
      setLoading(false);
    }
  };

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="p-3 bg-primary/10 rounded-xl">
          <FileSpreadsheet className="h-6 w-6 text-primary" />
        </div>
        <div>
          <h2 className="text-xl font-bold text-foreground">Informes por Tienda</h2>
          <p className="text-sm text-muted-foreground">Genera reportes detallados en Excel</p>
        </div>
      </div>

      {/* Filters Card */}
      <div className="rounded-xl bg-card p-6 shadow-card border border-border">
        <div className="flex items-center gap-2 mb-4">
          <Filter className="h-5 w-5 text-primary" />
          <h3 className="font-semibold text-foreground">Filtros del Reporte</h3>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Tienda Selector */}
          <div>
            <label className="block text-sm font-medium text-foreground mb-2">
              <Store className="inline h-4 w-4 mr-1" />
              Tienda
            </label>
            <select
              value={selectedTienda}
              onChange={(e) => setSelectedTienda(e.target.value)}
              disabled={loadingTiendas}
              className="w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
            >
              <option value="todas">Todas las tiendas</option>
              {tiendas.map((tienda) => (
                <option key={tienda.user_id} value={tienda.user_id}>
                  {tienda.store_name || tienda.full_name}
                </option>
              ))}
            </select>
          </div>

          {/* Start Date */}
          <div>
            <label className="block text-sm font-medium text-foreground mb-2">
              <Calendar className="inline h-4 w-4 mr-1" />
              Fecha Inicio
            </label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
            />
          </div>

          {/* End Date */}
          <div>
            <label className="block text-sm font-medium text-foreground mb-2">
              <Calendar className="inline h-4 w-4 mr-1" />
              Fecha Fin
            </label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
            />
          </div>

          {/* Download Button */}
          <div className="flex items-end">
            <Button
              onClick={handleDownloadExcel}
              disabled={loading || !startDate || !endDate}
              className="w-full gap-2"
            >
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Generando...
                </>
              ) : (
                <>
                  <Download className="h-4 w-4" />
                  Descargar Excel
                </>
              )}
            </Button>
          </div>
        </div>
      </div>

      {/* Info Card */}
      <div className="rounded-xl bg-muted/50 p-4 border border-border">
        <p className="text-sm text-muted-foreground">
          <strong>Columnas del reporte:</strong> Fecha, N° Guía, Cliente Final, Ciudad/Zona, 
          Barrio, Dirección, Método Pago, Valor Recaudo, <span className="text-primary font-medium">Costo Producto, Valor Flete, Valor Fulfillment, Utilidad Neta</span>, Estado, Motivo Novedad, Motorizado.
        </p>
        <p className="text-xs text-muted-foreground mt-2">
          💡 Incluye fila de <strong>TOTALES</strong> al final para facilitar la liquidación.
        </p>
      </div>
    </motion.div>
  );
};

export default AdminReportesPanel;