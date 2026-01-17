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
  remitente?: string;
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

  const formatDate = () => {
    return new Date().toLocaleDateString("es-CO", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit"
    });
  };

  const guiaNumero = pedido.numero_guia || `KP-${pedido.id}`;
  const isPagado = pedido.metodo_pago === "anticipado";

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
            {/* Fila 1: Header - Logo, Guía, Fecha */}
            <div style={{ 
              display: "flex", 
              justifyContent: "space-between", 
              alignItems: "center",
              borderBottom: "2px solid #000",
              paddingBottom: "2mm",
              marginBottom: "2mm"
            }}>
              <img 
                src={logo} 
                alt="Kompras Plus" 
                style={{ height: "8mm", filter: "grayscale(100%)" }} 
              />
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

            {/* Fila 2: Zona y Barrio destacados */}
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

            {/* Remitente */}
            <div style={{ 
              marginBottom: "2mm",
              padding: "1.5mm 2mm",
              borderBottom: "1px solid #999"
            }}>
              <span style={{ fontSize: "8pt", fontWeight: "bold" }}>REMITENTE: </span>
              <span style={{ fontSize: "8pt" }}>{remitente || "Kompras Plus"}</span>
            </div>

            {/* QR Code - Centered, 4x4cm max */}
            <div style={{ 
              display: "flex", 
              justifyContent: "center", 
              padding: "2mm 0",
              marginBottom: "2mm"
            }}>
              <QRCodeSVG
                value={`PEDIDO:${pedido.id}`}
                size={113} // ~4cm at 72dpi (4 * 28.35 ≈ 113px)
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
                Kompras Plus - Carrera 20 # 14-30 local 212 - Tel: 324 222 3825
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
