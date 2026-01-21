import { useEffect, useRef, useState, useCallback } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Camera, Loader2, CheckCircle2, XCircle, ScanLine, RefreshCw } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { restoreInventoryOnReturn } from "@/lib/inventoryService";

interface QRScannerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

const QRScannerModal = ({ isOpen, onClose, onSuccess }: QRScannerModalProps) => {
  const [scanning, setScanning] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [lastResult, setLastResult] = useState<{ success: boolean; message: string } | null>(null);
  const [isInitializing, setIsInitializing] = useState(false);
  const scannerRef = useRef<any>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const animationRef = useRef<number | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

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
    scannerRef.current = null;
    setScanning(false);
    setIsInitializing(false);
  }, []);

  const handleQRCode = useCallback(async (qrData: string) => {
    if (processing) return;
    setProcessing(true);

    try {
      // Expected format: "PEDIDO:123"
      const match = qrData.match(/PEDIDO:(\d+)/);
      if (!match) {
        setLastResult({ success: false, message: "Código QR no reconocido" });
        setProcessing(false);
        return;
      }

      const pedidoId = parseInt(match[1], 10);

      // Check current status
      const { data: pedido, error: fetchError } = await supabase
        .from("pedidos")
        .select("id, estado, cliente_nombre, numero_guia, inventory_item_id, quantity")
        .eq("id", pedidoId)
        .maybeSingle();

      if (fetchError || !pedido) {
        setLastResult({ success: false, message: `Pedido #${pedidoId} no encontrado` });
        setProcessing(false);
        return;
      }

      // Check if this is a return being received at warehouse
      const isReturn = pedido.estado?.toLowerCase() === "devolución";

      // Update to "Recibido en Bodega"
      const { error: updateError } = await supabase
        .from("pedidos")
        .update({ 
          estado: "Recibido en Bodega",
          fecha_actualizacion: new Date().toISOString(),
        })
        .eq("id", pedidoId);

      if (updateError) {
        setLastResult({ success: false, message: "Error al actualizar el pedido" });
        setProcessing(false);
        return;
      }

      // If this was a return, restore inventory stock
      if (isReturn && pedido.inventory_item_id) {
        const inventoryResult = await restoreInventoryOnReturn(
          pedidoId,
          pedido.inventory_item_id,
          pedido.quantity || 1
        );
        if (inventoryResult.success) {
          console.log("✅ Inventory restored for returned order");
        } else {
          console.warn("Inventory restoration failed:", inventoryResult.error);
        }
      }

      setLastResult({
        success: true,
        message: `${pedido.numero_guia || `#${pedidoId}`} - ${pedido.cliente_nombre || "Sin nombre"} → Recibido en Bodega${isReturn ? " (Devolución)" : ""}`,
      });

      toast.success(`Pedido ${pedido.numero_guia || `#${pedidoId}`} recibido en bodega`);
      onSuccess();

      // Short delay before allowing next scan
      setTimeout(() => {
        setProcessing(false);
      }, 2000);
    } catch (error) {
      console.error("Error processing QR:", error);
      setLastResult({ success: false, message: "Error al procesar el código" });
      setProcessing(false);
    }
  }, [processing, onSuccess]);

  const startScanner = useCallback(async () => {
    setCameraError(null);
    setLastResult(null);
    setIsInitializing(true);

    try {
      // Request camera permission
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { 
          facingMode: "environment",
          width: { ideal: 640 },
          height: { ideal: 480 }
        } 
      });

      streamRef.current = stream;

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
        
        // Dynamically import jsQR for QR detection
        const jsQR = (await import("jsqr")).default;
        
        // Create canvas for frame processing
        const canvas = document.createElement("canvas");
        const ctx = canvas.getContext("2d", { willReadFrequently: true });
        canvasRef.current = canvas;

        const scanFrame = () => {
          if (!videoRef.current || !ctx || !streamRef.current) return;

          const video = videoRef.current;
          if (video.readyState === video.HAVE_ENOUGH_DATA) {
            canvas.width = video.videoWidth;
            canvas.height = video.videoHeight;
            ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
            
            const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
            const code = jsQR(imageData.data, imageData.width, imageData.height, {
              inversionAttempts: "dontInvert",
            });

            if (code && code.data) {
              console.log("QR Detected:", code.data);
              handleQRCode(code.data);
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
        setCameraError("Permiso de cámara denegado. Por favor, permite el acceso a la cámara en la configuración del navegador.");
      } else if (err.name === "NotFoundError") {
        setCameraError("No se encontró ninguna cámara en el dispositivo.");
      } else if (err.name === "NotReadableError") {
        setCameraError("La cámara está siendo usada por otra aplicación.");
      } else {
        setCameraError("No se pudo acceder a la cámara. Intenta de nuevo.");
      }
    }
  }, [handleQRCode]);

  useEffect(() => {
    if (isOpen) {
      // Small delay to ensure modal is rendered
      const timer = setTimeout(() => {
        startScanner();
      }, 100);
      return () => clearTimeout(timer);
    } else {
      stopScanner();
    }
  }, [isOpen, startScanner, stopScanner]);

  useEffect(() => {
    return () => {
      stopScanner();
    };
  }, [stopScanner]);

  const handleClose = () => {
    stopScanner();
    onClose();
  };

  const handleRetry = () => {
    stopScanner();
    setTimeout(() => {
      startScanner();
    }, 100);
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ScanLine className="h-5 w-5" />
            Escanear Guía QR
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <p className="text-sm text-muted-foreground text-center">
            Escanea el código QR de la guía para marcar el pedido como <strong>"Recibido en Bodega"</strong>
          </p>

          {/* Scanner Container */}
          <div className="relative rounded-lg overflow-hidden bg-black aspect-square">
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
                <Button size="sm" variant="outline" onClick={handleRetry}>
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Reintentar
                </Button>
              </div>
            )}

            {processing && (
              <div className="absolute inset-0 flex flex-col items-center justify-center bg-background/80 backdrop-blur-sm">
                <Loader2 className="h-10 w-10 animate-spin text-primary mb-2" />
                <p className="text-sm font-medium">Procesando...</p>
              </div>
            )}

            {/* Scanning Frame Overlay */}
            {scanning && !processing && !cameraError && (
              <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
                <div className="w-56 h-56 border-2 border-primary rounded-lg relative">
                  <div className="absolute top-0 left-0 w-6 h-6 border-t-4 border-l-4 border-primary rounded-tl" />
                  <div className="absolute top-0 right-0 w-6 h-6 border-t-4 border-r-4 border-primary rounded-tr" />
                  <div className="absolute bottom-0 left-0 w-6 h-6 border-b-4 border-l-4 border-primary rounded-bl" />
                  <div className="absolute bottom-0 right-0 w-6 h-6 border-b-4 border-r-4 border-primary rounded-br" />
                  {/* Scanning line animation */}
                  <div className="absolute inset-x-0 h-0.5 bg-primary animate-pulse" 
                    style={{ 
                      animation: "scanLine 2s ease-in-out infinite",
                      top: "50%"
                    }} 
                  />
                </div>
              </div>
            )}
          </div>

          {/* Last Result */}
          {lastResult && (
            <div
              className={`p-3 rounded-lg flex items-start gap-2 ${
                lastResult.success
                  ? "bg-green-500/10 border border-green-500/30"
                  : "bg-destructive/10 border border-destructive/30"
              }`}
            >
              {lastResult.success ? (
                <CheckCircle2 className="h-5 w-5 text-green-600 shrink-0 mt-0.5" />
              ) : (
                <XCircle className="h-5 w-5 text-destructive shrink-0 mt-0.5" />
              )}
              <p className={`text-sm font-medium ${lastResult.success ? "text-green-700" : "text-destructive"}`}>
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

export default QRScannerModal;
