import { useState, useEffect } from "react";
import { History, Loader2, Clock, User } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

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

const PedidoStatusHistory = ({ pedidoId }: PedidoStatusHistoryProps) => {
  const [logs, setLogs] = useState<StatusLog[]>([]);
  const [loading, setLoading] = useState(true);

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
    return new Date(dateStr).toLocaleString("es-CO", {
      day: "numeric",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
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

  return (
    <div className="rounded-lg border border-border p-4">
      <div className="flex items-center gap-2 mb-3">
        <History className="h-4 w-4 text-primary" />
        <h3 className="font-semibold text-foreground">Historial de Cambios</h3>
      </div>
      
      <div className="space-y-3 max-h-60 overflow-y-auto">
        {logs.map((log) => (
          <div 
            key={log.id} 
            className="rounded-md bg-muted/50 p-3 text-sm border border-border"
          >
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2 text-foreground font-medium">
                <span className="text-muted-foreground">{log.estado_anterior || "—"}</span>
                <span>→</span>
                <span className="text-primary">{log.estado_nuevo}</span>
              </div>
            </div>
            
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
              <div className="flex items-center gap-1">
                <User className="h-3 w-3" />
                <span>{log.usuario_nombre || "Sistema"}</span>
              </div>
              <div className="flex items-center gap-1">
                <Clock className="h-3 w-3" />
                <span>{formatDate(log.created_at)}</span>
              </div>
            </div>
            
            {log.motivo && (
              <p className="mt-2 text-xs text-muted-foreground italic border-t border-border pt-2">
                "{log.motivo}"
              </p>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};

export default PedidoStatusHistory;
