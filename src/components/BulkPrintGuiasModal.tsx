import { useRef, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Printer, Loader2 } from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import { toast } from "sonner";
import { Progress } from "@/components/ui/progress";
const logo = "/logo-oficial.png";

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

interface BulkPrintGuiasModalProps {
  pedidos: Pedido[];
  isOpen: boolean;
  onClose: () => void;
  remitentes?: Record<string, string>; // client_user_id -> store_name
  onPrintComplete?: (pedidoIds: number[]) => void;
}

const BulkPrintGuiasModal = ({ pedidos, isOpen, onClose, remitentes = {}, onPrintComplete }: BulkPrintGuiasModalProps) => {
  const guiasRef = useRef<HTMLDivElement>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [progress, setProgress] = useState(0);
  const showProgressBar = pedidos.length > 10;

  const formatDate = () => {
    return new Date().toLocaleDateString("es-CO", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit"
    });
  };

  const handlePrint = async () => {
    const printContent = guiasRef.current;
    if (!printContent) return;

    setIsGenerating(true);
    setProgress(0);

    // Simulate progress for user feedback on large batches
    if (showProgressBar) {
      const progressInterval = setInterval(() => {
        setProgress((prev) => {
          if (prev >= 90) {
            clearInterval(progressInterval);
            return 90;
          }
          return prev + 10;
        });
      }, 100);
    }

    try {
      const printWindow = window.open("", "_blank");
      if (!printWindow) {
        toast.error("No se pudo abrir la ventana de impresión");
        setIsGenerating(false);
        setProgress(0);
        return;
      }

      printWindow.document.write(`
        <!DOCTYPE html>
        <html>
          <head>
            <title>Guías de Envío (${pedidos.length})</title>
            <style>
              * { margin: 0; padding: 0; box-sizing: border-box; }
              html, body {
                width: 10cm;
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
              .guia-container {
                page-break-after: always;
                page-break-inside: avoid;
                break-inside: avoid;
              }
              .guia-container:last-child {
                page-break-after: auto;
              }
              @media print {
                html, body {
                  width: 10cm;
                  margin: 0;
                  padding: 0;
                }
                .guia-container {
                  border: none !important;
                  width: 10cm !important;
                  height: 15cm !important;
                  max-height: 15cm !important;
                  overflow: hidden !important;
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

      setProgress(100);

      setTimeout(() => {
        printWindow.print();
        printWindow.close();
        
        // Notify parent that print was completed
        if (onPrintComplete) {
          onPrintComplete(pedidos.map(p => p.id));
        }
        
        setIsGenerating(false);
        setProgress(0);
        toast.success(`${pedidos.length} guías enviadas a impresión`);
      }, 250);
    } catch (error) {
      console.error("Error printing:", error);
      toast.error("Error al imprimir las guías");
      setIsGenerating(false);
      setProgress(0);
    }
  };

  // Early return after hooks
  if (pedidos.length === 0) return null;

  const GuiaItem = ({ pedido, remitente }: { pedido: Pedido; remitente?: string }) => {
    const guiaNumero = pedido.numero_guia || `KP-${pedido.id}`;
    const isPagado = pedido.metodo_pago === "anticipado";

    return (
      <div
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
        {/* Header - Logo, Guía, Fecha */}
        <div style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          borderBottom: "1.5px solid #000",
          paddingBottom: "1.5mm",
          marginBottom: "1.5mm"
        }}>
          <img
            src={logo}
            alt="Plus Envios"
            style={{ height: "7mm", filter: "grayscale(100%)" }}
          />
          <div style={{ textAlign: "right" }}>
            <div style={{
              fontSize: "11pt",
              fontWeight: "bold",
              lineHeight: "1.1"
            }}>
              GUÍA N°: {guiaNumero}
            </div>
            <div style={{ fontSize: "7pt", color: "#333" }}>
              FECHA: {formatDate()}
            </div>
          </div>
        </div>

        {/* Zona y Barrio */}
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

        {/* Remitente */}
        <div style={{
          marginBottom: "1.5mm",
          padding: "1mm 1.5mm",
          borderBottom: "1px solid #999"
        }}>
          <span style={{ fontSize: "7pt", fontWeight: "bold" }}>REMITENTE: </span>
          <span style={{ fontSize: "7pt" }}>{remitente || "Kompras Plus"}</span>
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

        {/* Detalles - inline / wrap compacto */}
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
            {isPagado ? "PAGADO" : `$${pedido.valor_recaudar?.toLocaleString("es-CO") || "0"}`}
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
    );
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>Imprimir {pedidos.length} Guías de Envío</DialogTitle>
        </DialogHeader>

        {/* Preview - Scrollable */}
        <div className="flex-1 overflow-auto bg-muted p-4 rounded-lg">
          <div ref={guiasRef} className="flex flex-col gap-4 items-center">
            {pedidos.map((pedido) => {
              // Get remitente from the pedido's client_user_id
              const remitente = (pedido as any).client_user_id ? remitentes[(pedido as any).client_user_id] : undefined;
              return (
                <div key={pedido.id} className="shadow-lg">
                  <GuiaItem pedido={pedido} remitente={remitente} />
                </div>
              );
            })}
          </div>
        </div>

        {/* Progress indicator for large batches */}
        {isGenerating && showProgressBar && (
          <div className="space-y-2 py-2">
            <div className="flex items-center justify-between text-sm text-muted-foreground">
              <span>Preparando {pedidos.length} guías...</span>
              <span>{progress}%</span>
            </div>
            <Progress value={progress} className="h-2" />
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-3 mt-4 pt-4 border-t">
          <Button variant="outline" className="flex-1" onClick={onClose} disabled={isGenerating}>
            Cancelar
          </Button>
          <Button className="flex-1" onClick={handlePrint} disabled={isGenerating}>
            {isGenerating ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Procesando...
              </>
            ) : (
              <>
                <Printer className="h-4 w-4 mr-2" />
                Imprimir {pedidos.length} Guías
              </>
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default BulkPrintGuiasModal;
