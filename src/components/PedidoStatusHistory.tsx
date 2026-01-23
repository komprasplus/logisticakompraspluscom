import { useState, useEffect } from "react";
import { History, Loader2, Clock, User, ArrowRight, CheckCircle2, AlertTriangle, Truck, Package, Ban, RotateCcw, DollarSign } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";

interface StatusLog {
  id: string;
  estado_anterior: string | null;
  estado_nuevo: string;
  usuario_nombre: string | null;
  motivo: string | null;
  created_at: string;
}

interface PedidoStatusHistoryProps {
  pedidoId: number;
}

const getStatusIcon = (status: string | null) => {
  const s = status?.toLowerCase() || "";
  if (s.includes("entregado")) return CheckCircle2;
  if (s.includes("novedad") || s.includes("rechazado")) return AlertTriangle;
  if (s.includes("ruta")) return Truck;
  if (s.includes("bodega") || s.includes("recibido")) return Package;
  if (s.includes("anulado")) return Ban;
  if (s.includes("devolucion") || s.includes("devolución")) return RotateCcw;
  if (s.includes("liquidado") || s.includes("pagado")) return DollarSign;
  return Clock;
};

const getStatusColor = (status: string | null) => {
  const s = status?.toLowerCase() || "";
  if (s.includes("entregado")) return "text-emerald-600 bg-emerald-100";
  if (s.includes("novedad")) return "text-orange-600 bg-orange-100";
  if (s.includes("rechazado")) return "text-red-600 bg-red-100";
  if (s.includes("ruta")) return "text-blue-600 bg-blue-100";
  if (s.includes("bodega") || s.includes("recibido")) return "text-teal-600 bg-teal-100";
  if (s.includes("anulado")) return "text-gray-600 bg-gray-100";
  if (s.includes("devolucion") || s.includes("devolución")) return "text-purple-600 bg-purple-100";
  if (s.includes("liquidado") || s.includes("pagado")) return "text-green-600 bg-green-100";
  if (s.includes("asignado")) return "text-indigo-600 bg-indigo-100";
  return "text-muted-foreground bg-muted";
};

const PedidoStatusHistory = ({ pedidoId }: PedidoStatusHistoryProps) => {
  const [logs, setLogs] = useState<StatusLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    fetchLogs();
  }, [pedidoId]);

  const fetchLogs = async () => {
    try {
      const { data, error } = await supabase
        .from("pedido_status_logs")
        .select("*")
        .eq("pedido_id", pedidoId)
        .order("created_at", { ascending: false });

      if (error) throw error;
      setLogs(data || []);
    } catch (error) {
      console.error("Error fetching status logs:", error);
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    const timeStr = date.toLocaleTimeString("es-CO", {
      hour: "2-digit",
      minute: "2-digit",
    });

    if (diffDays === 0) {
      if (diffHours < 1) return `Hace minutos - ${timeStr}`;
      return `Hoy - ${timeStr}`;
    } else if (diffDays === 1) {
      return `Ayer - ${timeStr}`;
    } else {
      return date.toLocaleDateString("es-CO", {
        day: "numeric",
        month: "short",
        year: diffDays > 365 ? "numeric" : undefined,
      }) + ` - ${timeStr}`;
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-4">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (logs.length === 0) {
    return null;
  }

  const displayedLogs = expanded ? logs : logs.slice(0, 3);

  return (
    <div className="rounded-xl border border-border bg-gradient-to-b from-muted/30 to-transparent p-4">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <div className="p-2 bg-primary/10 rounded-lg">
            <History className="h-4 w-4 text-primary" />
          </div>
          <div>
            <h3 className="font-semibold text-foreground">Historial de Auditoría</h3>
            <p className="text-xs text-muted-foreground">{logs.length} cambio{logs.length !== 1 ? "s" : ""} registrado{logs.length !== 1 ? "s" : ""}</p>
          </div>
        </div>
        {logs.length > 3 && (
          <button
            onClick={() => setExpanded(!expanded)}
            className="text-xs text-primary hover:underline font-medium"
          >
            {expanded ? "Ver menos" : `Ver todos (${logs.length})`}
          </button>
        )}
      </div>
      
      {/* Timeline */}
      <div className="relative">
        {/* Vertical line */}
        <div className="absolute left-5 top-2 bottom-2 w-0.5 bg-border" />
        
        <AnimatePresence mode="popLayout">
          <div className="space-y-3">
            {displayedLogs.map((log, index) => {
              const StatusIcon = getStatusIcon(log.estado_nuevo);
              const colorClass = getStatusColor(log.estado_nuevo);
              
              return (
                <motion.div
                  key={log.id}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -10 }}
                  transition={{ delay: index * 0.05 }}
                  className="relative flex gap-3 pl-0"
                >
                  {/* Icon container */}
                  <div className={cn(
                    "relative z-10 flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center border-2 border-background shadow-sm",
                    colorClass
                  )}>
                    <StatusIcon className="h-4 w-4" />
                  </div>
                  
                  {/* Content */}
                  <div className="flex-1 min-w-0 bg-card rounded-lg border border-border p-3 shadow-sm">
                    {/* Status change */}
                    <div className="flex items-center gap-2 flex-wrap mb-1.5">
                      {log.estado_anterior && (
                        <>
                          <span className="text-sm text-muted-foreground font-medium">
                            {log.estado_anterior}
                          </span>
                          <ArrowRight className="h-3.5 w-3.5 text-muted-foreground/50" />
                        </>
                      )}
                      <span className={cn(
                        "text-sm font-semibold px-2 py-0.5 rounded-md",
                        colorClass
                      )}>
                        {log.estado_nuevo}
                      </span>
                    </div>
                    
                    {/* Meta info */}
                    <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                      <div className="flex items-center gap-1">
                        <User className="h-3 w-3" />
                        <span className="font-medium">{log.usuario_nombre || "Sistema"}</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        <span>{formatDate(log.created_at)}</span>
                      </div>
                    </div>
                    
                    {/* Reason/Motive */}
                    {log.motivo && (
                      <div className="mt-2 pt-2 border-t border-border">
                        <p className="text-xs text-muted-foreground italic">
                          "{log.motivo}"
                        </p>
                      </div>
                    )}
                  </div>
                </motion.div>
              );
            })}
          </div>
        </AnimatePresence>
      </div>
    </div>
  );
};

export default PedidoStatusHistory;
