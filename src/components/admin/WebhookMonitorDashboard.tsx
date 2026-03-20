import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { motion, AnimatePresence } from "framer-motion";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Radio,
  RefreshCw,
  Clock,
  CheckCircle2,
  XCircle,
  Loader2,
  Satellite,
  Copy,
} from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { es } from "date-fns/locale";

interface WebhookLog {
  id: string;
  source: string;
  payload: Record<string, unknown>;
  processing_status: string;
  error_message: string | null;
  created_at: string;
}

const statusConfig: Record<string, { label: string; variant: string; icon: typeof Clock }> = {
  pending: { label: "Pendiente", variant: "bg-amber-100 text-amber-800 border-amber-200", icon: Clock },
  processed: { label: "Procesado", variant: "bg-emerald-100 text-emerald-800 border-emerald-200", icon: CheckCircle2 },
  error: { label: "Error", variant: "bg-red-100 text-red-800 border-red-200", icon: XCircle },
};

const WebhookMonitorDashboard = () => {
  const queryClient = useQueryClient();
  const [realtimeConnected, setRealtimeConnected] = useState(false);
  const [expandedRow, setExpandedRow] = useState<string | null>(null);

  // Fetch latest 20 logs
  const { data: logs = [], isLoading, refetch } = useQuery({
    queryKey: ["webhook-logs-incoming"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("webhook_logs_incoming" as any)
        .select("*")
        .order("created_at", { ascending: false })
        .limit(20);

      if (error) throw error;
      return (data ?? []) as unknown as WebhookLog[];
    },
    refetchInterval: 30_000,
  });

  // Realtime subscription
  useEffect(() => {
    const channel = supabase
      .channel("webhook-logs-realtime")
      .on(
        "postgres_changes" as any,
        {
          event: "INSERT",
          schema: "public",
          table: "webhook_logs_incoming",
        },
        (payload: any) => {
          queryClient.invalidateQueries({ queryKey: ["webhook-logs-incoming"] });
          toast.info(`📡 Nuevo webhook de "${payload.new?.source ?? "desconocido"}"`, {
            duration: 3000,
          });
        }
      )
      .on(
        "postgres_changes" as any,
        {
          event: "UPDATE",
          schema: "public",
          table: "webhook_logs_incoming",
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ["webhook-logs-incoming"] });
        }
      )
      .subscribe((status: string) => {
        setRealtimeConnected(status === "SUBSCRIBED");
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient]);

  const copyPayload = (payload: Record<string, unknown>) => {
    navigator.clipboard.writeText(JSON.stringify(payload, null, 2));
    toast.success("Payload copiado al portapapeles");
  };

  // KPI counts
  const pendingCount = logs.filter((l) => l.processing_status === "pending").length;
  const processedCount = logs.filter((l) => l.processing_status === "processed").length;
  const errorCount = logs.filter((l) => l.processing_status === "error").length;

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
      className="p-4 space-y-6"
    >
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-gradient-to-br from-violet-500 to-purple-600 shadow-lg">
            <Satellite className="h-5 w-5 text-white" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-foreground">Monitor de Webhooks</h2>
            <p className="text-xs text-muted-foreground">Shadow Layer — Datos crudos entrantes</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {/* Realtime indicator */}
          <div className="flex items-center gap-1.5 text-xs">
            <div
              className={`h-2 w-2 rounded-full ${
                realtimeConnected ? "bg-emerald-500 animate-pulse" : "bg-muted-foreground"
              }`}
            />
            <span className="text-muted-foreground">
              {realtimeConnected ? "Realtime activo" : "Conectando..."}
            </span>
          </div>
          <Button variant="outline" size="sm" onClick={() => refetch()} className="gap-1.5">
            <RefreshCw className="h-3.5 w-3.5" />
            Refrescar
          </Button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-3 gap-4">
        <Card className="border-amber-200/50 bg-amber-50/30">
          <CardContent className="p-4 flex items-center gap-3">
            <Clock className="h-8 w-8 text-amber-600" />
            <div>
              <p className="text-2xl font-bold tabular-nums text-amber-700">{pendingCount}</p>
              <p className="text-xs text-amber-600/80">Pendientes</p>
            </div>
          </CardContent>
        </Card>
        <Card className="border-emerald-200/50 bg-emerald-50/30">
          <CardContent className="p-4 flex items-center gap-3">
            <CheckCircle2 className="h-8 w-8 text-emerald-600" />
            <div>
              <p className="text-2xl font-bold tabular-nums text-emerald-700">{processedCount}</p>
              <p className="text-xs text-emerald-600/80">Procesados</p>
            </div>
          </CardContent>
        </Card>
        <Card className="border-red-200/50 bg-red-50/30">
          <CardContent className="p-4 flex items-center gap-3">
            <XCircle className="h-8 w-8 text-red-600" />
            <div>
              <p className="text-2xl font-bold tabular-nums text-red-700">{errorCount}</p>
              <p className="text-xs text-red-600/80">Errores</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Data Table */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <Radio className="h-4 w-4 text-primary" />
            Últimos 20 webhooks recibidos
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : logs.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Satellite className="h-10 w-10 mx-auto mb-3 opacity-30" />
              <p className="text-sm">No hay webhooks registrados aún</p>
              <p className="text-xs mt-1">Envía un POST a la Edge Function para probar</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[160px]">Fecha</TableHead>
                  <TableHead className="w-[120px]">Origen</TableHead>
                  <TableHead className="w-[120px]">Estado</TableHead>
                  <TableHead>Payload (preview)</TableHead>
                  <TableHead className="w-[80px]">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                <AnimatePresence initial={false}>
                  {logs.map((log) => {
                    const cfg = statusConfig[log.processing_status] ?? statusConfig.pending;
                    const StatusIcon = cfg.icon;
                    const isExpanded = expandedRow === log.id;
                    const payloadPreview = JSON.stringify(log.payload).slice(0, 80);

                    return (
                      <motion.tr
                        key={log.id}
                        initial={{ opacity: 0, x: -8 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.3 }}
                        className="border-b cursor-pointer hover:bg-muted/40 transition-colors"
                        onClick={() => setExpandedRow(isExpanded ? null : log.id)}
                      >
                        <TableCell className="text-xs tabular-nums text-muted-foreground">
                          {format(new Date(log.created_at), "dd MMM HH:mm:ss", { locale: es })}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className="text-xs font-mono">
                            {log.source}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <span
                            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border ${cfg.variant}`}
                          >
                            <StatusIcon className="h-3 w-3" />
                            {cfg.label}
                          </span>
                        </TableCell>
                        <TableCell className="max-w-[300px]">
                          {isExpanded ? (
                            <pre className="text-[11px] bg-muted/60 rounded-lg p-3 overflow-auto max-h-48 whitespace-pre-wrap break-all font-mono">
                              {JSON.stringify(log.payload, null, 2)}
                            </pre>
                          ) : (
                            <span className="text-xs text-muted-foreground font-mono truncate block">
                              {payloadPreview}
                              {JSON.stringify(log.payload).length > 80 && "…"}
                            </span>
                          )}
                          {log.error_message && (
                            <p className="text-[11px] text-red-600 mt-1">⚠ {log.error_message}</p>
                          )}
                        </TableCell>
                        <TableCell>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7"
                            onClick={(e) => {
                              e.stopPropagation();
                              copyPayload(log.payload);
                            }}
                          >
                            <Copy className="h-3.5 w-3.5" />
                          </Button>
                        </TableCell>
                      </motion.tr>
                    );
                  })}
                </AnimatePresence>
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </motion.div>
  );
};

export default WebhookMonitorDashboard;
