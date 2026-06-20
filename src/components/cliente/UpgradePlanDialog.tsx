import { Check, MessageCircle, Sparkles, Tag, X } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { type CatalogPlan } from "@/hooks/useProveedorPlan";

interface UpgradePlanDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  currentPlan: CatalogPlan;
  /** Razón opcional por la que se abrió (ej: "Quieres crear una 4ta lista"). */
  reason?: string;
}

interface PlanCardProps {
  id: CatalogPlan;
  nombre: string;
  precio: string;
  highlight?: boolean;
  features: { label: string; included: boolean }[];
  current: boolean;
}

const PLANS: Omit<PlanCardProps, "current">[] = [
  {
    id: "free",
    nombre: "Free",
    precio: "$0",
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
    features: [
      { label: "Todo lo de Premium", included: true },
      { label: "Dominio custom (subdominio)", included: true },
      { label: "Plantillas personalizadas", included: true },
      { label: "Cuenta dedicada", included: true },
    ],
  },
];

// Número de Plus Envíos para el botón "Hablar con un asesor".
const SUPPORT_WHATSAPP = "573242223825";

const buildWhatsappLink = (currentPlan: CatalogPlan, reason?: string) => {
  const msg = [
    `Hola, estoy en el plan ${currentPlan.toUpperCase()} de Plus Envíos.`,
    reason ? `\nMotivo: ${reason}` : "",
    "\nQuiero información para mejorar mi plan.",
  ].join("");
  return `https://wa.me/${SUPPORT_WHATSAPP}?text=${encodeURIComponent(msg)}`;
};

const PlanCard = ({
  nombre,
  precio,
  highlight,
  features,
  current,
}: PlanCardProps) => (
  <div
    className={cn(
      "relative rounded-xl border p-3 flex flex-col gap-2",
      highlight
        ? "border-gold/60 bg-gradient-to-br from-gold/10 to-gold/0 shadow-sm"
        : "border-border bg-card",
      current && "ring-2 ring-primary",
    )}
  >
    {highlight && (
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
      <p className="text-base font-bold text-foreground">{nombre}</p>
      <p className="text-xs text-muted-foreground">{precio}</p>
    </div>
    <ul className="space-y-1">
      {features.map((f) => (
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
  </div>
);

const UpgradePlanDialog = ({
  open,
  onOpenChange,
  currentPlan,
  reason,
}: UpgradePlanDialogProps) => {
  const whatsappUrl = buildWhatsappLink(currentPlan, reason);

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
              : "Desbloquea más listas de precios y funciones avanzadas."}
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 py-2">
          {PLANS.map((p) => (
            <PlanCard
              key={p.id}
              {...p}
              current={p.id === currentPlan}
            />
          ))}
        </div>

        <DialogFooter className="gap-2 sm:gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Más tarde
          </Button>
          <Button asChild className="gap-2">
            <a href={whatsappUrl} target="_blank" rel="noopener noreferrer">
              <MessageCircle className="h-4 w-4" />
              Hablar con un asesor
            </a>
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default UpgradePlanDialog;
