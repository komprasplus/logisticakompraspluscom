import { useState, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Package,
  DollarSign,
  MapPin,
  CheckCircle2,
  Truck,
  X,
  AlertTriangle,
  Loader2,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { formatCOP } from "@/lib/tarifas";
import { cn } from "@/lib/utils";

interface LoadedOrder {
  id: number;
  numero_guia: string | null;
  cliente_nombre: string | null;
  valor_recaudar?: number | null;
  zona: string | null;
  estado: string | null;
}

interface LoadManifestProps {
  isOpen: boolean;
  onClose: () => void;
  pedidos: LoadedOrder[];
  motorizadoId: string;
  motorizadoName: string;
  onConfirmExit: () => void;
}

const LoadManifest = ({
  isOpen,
  onClose,
  pedidos,
  motorizadoId,
  motorizadoName,
  onConfirmExit,
}: LoadManifestProps) => {
  const [confirming, setConfirming] = useState(false);
  const [confirmed, setConfirmed] = useState(false);

  // Filter only orders that are "En Ruta" (loaded)
  const loadedPedidos = useMemo(() => {
    return pedidos.filter(
      (p) => p.estado?.toLowerCase() === "en ruta"
    );
  }, [pedidos]);

  // Calculate summary stats
  const stats = useMemo(() => {
    const totalOrders = loadedPedidos.length;
    const totalRecaudar = loadedPedidos.reduce(
      (acc, p) => acc + (p.valor_recaudar || 0),
      0
    );
    const uniqueZones = new Set(
      loadedPedidos.map((p) => p.zona).filter(Boolean)
    );
    return {
      totalOrders,
      totalRecaudar,
      zonesCount: uniqueZones.size,
      zones: Array.from(uniqueZones) as string[],
    };
  }, [loadedPedidos]);

  const handleConfirmExit = async () => {
    if (loadedPedidos.length === 0) {
      toast.error("No tienes pedidos cargados para iniciar ruta");
      return;
    }

    setConfirming(true);

    try {
      // Add system note to all loaded orders
      const timestamp = new Date().toLocaleString("es-CO");
      const systemNote = `[SISTEMA ${timestamp}] Salida de bodega confirmada por ${motorizadoName}`;

      // Update all loaded orders with the exit timestamp
      for (const pedido of loadedPedidos) {
        const { data: currentData } = await supabase
          .from("pedidos")
          .select("observaciones")
          .eq("id", pedido.id)
          .single();

        const existingObs = currentData?.observaciones || "";
        const updatedObs = existingObs
          ? `${existingObs}\n${systemNote}`
          : systemNote;

        await supabase
          .from("pedidos")
          .update({ observaciones: updatedObs })
          .eq("id", pedido.id);
      }

      // Play success sound
      try {
        const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
        const oscillator = audioContext.createOscillator();
        const gainNode = audioContext.createGain();
        oscillator.connect(gainNode);
        gainNode.connect(audioContext.destination);
        oscillator.frequency.value = 880;
        oscillator.type = "sine";
        gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.5);
        oscillator.start();
        oscillator.stop(audioContext.currentTime + 0.5);
      } catch (e) {
        console.log("Audio not supported");
      }

      setConfirmed(true);
      toast.success("🚀 Salida confirmada - ¡Buen viaje!");
      
      setTimeout(() => {
        onConfirmExit();
        onClose();
      }, 1500);
    } catch (error) {
      console.error("Error confirming exit:", error);
      toast.error("Error al confirmar salida");
    } finally {
      setConfirming(false);
    }
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <motion.div
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
      >
        <motion.div
          className="w-full max-w-lg max-h-[90vh] overflow-hidden rounded-3xl bg-card shadow-2xl flex flex-col"
          initial={{ scale: 0.9, opacity: 0, y: 20 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          exit={{ scale: 0.9, opacity: 0, y: 20 }}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between p-6 border-b border-border">
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10">
                <Truck className="h-6 w-6 text-primary" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-foreground">
                  Resumen de Carga
                </h2>
                <p className="text-sm text-muted-foreground">
                  Verifica antes de salir
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="flex h-10 w-10 items-center justify-center rounded-full hover:bg-muted transition-colors"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* Stats Cards */}
          <div className="p-6 border-b border-border">
            <div className="grid grid-cols-3 gap-4">
              {/* Total Orders */}
              <motion.div
                className="rounded-2xl p-4 text-center"
                style={{
                  background: "linear-gradient(135deg, hsl(var(--primary) / 0.1), hsl(var(--primary) / 0.05))",
                  boxShadow: "inset 2px 2px 6px hsl(var(--background)), inset -2px -2px 6px hsl(var(--primary) / 0.1)",
                }}
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ delay: 0.1 }}
              >
                <Package className="h-8 w-8 mx-auto mb-2 text-primary" />
                <p className="text-3xl font-bold text-foreground">
                  {stats.totalOrders}
                </p>
                <p className="text-xs text-muted-foreground font-medium">
                  Pedidos
                </p>
              </motion.div>

              {/* Total Money */}
              <motion.div
                className="rounded-2xl p-4 text-center"
                style={{
                  background: "linear-gradient(135deg, hsl(142 76% 36% / 0.1), hsl(142 76% 36% / 0.05))",
                  boxShadow: "inset 2px 2px 6px hsl(var(--background)), inset -2px -2px 6px hsl(142 76% 36% / 0.1)",
                }}
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ delay: 0.2 }}
              >
                <DollarSign className="h-8 w-8 mx-auto mb-2 text-emerald-500" />
                <p className="text-2xl font-bold text-foreground">
                  {formatCOP(stats.totalRecaudar)}
                </p>
                <p className="text-xs text-muted-foreground font-medium">
                  A Recaudar
                </p>
              </motion.div>

              {/* Zones */}
              <motion.div
                className="rounded-2xl p-4 text-center"
                style={{
                  background: "linear-gradient(135deg, hsl(280 60% 50% / 0.1), hsl(280 60% 50% / 0.05))",
                  boxShadow: "inset 2px 2px 6px hsl(var(--background)), inset -2px -2px 6px hsl(280 60% 50% / 0.1)",
                }}
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ delay: 0.3 }}
              >
                <MapPin className="h-8 w-8 mx-auto mb-2 text-purple-500" />
                <p className="text-3xl font-bold text-foreground">
                  {stats.zonesCount}
                </p>
                <p className="text-xs text-muted-foreground font-medium">
                  Zonas
                </p>
              </motion.div>
            </div>

            {/* Zone Tags */}
            {stats.zones.length > 0 && (
              <div className="flex flex-wrap gap-2 mt-4">
                {stats.zones.map((zone) => (
                  <span
                    key={zone}
                    className="px-3 py-1 rounded-full bg-muted text-xs font-medium text-muted-foreground"
                  >
                    {zone}
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* Orders List */}
          <div className="flex-1 overflow-y-auto p-4">
            {loadedPedidos.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <AlertTriangle className="h-12 w-12 text-muted-foreground mb-4" />
                <p className="text-muted-foreground">
                  No hay pedidos cargados
                </p>
                <p className="text-sm text-muted-foreground mt-1">
                  Escanea paquetes para agregarlos a tu ruta
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-3">
                  Lista de verificación
                </p>
                {loadedPedidos.map((pedido, index) => (
                  <motion.div
                    key={pedido.id}
                    className="flex items-center justify-between rounded-xl border border-border bg-background p-3 hover:bg-muted/50 transition-colors"
                    initial={{ x: -20, opacity: 0 }}
                    animate={{ x: 0, opacity: 1 }}
                    transition={{ delay: index * 0.03 }}
                  >
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10">
                        <Package className="h-4 w-4 text-primary" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-mono text-muted-foreground">
                          {pedido.numero_guia || `#${pedido.id}`}
                        </p>
                        <p className="text-sm font-medium text-foreground truncate">
                          {pedido.cliente_nombre || "Sin nombre"}
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className={cn(
                        "text-sm font-semibold",
                        pedido.valor_recaudar ? "text-emerald-500" : "text-muted-foreground"
                      )}>
                        {pedido.valor_recaudar
                          ? formatCOP(pedido.valor_recaudar)
                          : "Pagado"}
                      </p>
                    </div>
                  </motion.div>
                ))}
              </div>
            )}
          </div>

          {/* Confirm Button */}
          <div className="p-6 border-t border-border">
            <motion.button
              onClick={handleConfirmExit}
              disabled={confirming || confirmed || loadedPedidos.length === 0}
              className={cn(
                "w-full flex items-center justify-center gap-3 rounded-2xl py-4 text-base font-bold transition-all",
                confirmed
                  ? "bg-emerald-500 text-white"
                  : "bg-primary text-primary-foreground hover:opacity-90"
              )}
              whileHover={{ scale: confirmed ? 1 : 1.02 }}
              whileTap={{ scale: confirmed ? 1 : 0.98 }}
            >
              {confirming ? (
                <>
                  <Loader2 className="h-5 w-5 animate-spin" />
                  Confirmando...
                </>
              ) : confirmed ? (
                <>
                  <CheckCircle2 className="h-5 w-5" />
                  ¡Salida Confirmada!
                </>
              ) : (
                <>
                  <Truck className="h-5 w-5" />
                  Confirmar Salida a Ruta
                </>
              )}
            </motion.button>
            {loadedPedidos.length > 0 && !confirmed && (
              <p className="text-xs text-muted-foreground text-center mt-3">
                El admin será notificado de tu salida
              </p>
            )}
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};

export default LoadManifest;
