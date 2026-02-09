import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Package, Clock, AlertTriangle, Truck, RefreshCw, Loader2, Timer } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { getStatusConfig } from "@/lib/orderStatuses";
import { toast } from "sonner";

interface FlexOrder {
  id: number;
  numero_guia: string | null;
  id_externo: string | null;
  cliente_nombre: string | null;
  direccion_entrega: string | null;
  barrio: string | null;
  estado: string | null;
  motorizado_asignado: string | null;
  hora_cierre_flex: string | null;
  fecha_creacion: string | null;
  valor_recaudar: number | null;
  foto_evidencia: string | null;
}

const MonitorFlexPanel = () => {
  const [orders, setOrders] = useState<FlexOrder[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchFlexOrders = async () => {
    setLoading(true);
    try {
      const today = new Date().toISOString().split("T")[0];
      const { data, error } = await supabase
        .from("pedidos")
        .select("id, numero_guia, id_externo, cliente_nombre, direccion_entrega, barrio, estado, motorizado_asignado, hora_cierre_flex, fecha_creacion, valor_recaudar, foto_evidencia")
        .eq("canal", "FLEX")
        .gte("fecha_creacion", `${today}T00:00:00`)
        .order("hora_cierre_flex", { ascending: true })
        .limit(200);

      if (error) throw error;
      setOrders(data || []);
    } catch (error) {
      console.error("Error fetching flex orders:", error);
      toast.error("Error al cargar pedidos Flex");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchFlexOrders();
    // Auto-refresh every 60 seconds
    const interval = setInterval(fetchFlexOrders, 60000);
    return () => clearInterval(interval);
  }, []);

  const getTimeRemaining = (horaCierre: string | null): { text: string; urgency: "ok" | "warning" | "critical" | "expired" } => {
    if (!horaCierre) return { text: "—", urgency: "ok" };

    const now = new Date();
    const [hours, minutes] = horaCierre.split(":").map(Number);
    const deadline = new Date(now);
    deadline.setHours(hours, minutes, 0, 0);

    const diffMs = deadline.getTime() - now.getTime();
    const diffMinutes = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMinutes / 60);
    const remainingMinutes = diffMinutes % 60;

    if (diffMs < 0) {
      return { text: "VENCIDO", urgency: "expired" };
    }
    if (diffMinutes <= 60) {
      return { text: `${diffMinutes}min`, urgency: "critical" };
    }
    if (diffHours <= 2) {
      return { text: `${diffHours}h ${remainingMinutes}m`, urgency: "warning" };
    }
    return { text: `${diffHours}h ${remainingMinutes}m`, urgency: "ok" };
  };

  // Stats
  const stats = useMemo(() => {
    const total = orders.length;
    const entregados = orders.filter(o => o.estado?.toLowerCase() === "entregado").length;
    const enRuta = orders.filter(o => o.estado?.toLowerCase() === "en ruta").length;
    const pendientes = orders.filter(o => 
      o.estado?.toLowerCase() !== "entregado" && 
      o.estado?.toLowerCase() !== "anulado"
    ).length;
    const vencidos = orders.filter(o => {
      const result = getTimeRemaining(o.hora_cierre_flex);
      return result.urgency === "expired" && o.estado?.toLowerCase() !== "entregado";
    }).length;
    return { total, entregados, enRuta, pendientes, vencidos };
  }, [orders]);

  const urgencyColors = {
    ok: "text-green-600 bg-green-500/10",
    warning: "text-amber-600 bg-amber-500/10",
    critical: "text-red-600 bg-red-500/10 animate-pulse",
    expired: "text-red-800 bg-red-500/20 font-bold",
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-4 p-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Package className="h-5 w-5 text-amber-500" />
          <h2 className="text-lg font-bold">Monitor Flex</h2>
          <Badge variant="outline" className="text-amber-600 border-amber-500/30">
            {stats.total} pedidos hoy
          </Badge>
        </div>
        <Button variant="outline" size="sm" onClick={fetchFlexOrders}>
          <RefreshCw className="h-4 w-4 mr-1" />
          Actualizar
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <div className="rounded-xl p-3 bg-muted/50 border text-center">
          <p className="text-2xl font-bold">{stats.total}</p>
          <p className="text-xs text-muted-foreground">Total</p>
        </div>
        <div className="rounded-xl p-3 bg-green-500/10 border border-green-500/20 text-center">
          <p className="text-2xl font-bold text-green-600">{stats.entregados}</p>
          <p className="text-xs text-muted-foreground">Entregados</p>
        </div>
        <div className="rounded-xl p-3 bg-sky-500/10 border border-sky-500/20 text-center">
          <p className="text-2xl font-bold text-sky-600">{stats.enRuta}</p>
          <p className="text-xs text-muted-foreground">En Ruta</p>
        </div>
        <div className="rounded-xl p-3 bg-amber-500/10 border border-amber-500/20 text-center">
          <p className="text-2xl font-bold text-amber-600">{stats.pendientes}</p>
          <p className="text-xs text-muted-foreground">Pendientes</p>
        </div>
        <div className="rounded-xl p-3 bg-red-500/10 border border-red-500/20 text-center">
          <p className="text-2xl font-bold text-red-600">{stats.vencidos}</p>
          <p className="text-xs text-muted-foreground">Vencidos</p>
        </div>
      </div>

      {/* Orders Table */}
      {orders.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <Package className="h-12 w-12 mx-auto mb-3 opacity-30" />
          <p>No hay pedidos Flex registrados hoy</p>
        </div>
      ) : (
        <div className="rounded-lg border overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[100px]">Guía</TableHead>
                <TableHead>Código Externo</TableHead>
                <TableHead>Cliente</TableHead>
                <TableHead>Barrio</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead>Motorizado</TableHead>
                <TableHead className="text-center">
                  <div className="flex items-center justify-center gap-1">
                    <Timer className="h-3 w-3" />
                    Tiempo Restante
                  </div>
                </TableHead>
                <TableHead className="text-right">Recaudo</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {orders.map((order) => {
                const statusConfig = getStatusConfig(order.estado);
                const timeInfo = getTimeRemaining(order.hora_cierre_flex);
                const isDelivered = order.estado?.toLowerCase() === "entregado";

                return (
                  <TableRow key={order.id} className={isDelivered ? "opacity-60" : ""}>
                    <TableCell className="font-mono text-xs font-bold">
                      {order.numero_guia || `#${order.id}`}
                    </TableCell>
                    <TableCell className="font-mono text-xs">
                      {order.id_externo || "—"}
                    </TableCell>
                    <TableCell className="text-sm">
                      {order.cliente_nombre || "—"}
                    </TableCell>
                    <TableCell className="text-sm">
                      {order.barrio || "—"}
                    </TableCell>
                    <TableCell>
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${statusConfig.bgColor} ${statusConfig.textColor}`}>
                        {statusConfig.icon} {statusConfig.label}
                      </span>
                    </TableCell>
                    <TableCell className="text-sm">
                      {order.motorizado_asignado || (
                        <span className="text-muted-foreground italic text-xs">Sin asignar</span>
                      )}
                    </TableCell>
                    <TableCell className="text-center">
                      {isDelivered ? (
                        <span className="text-green-600 text-xs font-medium">✅ Entregado</span>
                      ) : (
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold ${urgencyColors[timeInfo.urgency]}`}>
                          <Clock className="h-3 w-3" />
                          {timeInfo.text}
                        </span>
                      )}
                    </TableCell>
                    <TableCell className="text-right font-mono text-sm">
                      {order.valor_recaudar
                        ? `$${order.valor_recaudar.toLocaleString()}`
                        : "—"}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
};

export default MonitorFlexPanel;
