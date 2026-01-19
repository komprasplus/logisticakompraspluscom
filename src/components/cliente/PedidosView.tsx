import { motion } from "framer-motion";
import {
  Package,
  Loader2,
  Edit,
  Printer,
  Clock,
  Box,
  AlertTriangle,
  XCircle,
  CheckCircle2,
  Truck,
  Image,
  MessageSquare,
  RotateCcw,
  Search,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useState, useMemo } from "react";

interface Pedido {
  id: number;
  numero_guia: string | null;
  cliente_nombre: string | null;
  client_phone: string | null;
  direccion_entrega: string | null;
  barrio: string | null;
  zona: string | null;
  producto_nombre: string | null;
  valor_recaudar: number | null;
  metodo_pago: string | null;
  fecha_entrega: string | null;
  estado: string | null;
  corte_horario: string | null;
  fecha_creacion: string | null;
  foto_evidencia: string | null;
  tipo_novedad: string | null;
}

interface PedidosViewProps {
  pedidos: Pedido[];
  loading: boolean;
  onEdit: (pedido: Pedido) => void;
  onPrint: (pedido: Pedido) => void;
  onRespond: (pedido: Pedido) => void;
  onViewEvidence: (url: string) => void;
}

const FLETE_COSTO = 3500;

const PedidosView = ({
  pedidos,
  loading,
  onEdit,
  onPrint,
  onRespond,
  onViewEvidence,
}: PedidosViewProps) => {
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string | null>(null);

  const getStatusInfo = (status: string | null) => {
    const s = status?.toLowerCase();
    switch (s) {
      case "recibido":
      case "pedido recibido":
      case "recibido en bodega":
        return { label: "Recibido en Bodega", color: "bg-blue-500 text-white", icon: Box };
      case "pendiente":
        return { label: "Pendiente", color: "bg-amber-500 text-white", icon: Clock };
      case "asignado":
        return { label: "Asignado", color: "bg-purple-500 text-white", icon: Truck };
      case "en ruta":
      case "en camino":
        return { label: "En Ruta", color: "bg-primary text-primary-foreground", icon: Truck };
      case "entregado":
        return { label: "Entregado", color: "bg-green-500 text-white", icon: CheckCircle2 };
      case "cancelado":
      case "anulado":
        return { label: "Cancelado", color: "bg-destructive text-destructive-foreground", icon: XCircle };
      case "novedad":
        return { label: "Novedad", color: "bg-orange-500 text-white", icon: AlertTriangle };
      case "liquidado":
        return { label: "Liquidado", color: "bg-emerald-600 text-white", icon: CheckCircle2 };
      default:
        return { label: status || "Pendiente", color: "bg-muted text-muted-foreground", icon: Package };
    }
  };

  const canEditOrder = (status: string | null) => status?.toLowerCase() === "pendiente";
  
  const getNetProfit = (pedido: Pedido) => {
    if (pedido.metodo_pago === "anticipado") return 0;
    return (pedido.valor_recaudar || 0) - FLETE_COSTO;
  };

  const getDeliveryAttempts = (pedido: Pedido) => {
    if (pedido.estado?.toLowerCase() === "novedad") return "2+";
    if (pedido.estado?.toLowerCase() === "entregado") return "1";
    return "-";
  };

  // Filter pedidos
  const filteredPedidos = useMemo(() => {
    let result = pedidos;
    
    // Search filter
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(
        (p) =>
          p.numero_guia?.toLowerCase().includes(q) ||
          p.cliente_nombre?.toLowerCase().includes(q) ||
          p.direccion_entrega?.toLowerCase().includes(q)
      );
    }

    // Status filter
    if (statusFilter) {
      result = result.filter((p) => p.estado?.toLowerCase() === statusFilter);
    }

    return result;
  }, [pedidos, searchQuery, statusFilter]);

  const statusOptions = [
    { value: null, label: "Todos" },
    { value: "pendiente", label: "Pendiente" },
    { value: "recibido en bodega", label: "En Bodega" },
    { value: "en ruta", label: "En Ruta" },
    { value: "entregado", label: "Entregado" },
    { value: "novedad", label: "Novedad" },
    { value: "liquidado", label: "Liquidado" },
  ];

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-4"
    >
      {/* Header */}
      <div className="flex items-center gap-3 mb-4">
        <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-primary to-primary/80 shadow-lg shadow-primary/30">
          <Package className="h-6 w-6 text-white" />
        </div>
        <div>
          <h2 className="text-xl font-bold text-foreground">Mis Pedidos</h2>
          <p className="text-sm text-muted-foreground">{filteredPedidos.length} pedidos encontrados</p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por guía, cliente o dirección..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>
        <div className="flex gap-2 flex-wrap">
          {statusOptions.map((opt) => (
            <button
              key={opt.value || "all"}
              onClick={() => setStatusFilter(opt.value)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                statusFilter === opt.value
                  ? "bg-primary text-white"
                  : "bg-muted text-muted-foreground hover:bg-muted/80"
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* List */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : filteredPedidos.length === 0 ? (
        <div className="rounded-2xl bg-white border border-border p-8 text-center shadow-sm">
          <Package className="mx-auto h-12 w-12 text-muted-foreground" />
          <p className="mt-4 text-muted-foreground">
            {searchQuery || statusFilter ? "No se encontraron pedidos" : "No tienes pedidos registrados"}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredPedidos.map((pedido, index) => {
            const statusInfo = getStatusInfo(pedido.estado);
            const StatusIcon = statusInfo.icon;
            const isEditable = canEditOrder(pedido.estado);
            const isNovedad = pedido.estado?.toLowerCase() === "novedad";
            const netProfit = getNetProfit(pedido);
            const attempts = getDeliveryAttempts(pedido);

            return (
              <motion.div
                key={pedido.id}
                className={`rounded-xl bg-white border overflow-hidden shadow-sm hover:shadow-md transition-shadow ${
                  isNovedad ? "border-orange-300 bg-orange-50/30" : "border-border"
                }`}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.02 }}
              >
                {/* Header */}
                <div className={`px-4 py-2 flex items-center justify-between ${statusInfo.color}`}>
                  <div className="flex items-center gap-2">
                    <StatusIcon className="h-4 w-4" />
                    <span className="text-xs font-bold uppercase">{statusInfo.label}</span>
                  </div>
                  <span className="text-xs font-medium opacity-90">
                    {pedido.numero_guia || `#${pedido.id}`}
                  </span>
                </div>

                {/* Content */}
                <div className="p-4">
                  <div className="flex items-start gap-4">
                    {/* Evidence Thumbnail */}
                    {pedido.foto_evidencia ? (
                      <button
                        onClick={() => onViewEvidence(pedido.foto_evidencia!)}
                        className="relative flex-shrink-0 w-16 h-16 rounded-lg overflow-hidden border-2 border-border hover:border-primary transition-colors group"
                      >
                        <img
                          src={pedido.foto_evidencia}
                          alt="Evidencia"
                          className="w-full h-full object-cover"
                        />
                        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                          <Image className="h-5 w-5 text-white" />
                        </div>
                      </button>
                    ) : (
                      <div className="flex-shrink-0 w-16 h-16 rounded-lg bg-muted flex items-center justify-center">
                        <Image className="h-6 w-6 text-muted-foreground/50" />
                      </div>
                    )}

                    {/* Details */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between mb-2">
                        <div>
                          <p className="font-semibold text-foreground truncate">
                            {pedido.cliente_nombre || "Sin destinatario"}
                          </p>
                          <p className="text-xs text-muted-foreground line-clamp-1">
                            {pedido.direccion_entrega || "Sin dirección"}
                          </p>
                        </div>
                      </div>

                      {/* Stats */}
                      <div className="flex items-center gap-4 text-xs">
                        <div className="flex items-center gap-1">
                          <RotateCcw className="h-3 w-3 text-muted-foreground" />
                          <span className="text-muted-foreground">Intentos:</span>
                          <span className="font-semibold">{attempts}</span>
                        </div>
                        
                        {pedido.metodo_pago !== "anticipado" && (
                          <div className="flex items-center gap-1">
                            <span className="text-muted-foreground">Ganancia:</span>
                            <span className={`font-bold ${netProfit > 0 ? "text-green-600" : "text-muted-foreground"}`}>
                              ${netProfit.toLocaleString("es-CO")}
                            </span>
                          </div>
                        )}
                        
                        {pedido.metodo_pago === "anticipado" && (
                          <span className="bg-primary/10 text-primary text-xs font-bold px-2 py-0.5 rounded">
                            PAGADO
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Value */}
                    {pedido.valor_recaudar && pedido.metodo_pago !== "anticipado" && (
                      <div className="text-right flex-shrink-0">
                        <p className="text-xs text-muted-foreground">A recaudar</p>
                        <p className="text-sm font-bold text-green-600">
                          ${pedido.valor_recaudar.toLocaleString("es-CO")}
                        </p>
                      </div>
                    )}
                  </div>

                  {/* Novedad Alert */}
                  {isNovedad && pedido.tipo_novedad && (
                    <div className="mt-3 rounded-lg bg-orange-500/10 border border-orange-500/20 p-2 flex items-center gap-2">
                      <AlertTriangle className="h-4 w-4 text-orange-500 flex-shrink-0" />
                      <p className="text-xs text-orange-600 font-medium flex-1">{pedido.tipo_novedad}</p>
                    </div>
                  )}

                  {/* Actions */}
                  <div className="flex items-center justify-between pt-3 mt-3 border-t border-border">
                    <p className="text-xs text-muted-foreground">
                      {pedido.fecha_creacion
                        ? new Date(pedido.fecha_creacion).toLocaleDateString("es-CO", {
                            day: "numeric",
                            month: "short",
                            year: "numeric",
                          })
                        : "-"}
                    </p>
                    <div className="flex items-center gap-2">
                      {isNovedad && (
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-8 gap-1 border-orange-300 text-orange-600 hover:bg-orange-50"
                          onClick={() => onRespond(pedido)}
                        >
                          <MessageSquare className="h-3.5 w-3.5" />
                          <span className="hidden sm:inline">Responder</span>
                        </Button>
                      )}
                      {isEditable && (
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-8 gap-1"
                          onClick={() => onEdit(pedido)}
                        >
                          <Edit className="h-3.5 w-3.5" />
                          <span className="hidden sm:inline">Editar</span>
                        </Button>
                      )}
                      <Button
                        size="sm"
                        variant="secondary"
                        className="h-8 gap-1"
                        onClick={() => onPrint(pedido)}
                      >
                        <Printer className="h-3.5 w-3.5" />
                        <span className="hidden sm:inline">Guía</span>
                      </Button>
                    </div>
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>
      )}
    </motion.div>
  );
};

export default PedidosView;
