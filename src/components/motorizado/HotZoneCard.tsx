import { ArrowRight, Flame } from "lucide-react";
import { formatCOP } from "@/lib/motorizado-score";

interface HotZoneCardProps {
  zoneName: string;
  pedidosDisponibles: number;
  bonusPerDelivery: number;
  onAcceptZone: () => void;
}

const HotZoneCard = ({
  zoneName,
  pedidosDisponibles,
  bonusPerDelivery,
  onAcceptZone,
}: HotZoneCardProps) => {
  return (
    <div className="relative overflow-hidden rounded-2xl border border-border bg-gradient-to-br from-primary/[0.03] to-primary/[0.01] p-3.5">
      {/* Decoración derecha */}
      <div className="absolute top-0 right-0 bottom-0 w-24 bg-gradient-to-bl from-pink/8 to-gold/4 rounded-r-2xl" />

      <div className="relative">
        <div className="flex items-center gap-1.5 mb-2">
          <Flame className="h-3.5 w-3.5 text-pink" />
          <span className="text-[10px] font-semibold uppercase tracking-wider text-foreground">
            Zona caliente ahora
          </span>
        </div>

        <div className="flex items-end justify-between gap-3">
          <div className="flex-1 min-w-0">
            <div className="text-sm font-bold text-foreground leading-tight">{zoneName}</div>
            <div className="text-[11px] text-muted-foreground mt-0.5">
              {pedidosDisponibles} {pedidosDisponibles === 1 ? "pedido disponible" : "pedidos disponibles"}
              {bonusPerDelivery > 0 && (
                <>
                  {" · "}
                  <span className="text-gold-dark font-semibold">
                    Bono +{formatCOP(bonusPerDelivery)} c/u
                  </span>
                </>
              )}
            </div>
          </div>
          <button
            onClick={onAcceptZone}
            className="bg-primary hover:bg-primary/90 text-primary-foreground px-3 py-2 rounded-lg text-[11px] font-semibold flex items-center gap-1 transition-colors flex-shrink-0"
          >
            Ir
            <ArrowRight className="h-3 w-3" />
          </button>
        </div>
      </div>
    </div>
  );
};

export default HotZoneCard;
