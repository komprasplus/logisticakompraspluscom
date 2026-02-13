import { motion, useReducedMotion } from "framer-motion";
import { Warehouse, Clock, MapPin, CheckCircle, XCircle } from "lucide-react";

// ─── Tipos ────────────────────────────────────────────────────────────────────

interface WarehouseStatusProps {
  isOpen: boolean;
  address: string;
}

// ─── Constantes ───────────────────────────────────────────────────────────────

const BUSINESS_HOURS = {
  start: 8, // 8:00 AM
  end: 18, // 6:00 PM
  workDays: [1, 2, 3, 4, 5, 6], // Lunes a Sábado
};

// ─── Helper exportado ─────────────────────────────────────────────────────────

/**
 * Comprueba si la bodega está abierta en este momento.
 *
 * FIX: versión original usaba `new Date().getHours()` que devuelve la hora en
 * el timezone LOCAL del navegador. Un usuario con el sistema configurado en
 * UTC, EST o cualquier otra zona diferente a Colombia (UTC-5) vería el estado
 * incorrecto. Corregido usando `Intl.DateTimeFormat` con `timeZone: "America/Bogota"`
 * para obtener siempre la hora colombiana, independientemente del dispositivo.
 *
 * Mismo patrón de timezone que HistorialTransaccionesView, IntegracionesView,
 * NovedadesView, etc.
 */
export const checkWarehouseOpen = (): boolean => {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Bogota",
    weekday: "short",
    hour: "numeric",
    hour12: false,
  }).formatToParts(new Date());

  const hourPart = parts.find((p) => p.type === "hour");
  const weekdayPart = parts.find((p) => p.type === "weekday");
  if (!hourPart || !weekdayPart) return false;

  const currentHour = parseInt(hourPart.value, 10);
  const dayMap: Record<string, number> = {
    Sun: 0,
    Mon: 1,
    Tue: 2,
    Wed: 3,
    Thu: 4,
    Fri: 5,
    Sat: 6,
  };
  const dayOfWeek = dayMap[weekdayPart.value] ?? -1;

  return (
    BUSINESS_HOURS.workDays.includes(dayOfWeek) &&
    currentHour >= BUSINESS_HOURS.start &&
    currentHour < BUSINESS_HOURS.end
  );
};

// ─── Componente ───────────────────────────────────────────────────────────────

const WarehouseStatus = ({ isOpen, address }: WarehouseStatusProps) => {
  const prefersReducedMotion = useReducedMotion();

  return (
    <motion.div
      className={`rounded-xl border p-4 ${
        isOpen ? "bg-green-500/5 border-green-500/20" : "bg-red-500/5   border-red-500/20"
      }`}
      initial={{ opacity: 0, scale: prefersReducedMotion ? 1 : 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          {/* Ícono de bodega */}
          <div
            className={`flex h-12 w-12 items-center justify-center rounded-xl ${
              isOpen ? "bg-green-500/10" : "bg-red-500/10"
            }`}
          >
            {/*
              FIX: sintaxis JSX malformada en el original.
              `className=\`h-6 w-6 ...\`}` le faltaba la `{` de apertura
              antes del template literal — el archivo no compilaba.
              Corregido a `className={\`h-6 w-6 ...\`}`.
            */}
            <Warehouse className={`h-6 w-6 ${isOpen ? "text-green-600" : "text-red-600"}`} aria-hidden="true" />
          </div>

          <div>
            <div className="flex items-center gap-2">
              <span className="font-semibold text-foreground">Bodega Central</span>

              {/*
                FIX: animación pulsante con `repeat: Infinity` sin respetar
                `prefers-reduced-motion`. Para usuarios con epilepsia fotosensible
                o sensibilidad al movimiento, las animaciones en bucle infinito
                son especialmente problemáticas. Si el usuario prefiere movimiento
                reducido se elimina el scale pulsante completamente.

                FIX: `role="status"` + `aria-live="polite"` para que lectores
                de pantalla anuncien cambios del estado de la bodega.
              */}
              <motion.div
                role="status"
                aria-label={isOpen ? "Bodega abierta" : "Bodega cerrada"}
                aria-live="polite"
                className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold ${
                  isOpen ? "bg-green-500/20 text-green-600" : "bg-red-500/20   text-red-600"
                }`}
                animate={prefersReducedMotion ? undefined : { scale: [1, 1.05, 1] }}
                transition={prefersReducedMotion ? undefined : { duration: 2, repeat: Infinity }}
              >
                {isOpen ? (
                  <CheckCircle className="h-3 w-3" aria-hidden="true" />
                ) : (
                  <XCircle className="h-3 w-3" aria-hidden="true" />
                )}
                {isOpen ? "Abierta" : "Cerrada"}
              </motion.div>
            </div>

            {/* Dirección */}
            {address && (
              <div className="flex items-center gap-1 mt-1">
                <MapPin className="h-3 w-3 text-muted-foreground" aria-hidden="true" />
                <p className="text-xs text-muted-foreground">{address}</p>
              </div>
            )}
          </div>
        </div>

        {/* Horario (solo en sm+) */}
        <div className="hidden sm:flex flex-col items-end text-right">
          <div className="flex items-center gap-1 text-xs text-muted-foreground">
            <Clock className="h-3 w-3" aria-hidden="true" />
            <span>Horario</span>
          </div>
          <p className="text-sm font-medium text-foreground">Lun - Sáb: 8am - 6pm</p>
        </div>
      </div>
    </motion.div>
  );
};

export default WarehouseStatus;
