import { useRef, useEffect, useState, useCallback } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Printer, Download, Loader2 } from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import { toPng } from "html-to-image";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
const defaultLogo = "/logo-oficial.png";

type StoreCacheEntry = {
  logo_url: string | null;
  store_name: string | null;
  at: number;
};

const formatTodayDate = () => {
  return new Date().toLocaleDateString("es-CO", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
};

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

  // Cache to avoid repeated DB queries when opening/closing the modal frequently
  const storeCacheRef = useRef<Record<string, StoreCacheEntry>>({});

  // Fetch store logo if pedido has client_user_id
  useEffect(() => {
    let isMounted = true;

    const userId = pedido?.client_user_id ?? null;

    const fetchStoreLogo = async () => {
      if (!userId) {
        if (isMounted) {
          setStoreLogo(null);
          setStoreName(null);
        }
        return;
      }

      // Serve from cache when possible (reduces Supabase CPU + network)
      const cached = storeCacheRef.current[userId];
      const CACHE_TTL_MS = 10 * 60 * 1000; // 10 minutes
      if (cached && Date.now() - cached.at < CACHE_TTL_MS) {
        if (isMounted) {
          setStoreLogo(cached.logo_url);
          setStoreName(cached.store_name);
        }
        return;
      }

      try {
        const { data: profile, error } = await supabase
          .from("profiles")
          .select("logo_url, store_name")
          .eq("user_id", userId)
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

        storeCacheRef.current[userId] = {
          logo_url: profile?.logo_url || null,
          store_name: profile?.store_name || null,
          at: Date.now(),
        };
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
  }, [isOpen, pedido?.client_user_id]);

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
              html, body {
                width: 10cm;
                height: 15cm;
              }
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
                html, body {
                  width: 10cm;
                  height: 15cm;
                  margin: 0;
                  padding: 0;
                  overflow: hidden;
                }
                .guia-container {
                  border: none !important;
                  width: 10cm !important;
                  height: 15cm !important;
                  max-height: 15cm !important;
                  overflow: hidden !important;
                  page-break-inside: avoid !important;
                  page-break-after: avoid !important;
                  break-inside: avoid !important;
                  box-sizing: border-box !important;
                }
                .print-hidden { display: none !important; }
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

  // Use memoized values computed above (after hooks, before render)
  const finalGuiaNumero = pedido.numero_guia || `KP-${pedido.id}`;
  const finalIsPagado = pedido.metodo_pago === "anticipado";
  const finalDisplayStoreName = storeName || remitente || "Kompras Plus";
  const finalDisplayLogo = storeLogo || defaultLogo;

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
              maxHeight: "15cm",
              padding: "2.5mm",
              backgroundColor: "#ffffff",
              fontFamily: "Arial, Helvetica, sans-serif",
              border: "1px solid #000",
              boxSizing: "border-box",
              display: "flex",
              flexDirection: "column",
              overflow: "hidden",
            }}
          >
            {/* Fila 1: Header - Store Logo & Guía Number */}
            <div style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              borderBottom: "1.5px solid #000",
              paddingBottom: "1.5mm",
              marginBottom: "1.5mm"
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: "1.5mm" }}>
                <img
                  src={finalDisplayLogo}
                  alt={finalDisplayStoreName}
                  style={{
                    height: "9mm",
                    maxWidth: "30mm",
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
                  fontSize: "11pt",
                  fontWeight: "bold",
                  lineHeight: "1.1"
                }}>
                  GUÍA N°: {finalGuiaNumero}
                </div>
                <div style={{ fontSize: "7pt", color: "#333" }}>
                  FECHA: {formatTodayDate()}
                </div>
              </div>
            </div>

            {/* Fila 2: Store Name */}
            <div style={{
              backgroundColor: "#000",
              color: "#fff",
              padding: "1mm 2mm",
              marginBottom: "1.5mm",
              textAlign: "center"
            }}>
              <div style={{
                fontSize: "11pt",
                fontWeight: "bold",
                textTransform: "uppercase",
                letterSpacing: "0.3px",
                lineHeight: "1.1"
              }}>
                {finalDisplayStoreName}
              </div>
            </div>

            {/* Fila 3: Zona y Barrio */}
            <div style={{
              display: "flex",
              gap: "1.5mm",
              marginBottom: "1.5mm"
            }}>
              <div style={{
                flex: 1,
                padding: "1mm",
                border: "1.5px solid #000",
                textAlign: "center"
              }}>
                <div style={{ fontSize: "6pt", fontWeight: "bold", textTransform: "uppercase" }}>
                  ZONA
                </div>
                <div style={{ fontSize: "10pt", fontWeight: "bold", lineHeight: "1.1" }}>
                  {pedido.zona || "—"}
                </div>
              </div>
              <div style={{
                flex: 1,
                padding: "1mm",
                border: "1.5px solid #000",
                textAlign: "center"
              }}>
                <div style={{ fontSize: "6pt", fontWeight: "bold", textTransform: "uppercase" }}>
                  BARRIO
                </div>
                <div style={{ fontSize: "9pt", fontWeight: "bold", lineHeight: "1.1" }}>
                  {pedido.barrio || "—"}
                </div>
              </div>
            </div>

            {/* QR Code - Compacto */}
            <div style={{
              display: "flex",
              justifyContent: "center",
              padding: "1mm 0",
              marginBottom: "1.5mm"
            }}>
              <QRCodeSVG
                value={`PEDIDO:${pedido.id}`}
                size={75}
                level="H"
                bgColor="#ffffff"
                fgColor="#000000"
              />
            </div>

            {/* Destinatario */}
            <div style={{
              marginBottom: "1.5mm",
              padding: "1.5mm",
              border: "1.5px solid #000"
            }}>
              <div style={{ fontSize: "6pt", fontWeight: "bold", textTransform: "uppercase", marginBottom: "0.5mm" }}>
                DESTINATARIO
              </div>
              <div style={{ fontSize: "10pt", fontWeight: "bold", marginBottom: "0.5mm", lineHeight: "1.15" }}>
                {pedido.cliente_nombre || "—"}
              </div>
              <div style={{ fontSize: "8pt", lineHeight: "1.2" }}>
                {pedido.direccion_entrega || "—"}
              </div>
              <div style={{ fontSize: "9pt", fontWeight: "bold", marginTop: "0.5mm" }}>
                Tel: {pedido.client_phone || "—"}
              </div>
            </div>

            {/* Detalles - inline / wrap compacto para multi-variantes */}
            <div style={{
              marginBottom: "1.5mm",
              padding: "1mm 1.5mm",
              border: "1px solid #999"
            }}>
              <span style={{ fontSize: "7pt", fontWeight: "bold" }}>DETALLES: </span>
              <span style={{
                fontSize: "7pt",
                lineHeight: "1.2",
                display: "inline",
                wordBreak: "break-word",
              }}>
                {pedido.producto_nombre || "Paquete estándar"}
              </span>
            </div>

            {/* Observaciones */}
            {pedido.observaciones && (
              <div style={{
                marginBottom: "1.5mm",
                padding: "1.5mm",
                border: "1.5px solid #000",
                backgroundColor: "#f0f0f0"
              }}>
                <div style={{ fontSize: "6pt", fontWeight: "bold", textTransform: "uppercase", marginBottom: "0.5mm" }}>
                  ⚠️ OBSERVACIONES
                </div>
                <div style={{ fontSize: "8pt", fontWeight: "bold", lineHeight: "1.2" }}>
                  {pedido.observaciones}
                </div>
              </div>
            )}

            {/* Valor a Recaudar */}
            <div style={{
              padding: "1.5mm",
              border: "2.5px solid #000",
              textAlign: "center",
              marginBottom: "1.5mm",
              flex: "0 0 auto"
            }}>
              <div style={{ fontSize: "7pt", fontWeight: "bold", textTransform: "uppercase", marginBottom: "0.5mm" }}>
                TOTAL A RECAUDAR
              </div>
              <div style={{
                fontSize: "16pt",
                fontWeight: "bold",
                letterSpacing: "0.5px",
                lineHeight: "1.1"
              }}>
                {finalIsPagado ? "PAGADO" : `$${pedido.valor_recaudar?.toLocaleString("es-CO") || "0"}`}
              </div>
            </div>

            {/* Pie de página */}
            <div style={{
              marginTop: "auto",
              borderTop: "1px solid #999",
              paddingTop: "1mm",
              textAlign: "center"
            }}>
              <div style={{ fontSize: "6pt", fontWeight: "bold", color: "#333" }}>
                Plus Envíos - Calle 14 # 19-64 Bodega 403 - Tel: 324 222 3825
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
