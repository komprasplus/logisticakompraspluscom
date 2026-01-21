import { motion } from "framer-motion";
import { 
  Home, 
  MapPinOff, 
  PhoneOff, 
  CalendarClock,
  ChevronRight,
  Camera,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface Pedido {
  id: number;
  numero_guia: string | null;
  cliente_nombre: string | null;
  direccion_entrega: string | null;
  estado: string | null;
  client_phone: string | null;
  tipo_novedad: string | null;
  foto_evidencia: string | null;
  fecha_actualizacion: string | null;
  motorizado_asignado: string | null;
}

interface NovedadCompactCardProps {
  pedido: Pedido;
  onResolve: (pedido: Pedido) => void;
  onViewEvidence?: (url: string) => void;
  index?: number;
}

const getNovedadIcon = (tipo: string | null) => {
  switch (tipo?.toLowerCase()) {
    case "cliente ausente":
      return { icon: Home, color: "text-orange-500", bg: "bg-orange-100" };
    case "dirección errada":
      return { icon: MapPinOff, color: "text-red-500", bg: "bg-red-100" };
    case "teléfono no contesta":
      return { icon: PhoneOff, color: "text-amber-500", bg: "bg-amber-100" };
    case "reprogramado":
      return { icon: CalendarClock, color: "text-blue-500", bg: "bg-blue-100" };
    default:
      return { icon: Home, color: "text-orange-500", bg: "bg-orange-100" };
  }
};

const NovedadCompactCard = ({ 
  pedido, 
  onResolve, 
  onViewEvidence,
  index = 0 
}: NovedadCompactCardProps) => {
  const novedadConfig = getNovedadIcon(pedido.tipo_novedad);
  const NovedadIcon = novedadConfig.icon;

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return "";
    const date = new Date(dateStr);
    const now = new Date();
    const diffHours = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60));
    
    if (diffHours < 1) return "Hace minutos";
    if (diffHours < 24) return `Hace ${diffHours}h`;
    return date.toLocaleDateString("es-CO", { day: "2-digit", month: "short" });
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.05 }}
      className="bg-card border border-border rounded-xl p-3 shadow-sm hover:shadow-md transition-all"
    >
      <div className="flex items-center gap-3">
        {/* Icon */}
        <div className={cn(
          "flex-shrink-0 w-10 h-10 rounded-xl flex items-center justify-center",
          novedadConfig.bg
        )}>
          <NovedadIcon className={cn("h-5 w-5", novedadConfig.color)} />
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-bold text-sm text-foreground truncate">
              {pedido.numero_guia || `#${pedido.id}`}
            </span>
            {pedido.foto_evidencia && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onViewEvidence?.(pedido.foto_evidencia!);
                }}
                className="flex-shrink-0 p-1 rounded-md bg-muted hover:bg-muted/80"
              >
                <Camera className="h-3.5 w-3.5 text-muted-foreground" />
              </button>
            )}
          </div>
          <p className="text-xs text-muted-foreground truncate">
            {pedido.tipo_novedad || "Novedad"}
          </p>
          <p className="text-xs text-muted-foreground/70 truncate">
            {formatDate(pedido.fecha_actualizacion)}
          </p>
        </div>

        {/* Action */}
        <Button
          size="sm"
          onClick={() => onResolve(pedido)}
          className="flex-shrink-0 h-9 px-3 bg-orange-500 hover:bg-orange-600 text-white gap-1"
        >
          <span className="hidden sm:inline">Resolver</span>
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>
    </motion.div>
  );
};

export default NovedadCompactCard;
