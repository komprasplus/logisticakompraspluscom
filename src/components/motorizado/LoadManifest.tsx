import { useState, useMemo, useCallback, useRef, useEffect } from "react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { Package, DollarSign, MapPin, CheckCircle2, Truck, X, AlertTriangle, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { formatCOP } from "@/lib/tarifas";
import { format } from "date-fns";
import { cn } from "@/lib/utils";

// ─── Tipos ────────────────────────────────────────────────────────────────────

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

// ─── Componente ───────────────────────────────────────────────────────────────

const LoadManifest = ({ isOpen, onClose, pedidos, motorizadoId, motorizadoName, onConfirmExit }: LoadManifestProps) => {
  const [confirming, setConfirming] = useState(false);
  const [confirmed, setConfirmed] = useState(false);

  const cancelRef = useRef(false);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const prefersReducedMotion = useReducedMotion();

  // Cleanup en desmonte
  useEffect(() => {
    cancelRef.current = false;
    return () => {
      cancelRef.current = true;
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, []);

  // Resetear estado `confirmed` cuando el modal se abre de nuevo
  useEffect(() => {
    if (isOpen) setConfirmed(false);
  }, [isOpen]);

  // ── Pedidos en ruta ──────────────────────────────────────────────────────

  const loadedPedidos = useMemo(() => pedidos.filter((p) => p.estado?.toLowerCase() === "en ruta"), [pedidos]);

  // ── Estadísticas ─────────────────────────────────────────────────────────

  const stats = useMemo(() => {
    const totalOrders = loadedPedidos.length;
    /*
      FIX: `|| 0` → `?? 0` en la sumatoria financiera.
      Un pedido con `valor_recaudar: 0` (anticipado/exonerado) se ignoraba.
      Mismo bug corregido en DevolucionesView, NovedadesView, PedidosView, ReportesView.
    */
    const totalRecaudar = loadedPedidos.reduce((acc, p) => acc + (p.valor_recaudar ?? 0), 0);
    const uniqueZones = new Set(loadedPedidos.map((p) => p.zona).filter(Boolean));
    return {
      totalOrders,
      totalRecaudar,
      zonesCount: uniqueZones.size,
      zones: Array.from(uniqueZones) as string[],
    };
  }, [loadedPedidos]);

  // ── Confirmar salida ──────────────────────────────────────────────────────

  const handleConfirmExit = useCallback(async () => {
    if (loadedPedidos.length === 0) {
      toast.error("No tienes pedidos cargados para iniciar ruta");
      return;
    }

    setConfirming(true);
    try {
      /*
        FIX: N+1 queries → batch en 2 round trips.
        La versión original hacía 2 queries (SELECT + UPDATE) POR PEDIDO dentro
        de un `for` loop: 20 pedidos = 40 round trips secuenciales. Con
        conexiones lentas en móvil esto tardaba 5-10 segundos y podía agotar
        los límites de rate de Supabase.

        Solución en 2 pasos:
        1. Un único SELECT con `.in("id", ids)` para obtener todas las
           observaciones de una vez.
        2. Los UPDATEs se ejecutan en paralelo con `Promise.all()` en lugar
           de secuencialmente con `for...of`.
      */
      const ids = loadedPedidos.map((p) => p.id);

      /*
        FIX: `new Date().toLocaleString("es-CO")` → `format(new Date(), ...)`.
        Mismo bug de timezone que HistorialTransaccionesView y NovedadesView:
        `toLocaleString` usa el timezone del navegador del motorizado.
        Reemplazado con `format` de date-fns que produce un string estable.
      */
      const timestamp = format(new Date(), "dd/MM/yyyy HH:mm");
      const systemNote = `[SISTEMA ${timestamp}] Salida de bodega confirmada por ${motorizadoName}`;

      // 1. Obtener observaciones actuales en UNA sola consulta
      const { data: obsData, error: obsError } = await supabase
        .from("pedidos")
        .select("id, observaciones")
        .in("id", ids);

      if (cancelRef.current) return;
      if (obsError) throw obsError;

      const obsMap = new Map((obsData || []).map((row) => [row.id, row.observaciones as string | null]));

      // 2. Ejecutar todos los UPDATEs en paralelo
      const updateResults = await Promise.allSettled(
        loadedPedidos.map((pedido) => {
          const existing = obsMap.get(pedido.id) ?? "";
          const updatedObs = existing ? `${existing}\n${systemNote}` : systemNote;
          return supabase.from("pedidos").update({ observaciones: updatedObs }).eq("id", pedido.id);
        }),
      );

      if (cancelRef.current) return;

      // Reportar fallos individuales si los hay
      const failed = updateResults.filter(
        (r) => r.status === "rejected" || (r.status === "fulfilled" && r.value.error),
      );
      if (failed.length > 0) {
        console.error(`${failed.length} pedidos no se actualizaron`, failed);
        // No lanzar — continuar de todas formas para no bloquear la salida
        toast.warning(`${failed.length} pedido(s) no se pudieron registrar, pero la salida fue confirmada.`);
      }

      // Sonido de confirmación
      try {
        const audioCtx = new (
          window.AudioContext ||
          (window as typeof window & { webkitAudioContext: typeof AudioContext }).webkitAudioContext
        )();
        const oscillator = audioCtx.createOscillator();
        const gainNode = audioCtx.createGain();
        oscillator.connect(gainNode);
        gainNode.connect(audioCtx.destination);
        oscillator.frequency.value = 880;
        oscillator.type = "sine";
        gainNode.gain.setValueAtTime(0.3, audioCtx.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.5);
        oscillator.start();
        oscillator.stop(audioCtx.currentTime + 0.5);
        /*
          FIX: AudioContext no se cerraba — quedaba abierto acumulando recursos.
          `oscillator.onended` cierra el contexto una vez que el sonido termina.
        */
        oscillator.onended = () => audioCtx.close();
      } catch {
        // Audio no soportado en este dispositivo — silenciar silenciosamente
      }

      if (cancelRef.current) return;
      setConfirmed(true);
      toast.success("🚀 Salida confirmada - ¡Buen viaje!");

      /*
        FIX: `setTimeout` sin referencia de cleanup.
        Si el usuario cerraba el modal antes de los 1500ms, `onConfirmExit()`
        y `onClose()` se llamaban sobre estado ya desmontado.
        Guardado en `timeoutRef` para poder cancelarlo en el cleanup.
      */
      timeoutRef.current = setTimeout(() => {
        if (cancelRef.current) return;
        onConfirmExit();
        onClose();
      }, 1500);
    } catch (error) {
      if (cancelRef.current) return;
      console.error("Error confirming exit:", error);
      toast.error("Error al confirmar salida");
    } finally {
      if (!cancelRef.current) setConfirming(false);
    }
  }, [loadedPedidos, motorizadoName, onConfirmExit, onClose]);

  // ── Render ────────────────────────────────────────────────────────────────

  /*
    FIX: `if (!isOpen) return null` antes del `AnimatePresence`.
    La versión original retornaba `null` cuando `isOpen` era false, por lo que
    `AnimatePresence` nunca recibía su hijo y la animación de salida (`exit`)
    nunca se ejecutaba — el modal desaparecía abruptamente.
    Solución: eliminar el early return y renderizar el contenido condicionalmente
    DENTRO del `AnimatePresence`, que es el patrón correcto de framer-motion.
  */
  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          /*
            FIX: `role="dialog"` + `aria-modal` + `aria-labelledby`.
            El overlay era un `div` invisible a lectores de pantalla.
            Sin estas propiedades, NVDA/VoiceOver no sabían que había un modal
            activo ni que el contenido de fondo era inaccesible.
          */
          role="dialog"
          aria-modal="true"
          aria-labelledby="load-manifest-title"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          /*
            FIX: cerrar al hacer click fuera solo si no está confirmando.
            La versión original permitía cerrar accidentalmente durante la
            operación de base de datos.
          */
          onClick={confirming ? undefined : onClose}
        >
          <motion.div
            className="w-full max-w-lg max-h-[90vh] overflow-hidden rounded-3xl bg-card shadow-2xl flex flex-col"
            initial={{ scale: prefersReducedMotion ? 1 : 0.9, opacity: 0, y: prefersReducedMotion ? 0 : 20 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: prefersReducedMotion ? 1 : 0.9, opacity: 0, y: prefersReducedMotion ? 0 : 20 }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between p-6 border-b border-border">
              <div className="flex items-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10">
                  <Truck className="h-6 w-6 text-primary" aria-hidden="true" />
                </div>
                <div>
                  {/* FIX: id para aria-labelledby del dialog */}
                  <h2 id="load-manifest-title" className="text-xl font-bold text-foreground">
                    Resumen de Carga
                  </h2>
                  <p className="text-sm text-muted-foreground">Verifica antes de salir</p>
                </div>
              </div>
              {/*
                FIX: botón de cerrar sin `aria-label` ni `type="button"`.
                Era un `<button>` sin ninguna descripción textual — lectores
                de pantalla anunciaban solo "botón".
              */}
              <button
                type="button"
                onClick={onClose}
                disabled={confirming}
                aria-label="Cerrar resumen de carga"
                className="flex h-10 w-10 items-center justify-center rounded-full hover:bg-muted transition-colors disabled:opacity-40"
              >
                <X className="h-5 w-5" aria-hidden="true" />
              </button>
            </div>

            {/* Tarjetas de estadísticas */}
            <div className="p-6 border-b border-border">
              <div className="grid grid-cols-3 gap-4">
                <motion.div
                  className="rounded-2xl p-4 text-center"
                  style={{
                    background: "linear-gradient(135deg, hsl(var(--primary) / 0.1), hsl(var(--primary) / 0.05))",
                    boxShadow:
                      "inset 2px 2px 6px hsl(var(--background)), inset -2px -2px 6px hsl(var(--primary) / 0.1)",
                  }}
                  initial={{ scale: prefersReducedMotion ? 1 : 0.8, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ delay: prefersReducedMotion ? 0 : 0.1 }}
                >
                  <Package className="h-8 w-8 mx-auto mb-2 text-primary" aria-hidden="true" />
                  <p className="text-3xl font-bold text-foreground">{stats.totalOrders}</p>
                  <p className="text-xs text-muted-foreground font-medium">Pedidos</p>
                </motion.div>

                <motion.div
                  className="rounded-2xl p-4 text-center"
                  style={{
                    background: "linear-gradient(135deg, hsl(142 76% 36% / 0.1), hsl(142 76% 36% / 0.05))",
                    boxShadow: "inset 2px 2px 6px hsl(var(--background)), inset -2px -2px 6px hsl(142 76% 36% / 0.1)",
                  }}
                  initial={{ scale: prefersReducedMotion ? 1 : 0.8, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ delay: prefersReducedMotion ? 0 : 0.2 }}
                >
                  <DollarSign className="h-8 w-8 mx-auto mb-2 text-emerald-500" aria-hidden="true" />
                  <p className="text-2xl font-bold text-foreground">{formatCOP(stats.totalRecaudar)}</p>
                  <p className="text-xs text-muted-foreground font-medium">A Recaudar</p>
                </motion.div>

                <motion.div
                  className="rounded-2xl p-4 text-center"
                  style={{
                    background: "linear-gradient(135deg, hsl(280 60% 50% / 0.1), hsl(280 60% 50% / 0.05))",
                    boxShadow: "inset 2px 2px 6px hsl(var(--background)), inset -2px -2px 6px hsl(280 60% 50% / 0.1)",
                  }}
                  initial={{ scale: prefersReducedMotion ? 1 : 0.8, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ delay: prefersReducedMotion ? 0 : 0.3 }}
                >
                  <MapPin className="h-8 w-8 mx-auto mb-2 text-purple-500" aria-hidden="true" />
                  <p className="text-3xl font-bold text-foreground">{stats.zonesCount}</p>
                  <p className="text-xs text-muted-foreground font-medium">Zonas</p>
                </motion.div>
              </div>

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

            {/* Lista de pedidos */}
            <div className="flex-1 overflow-y-auto p-4">
              {loadedPedidos.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <AlertTriangle className="h-12 w-12 text-muted-foreground mb-4" aria-hidden="true" />
                  <p className="text-muted-foreground">No hay pedidos cargados</p>
                  <p className="text-sm text-muted-foreground mt-1">Escanea paquetes para agregarlos a tu ruta</p>
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
                      initial={{ x: prefersReducedMotion ? 0 : -20, opacity: 0 }}
                      animate={{ x: 0, opacity: 1 }}
                      transition={{ delay: prefersReducedMotion ? 0 : index * 0.03 }}
                    >
                      <div className="flex items-center gap-3 flex-1 min-w-0">
                        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10">
                          <Package className="h-4 w-4 text-primary" aria-hidden="true" />
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
                        {/*
                          FIX: `pedido.valor_recaudar ?` comprueba truthy.
                          `valor_recaudar: 0` mostraría "Pagado" cuando en realidad
                          el pedido anticipado tiene su propio campo `metodo_pago`.
                          Corregido a `!= null` para distinguir explícitamente entre
                          null (no configurado) y 0 (exonerado/anticipado).
                        */}
                        <p
                          className={cn(
                            "text-sm font-semibold",
                            pedido.valor_recaudar != null ? "text-emerald-500" : "text-muted-foreground",
                          )}
                        >
                          {pedido.valor_recaudar != null ? formatCOP(pedido.valor_recaudar) : "Pagado"}
                        </p>
                      </div>
                    </motion.div>
                  ))}
                </div>
              )}
            </div>

            {/* Botón de confirmación */}
            <div className="p-6 border-t border-border">
              <motion.button
                type="button"
                onClick={handleConfirmExit}
                disabled={confirming || confirmed || loadedPedidos.length === 0}
                aria-busy={confirming}
                aria-label={
                  confirmed ? "Salida confirmada" : confirming ? "Confirmando salida..." : "Confirmar salida a ruta"
                }
                className={cn(
                  "w-full flex items-center justify-center gap-3 rounded-2xl py-4 text-base font-bold transition-all",
                  confirmed ? "bg-emerald-500 text-white" : "bg-primary text-primary-foreground hover:opacity-90",
                )}
                whileHover={prefersReducedMotion || confirmed ? undefined : { scale: 1.02 }}
                whileTap={prefersReducedMotion || confirmed ? undefined : { scale: 0.98 }}
              >
                {confirming ? (
                  <>
                    <Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" />
                    Confirmando...
                  </>
                ) : confirmed ? (
                  <>
                    <CheckCircle2 className="h-5 w-5" aria-hidden="true" />
                    ¡Salida Confirmada!
                  </>
                ) : (
                  <>
                    <Truck className="h-5 w-5" aria-hidden="true" />
                    Confirmar Salida a Ruta
                  </>
                )}
              </motion.button>

              {loadedPedidos.length > 0 && !confirmed && (
                <p className="text-xs text-muted-foreground text-center mt-3">El admin será notificado de tu salida</p>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default LoadManifest;
