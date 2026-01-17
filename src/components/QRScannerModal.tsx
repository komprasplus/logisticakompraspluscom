import { useEffect, useRef, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Camera, Loader2, CheckCircle2, XCircle, ScanLine } from "lucide-react";
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
  const [lastResult, setLastResult] = useState<{ success: boolean; message: string } | null>(null);
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const hasStarted = useRef(false);

  useEffect(() => {
    if (isOpen && !hasStarted.current) {
      startScanner();
      hasStarted.current = true;
    }

    return () => {
      stopScanner();
      hasStarted.current = false;
    };
  }, [isOpen]);

  const startScanner = async () => {
    try {
      setScanning(true);
      setLastResult(null);

      const scanner = new Html5Qrcode("qr-reader");
      scannerRef.current = scanner;

      await scanner.start(
        { facingMode: "environment" },
        {
          fps: 10,
          qrbox: { width: 250, height: 250 },
          aspectRatio: 1,
        },
        async (decodedText) => {
          console.log("QR Scanned:", decodedText);
          await handleQRCode(decodedText);
        },
        (errorMessage) => {
          // Ignore scan errors (they happen when no QR is in view)
        }
      );
    } catch (err) {
      console.error("Error starting scanner:", err);
      setScanning(false);
      toast.error("No se pudo acceder a la cámara");
    }
  };

  const stopScanner = async () => {
    if (scannerRef.current) {
      try {
        await scannerRef.current.stop();
        scannerRef.current.clear();
      } catch (e) {
        console.log("Scanner already stopped");
      }
      scannerRef.current = null;
    }
    setScanning(false);
  };

  const handleQRCode = async (qrData: string) => {
    // Pause scanning while processing
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
        message: `✅ ${pedido.numero_guia || `#${pedidoId}`} - ${pedido.cliente_nombre || "Sin nombre"} → Recibido en Bodega`,
      });

      toast.success(`Pedido ${pedido.numero_guia || `#${pedidoId}`} recibido en bodega`);
      onSuccess();

      // Short delay before allowing next scan
      setTimeout(() => {
        setProcessing(false);
      }, 1500);
    } catch (error) {
      console.error("Error processing QR:", error);
      setLastResult({ success: false, message: "Error al procesar el código" });
      setProcessing(false);
    }
  };

  const handleClose = () => {
    stopScanner();
    onClose();
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
            <div id="qr-reader" className="w-full h-full" />

            {!scanning && (
              <div className="absolute inset-0 flex flex-col items-center justify-center bg-muted/90">
                <Camera className="h-12 w-12 text-muted-foreground mb-2" />
                <p className="text-sm text-muted-foreground">Iniciando cámara...</p>
              </div>
            )}

            {processing && (
              <div className="absolute inset-0 flex flex-col items-center justify-center bg-background/80 backdrop-blur-sm">
                <Loader2 className="h-10 w-10 animate-spin text-primary mb-2" />
                <p className="text-sm font-medium">Procesando...</p>
              </div>
            )}
          </div>

          {/* Last Result */}
          {lastResult && (
            <div
              className={`p-3 rounded-lg flex items-start gap-2 ${
                lastResult.success
                  ? "bg-green-500/10 border border-green-500/20"
                  : "bg-destructive/10 border border-destructive/20"
              }`}
            >
              {lastResult.success ? (
                <CheckCircle2 className="h-5 w-5 text-green-500 shrink-0 mt-0.5" />
              ) : (
                <XCircle className="h-5 w-5 text-destructive shrink-0 mt-0.5" />
              )}
              <p className={`text-sm ${lastResult.success ? "text-green-700" : "text-destructive"}`}>
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
