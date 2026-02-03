import { useState, useCallback, useEffect } from "react";
import { motion } from "framer-motion";
import {
  Search,
  Loader2,
  RotateCcw,
  Database,
  AlertTriangle,
  Package,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { getStatusConfig } from "@/lib/orderStatuses";
import { toast } from "sonner";

interface AuditPedido {
  id: number;
  numero_guia: string | null;
  cliente_nombre: string | null;
  direccion_entrega: string | null;
  estado: string | null;
  fecha_creacion: string | null;
  fecha_entrega: string | null;
  motorizado_asignado: string | null;
  tipo_novedad: string | null;
  client_user_id: string | null;
}

interface AuditOrdersPanelProps {
  onPedidoClick?: (pedido: AuditPedido) => void;
}

const PAGE_SIZE = 50;

/**
 * Emergency audit panel that shows raw Supabase orders
 * without any filtering logic - for debugging visibility issues.
 */
const AuditOrdersPanel = ({ onPedidoClick }: AuditOrdersPanelProps) => {
  const [orders, setOrders] = useState<AuditPedido[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [currentPage, setCurrentPage] = useState(0);
  const [totalCount, setTotalCount] = useState(0);
  const [lastFetchTime, setLastFetchTime] = useState<Date | null>(null);

  const fetchOrders = useCallback(async (page = 0, search = "") => {
    setLoading(true);
    try {
      const from = page * PAGE_SIZE;
      const to = from + PAGE_SIZE - 1;

      let query = supabase
        .from("pedidos")
        .select("id, numero_guia, cliente_nombre, direccion_entrega, estado, fecha_creacion, fecha_entrega, motorizado_asignado, tipo_novedad, client_user_id", { count: "exact" });

      // Apply search if provided
      if (search.trim()) {
        query = query.or(`numero_guia.ilike.%${search.trim()}%,cliente_nombre.ilike.%${search.trim()}%`);
      }

      const { data, error, count } = await query
        .order("fecha_creacion", { ascending: false })
        .range(from, to);

      if (error) throw error;

      setOrders(data || []);
      setTotalCount(count || 0);
      setCurrentPage(page);
      setLastFetchTime(new Date());
    } catch (err: any) {
      console.error("Audit fetch error:", err);
      toast.error("Error al cargar auditoría: " + (err.message || "desconocido"));
    } finally {
      setLoading(false);
    }
  }, []);

  // Initial fetch
  useEffect(() => {
    fetchOrders(0, "");
  }, [fetchOrders]);

  const handleSearch = () => {
    fetchOrders(0, searchQuery);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      handleSearch();
    }
  };

  const totalPages = Math.ceil(totalCount / PAGE_SIZE);

  const StatusBadge = ({ status }: { status: string | null }) => {
    const config = getStatusConfig(status);
    return (
      <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium ${config.bgColor} ${config.textColor}`}>
        {config.label}
      </span>
    );
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="p-4 space-y-4"
    >
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-2">
          <Database className="h-5 w-5 text-primary" />
          <h2 className="text-lg font-bold text-foreground">
            Auditoría de Órdenes
          </h2>
          <span className="text-sm text-muted-foreground">
            (Vista bruta sin filtros)
          </span>
        </div>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          {lastFetchTime && (
            <span>Actualizado: {lastFetchTime.toLocaleTimeString()}</span>
          )}
          <span className="font-semibold">Total: {totalCount}</span>
        </div>
      </div>

      {/* Warning Banner */}
      <div className="flex items-start gap-2 p-3 rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800">
        <AlertTriangle className="h-5 w-5 text-amber-600 flex-shrink-0 mt-0.5" />
        <div className="text-sm text-amber-800 dark:text-amber-200">
          <strong>Panel de Emergencia:</strong> Esta vista muestra los registros
          directos de Supabase sin ningún filtro de estado, fecha o tienda.
          Usa esto para encontrar órdenes "perdidas" que no aparecen en el panel principal.
        </div>
      </div>

      {/* Search */}
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input
            type="text"
            placeholder="Buscar por guía o cliente (Enter para buscar en toda la base)"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            className="w-full rounded-lg border border-border bg-card py-2 pl-10 pr-4 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
          />
        </div>
        <Button onClick={handleSearch} disabled={loading}>
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
          Buscar
        </Button>
        <Button
          variant="outline"
          onClick={() => {
            setSearchQuery("");
            fetchOrders(0, "");
          }}
          disabled={loading}
        >
          <RotateCcw className="h-4 w-4" />
          Reset
        </Button>
      </div>

      {/* Results Table */}
      {loading && orders.length === 0 ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : orders.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <Package className="h-12 w-12 text-muted-foreground mb-4" />
          <p className="text-muted-foreground">No se encontraron órdenes</p>
        </div>
      ) : (
        <div className="rounded-xl bg-card shadow-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 border-b border-border">
                <tr>
                  <th className="px-3 py-3 text-left font-semibold text-foreground">ID</th>
                  <th className="px-3 py-3 text-left font-semibold text-foreground">Guía</th>
                  <th className="px-3 py-3 text-left font-semibold text-foreground">Cliente</th>
                  <th className="px-3 py-3 text-left font-semibold text-foreground">Estado</th>
                  <th className="px-3 py-3 text-left font-semibold text-foreground">Novedad</th>
                  <th className="px-3 py-3 text-left font-semibold text-foreground">Motorizado</th>
                  <th className="px-3 py-3 text-left font-semibold text-foreground">F. Entrega</th>
                  <th className="px-3 py-3 text-left font-semibold text-foreground">F. Creación</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {orders.map((order) => (
                  <tr
                    key={order.id}
                    className="hover:bg-muted/30 cursor-pointer transition-colors"
                    onClick={() => onPedidoClick?.(order as any)}
                  >
                    <td className="px-3 py-3 text-xs font-mono text-muted-foreground">
                      {order.id}
                    </td>
                    <td className="px-3 py-3 font-medium text-foreground">
                      {order.numero_guia || "-"}
                    </td>
                    <td className="px-3 py-3 text-muted-foreground max-w-[150px] truncate">
                      {order.cliente_nombre || "-"}
                    </td>
                    <td className="px-3 py-3">
                      <StatusBadge status={order.estado} />
                    </td>
                    <td className="px-3 py-3 text-xs text-orange-600">
                      {order.tipo_novedad || "-"}
                    </td>
                    <td className="px-3 py-3 text-muted-foreground">
                      {order.motorizado_asignado || "-"}
                    </td>
                    <td className="px-3 py-3 text-xs text-muted-foreground">
                      {order.fecha_entrega || "-"}
                    </td>
                    <td className="px-3 py-3 text-xs text-muted-foreground">
                      {order.fecha_creacion
                        ? new Date(order.fecha_creacion).toLocaleString("es-CO", {
                            dateStyle: "short",
                            timeStyle: "short",
                          })
                        : "-"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between p-3 border-t border-border bg-muted/30">
              <span className="text-sm text-muted-foreground">
                Mostrando {currentPage * PAGE_SIZE + 1}-
                {Math.min((currentPage + 1) * PAGE_SIZE, totalCount)} de {totalCount}
              </span>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={currentPage === 0 || loading}
                  onClick={() => fetchOrders(currentPage - 1, searchQuery)}
                >
                  <ChevronLeft className="h-4 w-4" />
                  Anterior
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={currentPage >= totalPages - 1 || loading}
                  onClick={() => fetchOrders(currentPage + 1, searchQuery)}
                >
                  Siguiente
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        </div>
      )}
    </motion.div>
  );
};

export default AuditOrdersPanel;
