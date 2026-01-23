import { useEffect, useRef, useState, useCallback } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { 
  Camera, 
  Loader2, 
  CheckCircle2, 
  XCircle, 
  ScanLine, 
  RefreshCw,
  MapPin,
  Phone,
  Package,
  DollarSign,
  PlayCircle,
  AlertTriangle,
  Truck
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";

interface Pedido {
  id: number;
  numero_guia: string | null;
  cliente_nombre: string | null;
  client_phone: string | null;
  direccion_entrega: string | null;
  barrio: string | null;
  zona: string | null;
  producto_nombre: string | null;
  valor_recaudar: number | null;
  metodo_pago: string | null;
  estado: string | null;
  motorizado_id: string | null;
  motorizado_asignado: string | null;
}

interface MotorizadoQRScannerProps {
  isOpen: boolean;
  onClose: () => void;
  onStartDelivery: (pedido: Pedido) => void;
  motorizadoId: string;
  motorizadoName?: string;
}

const MotorizadoQRScanner = ({ isOpen, onClose, onStartDelivery, motorizadoId, motorizadoName }: MotorizadoQRScannerProps) => {
  const [scanning, setScanning] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [scannedPedido, setScannedPedido] = useState<Pedido | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isInitializing, setIsInitializing] = useState(false);
  const [isAutoAssign, setIsAutoAssign] = useState(false); // Track if this is an auto-assignment
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
    setScanning(false);
    setIsInitializing(false);
  }, []);

  const handleQRCode = useCallback(async (qrData: string) => {
    if (processing) return;
    setProcessing(true);
    setErrorMessage(null);
    setScannedPedido(null);
    setIsAutoAssign(false);

    try {
      // Expected format: "PEDIDO:123"
      const match = qrData.match(/PEDIDO:(\d+)/);
      if (!match) {
        setErrorMessage("Código QR no reconocido. Asegúrate de escanear una guía de Plus Envíos.");
        setProcessing(false);
        return;
      }

      const pedidoId = parseInt(match[1], 10);

      // Fetch the pedido details
      const { data: pedido, error: fetchError } = await supabase
        .from("pedidos")
        .select("id, numero_guia, cliente_nombre, client_phone, direccion_entrega, barrio, zona, producto_nombre, valor_recaudar, metodo_pago, estado, motorizado_id, motorizado_asignado")
        .eq("id", pedidoId)
        .maybeSingle();

      if (fetchError || !pedido) {
        setErrorMessage(`Pedido #${pedidoId} no encontrado en el sistema.`);
        setProcessing(false);
        return;
      }

      // Check if order is in a valid state
      const estado = pedido.estado?.toLowerCase();
      if (estado === "entregado" || estado === "liquidado") {
        setErrorMessage(`Este pedido ya fue entregado.`);
        setProcessing(false);
        return;
      }

      if (estado === "anulado") {
        setErrorMessage(`Este pedido fue anulado y no puede ser entregado.`);
        setProcessing(false);
        return;
      }

      // AUTO-ASSIGNMENT LOGIC
      // If the order is not assigned OR is assigned to someone else, we can auto-assign
      if (!pedido.motorizado_id || pedido.motorizado_id !== motorizadoId) {
        // Check if order is in a state that allows assignment
        if (estado === "pendiente" || estado === "recibido en bodega" || estado === "asignado") {
          setIsAutoAssign(true);
          setScannedPedido({
            ...pedido,
            // Show that it will be auto-assigned
            motorizado_id: motorizadoId,
            motorizado_asignado: motorizadoName || "Yo"
          });
          stopScanner();
          setProcessing(false);
          return;
        } else if (pedido.motorizado_id && pedido.motorizado_id !== motorizadoId) {
          // Order is already in route with another driver
          setErrorMessage("❌ Este pedido está asignado a otro motorizado y ya está en ruta.");
          setProcessing(false);
          return;
        }
      }

      // Success! Order belongs to this motorizado
      setScannedPedido(pedido);
      stopScanner();
      
    } catch (error) {
      console.error("Error processing QR:", error);
      setErrorMessage("Error al procesar el código. Intenta de nuevo.");
    } finally {
      setProcessing(false);
    }
  }, [processing, motorizadoId, motorizadoName, stopScanner]);

  const startScanner = useCallback(async () => {
    setCameraError(null);
    setErrorMessage(null);
    setScannedPedido(null);
    setIsInitializing(true);
    setIsAutoAssign(false);

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
        setCameraError("Necesitamos acceso a la cámara para escanear las guías de Plus Envíos. Por favor, permite el acceso en la configuración del navegador.");
      } else if (err.name === "NotFoundError") {
        setCameraError("No se encontró ninguna cámara en el dispositivo.");
      } else if (err.name === "NotReadableError") {
        setCameraError("La cámara está siendo usada por otra aplicación. Cierra otras apps y vuelve a intentar.");
      } else {
        setCameraError("No se pudo acceder a la cámara. Intenta de nuevo.");
      }
    }
  }, [handleQRCode]);

  useEffect(() => {
    if (isOpen && !scannedPedido) {
      // Small delay to ensure modal is rendered
      const timer = setTimeout(() => {
        startScanner();
      }, 100);
      return () => clearTimeout(timer);
    } else if (!isOpen) {
      stopScanner();
      setScannedPedido(null);
      setErrorMessage(null);
      setIsAutoAssign(false);
    }
  }, [isOpen, startScanner, stopScanner, scannedPedido]);

  useEffect(() => {
    return () => {
      stopScanner();
    };
  }, [stopScanner]);

  const handleClose = () => {
    stopScanner();
    setScannedPedido(null);
    setErrorMessage(null);
    setIsAutoAssign(false);
    onClose();
  };

  const handleRetry = () => {
    setErrorMessage(null);
    setScannedPedido(null);
    setIsAutoAssign(false);
    stopScanner();
    setTimeout(() => {
      startScanner();
    }, 100);
  };

  const handleStartDelivery = async () => {
    if (!scannedPedido) return;
    
    setProcessing(true);
    try {
      // Build the update payload
      const updatePayload: Record<string, any> = {
        estado: "En Ruta",
        fecha_actualizacion: new Date().toISOString(),
      };

      // If auto-assigning, also set the motorizado
      if (isAutoAssign) {
        updatePayload.motorizado_id = motorizadoId;
        updatePayload.motorizado_asignado = motorizadoName || "Motorizado";
      }

      // Update the order status to "En Ruta"
      const { error } = await supabase
        .from("pedidos")
        .update(updatePayload)
        .eq("id", scannedPedido.id);

      if (error) throw error;

      // Log the status change for audit
      await supabase.from("pedido_status_logs").insert({
        pedido_id: scannedPedido.id,
        estado_anterior: scannedPedido.estado,
        estado_nuevo: "En Ruta",
        motivo: isAutoAssign ? "Auto-asignado por escaneo QR" : "Iniciado por escaneo QR",
        usuario_nombre: motorizadoName || "Motorizado",
        usuario_id: motorizadoId,
      });

      if (isAutoAssign) {
        toast.success(`🏍️ Pedido asignado automáticamente y ¡en ruta!`);
      } else {
        toast.success(`🚀 ¡Entrega iniciada para ${scannedPedido.cliente_nombre || 'cliente'}!`);
      }
      
      onStartDelivery({ 
        ...scannedPedido, 
        estado: "En Ruta",
        motorizado_id: motorizadoId,
        motorizado_asignado: motorizadoName || "Motorizado"
      });
      handleClose();
    } catch (error) {
      console.error("Error starting delivery:", error);
      toast.error("Error al iniciar la entrega. Intenta de nuevo.");
    } finally {
      setProcessing(false);
    }
  };

  const formatCurrency = (amount: number | null) => {
    if (!amount) return "$0";
    return `$${amount.toLocaleString("es-CO")}`;
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ScanLine className="h-5 w-5 text-primary" />
            Escanear Paquete
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Show scanner or order info */}
          {!scannedPedido ? (
            <>
              <p className="text-sm text-muted-foreground text-center">
                Escanea el código QR de la guía para <strong>asignar automáticamente</strong> el pedido e iniciar la entrega.
              </p>

              {/* Scanner Container */}
              <div className="relative rounded-xl overflow-hidden bg-black aspect-square">
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
                    <p className="text-sm text-foreground font-medium mb-3">{cameraError}</p>
                    <Button size="sm" onClick={handleRetry}>
                      <RefreshCw className="h-4 w-4 mr-2" />
                      Intentar de Nuevo
                    </Button>
                  </div>
                )}

                {processing && (
                  <div className="absolute inset-0 flex flex-col items-center justify-center bg-background/80 backdrop-blur-sm">
                    <Loader2 className="h-10 w-10 animate-spin text-primary mb-2" />
                    <p className="text-sm font-medium">Buscando pedido...</p>
                  </div>
                )}

                {/* Scanning Frame Overlay */}
                {scanning && !processing && !cameraError && (
                  <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
                    <div className="w-56 h-56 relative">
                      {/* Corner brackets */}
                      <div className="absolute top-0 left-0 w-8 h-8 border-t-4 border-l-4 border-primary rounded-tl-lg" />
                      <div className="absolute top-0 right-0 w-8 h-8 border-t-4 border-r-4 border-primary rounded-tr-lg" />
                      <div className="absolute bottom-0 left-0 w-8 h-8 border-b-4 border-l-4 border-primary rounded-bl-lg" />
                      <div className="absolute bottom-0 right-0 w-8 h-8 border-b-4 border-r-4 border-primary rounded-br-lg" />
                      {/* Scanning line animation */}
                      <motion.div 
                        className="absolute inset-x-2 h-0.5 bg-gradient-to-r from-transparent via-primary to-transparent"
                        initial={{ top: "10%" }}
                        animate={{ top: ["10%", "90%", "10%"] }}
                        transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* Error Message */}
              {errorMessage && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="p-4 rounded-xl bg-destructive/10 border border-destructive/30"
                >
                  <div className="flex items-start gap-3">
                    <AlertTriangle className="h-5 w-5 text-destructive shrink-0 mt-0.5" />
                    <div>
                      <p className="text-sm font-medium text-destructive">{errorMessage}</p>
                      <Button 
                        size="sm" 
                        variant="outline" 
                        className="mt-3"
                        onClick={handleRetry}
                      >
                        <RefreshCw className="h-4 w-4 mr-2" />
                        Escanear Otro
                      </Button>
                    </div>
                  </div>
                </motion.div>
              )}
            </>
          ) : (
            /* Order Info Card */
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="space-y-4"
            >
              {/* Auto-assign indicator */}
              {isAutoAssign && (
                <div className="p-3 rounded-lg bg-teal-50 border border-teal-200 flex items-center gap-2">
                  <Truck className="h-5 w-5 text-teal-600" />
                  <div>
                    <p className="text-sm font-semibold text-teal-800">Asignación Automática</p>
                    <p className="text-xs text-teal-700">Este pedido se asignará a ti al iniciar</p>
                  </div>
                </div>
              )}

              <div className="p-4 rounded-xl bg-primary/5 border border-primary/20">
                <div className="flex items-center gap-2 mb-3">
                  <CheckCircle2 className="h-5 w-5 text-primary" />
                  <span className="font-semibold text-primary">
                    Guía: {scannedPedido.numero_guia || `#${scannedPedido.id}`}
                  </span>
                </div>
                
                {/* Customer Name */}
                <div className="text-lg font-bold text-foreground mb-3">
                  {scannedPedido.cliente_nombre || "Cliente sin nombre"}
                </div>

                {/* Address */}
                <div className="flex items-start gap-2 mb-2">
                  <MapPin className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
                  <span className="text-sm text-muted-foreground">
                    {scannedPedido.direccion_entrega || "Sin dirección"}
                    {scannedPedido.barrio && ` - ${scannedPedido.barrio}`}
                  </span>
                </div>

                {/* Phone */}
                {scannedPedido.client_phone && (
                  <div className="flex items-center gap-2 mb-2">
                    <Phone className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm text-muted-foreground">{scannedPedido.client_phone}</span>
                  </div>
                )}

                {/* Product */}
                {scannedPedido.producto_nombre && (
                  <div className="flex items-center gap-2 mb-2">
                    <Package className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm text-muted-foreground">{scannedPedido.producto_nombre}</span>
                  </div>
                )}

                {/* Collection Amount */}
                <div className="flex items-center gap-2 mt-3 pt-3 border-t border-border">
                  <DollarSign className="h-5 w-5 text-primary" />
                  <span className="text-lg font-bold text-foreground">
                    {scannedPedido.metodo_pago === "anticipado" 
                      ? "PAGADO" 
                      : `Recaudar: ${formatCurrency(scannedPedido.valor_recaudar)}`
                    }
                  </span>
                </div>
              </div>

              {/* Status Indicator */}
              <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
                <span>Estado actual:</span>
                <span className="font-medium text-foreground">{scannedPedido.estado}</span>
              </div>

              {/* Action Buttons */}
              <div className="flex gap-3">
                <Button 
                  variant="outline" 
                  className="flex-1"
                  onClick={handleRetry}
                >
                  <ScanLine className="h-4 w-4 mr-2" />
                  Escanear Otro
                </Button>
                <Button 
                  className="flex-1 gap-2"
                  onClick={handleStartDelivery}
                  disabled={processing}
                >
                  {processing ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <PlayCircle className="h-5 w-5" />
                  )}
                  {isAutoAssign ? "Asignar e Iniciar" : "Iniciar Entrega"}
                </Button>
              </div>
            </motion.div>
          )}

          <Button variant="outline" className="w-full" onClick={handleClose}>
            Cerrar
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default MotorizadoQRScanner;
