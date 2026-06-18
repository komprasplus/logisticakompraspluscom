import { CheckCircle2, MapPin, Camera, FileSignature } from "lucide-react";
import { formatCOPShort, isCashPayment } from "@/lib/payments";
import { cn } from "@/lib/utils";

interface PedidoEntregado {
  id: number;
  numero_guia?: string | null;
  cliente_nombre: string | null;
  direccion_entrega: string | null;
  zona?: string | null;
  valor_recaudar?: number | null;
  metodo_pago?: string | null;
  foto_evidencia?: string | null;
  foto_paquete?: string | null;
  firma_cliente?: string | null;
  fecha_actualizacion?: string | null;
}

interface EntregaDelDiaCardProps {
  pedido: PedidoEntregado;
  onClick?: (pedido: PedidoEntregado) => void;
}

const formatBogotaTime = (iso: string | null | undefined): string => {
  if (!iso) return "--:--";
  try {
    return new Intl.DateTimeFormat("es-CO", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
      timeZone: "America/Bogota",
    }).format(new Date(iso));
  } catch {
    return "--:--";
  }
};

const EntregaDelDiaCard = ({ pedido, onClick }: EntregaDelDiaCardProps) => {
  const valor = Number(pedido.valor_recaudar ?? 0);
  const esCOD = isCashPayment(pedido.metodo_pago);
  const photo = pedido.foto_evidencia || pedido.foto_paquete;
  const time = formatBogotaTime(pedido.fecha_actualizacion);

  const Wrapper: React.ElementType = onClick ? "button" : "div";
  const wrapperProps = onClick
    ? { onClick: () => onClick(pedido), type: "button" as const }
    : {};

  return (
    <Wrapper
      {...wrapperProps}
      className={cn(
        "w-full text-left bg-card border border-border rounded-xl overflow-hidden transition-all",
        onClick && "hover:border-success/40 hover:shadow-sm active:scale-[0.99]",
      )}
    >
      <div className="flex items-stretch">
        {/* Marca lateral verde de "entregado" */}
        <div className="w-1 bg-success flex-shrink-0" aria-hidden="true" />

        {/* Hora */}
        <div className="flex flex-col items-center justify-center px-3 py-3 bg-success/5 border-r border-border min-w-[64px]">
          <CheckCircle2 className="h-3.5 w-3.5 text-success mb-1" />
          <span className="text-base font-bold tabular-nums text-foreground leading-none">
            {time}
          </span>
          <span className="text-[10px] uppercase text-muted-foreground mt-0.5">
            Entregado
          </span>
        </div>

        {/* Contenido principal */}
        <div className="flex-1 min-w-0 p-3 flex flex-col gap-1.5">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <h4 className="text-sm font-semibold text-foreground truncate leading-tight">
                {pedido.cliente_nombre || "Sin nombre"}
              </h4>
              <p className="text-[11px] font-mono text-muted-foreground truncate">
                #{pedido.numero_guia ?? pedido.id}
              </p>
            </div>
            {valor > 0 && (
              <div
                className={cn(
                  "rounded-md px-2 py-1 text-right flex-shrink-0",
                  esCOD
                    ? "bg-gold/15 text-gold-dark"
                    : "bg-success/10 text-success",
                )}
              >
                <p className="text-[9px] uppercase tracking-wider opacity-70 leading-tight">
                  {esCOD ? "Cobrado" : "Pagado"}
                </p>
                <p className="text-xs font-bold tabular-nums leading-tight">
                  {formatCOPShort(valor)}
                </p>
              </div>
            )}
          </div>

          {pedido.direccion_entrega && (
            <div className="flex items-start gap-1 text-[11px] text-muted-foreground min-w-0">
              <MapPin className="h-3 w-3 text-pink flex-shrink-0 mt-0.5" />
              <span className="line-clamp-1">{pedido.direccion_entrega}</span>
              {pedido.zona && (
                <span className="ml-auto text-[10px] font-medium text-muted-foreground/70 flex-shrink-0 uppercase">
                  {pedido.zona}
                </span>
              )}
            </div>
          )}

          <div className="flex items-center gap-2 pt-0.5">
            {photo ? (
              <div className="relative h-9 w-9 rounded-md overflow-hidden border border-border flex-shrink-0">
                <img
                  src={photo}
                  alt="Evidencia"
                  className="h-full w-full object-cover"
                  loading="lazy"
                />
              </div>
            ) : (
              <span className="inline-flex items-center gap-1 text-[10px] text-muted-foreground">
                <Camera className="h-3 w-3" />
                Sin foto
              </span>
            )}
            {pedido.firma_cliente ? (
              <span className="inline-flex items-center gap-1 text-[10px] text-success">
                <FileSignature className="h-3 w-3" />
                Firma OK
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 text-[10px] text-muted-foreground">
                <FileSignature className="h-3 w-3" />
                Sin firma
              </span>
            )}
          </div>
        </div>
      </div>
    </Wrapper>
  );
};

export default EntregaDelDiaCard;
