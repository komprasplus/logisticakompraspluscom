import { useEffect, useRef, useState, useCallback } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Camera, Loader2, CheckCircle2, XCircle, ScanLine, RefreshCw } from "lucide-react";
import { Html5Qrcode } from "html5-qrcode";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

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
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const mountedRef = useRef(false);

  const stopScanner = useCallback(async () => {
    if (scannerRef.current) {
      try {
        const state = scannerRef.current.getState();
        if (state === 2) { // SCANNING state
          await scannerRef.current.stop();
        }
        scannerRef.current.clear();
      } catch (e) {
        console.log("Scanner cleanup:", e);
      }
      scannerRef.current = null;
    }
    setScanning(false);
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
        .select("id, estado, cliente_nombre, numero_guia")
        .eq("id", pedidoId)
        .maybeSingle();

      if (fetchError || !pedido) {
        setLastResult({ success: false, message: `Pedido #${pedidoId} no encontrado` });
        setProcessing(false);
        return;
      }

      // Update to "Recibido en Bodega"
      const { error: updateError } = await supabase
        .from("pedidos")
        .update({ estado: "Recibido en Bodega" })
        .eq("id", pedidoId);

      if (updateError) {
        setLastResult({ success: false, message: "Error al actualizar el pedido" });
        setProcessing(false);
        return;
      }

      setLastResult({
        success: true,
        message: `${pedido.numero_guia || `#${pedidoId}`} - ${pedido.cliente_nombre || "Sin nombre"} → Recibido en Bodega`,
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

    // Wait for the container to be in DOM
    await new Promise(resolve => setTimeout(resolve, 300));

    if (!containerRef.current || !mountedRef.current) {
      console.log("Container not ready or component unmounted");
      return;
    }

    try {
      // Request camera permission first
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { facingMode: "environment" } 
      });
      // Stop the test stream immediately
      stream.getTracks().forEach(track => track.stop());

      // Check if container still exists
      if (!containerRef.current || !mountedRef.current) return;

      const scanner = new Html5Qrcode("qr-scanner-container");
      scannerRef.current = scanner;

      await scanner.start(
        { facingMode: "environment" },
        {
          fps: 10,
          qrbox: { width: 220, height: 220 },
          aspectRatio: 1,
        },
        async (decodedText) => {
          console.log("QR Scanned:", decodedText);
          await handleQRCode(decodedText);
        },
        () => {
          // Ignore scan errors (they happen when no QR is in view)
        }
      );

      setScanning(true);
    } catch (err: any) {
      console.error("Error starting scanner:", err);
      setScanning(false);
      
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
      mountedRef.current = true;
      startScanner();
    }

    return () => {
      mountedRef.current = false;
      stopScanner();
    };
  }, [isOpen, startScanner, stopScanner]);

  const handleClose = () => {
    stopScanner();
    onClose();
  };

  const handleRetry = () => {
    stopScanner().then(() => {
      startScanner();
    });
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
            <div 
              id="qr-scanner-container" 
              ref={containerRef}
              className="w-full h-full"
            />

            {!scanning && !cameraError && (
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
            {scanning && !processing && (
              <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
                <div className="w-56 h-56 border-2 border-primary rounded-lg relative">
                  <div className="absolute top-0 left-0 w-6 h-6 border-t-4 border-l-4 border-primary rounded-tl" />
                  <div className="absolute top-0 right-0 w-6 h-6 border-t-4 border-r-4 border-primary rounded-tr" />
                  <div className="absolute bottom-0 left-0 w-6 h-6 border-b-4 border-l-4 border-primary rounded-bl" />
                  <div className="absolute bottom-0 right-0 w-6 h-6 border-b-4 border-r-4 border-primary rounded-br" />
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
    </Dialog>
  );
};

export default QRScannerModal;
