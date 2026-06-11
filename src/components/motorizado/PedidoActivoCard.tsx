import { ArrowRight, Clock, MapPin, Navigation, Phone } from "lucide-react";
import { formatCOP } from "@/lib/motorizado-score";
import { cn } from "@/lib/utils";

interface PedidoMinimo {
  id: number;
  id_guia?: string | null;
  numero_guia?: string | null;
  cliente_nombre: string | null;
  direccion_entrega: string | null;
  client_phone: string | null;
  valor_recaudar?: number | null;
  metodo_pago?: string | null;
  ciudad?: string | null;
}

interface PedidoActivoCardProps {
  pedido: PedidoMinimo | null;
  onNavigate: (pedido: PedidoMinimo) => void;
  onCallClient: (pedido: PedidoMinimo) => void;
  onViewDetail: (pedido: PedidoMinimo) => void;
}

const PedidoActivoCard = ({
  pedido,
  onNavigate,
  onCallClient,
  onViewDetail,
}: PedidoActivoCardProps) => {
  if (!pedido) {
    return (
      <div className="bg-card border-2 border-dashed border-border rounded-2xl p-6 text-center">
        <Clock className="h-10 w-10 text-muted-foreground/40 mx-auto mb-2" />
        <h3 className="font-semibold text-foreground">Sin pedidos activos</h3>
        <p className="text-sm text-muted-foreground mt-1">
          Cuando se te asigne uno, aparecerá aquí
        </p>
      </div>
    );
  }

  const valor = pedido.valor_recaudar ?? 0;
  const esCOD = pedido.metodo_pago === "efectivo" || pedido.metodo_pago === "contraentrega";

  return (
    <div className="bg-gradient-to-br from-card to-card/95 border border-primary/20 rounded-2xl shadow-md overflow-hidden">
      {/* Header con indicador de estado activo */}
      <div className="bg-primary px-4 py-2.5 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-gold opacity-75" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-gold" />
          </span>
          <span className="text-xs font-semibold uppercase tracking-wide text-primary-foreground">
            Pedido activo
          </span>
        </div>
        <span className="text-xs text-primary-foreground/80 font-mono">
          #{pedido.id_guia ?? pedido.numero_guia ?? pedido.id}
        </span>
      </div>

      {/* Body */}
      <div className="p-4 space-y-3">
        {/* Cliente + valor */}
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-0.5">
              Cliente
            </p>
            <h3 className="font-bold text-base text-foreground truncate">
              {pedido.cliente_nombre || "Sin nombre"}
            </h3>
            {pedido.client_phone && (
              <p className="text-xs text-muted-foreground mt-0.5">{pedido.client_phone}</p>
            )}
          </div>
          {valor > 0 && (
            <div
              className={cn(
                "rounded-lg px-3 py-2 text-right flex-shrink-0",
                esCOD ? "bg-gold/15 border border-gold/30" : "bg-success/10 border border-success/30",
              )}
            >
              <p className="text-[10px] font-semibold uppercase tracking-wide opacity-70">
                {esCOD ? "A cobrar" : "Pagado"}
              </p>
              <p className={cn("text-base font-bold tabular-nums", esCOD ? "text-gold-dark" : "text-success")}>
                {formatCOP(valor)}
              </p>
            </div>
          )}
        </div>

        {/* Dirección */}
        <button
          onClick={() => onViewDetail(pedido)}
          className="w-full flex items-start gap-2 p-3 bg-muted/50 hover:bg-muted rounded-lg text-left transition-colors group"
        >
          <MapPin className="h-4 w-4 text-primary flex-shrink-0 mt-0.5" />
          <div className="min-w-0 flex-1">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-0.5">
              Dirección
            </p>
            <p className="text-sm text-foreground line-clamp-2">
              {pedido.direccion_entrega || "Sin dirección"}
            </p>
            {pedido.ciudad && (
              <p className="text-xs text-muted-foreground mt-0.5">{pedido.ciudad}</p>
            )}
          </div>
          <ArrowRight className="h-4 w-4 text-muted-foreground group-hover:text-foreground transition-colors flex-shrink-0 mt-1" />
        </button>

        {/* Acciones primarias */}
        <div className="grid grid-cols-2 gap-2">
          <button
            onClick={() => onNavigate(pedido)}
            className="h-12 bg-primary hover:bg-primary/90 text-primary-foreground rounded-lg font-semibold text-sm flex items-center justify-center gap-2 transition-colors"
          >
            <Navigation className="h-4 w-4" />
            Navegar
          </button>
          <button
            onClick={() => onCallClient(pedido)}
            disabled={!pedido.client_phone}
            className="h-12 bg-gold hover:bg-gold-dark text-gold-foreground rounded-lg font-semibold text-sm flex items-center justify-center gap-2 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <Phone className="h-4 w-4" />
            Llamar
          </button>
        </div>

        <button
          onClick={() => onViewDetail(pedido)}
          className="w-full h-10 border border-border hover:bg-muted rounded-lg font-medium text-sm text-foreground transition-colors"
        >
          Ver detalle y entregar
        </button>
      </div>
    </div>
  );
};

export default PedidoActivoCard;
