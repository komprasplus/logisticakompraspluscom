import { useState } from "react";
import {
  Check,
  CreditCard,
  Loader2,
  MessageCircle,
  Sparkles,
  Tag,
  X,
} from "lucide-react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import { type CatalogPlan } from "@/hooks/useProveedorPlan";

interface UpgradePlanDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  currentPlan: CatalogPlan;
  /** Razón opcional por la que se abrió (ej: "Quieres crear una 4ta lista"). */
  reason?: string;
}

interface PlanInfo {
  id: CatalogPlan;
  nombre: string;
  precio: string;
  /** rank 0=free, 1=pro, 2=premium, 3=business — para saber qué planes son "upgrade". */
  rank: number;
  highlight?: boolean;
  features: { label: string; included: boolean }[];
}

const PLANS: PlanInfo[] = [
  {
    id: "free",
    nombre: "Free",
    precio: "$0",
    rank: 0,
    features: [
      { label: "1 lista de precios", included: true },
      { label: "Catálogo público", included: true },
      { label: "Listas privadas con código", included: false },
      { label: "PDF/Excel del catálogo", included: false },
    ],
  },
  {
    id: "pro",
    nombre: "Pro",
    precio: "$39.000/mes",
    rank: 1,
    features: [
      { label: "Hasta 3 listas de precios", included: true },
      { label: "Catálogo público", included: true },
      { label: "Listas privadas con código", included: false },
      { label: "PDF/Excel del catálogo", included: false },
    ],
  },
  {
    id: "premium",
    nombre: "Premium",
    precio: "$89.000/mes",
    rank: 2,
    highlight: true,
    features: [
      { label: "Listas ilimitadas", included: true },
      { label: "Listas privadas con código", included: true },
      { label: "PDF/Excel del catálogo", included: true },
      { label: "Soporte prioritario", included: true },
    ],
  },
  {
    id: "business",
    nombre: "Business",
    precio: "$199.000/mes",
    rank: 3,
    features: [
      { label: "Todo lo de Premium", included: true },
      { label: "Dominio custom (subdominio)", included: true },
      { label: "Plantillas personalizadas", included: true },
      { label: "Cuenta dedicada", included: true },
    ],
  },
];

const SUPPORT_WHATSAPP = "573242223825";

const buildWhatsappLink = (currentPlan: CatalogPlan, reason?: string) => {
  const msg = [
    `Hola, estoy en el plan ${currentPlan.toUpperCase()} de Plus Envíos.`,
    reason ? `\nMotivo: ${reason}` : "",
    "\nQuiero información para mejorar mi plan.",
  ].join("");
  return `https://wa.me/${SUPPORT_WHATSAPP}?text=${encodeURIComponent(msg)}`;
};

interface PlanCardProps {
  plan: PlanInfo;
  current: boolean;
  isUpgrade: boolean;
  loading: boolean;
  onPay: () => void;
}

const PlanCard = ({ plan, current, isUpgrade, loading, onPay }: PlanCardProps) => (
  <div
    className={cn(
      "relative rounded-xl border p-3 flex flex-col gap-2",
      plan.highlight
        ? "border-gold/60 bg-gradient-to-br from-gold/10 to-gold/0 shadow-sm"
        : "border-border bg-card",
      current && "ring-2 ring-primary",
    )}
  >
    {plan.highlight && (
      <span className="absolute -top-2 left-3 inline-flex items-center gap-1 rounded-full bg-gold px-2 py-0.5 text-[10px] font-bold text-gold-foreground">
        <Sparkles className="h-2.5 w-2.5" /> Más popular
      </span>
    )}
    {current && (
      <span className="absolute -top-2 right-3 rounded-full bg-primary px-2 py-0.5 text-[10px] font-bold text-primary-foreground">
        Tu plan
      </span>
    )}
    <div>
      <p className="text-base font-bold text-foreground">{plan.nombre}</p>
      <p className="text-xs text-muted-foreground">{plan.precio}</p>
    </div>
    <ul className="space-y-1 flex-1">
      {plan.features.map((f) => (
        <li
          key={f.label}
          className={cn(
            "flex items-start gap-1.5 text-[12px]",
            f.included ? "text-foreground" : "text-muted-foreground/70 line-through",
          )}
        >
          {f.included ? (
            <Check className="h-3.5 w-3.5 mt-0.5 text-success flex-shrink-0" />
          ) : (
            <X className="h-3.5 w-3.5 mt-0.5 text-muted-foreground/50 flex-shrink-0" />
          )}
          <span className="flex-1">{f.label}</span>
        </li>
      ))}
    </ul>
    {isUpgrade && (
      <Button
        size="sm"
        onClick={onPay}
        disabled={loading}
        className={cn(
          "mt-1 gap-1.5 font-semibold",
          plan.highlight && "bg-gold text-gold-foreground hover:bg-gold/90",
        )}
      >
        {loading ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
        ) : (
          <CreditCard className="h-3.5 w-3.5" />
        )}
        Pagar y activar
      </Button>
    )}
    {current && (
      <div className="mt-1 rounded-md bg-primary/10 px-2 py-1.5 text-center text-[11px] font-semibold text-primary">
        Plan actual
      </div>
    )}
  </div>
);

const UpgradePlanDialog = ({
  open,
  onOpenChange,
  currentPlan,
  reason,
}: UpgradePlanDialogProps) => {
  const whatsappUrl = buildWhatsappLink(currentPlan, reason);
  const currentRank = PLANS.find((p) => p.id === currentPlan)?.rank ?? 0;
  const [payingPlan, setPayingPlan] = useState<CatalogPlan | null>(null);

  const iniciarPago = async (planTarget: CatalogPlan) => {
    setPayingPlan(planTarget);
    try {
      const { data, error } = await supabase.functions.invoke(
        "bold-iniciar-upgrade",
        {
          body: {
            plan_target: planTarget,
            callback_url: `${window.location.origin}/cliente?upgrade=success`,
          },
        },
      );
      if (error) throw error;
      const url = (data as { payment_url?: string })?.payment_url;
      if (!url) {
        throw new Error("La pasarela no devolvió un link de pago");
      }
      // Abrir en nueva pestaña para no perder el contexto del dashboard.
      window.open(url, "_blank", "noopener,noreferrer");
      toast.success(
        "Te abrimos el link de Bold en otra pestaña. Cuando completes el pago tu plan se activa automáticamente.",
        { duration: 8000 },
      );
      onOpenChange(false);
    } catch (e: any) {
      const msg =
        e?.context?.body?.error ??
        e?.message ??
        "No pudimos iniciar el pago. Intenta de nuevo.";
      toast.error(msg);
    } finally {
      setPayingPlan(null);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Tag className="h-4 w-4 text-gold" />
            Actualiza tu plan de catálogo
          </DialogTitle>
          <DialogDescription>
            {reason
              ? `${reason} Para hacerlo, necesitas un plan superior.`
              : "Desbloquea más listas de precios y funciones avanzadas. Pago seguro con Bold."}
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 py-2">
          {PLANS.map((plan) => (
            <PlanCard
              key={plan.id}
              plan={plan}
              current={plan.id === currentPlan}
              isUpgrade={plan.rank > currentRank}
              loading={payingPlan === plan.id}
              onPay={() => iniciarPago(plan.id)}
            />
          ))}
        </div>

        <DialogFooter className="flex-col items-stretch gap-2 sm:flex-row sm:items-center sm:justify-between">
          <a
            href={whatsappUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center justify-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            <MessageCircle className="h-3.5 w-3.5" />
            ¿Otro método de pago? Habla con un asesor
          </a>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cerrar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default UpgradePlanDialog;
