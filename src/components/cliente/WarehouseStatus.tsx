import { motion } from "framer-motion";
import { Warehouse, Clock, MapPin, CheckCircle, XCircle } from "lucide-react";

interface WarehouseStatusProps {
  isOpen: boolean;
  address: string;
}

// Business hours configuration - Monday to Saturday 8am-6pm
const BUSINESS_HOURS = {
  start: 8, // 8:00 AM
  end: 18,  // 6:00 PM
  workDays: [1, 2, 3, 4, 5, 6], // Monday to Saturday
};

export const checkWarehouseOpen = (): boolean => {
  const now = new Date();
  const dayOfWeek = now.getDay(); // 0 = Sunday, 1 = Monday, etc.
  const currentHour = now.getHours();

  const isWorkDay = BUSINESS_HOURS.workDays.includes(dayOfWeek);
  const isWithinHours = currentHour >= BUSINESS_HOURS.start && currentHour < BUSINESS_HOURS.end;

  return isWorkDay && isWithinHours;
};

const WarehouseStatus = ({ isOpen, address }: WarehouseStatusProps) => {
  return (
    <motion.div
      className={`rounded-xl border p-4 ${
        isOpen
          ? "bg-green-500/5 border-green-500/20"
          : "bg-red-500/5 border-red-500/20"
      }`}
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div
            className={`flex h-12 w-12 items-center justify-center rounded-xl ${
              isOpen
                ? "bg-green-500/10"
                : "bg-red-500/10"
            }`}
          >
            <Warehouse
              className={`h-6 w-6 ${isOpen ? "text-green-600" : "text-red-600"}`}
            />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-semibold text-foreground">Bodega Central</span>
              <motion.div
                className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold ${
                  isOpen
                    ? "bg-green-500/20 text-green-600"
                    : "bg-red-500/20 text-red-600"
                }`}
                animate={{ scale: [1, 1.05, 1] }}
                transition={{ duration: 2, repeat: Infinity }}
              >
                {isOpen ? (
                  <CheckCircle className="h-3 w-3" />
                ) : (
                  <XCircle className="h-3 w-3" />
                )}
                {isOpen ? "Abierta" : "Cerrada"}
              </motion.div>
            </div>
            <div className="flex items-center gap-1 mt-1">
              <MapPin className="h-3 w-3 text-muted-foreground" />
              <p className="text-xs text-muted-foreground">{address}</p>
            </div>
          </div>
        </div>

        <div className="hidden sm:flex flex-col items-end text-right">
          <div className="flex items-center gap-1 text-xs text-muted-foreground">
            <Clock className="h-3 w-3" />
            Horario
          </div>
          <p className="text-sm font-medium text-foreground">
            Lun - Sáb: 8am - 6pm
          </p>
        </div>
      </div>
    </motion.div>
  );
};

export default WarehouseStatus;
