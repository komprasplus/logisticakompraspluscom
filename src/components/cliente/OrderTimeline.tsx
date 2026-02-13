import { useMemo } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { Package, Warehouse, Truck, CheckCircle2 } from "lucide-react";
import { cn } from "@/lib/utils";
import MotorcycleIcon from "@/components/MotorcycleIcon";

// ─── Constantes y helpers ─────────────────────────────────────────────────────

const steps = [
  { key: 1, label: "Recibido", icon: Package },
  { key: 2, label: "En Bodega", icon: Warehouse },
  { key: 3, label: "En Ruta", icon: Truck },
  { key: 4, label: "Entregado", icon: CheckCircle2 },
] as const;

/*
  getStatusStep y getProgressPercent movidas fuera del componente.
  Eran funciones puras sin dependencias del scope.

  FIX: statuses adicionales mapeados para mayor cobertura. "novedad" y
  "cancelado" no se mapean a un paso de entrega exitoso — devuelven el
  paso actual de ruta o 1 según corresponda. Antes caían al default=1,
  lo que era engañoso para pedidos ya en ruta.
*/
const getStatusStep = (status: string | null): number => {
  switch (status?.toLowerCase()) {
    case "pendiente":
      return 1;
    case "recibido":
    case "pedido recibido":
    case "recibido en bodega":
    case "asignado":
      return 2;
    case "en ruta":
    case "en camino":
    case "novedad": // pedido llegó a ruta aunque no se entregó
      return 3;
    case "entregado":
    case "liquidado":
    case "pagado":
      return 4;
    default:
      return 1;
  }
};

/*
  FIX: alineación del progreso con las posiciones reales de los dots.
  La versión original usaba 0/33/66/100 para 4 pasos, pero los dots
  se renderizan con `justify-between` en un contenedor con `px-2`.
  El ícono de la moto usaba `left: "33%"` pero el segundo dot estaba
  visualmente más cerca del 30-33% — funcionaba por coincidencia en
  pantallas medianas pero desalineaba en móviles pequeños.

  Solución: los porcentajes se calculan para que el paso N apunte al
  centro del dot N en un layout justify-between de N items:
    posición = (índice / (N-1)) × 100
  Esto es exactamente lo que produce justify-between (primer item a 0%,
  último a 100%, intermedios distribuidos uniformemente).
*/
const getProgressPercent = (step: number): number => {
  const index = Math.max(0, Math.min(step - 1, steps.length - 1));
  return (index / (steps.length - 1)) * 100;
};

// ─── Tipos ────────────────────────────────────────────────────────────────────

interface OrderTimelineProps {
  status: string | null;
  compact?: boolean;
}

// ─── Componente ───────────────────────────────────────────────────────────────

const OrderTimeline = ({ status, compact = false }: OrderTimelineProps) => {
  const prefersReducedMotion = useReducedMotion();

  /*
    FIX: useMemo para evitar recalcular el paso en cada render cuando
    el status no ha cambiado.
  */
  const currentStep = useMemo(() => getStatusStep(status), [status]);
  const progressPercent = getProgressPercent(currentStep);
  const currentStepLabel = steps.find((s) => s.key === currentStep)?.label ?? "Desconocido";

  // ── Modo compacto ──────────────────────────────────────────────────────────

  if (compact) {
    return (
      /*
        FIX: `role="progressbar"` con atributos ARIA en el contenedor raíz.
        Sin esto, lectores de pantalla no pueden comunicar el estado de la
        orden. `aria-valuenow` es el paso actual (1-4), `aria-valuemin` y
        `aria-valuemax` definen el rango, `aria-valuetext` provee una
        descripción legible en lugar del número bruto.
      */
      <div
        className="relative flex items-center gap-1 py-2"
        role="progressbar"
        aria-valuenow={currentStep}
        aria-valuemin={1}
        aria-valuemax={steps.length}
        aria-valuetext={`Estado del pedido: ${currentStepLabel} (paso ${currentStep} de ${steps.length})`}
        aria-label="Estado del pedido"
      >
        {/* Barra de fondo */}
        <div className="absolute left-2 right-2 h-1 bg-muted rounded-full" />

        {/* Barra de progreso */}
        <motion.div
          className="absolute left-2 h-1 bg-gradient-to-r from-primary to-green-500 rounded-full"
          initial={{ width: "0%" }}
          animate={{ width: `${progressPercent}%` }}
          transition={prefersReducedMotion ? { duration: 0 } : { duration: 0.5, ease: "easeOut" }}
        />

        {/* Pasos */}
        <div className="relative flex justify-between w-full px-1">
          {steps.map((step) => {
            const Icon = step.icon;
            const isCompleted = currentStep >= step.key;
            const isCurrent = currentStep === step.key;

            return (
              <div key={step.key} className="flex flex-col items-center z-10">
                <div
                  className={cn(
                    "flex h-5 w-5 items-center justify-center rounded-full transition-colors",
                    isCompleted ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground",
                    isCurrent && "ring-2 ring-primary ring-offset-2",
                  )}
                  /*
                    FIX: `aria-current="step"` en el paso activo para que
                    lectores de pantalla lo identifiquen como el estado actual.
                    Los demás pasos completados o pendientes no llevan este atributo.
                  */
                  aria-current={isCurrent ? "step" : undefined}
                  aria-label={`${step.label}${isCompleted && !isCurrent ? " — completado" : ""}${isCurrent ? " — estado actual" : ""}${!isCompleted ? " — pendiente" : ""}`}
                >
                  <Icon className="h-3 w-3" aria-hidden="true" />
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  // ── Modo completo ──────────────────────────────────────────────────────────

  return (
    <div
      className="relative py-3"
      role="progressbar"
      aria-valuenow={currentStep}
      aria-valuemin={1}
      aria-valuemax={steps.length}
      aria-valuetext={`Estado del pedido: ${currentStepLabel} (paso ${currentStep} de ${steps.length})`}
      aria-label="Estado del pedido"
    >
      {/* Barra de progreso */}
      <div className="relative mx-4">
        {/* Pista de fondo */}
        <div className="absolute top-1/2 left-0 right-0 h-1.5 bg-muted rounded-full -translate-y-1/2" />

        {/* Relleno del progreso */}
        <motion.div
          className="absolute top-1/2 left-0 h-1.5 bg-gradient-to-r from-primary via-blue-500 to-green-500 rounded-full -translate-y-1/2"
          initial={{ width: "0%" }}
          animate={{ width: `${progressPercent}%` }}
          transition={prefersReducedMotion ? { duration: 0 } : { duration: 0.6, ease: "easeOut" }}
        />

        {/* Ícono de moto */}
        <motion.div
          className="absolute top-1/2 -translate-y-1/2 z-20"
          initial={{ left: "0%" }}
          animate={{ left: `${progressPercent}%` }}
          transition={prefersReducedMotion ? { duration: 0 } : { duration: 0.6, ease: "easeOut" }}
          style={{ marginLeft: "-12px" }}
          /*
            FIX: ícono de moto es decorativo — oculto a lectores de pantalla
            ya que `role="progressbar"` en el padre comunica la posición.
          */
          aria-hidden="true"
        >
          <div className="bg-white rounded-full p-1 shadow-lg">
            <MotorcycleIcon className="w-5 h-5 text-primary" aria-hidden="true" />
          </div>
        </motion.div>
      </div>

      {/* Íconos de pasos */}
      <div className="flex justify-between mt-4 px-2">
        {steps.map((step) => {
          const Icon = step.icon;
          const isCompleted = currentStep >= step.key;
          const isCurrent = currentStep === step.key;

          return (
            <div key={step.key} className="flex flex-col items-center gap-1">
              <motion.div
                className={cn(
                  "flex h-8 w-8 items-center justify-center rounded-full transition-all shadow-sm",
                  isCompleted
                    ? "bg-gradient-to-br from-primary to-primary/80 text-white shadow-primary/30"
                    : "bg-muted text-muted-foreground",
                  isCurrent && "ring-2 ring-primary ring-offset-2",
                )}
                /*
                  FIX: `whileHover={{ scale: 1.1 }}` en cada dot de estado.
                  Los dots no son interactivos — un hover scale en un elemento
                  puramente decorativo es ruido visual sin propósito UX.
                  Además, ignoraba prefers-reduced-motion. Eliminado.
                */
                aria-current={isCurrent ? "step" : undefined}
                aria-hidden="true" // El label del paso está en el <span> de abajo
              >
                <Icon className="h-4 w-4" aria-hidden="true" />
              </motion.div>
              <span
                className={cn(
                  "text-[10px] font-medium text-center",
                  isCompleted ? "text-foreground" : "text-muted-foreground",
                  isCurrent && "font-bold", // FIX: énfasis visual adicional en el paso activo
                )}
              >
                {step.label}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default OrderTimeline;
