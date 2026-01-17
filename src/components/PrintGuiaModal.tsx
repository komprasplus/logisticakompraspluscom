import { useRef } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Printer, Download } from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import { toPng } from "html-to-image";
import { toast } from "sonner";
import logo from "@/assets/logo-kompras-plus.png";

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
}

interface PrintGuiaModalProps {
  pedido: Pedido | null;
  isOpen: boolean;
  onClose: () => void;
  remitente?: string; // Business name of the sender (client)
}

const PrintGuiaModal = ({ pedido, isOpen, onClose, remitente }: PrintGuiaModalProps) => {
  const guiaRef = useRef<HTMLDivElement>(null);

  if (!pedido) return null;

  const handlePrint = () => {
    const printContent = guiaRef.current;
    if (!printContent) return;

    const printWindow = window.open("", "_blank");
    if (!printWindow) {
      toast.error("No se pudo abrir la ventana de impresión");
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
              .guia-label { border: none !important; }
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
    }, 250);
  };

  const handleDownload = async () => {
    if (!guiaRef.current) return;

    try {
      const dataUrl = await toPng(guiaRef.current, { 
        quality: 1, 
        pixelRatio: 3,
        backgroundColor: "#ffffff"
      });
      const link = document.createElement("a");
      link.download = `guia-${pedido.numero_guia || pedido.id}.png`;
      link.href = dataUrl;
      link.click();
      toast.success("Guía descargada");
    } catch (error) {
      console.error("Error generating image:", error);
      toast.error("Error al descargar la guía");
    }
  };

  // Determine city based on zone
  const getCiudad = () => {
    const zona = pedido.zona?.toUpperCase() || "";
    if (zona.includes("SOACHA")) return "Soacha";
    if (zona.includes("FUNZA")) return "Funza";
    if (zona.includes("MOSQUERA")) return "Mosquera";
    if (zona.includes("MADRID")) return "Madrid";
    if (zona.includes("CHIA")) return "Chía";
    if (zona.includes("COTA")) return "Cota";
    if (zona.includes("CAJICA")) return "Cajicá";
    if (zona.includes("ZIPAQUIRA")) return "Zipaquirá";
    if (zona.includes("MUNI")) return "Municipios";
    return "Bogotá D.C.";
  };

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return new Date().toLocaleDateString("es-CO");
    return new Date(dateStr).toLocaleDateString("es-CO", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit"
    });
  };

  const ciudad = getCiudad();

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
            style={{
              width: "10cm",
              minHeight: "15cm",
              padding: "8mm",
              backgroundColor: "#ffffff",
              fontFamily: "Arial, Helvetica, sans-serif",
              border: "1px solid #000",
              boxSizing: "border-box",
            }}
          >
            {/* Header - Logo, Guide Number, Date */}
            <div style={{ 
              display: "flex", 
              justifyContent: "space-between", 
              alignItems: "flex-start",
              borderBottom: "2px solid #000",
              paddingBottom: "3mm",
              marginBottom: "3mm"
            }}>
              <img 
                src={logo} 
                alt="Kompras Plus" 
                style={{ height: "10mm", filter: "grayscale(100%)" }} 
              />
              <div style={{ textAlign: "right" }}>
                <div style={{ 
                  fontSize: "6pt", 
                  color: "#666",
                  textTransform: "uppercase",
                  letterSpacing: "0.5px"
                }}>
                  Guía N°
                </div>
                <div style={{ 
                  fontSize: "14pt", 
                  fontWeight: "bold",
                  letterSpacing: "1px"
                }}>
                  {pedido.numero_guia || `KP-${pedido.id}`}
                </div>
                <div style={{ fontSize: "7pt", color: "#444" }}>
                  {formatDate(pedido.fecha_creacion)}
                </div>
              </div>
            </div>

            {/* QR Code - Centered, Large */}
            <div style={{ 
              display: "flex", 
              justifyContent: "center", 
              padding: "4mm 0",
              borderBottom: "1px dashed #999",
              marginBottom: "3mm"
            }}>
              <QRCodeSVG
                value={`PEDIDO:${pedido.id}`}
                size={150}
                level="H"
                bgColor="#ffffff"
                fgColor="#000000"
              />
            </div>

            {/* Remitente (Sender) */}
            <div style={{ 
              marginBottom: "3mm",
              padding: "2mm",
              border: "1px solid #999"
            }}>
              <div style={{ 
                fontSize: "6pt", 
                color: "#666", 
                textTransform: "uppercase",
                marginBottom: "1mm"
              }}>
                Remitente
              </div>
              <div style={{ fontSize: "9pt", fontWeight: "bold" }}>
                {remitente || "Kompras Plus"}
              </div>
            </div>

            {/* Destinatario (Recipient) */}
            <div style={{ 
              marginBottom: "3mm",
              padding: "2mm",
              border: "2px solid #000"
            }}>
              <div style={{ 
                fontSize: "6pt", 
                color: "#666", 
                textTransform: "uppercase",
                marginBottom: "1mm"
              }}>
                Destinatario
              </div>
              <div style={{ fontSize: "11pt", fontWeight: "bold", marginBottom: "1mm" }}>
                {pedido.cliente_nombre || "—"}
              </div>
              <div style={{ fontSize: "9pt", color: "#333" }}>
                Tel: {pedido.client_phone || "—"}
              </div>
            </div>

            {/* Ubicación (Location) */}
            <div style={{ 
              marginBottom: "3mm",
              padding: "2mm",
              border: "1px solid #999"
            }}>
              <div style={{ 
                fontSize: "6pt", 
                color: "#666", 
                textTransform: "uppercase",
                marginBottom: "1mm"
              }}>
                Dirección de Entrega
              </div>
              <div style={{ fontSize: "9pt", fontWeight: "600", lineHeight: "1.3" }}>
                {pedido.direccion_entrega || "—"}
              </div>
            </div>

            {/* Barrio and Ciudad */}
            <div style={{ 
              display: "flex", 
              gap: "2mm", 
              marginBottom: "3mm" 
            }}>
              <div style={{ 
                flex: 1, 
                padding: "2mm", 
                border: "1px solid #999"
              }}>
                <div style={{ 
                  fontSize: "6pt", 
                  color: "#666", 
                  textTransform: "uppercase",
                  marginBottom: "1mm"
                }}>
                  Barrio
                </div>
                <div style={{ fontSize: "8pt", fontWeight: "600" }}>
                  {pedido.barrio || "—"}
                </div>
              </div>
              <div style={{ 
                flex: 1, 
                padding: "2mm", 
                border: "1px solid #999"
              }}>
                <div style={{ 
                  fontSize: "6pt", 
                  color: "#666", 
                  textTransform: "uppercase",
                  marginBottom: "1mm"
                }}>
                  Ciudad
                </div>
                <div style={{ fontSize: "8pt", fontWeight: "600" }}>
                  {ciudad}
                </div>
              </div>
            </div>

            {/* Detalles del Paquete (Package Details) */}
            <div style={{ 
              marginBottom: "3mm",
              padding: "2mm",
              border: "1px solid #999"
            }}>
              <div style={{ 
                fontSize: "6pt", 
                color: "#666", 
                textTransform: "uppercase",
                marginBottom: "1mm"
              }}>
                Detalles del Paquete
              </div>
              <div style={{ fontSize: "8pt", fontWeight: "500" }}>
                {pedido.producto_nombre || "Paquete estándar"}
              </div>
            </div>

            {/* Valor a Recaudar - Black border box, no fill */}
            <div style={{ 
              padding: "4mm",
              border: "3px solid #000",
              textAlign: "center",
              marginBottom: "3mm"
            }}>
              <div style={{ 
                fontSize: "7pt", 
                color: "#444", 
                textTransform: "uppercase",
                marginBottom: "2mm",
                fontWeight: "bold"
              }}>
                Valor a Recaudar
              </div>
              <div style={{ 
                fontSize: "22pt", 
                fontWeight: "bold",
                letterSpacing: "1px"
              }}>
                {pedido.metodo_pago === "anticipado" ? (
                  "PAGADO"
                ) : (
                  `$${pedido.valor_recaudar?.toLocaleString("es-CO") || "0"}`
                )}
              </div>
            </div>

            {/* Footer */}
            <div style={{ 
              borderTop: "1px dashed #999",
              paddingTop: "2mm",
              textAlign: "center"
            }}>
              <div style={{ fontSize: "7pt", color: "#444", fontWeight: "500" }}>
                Kompras Plus - Tu aliado de última milla
              </div>
              <div style={{ fontSize: "7pt", color: "#666" }}>
                Tel: 324 222 3825 | www.komprasplus.com
              </div>
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-3 mt-4">
          <Button variant="outline" className="flex-1" onClick={handleDownload}>
            <Download className="h-4 w-4 mr-2" />
            Descargar
          </Button>
          <Button className="flex-1" onClick={handlePrint}>
            <Printer className="h-4 w-4 mr-2" />
            Imprimir
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default PrintGuiaModal;
