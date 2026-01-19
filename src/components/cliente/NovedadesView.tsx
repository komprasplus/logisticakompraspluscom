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
} from "lucide-react";
import { Button } from "@/components/ui/button";

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
  // Filter only novedades
  const novedades = pedidos.filter((p) => p.estado?.toLowerCase() === "novedad");

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

      {/* List */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-orange-500" />
        </div>
      ) : novedades.length === 0 ? (
        <div className="rounded-2xl bg-white border border-border p-8 text-center shadow-sm">
          <div className="mx-auto h-16 w-16 rounded-full bg-green-500/10 flex items-center justify-center mb-4">
            <Package className="h-8 w-8 text-green-600" />
          </div>
          <h3 className="text-lg font-bold text-foreground mb-2">¡Excelente!</h3>
          <p className="text-muted-foreground">
            No tienes pedidos con novedad pendiente
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {novedades.map((pedido, index) => (
            <motion.div
              key={pedido.id}
              className="rounded-xl bg-white border-2 border-orange-300 overflow-hidden shadow-sm"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: index * 0.05 }}
            >
              {/* Header */}
              <div className="bg-orange-500 px-4 py-3 flex items-center justify-between text-white">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="h-5 w-5" />
                  <span className="font-bold">NOVEDAD</span>
                </div>
                <span className="text-sm font-medium">
                  {pedido.numero_guia || `#${pedido.id}`}
                </span>
              </div>

              {/* Content */}
              <div className="p-4 space-y-4">
                {/* Novedad Reason */}
                <div className="rounded-lg bg-orange-50 border border-orange-200 p-3">
                  <p className="text-sm font-semibold text-orange-700 mb-1">Motivo:</p>
                  <p className="text-orange-600">{pedido.tipo_novedad || "No especificado"}</p>
                </div>

                {/* Order Info */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="flex items-start gap-2">
                    <Package className="h-4 w-4 text-muted-foreground mt-0.5" />
                    <div>
                      <p className="text-xs text-muted-foreground">Destinatario</p>
                      <p className="text-sm font-semibold text-foreground">
                        {pedido.cliente_nombre || "Sin nombre"}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-start gap-2">
                    <Phone className="h-4 w-4 text-muted-foreground mt-0.5" />
                    <div>
                      <p className="text-xs text-muted-foreground">Teléfono</p>
                      <p className="text-sm font-semibold text-foreground">
                        {pedido.client_phone || "Sin teléfono"}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-start gap-2 sm:col-span-2">
                    <MapPin className="h-4 w-4 text-muted-foreground mt-0.5" />
                    <div>
                      <p className="text-xs text-muted-foreground">Dirección</p>
                      <p className="text-sm font-semibold text-foreground">
                        {pedido.direccion_entrega || "Sin dirección"}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Evidence Photo */}
                {pedido.foto_evidencia && (
                  <button
                    onClick={() => onViewEvidence(pedido.foto_evidencia!)}
                    className="w-full rounded-lg overflow-hidden border border-border hover:border-primary transition-colors group relative"
                  >
                    <img
                      src={pedido.foto_evidencia}
                      alt="Evidencia"
                      className="w-full h-32 object-cover"
                    />
                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                      <Image className="h-8 w-8 text-white" />
                    </div>
                    <div className="absolute bottom-0 left-0 right-0 bg-black/60 text-white text-xs py-1 text-center">
                      Ver evidencia del motorizado
                    </div>
                  </button>
                )}

                {/* Actions */}
                <div className="flex items-center gap-2 pt-2">
                  <Button
                    onClick={() => onRespond(pedido)}
                    className="flex-1 bg-orange-500 hover:bg-orange-600"
                  >
                    <MessageSquare className="h-4 w-4 mr-2" />
                    Responder Novedad
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => onPrint(pedido)}
                  >
                    <Printer className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      )}
    </motion.div>
  );
};

export default NovedadesView;
