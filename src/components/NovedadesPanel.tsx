import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { 
  AlertTriangle, 
  MapPin, 
  Clock, 
  User, 
  Phone, 
  Image as ImageIcon,
  ExternalLink,
  X,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { getStatusConfig, NOVEDAD_OPTIONS } from "@/lib/orderStatuses";
import { Button } from "@/components/ui/button";

interface Pedido {
  id: number;
  numero_guia: string | null;
  cliente_nombre: string | null;
  direccion_entrega: string | null;
  estado: string | null;
  client_phone: string | null;
  latitud: number | null;
  longitud: number | null;
  tipo_novedad: string | null;
  foto_evidencia: string | null;
  fecha_actualizacion: string | null;
  motorizado_asignado: string | null;
  novedad_latitud?: number | null;
  novedad_longitud?: number | null;
}

interface NovedadesPanelProps {
  pedidos: Pedido[];
  onPedidoClick: (pedido: Pedido) => void;
}

const NovedadesPanel = ({ pedidos, onPedidoClick }: NovedadesPanelProps) => {
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);

  // Filter only novedades
  const novedades = pedidos.filter(
    (p) => p.estado?.toLowerCase().includes("novedad")
  );

  const getNovedadColor = (tipo: string | null) => {
    const option = NOVEDAD_OPTIONS.find((o) => o.value === tipo);
    if (option?.requiresPhoto) {
      return "border-l-red-500 bg-red-50";
    }
    return "border-l-orange-500 bg-orange-50";
  };

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return "Sin fecha";
    return new Date(dateStr).toLocaleString("es-CO", {
      day: "2-digit",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const openWhatsApp = (phone: string | null, pedido: Pedido) => {
    if (!phone) return;
    const cleanPhone = phone.replace(/\D/g, "");
    const message = encodeURIComponent(
      `Hola, me comunico de Kompras Plus. Tenemos una novedad con su pedido ${pedido.numero_guia || `#${pedido.id}`}: ${pedido.tipo_novedad}. ¿Podemos coordinar la entrega?`
    );
    window.open(`https://wa.me/57${cleanPhone}?text=${message}`, "_blank");
  };

  const openLocation = (lat: number | null, lng: number | null) => {
    if (lat && lng) {
      window.open(`https://www.google.com/maps?q=${lat},${lng}`, "_blank");
    }
  };

  if (novedades.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <div className="rounded-full bg-green-100 p-4 mb-4">
          <AlertTriangle className="h-8 w-8 text-green-600" />
        </div>
        <h3 className="text-lg font-semibold text-foreground">Sin novedades</h3>
        <p className="text-sm text-muted-foreground mt-1">
          Todos los pedidos están en orden 🎉
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <AlertTriangle className="h-5 w-5 text-orange-500" />
          <h2 className="text-lg font-bold text-foreground">
            Novedades ({novedades.length})
          </h2>
        </div>
        <div className="flex gap-2">
          {NOVEDAD_OPTIONS.map((option) => {
            const count = novedades.filter((p) => p.tipo_novedad === option.value).length;
            if (count === 0) return null;
            return (
              <span
                key={option.value}
                className={`text-xs px-2 py-1 rounded-full ${
                  option.requiresPhoto 
                    ? "bg-red-100 text-red-700" 
                    : "bg-orange-100 text-orange-700"
                }`}
              >
                {option.label}: {count}
              </span>
            );
          })}
        </div>
      </div>

      {/* Novedades List */}
      <div className="space-y-3">
        {novedades.map((pedido) => {
          const isExpanded = expandedId === pedido.id;
          
          return (
            <motion.div
              key={pedido.id}
              className={`rounded-xl border-l-4 p-4 shadow-sm ${getNovedadColor(pedido.tipo_novedad)}`}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
            >
              {/* Main Row */}
              <div 
                className="flex items-start justify-between cursor-pointer"
                onClick={() => setExpandedId(isExpanded ? null : pedido.id)}
              >
                <div className="flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-bold text-foreground">
                      {pedido.numero_guia || `#${pedido.id}`}
                    </span>
                    <span className="rounded-full bg-orange-500 px-2 py-0.5 text-xs font-medium text-white">
                      {pedido.tipo_novedad || "Novedad"}
                    </span>
                  </div>
                  <p className="text-sm font-medium text-foreground mt-1">
                    {pedido.cliente_nombre || "Cliente"}
                  </p>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground mt-1">
                    <Clock className="h-3 w-3" />
                    <span>{formatDate(pedido.fecha_actualizacion)}</span>
                    {pedido.motorizado_asignado && (
                      <>
                        <span>•</span>
                        <User className="h-3 w-3" />
                        <span>{pedido.motorizado_asignado}</span>
                      </>
                    )}
                  </div>
                </div>
                <button className="p-1 hover:bg-white/50 rounded">
                  {isExpanded ? (
                    <ChevronUp className="h-5 w-5 text-muted-foreground" />
                  ) : (
                    <ChevronDown className="h-5 w-5 text-muted-foreground" />
                  )}
                </button>
              </div>

              {/* Expanded Details */}
              <AnimatePresence>
                {isExpanded && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    className="overflow-hidden"
                  >
                    <div className="mt-4 pt-4 border-t border-orange-200 space-y-3">
                      {/* Address */}
                      <div className="flex items-start gap-2 text-sm">
                        <MapPin className="h-4 w-4 text-muted-foreground mt-0.5" />
                        <span className="text-foreground">{pedido.direccion_entrega || "Sin dirección"}</span>
                      </div>

                      {/* Evidence Photo */}
                      {pedido.foto_evidencia && (
                        <div className="space-y-2">
                          <p className="text-xs font-medium text-muted-foreground flex items-center gap-1">
                            <ImageIcon className="h-3 w-3" />
                            Foto de Evidencia:
                          </p>
                          <div 
                            className="relative w-full h-40 rounded-lg overflow-hidden cursor-pointer hover:opacity-90 transition-opacity"
                            onClick={() => setSelectedImage(pedido.foto_evidencia)}
                          >
                            <img
                              src={pedido.foto_evidencia}
                              alt="Evidencia"
                              className="w-full h-full object-cover"
                            />
                            <div className="absolute inset-0 bg-black/20 flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity">
                              <ExternalLink className="h-6 w-6 text-white" />
                            </div>
                          </div>
                        </div>
                      )}

                      {/* Actions */}
                      <div className="flex gap-2 flex-wrap">
                        {pedido.client_phone && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={(e) => {
                              e.stopPropagation();
                              openWhatsApp(pedido.client_phone, pedido);
                            }}
                            className="gap-1 bg-green-50 border-green-300 text-green-700 hover:bg-green-100"
                          >
                            <Phone className="h-3 w-3" />
                            WhatsApp
                          </Button>
                        )}
                        {pedido.novedad_latitud && pedido.novedad_longitud && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={(e) => {
                              e.stopPropagation();
                              openLocation(pedido.novedad_latitud!, pedido.novedad_longitud!);
                            }}
                            className="gap-1"
                          >
                            <MapPin className="h-3 w-3" />
                            Ver Ubicación GPS
                          </Button>
                        )}
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            onPedidoClick(pedido);
                          }}
                        >
                          Ver Detalles
                        </Button>
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          );
        })}
      </div>

      {/* Image Modal */}
      <AnimatePresence>
        {selectedImage && (
          <motion.div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setSelectedImage(null)}
          >
            <button
              className="absolute top-4 right-4 p-2 rounded-full bg-white/20 hover:bg-white/30 transition-colors"
              onClick={() => setSelectedImage(null)}
            >
              <X className="h-6 w-6 text-white" />
            </button>
            <motion.img
              src={selectedImage}
              alt="Evidencia ampliada"
              className="max-w-full max-h-[90vh] rounded-lg"
              initial={{ scale: 0.9 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0.9 }}
            />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default NovedadesPanel;
