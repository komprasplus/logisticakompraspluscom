import { useEffect, useRef, useState, useCallback } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Loader2, CheckCircle2, XCircle, ScanLine, RefreshCw, Camera, Package } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useScannerAudio } from "@/hooks/useScannerAudio";

interface MeliFlexScannerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

type Phase = "scanning" | "processing" | "success" | "error";

const MeliFlexScannerModal = ({ isOpen, onClose, onSuccess }: MeliFlexScannerModalProps) => {
  const [phase, setPhase] = useState<Phase>("scanning");
  const [errorMsg, setErrorMsg] = useState<string>("");
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [isInitializing, setIsInitializing] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);

  const scannerRef = useRef<any>(null);
  const containerId = "meli-flex-reader";
  const isProcessingRef = useRef(false);
  const { playSuccessSound, playErrorSound } = useScannerAudio();

  const stopScanner = useCallback(async () => {
    try {
      if (scannerRef.current) {
        await scannerRef.current.stop().catch(() => {});
        await scannerRef.current.clear().catch(() => {});
        scannerRef.current = null;
      }
    } catch {/* ignore */}
  }, []);

  const handleScan = useCallback(async (scannedData: unknown) => {
    if (!scannedData || isProcessingRef.current) return;
    isProcessingRef.current = true;
    setIsProcessing(true);

    const rawText = typeof scannedData === "string" ? scannedData : (scannedData as { text?: string })?.text || "";
    const cleanShipmentId = rawText.replace(/\D/g, "");

    if (!cleanShipmentId) {
      isProcessingRef.current = false;
      setIsProcessing(false);
      return;
    }

    await stopScanner();
    setPhase("processing");
    let success = false;
    const loadingToast = toast.loading("Sincronizando recolección con ML...");

    try {
      const { data, error } = await supabase.functions.invoke("meli-scan-shipment", {
        body: { shipment_id: cleanShipmentId },
      });

      toast.dismiss(loadingToast);
      if (error) throw error;

      const d: any = data ?? {};
      if (d.error || d.success === false) {
        const msg = d.message || d.error || "No se pudo registrar la recolección";
        playErrorSound();
        setErrorMsg(msg);
        setPhase("error");
        if (d.error === "meli_api_error") {
          toast.warning(`Mercado Libre: ${msg}`);
        } else {
          toast.error(msg);
        }
        return;
      }

      success = true;
      playSuccessSound();
      setPhase("success");
      toast.success("¡Recolección Exitosa en Flex!");
      onSuccess?.();
      isProcessingRef.current = false;
      setIsProcessing(false);
      setPhase("scanning");
      setErrorMsg("");
      onClose();
    } catch (e: any) {
      toast.dismiss(loadingToast);
      console.error("meli-scan-shipment failed", e);
      playErrorSound();
      setErrorMsg(e?.message ?? "No se pudo registrar la recolección");
      setPhase("error");
      toast.error(e?.message || "Error al sincronizar con Mercado Libre");
    } finally {
      if (!success) {
        isProcessingRef.current = false;
        setIsProcessing(false);
      }
    }
  }, [onSuccess, onClose, playSuccessSound, playErrorSound, stopScanner]);

  const startScanner = useCallback(async () => {
    setCameraError(null);
    setIsInitializing(true);
    try {
      const { Html5Qrcode } = await import("html5-qrcode");
      const html5Qrcode = new Html5Qrcode(containerId);
      scannerRef.current = html5Qrcode;

      await html5Qrcode.start(
        { facingMode: "environment" },
        { fps: 10, qrbox: { width: 280, height: 140 } },
        (decoded) => {
          handleScan(decoded);
        },
        () => { /* ignore scan-frame errors */ }
      );
      setIsInitializing(false);
    } catch (err: any) {
      console.error("Scanner init failed", err);
      setIsInitializing(false);
      setCameraError(err?.message ?? "No se pudo acceder a la cámara");
    }
  }, [stopScanner, handleScan]);

  useEffect(() => {
    if (isOpen && phase === "scanning") {
      const t = setTimeout(() => startScanner(), 150);
      return () => clearTimeout(t);
    }
    return () => { stopScanner(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, phase]);

  useEffect(() => () => { stopScanner(); }, [stopScanner]);

  const handleClose = async () => {
    await stopScanner();
    isProcessingRef.current = false;
    setIsProcessing(false);
    setPhase("scanning");
    setErrorMsg("");
    onClose();
  };

  const handleScanAnother = async () => {
    await stopScanner();
    isProcessingRef.current = false;
    setIsProcessing(false);
    setErrorMsg("");
    setPhase("scanning");
  };

  return (
    <Dialog open={isOpen} onOpenChange={(o) => { if (!o) handleClose(); }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ScanLine className="h-5 w-5" /> Escanear Recolección · ML Flex
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {phase === "scanning" && (
            <>
              <p className="text-sm text-muted-foreground text-center">
                Apunta la cámara al código de barras (Code 128) de la etiqueta de Mercado Libre.
              </p>
              <div className="relative rounded-lg overflow-hidden bg-black aspect-video">
                <div id={containerId} className="w-full h-full" />
                {isInitializing && (
                  <div className="absolute inset-0 flex flex-col items-center justify-center bg-muted/90">
                    <Loader2 className="h-10 w-10 animate-spin text-primary mb-2" />
                    <p className="text-sm text-muted-foreground">Iniciando cámara...</p>
                  </div>
                )}
                {cameraError && (
                  <div className="absolute inset-0 flex flex-col items-center justify-center bg-muted/90 p-4 text-center">
                    <Camera className="h-10 w-10 text-destructive mb-3" />
                    <p className="text-sm text-destructive font-medium mb-3">{cameraError}</p>
                    <Button size="sm" variant="outline" onClick={startScanner}>
                      <RefreshCw className="h-4 w-4 mr-2" /> Reintentar
                    </Button>
                  </div>
                )}
                {!isInitializing && !cameraError && (
                  <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
                    <div className="w-[70%] h-[35%] border-2 border-primary rounded-md shadow-[0_0_0_9999px_rgba(0,0,0,0.35)]" />
                  </div>
                )}
              </div>
              <Button variant="outline" className="w-full" onClick={handleClose}>
                Cerrar Escáner
              </Button>
            </>
          )}

          {phase === "processing" && isProcessing && (
            <div className="py-12 flex flex-col items-center justify-center gap-3">
              <Loader2 className="h-12 w-12 animate-spin text-primary" />
              <p className="font-medium">Sincronizando recolección con Mercado Libre...</p>
            </div>
          )}

          {phase === "success" && (
            <div className="py-10 flex flex-col items-center justify-center gap-3 text-center">
              <div className="rounded-full bg-green-500/15 p-5">
                <CheckCircle2 className="h-16 w-16 text-green-600" />
              </div>
              <h3 className="text-2xl font-bold text-green-700">¡Paquete Recolectado con Éxito!</h3>
              <Package className="h-5 w-5 text-muted-foreground" />
              <div className="flex gap-2 w-full pt-3">
                <Button variant="outline" className="flex-1" onClick={handleClose}>Cerrar</Button>
                <Button className="flex-1" onClick={handleScanAnother}>Escanear otro</Button>
              </div>
            </div>
          )}

          {phase === "error" && (
            <div className="py-8 flex flex-col items-center justify-center gap-3 text-center">
              <XCircle className="h-14 w-14 text-destructive" />
              <h3 className="text-xl font-bold text-destructive">No se pudo registrar</h3>
              <p className="text-sm text-muted-foreground break-all">{errorMsg}</p>
              <div className="flex gap-2 w-full pt-2">
                <Button variant="outline" className="flex-1" onClick={handleClose}>Cerrar</Button>
                <Button className="flex-1" onClick={handleScanAnother}>Reintentar</Button>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default MeliFlexScannerModal;
