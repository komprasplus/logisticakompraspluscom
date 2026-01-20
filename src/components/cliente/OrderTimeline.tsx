import { motion } from "framer-motion";
import { Package, Warehouse, Truck, CheckCircle2 } from "lucide-react";
import { cn } from "@/lib/utils";
import MotorcycleIcon from "@/components/MotorcycleIcon";

interface OrderTimelineProps {
  status: string | null;
  compact?: boolean;
}

const steps = [
  { key: 1, label: "Recibido", icon: Package },
  { key: 2, label: "En Bodega", icon: Warehouse },
  { key: 3, label: "En Ruta", icon: Truck },
  { key: 4, label: "Entregado", icon: CheckCircle2 },
];

const getStatusStep = (status: string | null): number => {
  const s = status?.toLowerCase();
  switch (s) {
    case "pendiente":
      return 1;
    case "recibido":
    case "pedido recibido":
    case "recibido en bodega":
    case "asignado":
      return 2;
    case "en ruta":
    case "en camino":
      return 3;
    case "entregado":
    case "liquidado":
    case "pagado":
      return 4;
    default:
      return 1;
  }
};

const OrderTimeline = ({ status, compact = false }: OrderTimelineProps) => {
  const currentStep = getStatusStep(status);
  
  // Calculate motorcycle position percentage
  const getMotorcyclePosition = (step: number): number => {
    switch (step) {
      case 1: return 0;
      case 2: return 33;
      case 3: return 66;
      case 4: return 100;
      default: return 0;
    }
  };

  if (compact) {
    return (
      <div className="relative flex items-center gap-1 py-2">
        {/* Progress Bar Background */}
        <div className="absolute left-2 right-2 h-1 bg-muted rounded-full" />
        
        {/* Progress Bar Fill */}
        <motion.div
          className="absolute left-2 h-1 bg-gradient-to-r from-primary to-green-500 rounded-full"
          initial={{ width: "0%" }}
          animate={{ width: `${getMotorcyclePosition(currentStep)}%` }}
          transition={{ duration: 0.5, ease: "easeOut" }}
        />

        {/* Steps */}
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
                    isCompleted
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted text-muted-foreground",
                    isCurrent && "ring-2 ring-primary ring-offset-2"
                  )}
                >
                  <Icon className="h-3 w-3" />
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  return (
    <div className="relative py-3">
      {/* Progress Bar Container */}
      <div className="relative mx-4">
        {/* Background Track */}
        <div className="absolute top-1/2 left-0 right-0 h-1.5 bg-muted rounded-full -translate-y-1/2" />
        
        {/* Progress Fill */}
        <motion.div
          className="absolute top-1/2 left-0 h-1.5 bg-gradient-to-r from-primary via-blue-500 to-green-500 rounded-full -translate-y-1/2"
          initial={{ width: "0%" }}
          animate={{ width: `${getMotorcyclePosition(currentStep)}%` }}
          transition={{ duration: 0.6, ease: "easeOut" }}
        />

        {/* Motorcycle Icon */}
        <motion.div
          className="absolute top-1/2 -translate-y-1/2 z-20"
          initial={{ left: "0%" }}
          animate={{ left: `${getMotorcyclePosition(currentStep)}%` }}
          transition={{ duration: 0.6, ease: "easeOut" }}
          style={{ marginLeft: "-12px" }}
        >
          <div className="bg-white rounded-full p-1 shadow-lg">
            <MotorcycleIcon className="w-5 h-5 text-primary" />
          </div>
        </motion.div>
      </div>

      {/* Step Icons */}
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
                  isCurrent && "ring-2 ring-primary ring-offset-2"
                )}
                whileHover={{ scale: 1.1 }}
              >
                <Icon className="h-4 w-4" />
              </motion.div>
              <span
                className={cn(
                  "text-[10px] font-medium text-center",
                  isCompleted ? "text-foreground" : "text-muted-foreground"
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
