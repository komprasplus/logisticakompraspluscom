import { useState, useEffect, useRef, useCallback } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Camera, Loader2, CheckCircle2, XCircle, ScanLine, RefreshCw, Package, Volume2, VolumeX } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

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

const FlexReceptionScanner = ({ isOpen, onClose, onSuccess }: FlexReceptionScannerProps) => {
  const [scanning, setScanning] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [lastResult, setLastResult] = useState<ScanResult | null>(null);
  const [isInitializing, setIsInitializing] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [scannedCount, setScannedCount] = useState(0);

  // Quick-entry form state
  const [showForm, setShowForm] = useState(false);
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

  // Sound effects using Web Audio API
  const playSound = useCallback((type: "success" | "error" | "duplicate") => {
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
  }, [soundEnabled]);

  const stopScanner = useCallback(() => {
    if (animationRef.current) {
      cancelAnimationFrame(animationRef.current);
      animationRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setScanning(false);
    setIsInitializing(false);
  }, []);

  const checkDuplicate = async (barcode: string): Promise<boolean> => {
    const today = new Date().toISOString().split("T")[0];
    const { data, error } = await supabase
      .from("pedidos")
      .select("id, numero_guia")
      .eq("id_externo", barcode)
      .gte("fecha_creacion", `${today}T00:00:00`)
      .lte("fecha_creacion", `${today}T23:59:59`)
      .limit(1);

    if (error) {
      console.error("Duplicate check error:", error);
      return false;
    }
    return (data?.length ?? 0) > 0;
  };

  const handleBarcode = useCallback(async (barcodeData: string) => {
    if (processing) return;
    setProcessing(true);

    try {
      const barcode = barcodeData.trim();
      if (!barcode) {
        setProcessing(false);
        return;
      }

      // Check for duplicates today
      const isDuplicate = await checkDuplicate(barcode);
      if (isDuplicate) {
        playSound("duplicate");
        setLastResult({
          success: false,
          message: `⚠️ DUPLICADO: El código "${barcode}" ya fue registrado hoy`,
          isDuplicate: true,
        });
        setProcessing(false);
        return;
      }

      // Show quick-entry form
      playSound("success");
      setCurrentBarcode(barcode);
      setShowForm(true);
      setProcessing(false);
    } catch (error) {
      console.error("Error processing barcode:", error);
      playSound("error");
      setLastResult({ success: false, message: "Error al procesar el código" });
      setProcessing(false);
    }
  }, [processing, playSound]);

  const submitFlexOrder = async () => {
    if (!currentBarcode) return;
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

      setScannedCount(prev => prev + 1);
      setLastResult({
        success: true,
        message: `✅ FLEX-${currentBarcode.slice(-8)} registrado → ${barrio || "Sin barrio"}`,
      });

      toast.success(`Pedido Flex registrado: ${currentBarcode}`);
      onSuccess();

      // Reset form
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
      setLastResult({ success: false, message: "Error al crear el pedido Flex" });
    } finally {
      setProcessing(false);
    }
  };

  const startScanner = useCallback(async () => {
    setCameraError(null);
    setLastResult(null);
    setIsInitializing(true);

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: "environment",
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
      });

      streamRef.current = stream;

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();

        // Use BarcodeDetector API if available, otherwise jsQR fallback
        const hasBarcodeDetector = "BarcodeDetector" in window;
        let detector: any = null;

        if (hasBarcodeDetector) {
          detector = new (window as any).BarcodeDetector({
            formats: ["code_128", "code_39", "ean_13", "ean_8", "qr_code", "upc_a", "upc_e"],
          });
        }

        const jsQR = hasBarcodeDetector ? null : (await import("jsqr")).default;

        const canvas = document.createElement("canvas");
        const ctx = canvas.getContext("2d", { willReadFrequently: true });
        canvasRef.current = canvas;

        let lastDetected = "";
        let lastDetectedTime = 0;

        const scanFrame = async () => {
          if (!videoRef.current || !ctx || !streamRef.current) return;

          const video = videoRef.current;
          if (video.readyState === video.HAVE_ENOUGH_DATA) {
            canvas.width = video.videoWidth;
            canvas.height = video.videoHeight;
            ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

            try {
              if (detector) {
                const barcodes = await detector.detect(canvas);
                if (barcodes.length > 0) {
                  const code = barcodes[0].rawValue;
                  const now = Date.now();
                  if (code && (code !== lastDetected || now - lastDetectedTime > 3000)) {
                    lastDetected = code;
                    lastDetectedTime = now;
                    handleBarcode(code);
                  }
                }
              } else if (jsQR) {
                const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
                const code = jsQR(imageData.data, imageData.width, imageData.height, {
                  inversionAttempts: "attemptBoth",
                });
                if (code?.data) {
                  const now = Date.now();
                  if (code.data !== lastDetected || now - lastDetectedTime > 3000) {
                    lastDetected = code.data;
                    lastDetectedTime = now;
                    handleBarcode(code.data);
                  }
                }
              }
            } catch (e) {
              // Detection error, continue scanning
            }
          }

          animationRef.current = requestAnimationFrame(scanFrame);
        };

        setScanning(true);
        setIsInitializing(false);
        scanFrame();
      }
    } catch (err: any) {
      console.error("Error starting scanner:", err);
      setScanning(false);
      setIsInitializing(false);

      if (err.name === "NotAllowedError") {
        setCameraError("Permiso de cámara denegado.");
      } else if (err.name === "NotFoundError") {
        setCameraError("No se encontró cámara.");
      } else {
        setCameraError("No se pudo acceder a la cámara.");
      }
    }
  }, [handleBarcode]);

  useEffect(() => {
    if (isOpen && !showForm) {
      const timer = setTimeout(() => startScanner(), 100);
      return () => clearTimeout(timer);
    } else if (!isOpen) {
      stopScanner();
      setShowForm(false);
      setScannedCount(0);
    }
  }, [isOpen, showForm, startScanner, stopScanner]);

  useEffect(() => {
    return () => stopScanner();
  }, [stopScanner]);

  const handleClose = () => {
    stopScanner();
    onClose();
  };

  // Manual barcode entry
  const [manualBarcode, setManualBarcode] = useState("");
  const handleManualEntry = () => {
    if (manualBarcode.trim()) {
      handleBarcode(manualBarcode.trim());
      setManualBarcode("");
    }
  };

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

              {/* Scanner Container */}
              <div className="relative rounded-lg overflow-hidden bg-black aspect-[4/3]">
                <video
                  ref={videoRef}
                  className="w-full h-full object-cover"
                  playsInline
                  muted
                  autoPlay
                />

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
                    <Button size="sm" variant="outline" onClick={() => startScanner()}>
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
                        style={{
                          animation: "scanLine 2s ease-in-out infinite",
                          top: "50%",
                        }}
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* Manual Entry */}
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

              {/* Sound Toggle */}
              <Button
                variant="ghost"
                size="sm"
                className="w-full text-xs"
                onClick={() => setSoundEnabled(!soundEnabled)}
              >
                {soundEnabled ? <Volume2 className="h-3 w-3 mr-1" /> : <VolumeX className="h-3 w-3 mr-1" />}
                Sonido {soundEnabled ? "activado" : "desactivado"}
              </Button>
            </>
          ) : (
            /* Quick Entry Form */
            <div className="space-y-3">
              <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg p-3 text-center">
                <p className="text-xs text-muted-foreground">Código escaneado</p>
                <p className="font-mono font-bold text-lg">{currentBarcode}</p>
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
                  <Label className="text-xs">Dirección de entrega *</Label>
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
                    className="text-sm"
                  />
                </div>
              </div>

              <div className="flex gap-2">
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={() => {
                    setShowForm(false);
                    setCurrentBarcode("");
                  }}
                >
                  Cancelar
                </Button>
                <Button
                  className="flex-1 bg-amber-500 hover:bg-amber-600 text-white"
                  onClick={submitFlexOrder}
                  disabled={processing}
                >
                  {processing ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <CheckCircle2 className="h-4 w-4 mr-1" />}
                  Registrar Flex
                </Button>
              </div>
            </div>
          )}

          {/* Last Result */}
          {lastResult && (
            <div
              className={`p-3 rounded-lg flex items-start gap-2 ${
                lastResult.success
                  ? "bg-green-500/10 border border-green-500/30"
                  : lastResult.isDuplicate
                  ? "bg-amber-500/10 border border-amber-500/30 animate-pulse"
                  : "bg-destructive/10 border border-destructive/30"
              }`}
            >
              {lastResult.success ? (
                <CheckCircle2 className="h-5 w-5 text-green-600 shrink-0 mt-0.5" />
              ) : (
                <XCircle className="h-5 w-5 text-destructive shrink-0 mt-0.5" />
              )}
              <p className={`text-sm font-medium ${
                lastResult.success ? "text-green-700 dark:text-green-400" : 
                lastResult.isDuplicate ? "text-amber-700 dark:text-amber-400" : 
                "text-destructive"
              }`}>
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
          50% { top: 90%; }
        }
      `}</style>
    </Dialog>
  );
};

export default FlexReceptionScanner;
