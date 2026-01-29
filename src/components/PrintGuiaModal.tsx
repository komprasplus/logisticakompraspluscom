import { useRef, useEffect, useState, useCallback } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Printer, Download, Loader2 } from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import { toPng } from "html-to-image";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
const defaultLogo = "/logo-oficial.png";

interface Pedido {
  id: number;
  numero_guia: string | null;
  cliente_nombre: string | null;
  client_phone: string | null;
  direccion_entrega: string | null;
  barrio: string | null;
  zona: string | null;
  valor_recaudar: number | null;
  metodo_pago: string | null;
  producto_nombre: string | null;
  fecha_creacion: string | null;
  observaciones?: string | null;
  client_user_id?: string | null;
}

interface PrintGuiaModalProps {
  pedido: Pedido | null;
  isOpen: boolean;
  onClose: () => void;
  remitente?: string;
}

const PrintGuiaModal = ({ pedido, isOpen, onClose, remitente }: PrintGuiaModalProps) => {
  const guiaRef = useRef<HTMLDivElement>(null);
  const [storeLogo, setStoreLogo] = useState<string | null>(null);
  const [storeName, setStoreName] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isPrinting, setIsPrinting] = useState(false);

  // Fetch store logo if pedido has client_user_id
  useEffect(() => {
    let isMounted = true;

    const fetchStoreLogo = async () => {
      if (!pedido?.client_user_id) {
        if (isMounted) {
          setStoreLogo(null);
          setStoreName(null);
        }
        return;
      }

      try {
        const { data: profile, error } = await supabase
          .from("profiles")
          .select("logo_url, store_name")
          .eq("user_id", pedido.client_user_id)
          .maybeSingle();

        if (error) {
          console.error("Error fetching store logo:", error);
          if (isMounted) {
            setStoreLogo(null);
            setStoreName(null);
          }
          return;
        }

        if (isMounted) {
          setStoreLogo(profile?.logo_url || null);
          setStoreName(profile?.store_name || null);
        }
      } catch (error) {
        console.error("Error fetching store logo:", error);
        if (isMounted) {
          setStoreLogo(null);
          setStoreName(null);
        }
      }
    };

    if (isOpen && pedido) {
      fetchStoreLogo();
    }

    return () => {
      isMounted = false;
    };
  }, [pedido, isOpen]);

  const handlePrint = useCallback(async () => {
    if (!pedido) return;
    const printContent = guiaRef.current;
    if (!printContent) return;

    setIsPrinting(true);

    try {
      // For mobile, use a more compatible approach
      const printWindow = window.open("", "_blank");
      if (!printWindow) {
        toast.error("No se pudo abrir la ventana de impresión. Desactiva el bloqueador de pop-ups.");
        setIsPrinting(false);
        return;
      }

      printWindow.document.write(`
        <!DOCTYPE html>
        <html>
          <head>
            <title>Guía ${pedido.numero_guia || pedido.id}</title>
            <style>
              * { margin: 0; padding: 0; box-sizing: border-box; }
              body { 
                font-family: Arial, Helvetica, sans-serif; 
                background: white;
                -webkit-print-color-adjust: exact;
                print-color-adjust: exact;
              }
              @page {
                size: 10cm 15cm;
                margin: 0;
              }
              @media print {
                body { margin: 0; }
                .guia-container { border: none !important; }
              }
            </style>
          </head>
          <body>
            ${printContent.innerHTML}
          </body>
        </html>
      `);
      printWindow.document.close();
      printWindow.focus();
      setTimeout(() => {
        printWindow.print();
        printWindow.close();
        setIsPrinting(false);
      }, 250);
    } catch (error) {
      console.error("Error printing:", error);
      toast.error("Error al imprimir la guía");
      setIsPrinting(false);
    }
  }, [pedido]);

  const handleDownload = useCallback(async () => {
    if (!pedido) return;
    if (!guiaRef.current) return;

    setIsGenerating(true);
    toast.info("Generando guía...", { duration: 2000 });

    try {
      // Use lower pixelRatio on mobile for better performance
      const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
      const pixelRatio = isMobile ? 2 : 3;
      
      const dataUrl = await toPng(guiaRef.current, { 
        quality: 0.95, 
        pixelRatio,
        backgroundColor: "#ffffff",
        cacheBust: true, // Prevent caching issues
        skipAutoScale: true, // Better mobile compatibility
      });

      // Convert data URL to Blob for more reliable mobile download
      const response = await fetch(dataUrl);
      const blob = await response.blob();
      
      // Create a robust download using object URL
      const blobUrl = URL.createObjectURL(blob);
      const fileName = `guia-${pedido.numero_guia || pedido.id}.png`;
      
      // Create temporary anchor for download
      const link = document.createElement("a");
      link.href = blobUrl;
      link.download = fileName;
      link.style.display = "none";
      
      // Required for Firefox and some mobile browsers
      document.body.appendChild(link);
      
      // Trigger download
      link.click();
      
      // Cleanup
      setTimeout(() => {
        document.body.removeChild(link);
        URL.revokeObjectURL(blobUrl);
      }, 100);
      
      toast.success("Guía descargada correctamente");
    } catch (error) {
      console.error("Error generating image:", error);
      toast.error("No se pudo generar la guía, intenta nuevamente");
    } finally {
      setIsGenerating(false);
    }
  }, [pedido]);

  // Early return after all hooks
  if (!pedido) return null;

  const formatDate = () => {
    return new Date().toLocaleDateString("es-CO", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit"
    });
  };

  const guiaNumero = pedido.numero_guia || `KP-${pedido.id}`;
  const isPagado = pedido.metodo_pago === "anticipado";
  const displayStoreName = storeName || remitente || "Kompras Plus";
  const displayLogo = storeLogo || defaultLogo;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Guía de Envío</DialogTitle>
        </DialogHeader>

        {/* Preview */}
        <div className="flex justify-center bg-muted p-4 rounded-lg overflow-auto max-h-[70vh]">
          <div
            ref={guiaRef}
            className="guia-container"
            style={{
              width: "10cm",
              height: "15cm",
              padding: "4mm",
              backgroundColor: "#ffffff",
              fontFamily: "Arial, Helvetica, sans-serif",
              border: "1px solid #000",
              boxSizing: "border-box",
              display: "flex",
              flexDirection: "column",
            }}
          >
            {/* Fila 1: Header - Store Logo & Guía Number */}
            <div style={{ 
              display: "flex", 
              justifyContent: "space-between", 
              alignItems: "center",
              borderBottom: "2px solid #000",
              paddingBottom: "3mm",
              marginBottom: "3mm"
            }}>
              {/* Store Logo - Left Corner */}
              <div style={{ display: "flex", alignItems: "center", gap: "2mm" }}>
                <img 
                  src={displayLogo} 
                  alt={displayStoreName}
                  style={{ 
                    height: "12mm", 
                    maxWidth: "35mm",
                    objectFit: "contain",
                    filter: storeLogo ? "none" : "grayscale(100%)"
                  }}
                  onError={(e) => {
                    e.currentTarget.src = defaultLogo;
                    e.currentTarget.style.filter = "grayscale(100%)";
                  }}
                />
              </div>
              <div style={{ textAlign: "right" }}>
                <div style={{ 
                  fontSize: "14pt", 
                  fontWeight: "bold",
                  lineHeight: "1.1"
                }}>
                  GUÍA N°: {guiaNumero}
                </div>
                <div style={{ fontSize: "8pt", color: "#333" }}>
                  FECHA: {formatDate()}
                </div>
              </div>
            </div>

            {/* Fila 2: Store Name - PROMINENTLY DISPLAYED */}
            <div style={{ 
              backgroundColor: "#000",
              color: "#fff",
              padding: "2mm 3mm",
              marginBottom: "2mm",
              textAlign: "center"
            }}>
              <div style={{ 
                fontSize: "14pt", 
                fontWeight: "bold",
                textTransform: "uppercase",
                letterSpacing: "0.5px"
              }}>
                {displayStoreName}
              </div>
            </div>

            {/* Fila 3: Zona y Barrio destacados */}
            <div style={{ 
              display: "flex", 
              gap: "2mm", 
              marginBottom: "2mm"
            }}>
              <div style={{ 
                flex: 1, 
                padding: "2mm", 
                border: "2px solid #000",
                textAlign: "center"
              }}>
                <div style={{ fontSize: "7pt", fontWeight: "bold", textTransform: "uppercase" }}>
                  ZONA
                </div>
                <div style={{ fontSize: "12pt", fontWeight: "bold" }}>
                  {pedido.zona || "—"}
                </div>
              </div>
              <div style={{ 
                flex: 1, 
                padding: "2mm", 
                border: "2px solid #000",
                textAlign: "center"
              }}>
                <div style={{ fontSize: "7pt", fontWeight: "bold", textTransform: "uppercase" }}>
                  BARRIO
                </div>
                <div style={{ fontSize: "10pt", fontWeight: "bold" }}>
                  {pedido.barrio || "—"}
                </div>
              </div>
            </div>

            {/* QR Code - Centered with increased margin */}
            <div style={{ 
              display: "flex", 
              justifyContent: "center", 
              padding: "4mm 0",
              marginBottom: "3mm"
            }}>
              <QRCodeSVG
                value={`PEDIDO:${pedido.id}`}
                size={100} // Slightly smaller for better spacing
                level="H"
                bgColor="#ffffff"
                fgColor="#000000"
              />
            </div>

            {/* Destinatario */}
            <div style={{ 
              marginBottom: "2mm",
              padding: "2mm",
              border: "2px solid #000"
            }}>
              <div style={{ fontSize: "7pt", fontWeight: "bold", textTransform: "uppercase", marginBottom: "1mm" }}>
                DESTINATARIO
              </div>
              <div style={{ fontSize: "11pt", fontWeight: "bold", marginBottom: "1mm" }}>
                {pedido.cliente_nombre || "—"}
              </div>
              <div style={{ fontSize: "9pt", lineHeight: "1.3" }}>
                {pedido.direccion_entrega || "—"}
              </div>
              <div style={{ fontSize: "10pt", fontWeight: "bold", marginTop: "1mm" }}>
                Tel: {pedido.client_phone || "—"}
              </div>
            </div>

            {/* Detalles del Contenido */}
            <div style={{ 
              marginBottom: "2mm",
              padding: "1.5mm 2mm",
              border: "1px solid #999"
            }}>
              <span style={{ fontSize: "8pt", fontWeight: "bold" }}>DETALLES: </span>
              <span style={{ fontSize: "8pt" }}>{pedido.producto_nombre || "Paquete estándar"}</span>
            </div>

            {/* Observaciones - Highlighted */}
            {pedido.observaciones && (
              <div style={{ 
                marginBottom: "2mm",
                padding: "2mm",
                border: "2px solid #000",
                backgroundColor: "#f0f0f0"
              }}>
                <div style={{ fontSize: "7pt", fontWeight: "bold", textTransform: "uppercase", marginBottom: "1mm" }}>
                  ⚠️ OBSERVACIONES
                </div>
                <div style={{ fontSize: "9pt", fontWeight: "bold" }}>
                  {pedido.observaciones}
                </div>
              </div>
            )}

            {/* Valor a Recaudar - Destacado */}
            <div style={{ 
              padding: "3mm",
              border: "3px solid #000",
              textAlign: "center",
              marginBottom: "2mm",
              flex: "0 0 auto"
            }}>
              <div style={{ fontSize: "8pt", fontWeight: "bold", textTransform: "uppercase", marginBottom: "1mm" }}>
                TOTAL A RECAUDAR
              </div>
              <div style={{ 
                fontSize: "20pt", 
                fontWeight: "bold",
                letterSpacing: "1px"
              }}>
                {isPagado ? "PAGADO" : `$${pedido.valor_recaudar?.toLocaleString("es-CO") || "0"}`}
              </div>
            </div>

            {/* Pie de página */}
            <div style={{ 
              marginTop: "auto",
              borderTop: "1px solid #999",
              paddingTop: "2mm",
              textAlign: "center"
            }}>
              <div style={{ fontSize: "7pt", fontWeight: "bold", color: "#333" }}>
                Plus Envíos - Carrera 20 # 14-30 local 212 - Tel: 324 222 3825
              </div>
            </div>
          </div>
        </div>

        {/* Actions - Larger touch targets for mobile (min 44px) */}
        <div className="flex gap-3 mt-4">
          <Button 
            variant="outline" 
            className="flex-1 h-12 min-h-[44px] text-base" 
            onClick={handleDownload}
            disabled={isGenerating}
          >
            {isGenerating ? (
              <>
                <Loader2 className="h-5 w-5 mr-2 animate-spin" />
                Generando...
              </>
            ) : (
              <>
                <Download className="h-5 w-5 mr-2" />
                Descargar
              </>
            )}
          </Button>
          <Button 
            className="flex-1 h-12 min-h-[44px] text-base" 
            onClick={handlePrint}
            disabled={isPrinting}
          >
            {isPrinting ? (
              <>
                <Loader2 className="h-5 w-5 mr-2 animate-spin" />
                Imprimiendo...
              </>
            ) : (
              <>
                <Printer className="h-5 w-5 mr-2" />
                Imprimir
              </>
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default PrintGuiaModal;
