import { useState, useEffect, useRef, useCallback } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Camera, Loader2, CheckCircle2, XCircle, RefreshCw, Package, Volume2, VolumeX } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

// ─── Tipos ────────────────────────────────────────────────────────────────────

interface FlexReceptionScannerProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

interface ScanResult {
  success: boolean;
  message: string;
  isDuplicate?: boolean;
}

// ─── Constantes ───────────────────────────────────────────────────────────────

/** Tiempo mínimo (ms) entre dos detecciones del mismo código */
const DEBOUNCE_MS = 3000;

/** Obtiene la fecha de hoy en Colombia (evita bug de UTC) */
const getTodayColombia = (): string => new Date().toLocaleDateString("en-CA", { timeZone: "America/Bogota" });

// ─── Componente ───────────────────────────────────────────────────────────────

const FlexReceptionScanner = ({ isOpen, onClose, onSuccess }: FlexReceptionScannerProps) => {
  const [scanning, setScanning] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [lastResult, setLastResult] = useState<ScanResult | null>(null);
  const [isInitializing, setIsInitializing] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [scannedCount, setScannedCount] = useState(0);
  const [showForm, setShowForm] = useState(false);
  const [manualBarcode, setManualBarcode] = useState("");

  // Campos del formulario
  const [currentBarcode, setCurrentBarcode] = useState("");
  const [barrio, setBarrio] = useState("");
  const [direccion, setDireccion] = useState("");
  const [clienteNombre, setClienteNombre] = useState("");
  const [clientPhone, setClientPhone] = useState("");
  const [valorRecaudar, setValorRecaudar] = useState("");

  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const animationRef = useRef<number | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);

  /*
    FIX CRÍTICO — stale closure en el scan loop:
    `processing` como estado de React NO es visible dentro del loop de
    `requestAnimationFrame` porque la closure captura el valor del render
    en que se creó. Esto causaba que el scanner intentara procesar el mismo
    código múltiples veces antes de que React actualizara el estado.
    Solución: un ref que se actualiza síncronamente en paralelo al estado.
  */
  const processingRef = useRef(false);

  /*
    FIX: cachear el módulo jsQR para no hacer `await import()` en cada
    llamada a `startScanner` cuando BarcodeDetector no está disponible.
  */
  const jsQRRef = useRef<
    ((data: Uint8ClampedArray, width: number, height: number, opts?: object) => { data: string } | null) | null
  >(null);

  // ── Audio ──────────────────────────────────────────────────────────────────

  const playSound = useCallback(
    (type: "success" | "error" | "duplicate") => {
      if (!soundEnabled) return;
      try {
        if (!audioCtxRef.current) {
          audioCtxRef.current = new AudioContext();
        }
        const ctx = audioCtxRef.current;
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);
        gain.gain.value = 0.3;

        if (type === "success") {
          osc.frequency.value = 880;
          osc.type = "sine";
          gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.15);
          osc.start(ctx.currentTime);
          osc.stop(ctx.currentTime + 0.15);
        } else if (type === "duplicate") {
          osc.frequency.value = 200;
          osc.type = "square";
          gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.5);
          osc.start(ctx.currentTime);
          osc.stop(ctx.currentTime + 0.5);
        } else {
          osc.frequency.value = 300;
          osc.type = "sawtooth";
          gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.3);
          osc.start(ctx.currentTime);
          osc.stop(ctx.currentTime + 0.3);
        }
      } catch (e) {
        console.warn("Audio playback failed:", e);
      }
    },
    [soundEnabled],
  );

  // ── Scanner lifecycle ──────────────────────────────────────────────────────

  const stopScanner = useCallback(() => {
    if (animationRef.current) {
      cancelAnimationFrame(animationRef.current);
      animationRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setScanning(false);
    setIsInitializing(false);
  }, []);

  // ── Verificación de duplicados ─────────────────────────────────────────────

  /*
    FIX: checkDuplicate en useCallback para evitar recreación en cada render.
    FIX: timezone Colombia en vez de UTC para la comparación de fechas.
  */
  const checkDuplicate = useCallback(async (barcode: string): Promise<boolean> => {
    const today = getTodayColombia();
    const { data, error } = await supabase
      .from("pedidos")
      .select("id")
      .eq("id_externo", barcode)
      .gte("fecha_creacion", `${today}T00:00:00`)
      .lte("fecha_creacion", `${today}T23:59:59`)
      .limit(1);

    if (error) {
      console.error("Duplicate check error:", error);
      return false; // En caso de error, no bloquear el registro
    }
    return (data?.length ?? 0) > 0;
  }, []);

  // ── Procesamiento de código ────────────────────────────────────────────────

  const handleBarcode = useCallback(
    async (barcodeData: string) => {
      // FIX: usar ref para la guarda — el estado `processing` tiene stale closure
      if (processingRef.current) return;
      processingRef.current = true;
      setProcessing(true);

      try {
        const barcode = barcodeData.trim();
        if (!barcode) return;

        const isDuplicate = await checkDuplicate(barcode);

        if (isDuplicate) {
          playSound("duplicate");
          setLastResult({
            success: false,
            message: `⚠️ DUPLICADO: "${barcode}" ya fue registrado hoy`,
            isDuplicate: true,
          });
          return;
        }

        // Abrir formulario de registro
        playSound("success");
        setCurrentBarcode(barcode);
        setShowForm(true);
      } catch (error) {
        console.error("Error processing barcode:", error);
        playSound("error");
        setLastResult({ success: false, message: "Error al procesar el código" });
      } finally {
        processingRef.current = false;
        setProcessing(false);
      }
    },
    [checkDuplicate, playSound],
  );

  // ── Envío del formulario ───────────────────────────────────────────────────

  /*
    FIX: submitFlexOrder en useCallback.
    FIX: añadido playSound("success") al completar registro (faltaba en el original).
    FIX: reset completo del formulario y lastResult al volver al scanner.
  */
  const submitFlexOrder = useCallback(async () => {
    if (!currentBarcode) return;
    processingRef.current = true;
    setProcessing(true);

    try {
      const { error } = await supabase.from("pedidos").insert({
        id_externo: currentBarcode,
        canal: "FLEX",
        estado: "Recibido en Bodega",
        barrio: barrio || null,
        direccion_entrega: direccion || null,
        cliente_nombre: clienteNombre || null,
        client_phone: clientPhone || null,
        valor_recaudar: valorRecaudar ? parseFloat(valorRecaudar) : null,
        hora_cierre_flex: "21:00:00",
        fecha_creacion: new Date().toISOString(),
        fecha_actualizacion: new Date().toISOString(),
        numero_guia: `FLEX-${currentBarcode.slice(-8)}`,
      });

      if (error) throw error;

      playSound("success");
      setScannedCount((prev) => prev + 1);
      setLastResult({
        success: true,
        message: `✅ FLEX-${currentBarcode.slice(-8)} registrado → ${barrio || "Sin barrio"}`,
      });
      toast.success(`Pedido Flex registrado: FLEX-${currentBarcode.slice(-8)}`);
      onSuccess();

      // Reset form y volver al scanner
      setShowForm(false);
      setCurrentBarcode("");
      setBarrio("");
      setDireccion("");
      setClienteNombre("");
      setClientPhone("");
      setValorRecaudar("");
    } catch (error) {
      console.error("Error creating flex order:", error);
      playSound("error");
      toast.error("Error al crear el pedido Flex");
      setLastResult({ success: false, message: "Error al crear el pedido Flex" });
    } finally {
      processingRef.current = false;
      setProcessing(false);
    }
  }, [currentBarcode, barrio, direccion, clienteNombre, clientPhone, valorRecaudar, playSound, onSuccess]);

  // ── Inicio del scanner ─────────────────────────────────────────────────────

  const startScanner = useCallback(async () => {
    setCameraError(null);
    setLastResult(null);
    setIsInitializing(true);
    processingRef.current = false;

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: "environment",
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
      });

      streamRef.current = stream;
      if (!videoRef.current) return;

      videoRef.current.srcObject = stream;
      await videoRef.current.play();

      const hasBarcodeDetector = "BarcodeDetector" in window;
      let detector: { detect: (canvas: HTMLCanvasElement) => Promise<{ rawValue: string }[]> } | null = null;

      if (hasBarcodeDetector) {
        detector = new (
          window as typeof window & {
            BarcodeDetector: new (opts: object) => typeof detector;
          }
        ).BarcodeDetector({
          formats: ["code_128", "code_39", "ean_13", "ean_8", "qr_code", "upc_a", "upc_e"],
        });
      } else {
        // FIX: cargar jsQR una sola vez y cachear en ref
        if (!jsQRRef.current) {
          jsQRRef.current = (await import("jsqr")).default;
        }
      }

      // Reusar canvas si ya existe para no crear uno nuevo en cada retry
      if (!canvasRef.current) {
        canvasRef.current = document.createElement("canvas");
      }
      const canvas = canvasRef.current;
      const ctx = canvas.getContext("2d", { willReadFrequently: true });
      if (!ctx) return;

      let lastDetected = "";
      let lastDetectedTime = 0;

      const scanFrame = async () => {
        // Verificar que el stream siga activo antes de cada frame
        if (!videoRef.current || !streamRef.current || !ctx) return;

        const video = videoRef.current;
        if (video.readyState === video.HAVE_ENOUGH_DATA) {
          canvas.width = video.videoWidth;
          canvas.height = video.videoHeight;
          ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

          try {
            let code: string | null = null;

            if (detector) {
              const barcodes = await detector.detect(canvas);
              code = barcodes[0]?.rawValue ?? null;
            } else if (jsQRRef.current) {
              const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
              const result = jsQRRef.current(imageData.data, imageData.width, imageData.height, {
                inversionAttempts: "attemptBoth",
              });
              code = result?.data ?? null;
            }

            if (code) {
              const now = Date.now();
              const isDebounced = code === lastDetected && now - lastDetectedTime < DEBOUNCE_MS;
              if (!isDebounced) {
                lastDetected = code;
                lastDetectedTime = now;
                handleBarcode(code); // No await — continúa el loop mientras procesa
              }
            }
          } catch {
            // Error de detección puntual — continuar el loop sin interrumpir
          }
        }

        animationRef.current = requestAnimationFrame(scanFrame);
      };

      setScanning(true);
      setIsInitializing(false);
      // FIX: usar requestAnimationFrame directamente en vez de llamar
      // a la función async directamente para no bloquear el primer frame
      animationRef.current = requestAnimationFrame(scanFrame);
    } catch (err) {
      setScanning(false);
      setIsInitializing(false);

      if (err instanceof Error) {
        if (err.name === "NotAllowedError") {
          setCameraError("Permiso de cámara denegado. Actívalo en la configuración del navegador.");
        } else if (err.name === "NotFoundError") {
          setCameraError("No se encontró cámara en este dispositivo.");
        } else {
          setCameraError("No se pudo acceder a la cámara.");
        }
      }
    }
  }, [handleBarcode]);

  // ── Efectos ────────────────────────────────────────────────────────────────

  /*
    FIX: separar en dos efectos con responsabilidades claras:
    1. Controlar el ciclo de vida del modal (open/close)
    2. Reiniciar el scanner cuando el formulario se cierra
    Antes, un solo efecto con [isOpen, showForm] mezclaba ambas lógicas
    y podía causar reinicios inesperados.
  */
  useEffect(() => {
    if (isOpen) {
      const timer = setTimeout(() => startScanner(), 100);
      return () => clearTimeout(timer);
    } else {
      stopScanner();
      setShowForm(false);
      setScannedCount(0);
      setLastResult(null);
    }
  }, [isOpen, startScanner, stopScanner]);

  useEffect(() => {
    // Reiniciar scanner cuando el usuario cancela o envía el formulario
    if (isOpen && !showForm) {
      const timer = setTimeout(() => startScanner(), 100);
      return () => clearTimeout(timer);
    } else {
      // Pausar scanner mientras el formulario está visible (ahorra batería/CPU)
      stopScanner();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showForm]);

  useEffect(() => {
    // FIX: cerrar AudioContext al desmontar para liberar recursos del sistema de audio
    return () => {
      stopScanner();
      if (audioCtxRef.current) {
        audioCtxRef.current.close();
        audioCtxRef.current = null;
      }
    };
  }, [stopScanner]);

  // ── Handlers ───────────────────────────────────────────────────────────────

  const handleClose = useCallback(() => {
    stopScanner();
    onClose();
  }, [stopScanner, onClose]);

  const handleManualEntry = useCallback(() => {
    const trimmed = manualBarcode.trim();
    if (trimmed) {
      handleBarcode(trimmed);
      setManualBarcode("");
    }
  }, [manualBarcode, handleBarcode]);

  const handleCancelForm = useCallback(() => {
    setShowForm(false);
    setCurrentBarcode("");
  }, []);

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-md max-h-[95vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Package className="h-5 w-5 text-amber-500" />
            Recepción Flex
            {scannedCount > 0 && (
              <span className="ml-auto text-sm font-normal bg-primary/10 text-primary px-2 py-0.5 rounded-full">
                {scannedCount} escaneados
              </span>
            )}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-3">
          {!showForm ? (
            <>
              <p className="text-xs text-muted-foreground text-center">
                Escanea el código de barras del paquete Mercado Libre Flex
              </p>

              {/* Visor de cámara */}
              <div className="relative rounded-lg overflow-hidden bg-black aspect-[4/3]">
                <video ref={videoRef} className="w-full h-full object-cover" playsInline muted autoPlay />

                {isInitializing && (
                  <div className="absolute inset-0 flex flex-col items-center justify-center bg-muted/90">
                    <Loader2 className="h-10 w-10 animate-spin text-primary mb-2" />
                    <p className="text-sm text-muted-foreground">Iniciando cámara...</p>
                  </div>
                )}

                {cameraError && (
                  <div className="absolute inset-0 flex flex-col items-center justify-center bg-muted/90 p-4 text-center">
                    <Camera className="h-12 w-12 text-destructive mb-3" />
                    <p className="text-sm text-destructive font-medium mb-3">{cameraError}</p>
                    <Button size="sm" variant="outline" onClick={startScanner}>
                      <RefreshCw className="h-4 w-4 mr-2" />
                      Reintentar
                    </Button>
                  </div>
                )}

                {processing && (
                  <div className="absolute inset-0 flex flex-col items-center justify-center bg-background/80 backdrop-blur-sm">
                    <Loader2 className="h-10 w-10 animate-spin text-primary mb-2" />
                    <p className="text-sm font-medium">Verificando...</p>
                  </div>
                )}

                {scanning && !processing && !cameraError && (
                  <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
                    <div className="w-64 h-24 border-2 border-amber-400 rounded-lg relative">
                      <div className="absolute top-0 left-0 w-6 h-6 border-t-4 border-l-4 border-amber-400 rounded-tl" />
                      <div className="absolute top-0 right-0 w-6 h-6 border-t-4 border-r-4 border-amber-400 rounded-tr" />
                      <div className="absolute bottom-0 left-0 w-6 h-6 border-b-4 border-l-4 border-amber-400 rounded-bl" />
                      <div className="absolute bottom-0 right-0 w-6 h-6 border-b-4 border-r-4 border-amber-400 rounded-br" />
                      <div
                        className="absolute inset-x-0 h-0.5 bg-amber-400"
                        style={{ animation: "scanLine 2s ease-in-out infinite", top: "50%" }}
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* Entrada manual */}
              <div className="flex gap-2">
                <Input
                  placeholder="Ingreso manual del código..."
                  value={manualBarcode}
                  onChange={(e) => setManualBarcode(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleManualEntry()}
                  className="text-sm"
                />
                <Button size="sm" onClick={handleManualEntry} disabled={!manualBarcode.trim()}>
                  OK
                </Button>
              </div>

              {/* Toggle sonido */}
              <Button variant="ghost" size="sm" className="w-full text-xs" onClick={() => setSoundEnabled((s) => !s)}>
                {soundEnabled ? <Volume2 className="h-3 w-3 mr-1" /> : <VolumeX className="h-3 w-3 mr-1" />}
                Sonido {soundEnabled ? "activado" : "desactivado"}
              </Button>
            </>
          ) : (
            /* Formulario de registro */
            <div className="space-y-3">
              <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg p-3 text-center">
                <p className="text-xs text-muted-foreground">Código escaneado</p>
                <p className="font-mono font-bold text-lg break-all">{currentBarcode}</p>
              </div>

              <div className="grid gap-3">
                <div>
                  <Label className="text-xs">Nombre del cliente</Label>
                  <Input
                    value={clienteNombre}
                    onChange={(e) => setClienteNombre(e.target.value)}
                    placeholder="Nombre completo"
                    className="text-sm"
                  />
                </div>
                <div>
                  <Label className="text-xs">
                    Dirección de entrega
                    <span className="text-destructive ml-0.5">*</span>
                  </Label>
                  <Input
                    value={direccion}
                    onChange={(e) => setDireccion(e.target.value)}
                    placeholder="Calle, número, apto..."
                    className="text-sm"
                  />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <Label className="text-xs">Barrio</Label>
                    <Input
                      value={barrio}
                      onChange={(e) => setBarrio(e.target.value)}
                      placeholder="Barrio"
                      className="text-sm"
                    />
                  </div>
                  <div>
                    <Label className="text-xs">Teléfono</Label>
                    <Input
                      value={clientPhone}
                      onChange={(e) => setClientPhone(e.target.value)}
                      placeholder="300..."
                      className="text-sm"
                      inputMode="tel"
                    />
                  </div>
                </div>
                <div>
                  <Label className="text-xs">Valor a recaudar (COP)</Label>
                  <Input
                    value={valorRecaudar}
                    onChange={(e) => setValorRecaudar(e.target.value)}
                    placeholder="0"
                    type="number"
                    min="0"
                    className="text-sm"
                    inputMode="numeric"
                  />
                </div>
              </div>

              <div className="flex gap-2">
                <Button variant="outline" className="flex-1" onClick={handleCancelForm} disabled={processing}>
                  Cancelar
                </Button>
                <Button
                  className="flex-1 bg-amber-500 hover:bg-amber-600 text-white"
                  onClick={submitFlexOrder}
                  disabled={processing}
                >
                  {processing ? (
                    <Loader2 className="h-4 w-4 animate-spin mr-1" />
                  ) : (
                    <CheckCircle2 className="h-4 w-4 mr-1" />
                  )}
                  Registrar Flex
                </Button>
              </div>
            </div>
          )}

          {/* Último resultado */}
          {lastResult && (
            <div
              className={`p-3 rounded-lg flex items-start gap-2 ${
                lastResult.success
                  ? "bg-green-500/10 border border-green-500/30"
                  : lastResult.isDuplicate
                    ? "bg-amber-500/10 border border-amber-500/30"
                    : "bg-destructive/10 border border-destructive/30"
              }`}
            >
              {lastResult.success ? (
                <CheckCircle2 className="h-5 w-5 text-green-600 shrink-0 mt-0.5" />
              ) : (
                <XCircle className="h-5 w-5 text-destructive shrink-0 mt-0.5" />
              )}
              <p
                className={`text-sm font-medium ${
                  lastResult.success
                    ? "text-green-700 dark:text-green-400"
                    : lastResult.isDuplicate
                      ? "text-amber-700 dark:text-amber-400"
                      : "text-destructive"
                }`}
              >
                {lastResult.message}
              </p>
            </div>
          )}

          <Button variant="outline" className="w-full" onClick={handleClose}>
            Cerrar Escáner
          </Button>
        </div>
      </DialogContent>

      <style>{`
        @keyframes scanLine {
          0%, 100% { top: 10%; }
          50%       { top: 90%; }
        }
      `}</style>
    </Dialog>
  );
};

export default FlexReceptionScanner;
