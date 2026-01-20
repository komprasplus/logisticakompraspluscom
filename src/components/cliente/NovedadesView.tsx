import { motion } from "framer-motion";
import {
  AlertTriangle,
  Package,
  Loader2,
  MessageSquare,
  Printer,
  Image,
  MapPin,
  Phone,
  DollarSign,
  TrendingUp,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatCOP } from "@/lib/tarifas";

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
  valor_flete?: number | null;
  utilidad?: number | null;
  metodo_pago: string | null;
  fecha_entrega: string | null;
  estado: string | null;
  corte_horario: string | null;
  fecha_creacion: string | null;
  foto_evidencia: string | null;
  tipo_novedad: string | null;
}

interface NovedadesViewProps {
  pedidos: Pedido[];
  loading: boolean;
  onRespond: (pedido: Pedido) => void;
  onPrint: (pedido: Pedido) => void;
  onViewEvidence: (url: string) => void;
}

const NovedadesView = ({
  pedidos,
  loading,
  onRespond,
  onPrint,
  onViewEvidence,
}: NovedadesViewProps) => {
  const novedades = pedidos.filter((p) => p.estado?.toLowerCase() === "novedad");

  const getNetProfit = (pedido: Pedido) => {
    if (pedido.metodo_pago === "anticipado") return 0;
    if (pedido.utilidad !== null && pedido.utilidad !== undefined) {
      return pedido.utilidad;
    }
    const flete = pedido.valor_flete || 12000;
    return (pedido.valor_recaudar || 0) - flete;
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-4"
    >
      {/* Header */}
      <div className="flex items-center gap-3 mb-4">
        <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-orange-500 to-orange-600 shadow-lg shadow-orange-500/30">
          <AlertTriangle className="h-6 w-6 text-white" />
        </div>
        <div>
          <h2 className="text-xl font-bold text-foreground">Gestión de Novedades</h2>
          <p className="text-sm text-muted-foreground">
            {novedades.length} pedido{novedades.length !== 1 ? "s" : ""} requiere{novedades.length !== 1 ? "n" : ""} atención
          </p>
        </div>
      </div>

      {/* Info Banner */}
      <div className="rounded-xl bg-orange-500/10 border border-orange-500/20 p-4">
        <div className="flex items-start gap-3">
          <AlertTriangle className="h-5 w-5 text-orange-600 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-semibold text-orange-700">¿Qué es una novedad?</p>
            <p className="text-sm text-orange-600 mt-1">
              Una novedad ocurre cuando no fue posible entregar el pedido en el primer intento. 
              Puedes responder con instrucciones adicionales para reprogramar la entrega.
            </p>
          </div>
        </div>
      </div>

      {/* Grid */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-orange-500" />
        </div>
      ) : novedades.length === 0 ? (
        <div className="rounded-2xl bg-card border border-border p-8 text-center shadow-sm">
          <div className="mx-auto h-16 w-16 rounded-full bg-green-500/10 flex items-center justify-center mb-4">
            <Package className="h-8 w-8 text-green-600" />
          </div>
          <h3 className="text-lg font-bold text-foreground mb-2">¡Excelente!</h3>
          <p className="text-muted-foreground">
            No tienes pedidos con novedad pendiente
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {novedades.map((pedido, index) => {
            const netProfit = getNetProfit(pedido);

            return (
              <motion.div
                key={pedido.id}
                className="rounded-2xl bg-card border-2 border-orange-300 overflow-hidden shadow-lg shadow-orange-500/10 hover:shadow-xl hover:-translate-y-1 transition-all duration-200"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: index * 0.05 }}
              >
                {/* Card Header */}
                <div className="bg-gradient-to-r from-orange-500 to-orange-600 px-4 py-3 flex items-center justify-between">
                  <div className="flex items-center gap-2 text-white">
                    <AlertTriangle className="h-4 w-4" />
                    <span className="text-xs font-bold uppercase">Novedad</span>
                  </div>
                  <span className="text-sm font-bold text-white/90">
                    {pedido.numero_guia || `#${pedido.id}`}
                  </span>
                </div>

                {/* Card Body */}
                <div className="p-4 space-y-3">
                  {/* Novedad Reason */}
                  <div className="rounded-xl bg-orange-50 border border-orange-200 p-3">
                    <p className="text-xs font-semibold text-orange-700 mb-1">Motivo:</p>
                    <p className="text-sm text-orange-600 font-medium">{pedido.tipo_novedad || "No especificado"}</p>
                  </div>

                  {/* Recipient */}
                  <div>
                    <p className="font-bold text-foreground text-base truncate">
                      {pedido.cliente_nombre || "Sin nombre"}
                    </p>
                    <div className="flex items-start gap-1.5 mt-1">
                      <MapPin className="h-3.5 w-3.5 text-muted-foreground mt-0.5 flex-shrink-0" />
                      <p className="text-xs text-muted-foreground line-clamp-2">
                        {pedido.direccion_entrega || "Sin dirección"}
                        {pedido.barrio && ` - ${pedido.barrio}`}
                      </p>
                    </div>
                    {pedido.client_phone && (
                      <div className="flex items-center gap-1.5 mt-1">
                        <Phone className="h-3.5 w-3.5 text-muted-foreground" />
                        <p className="text-xs text-muted-foreground">{pedido.client_phone}</p>
                      </div>
                    )}
                  </div>

                  {/* Metrics Row */}
                  {pedido.metodo_pago !== "anticipado" && (
                    <div className="flex items-center gap-4 py-2 px-3 rounded-xl bg-muted/50">
                      <div className="flex-1 flex items-center gap-2">
                        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-green-500/15">
                          <DollarSign className="h-4 w-4 text-green-600" />
                        </div>
                        <div>
                          <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Recaudar</p>
                          <p className="text-sm font-bold text-green-600">
                            {formatCOP(pedido.valor_recaudar || 0)}
                          </p>
                        </div>
                      </div>
                      <div className="w-px h-8 bg-border" />
                      <div className="flex-1 flex items-center gap-2">
                        <div className={`flex h-8 w-8 items-center justify-center rounded-lg ${netProfit > 0 ? 'bg-emerald-500/15' : 'bg-destructive/15'}`}>
                          <TrendingUp className={`h-4 w-4 ${netProfit > 0 ? 'text-emerald-600' : 'text-destructive'}`} />
                        </div>
                        <div>
                          <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Utilidad</p>
                          <p className={`text-sm font-bold ${netProfit > 0 ? 'text-emerald-600' : 'text-destructive'}`}>
                            {formatCOP(netProfit)}
                          </p>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Evidence Photo */}
                  {pedido.foto_evidencia && (
                    <button
                      onClick={() => onViewEvidence(pedido.foto_evidencia!)}
                      className="w-full rounded-xl overflow-hidden border-2 border-border hover:border-orange-400 transition-colors group relative h-28"
                    >
                      <img
                        src={pedido.foto_evidencia}
                        alt="Evidencia"
                        className="w-full h-full object-cover"
                      />
                      <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                        <Image className="h-6 w-6 text-white" />
                      </div>
                      <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 to-transparent text-white text-xs py-2 text-center">
                        Ver evidencia del motorizado
                      </div>
                    </button>
                  )}
                </div>

                {/* Card Footer - Actions */}
                <div className="px-4 pb-4 pt-0 flex gap-2">
                  <Button
                    onClick={() => onRespond(pedido)}
                    className="flex-1 h-11 gap-2 bg-orange-500 hover:bg-orange-600 text-white font-semibold"
                  >
                    <MessageSquare className="h-4 w-4" />
                    Responder Novedad
                  </Button>
                  <Button
                    variant="outline"
                    className="h-11 px-4 border-orange-300 text-orange-600 hover:bg-orange-50"
                    onClick={() => onPrint(pedido)}
                  >
                    <Printer className="h-4 w-4" />
                  </Button>
                </div>
              </motion.div>
            );
          })}
        </div>
      )}
    </motion.div>
  );
};

export default NovedadesView;
