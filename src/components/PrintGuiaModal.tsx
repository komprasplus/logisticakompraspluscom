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
  direccion_entrega: string | null;
  barrio: string | null;
  zona: string | null;
  valor_recaudar: number | null;
  metodo_pago: string | null;
}

interface PrintGuiaModalProps {
  pedido: Pedido | null;
  isOpen: boolean;
  onClose: () => void;
}

const PrintGuiaModal = ({ pedido, isOpen, onClose }: PrintGuiaModalProps) => {
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
            body { font-family: Arial, sans-serif; }
            .guia-label {
              width: 10cm;
              height: 15cm;
              padding: 12px;
              border: 2px solid #000;
              background: #fff;
            }
            .header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px; padding-bottom: 12px; border-bottom: 2px dashed #ccc; }
            .logo { height: 32px; }
            .guia-number { font-size: 14px; font-weight: bold; }
            .qr-section { display: flex; justify-content: center; margin: 16px 0; }
            .info-section { margin-bottom: 12px; padding: 8px; border: 1px solid #e5e5e5; border-radius: 4px; }
            .info-label { font-size: 10px; color: #666; text-transform: uppercase; margin-bottom: 2px; }
            .info-value { font-size: 14px; font-weight: 600; }
            .address-value { font-size: 12px; font-weight: 600; }
            .valor-section { background: #f3f4f6; padding: 12px; border-radius: 4px; text-align: center; }
            .valor-label { font-size: 10px; color: #666; }
            .valor-amount { font-size: 24px; font-weight: bold; color: #16a34a; }
            .footer { margin-top: 12px; padding-top: 12px; border-top: 2px dashed #ccc; text-align: center; font-size: 10px; color: #666; }
            @media print {
              body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
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
      const dataUrl = await toPng(guiaRef.current, { quality: 1, pixelRatio: 2 });
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

  const ciudad = pedido.zona?.includes("MUNI") ? "Municipios" : "Bogotá D.C.";

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Guía de Envío</DialogTitle>
        </DialogHeader>

        {/* Preview */}
        <div className="flex justify-center bg-muted p-4 rounded-lg overflow-auto">
          <div
            ref={guiaRef}
            className="guia-label bg-white border-2 border-foreground p-3 w-[10cm] min-h-[15cm]"
            style={{ fontFamily: "Arial, sans-serif" }}
          >
            {/* Header */}
            <div className="flex items-center justify-between pb-3 mb-3 border-b-2 border-dashed border-muted">
              <img src={logo} alt="Kompras Plus" className="h-8" />
              <div className="text-right">
                <p className="text-xs text-muted-foreground">GUÍA N°</p>
                <p className="text-sm font-bold">{pedido.numero_guia || `KP-${pedido.id}`}</p>
              </div>
            </div>

            {/* QR Code */}
            <div className="flex justify-center my-4">
              <QRCodeSVG
                value={`PEDIDO:${pedido.id}`}
                size={140}
                level="H"
                includeMargin
              />
            </div>

            {/* Destinatario */}
            <div className="mb-3 p-2 border border-border rounded">
              <p className="text-[10px] text-muted-foreground uppercase mb-1">Destinatario</p>
              <p className="text-sm font-semibold">{pedido.cliente_nombre || "—"}</p>
            </div>

            {/* Dirección */}
            <div className="mb-3 p-2 border border-border rounded">
              <p className="text-[10px] text-muted-foreground uppercase mb-1">Dirección</p>
              <p className="text-xs font-semibold leading-tight">{pedido.direccion_entrega || "—"}</p>
            </div>

            {/* Barrio y Ciudad */}
            <div className="grid grid-cols-2 gap-2 mb-3">
              <div className="p-2 border border-border rounded">
                <p className="text-[10px] text-muted-foreground uppercase mb-1">Barrio</p>
                <p className="text-xs font-semibold">{pedido.barrio || "—"}</p>
              </div>
              <div className="p-2 border border-border rounded">
                <p className="text-[10px] text-muted-foreground uppercase mb-1">Ciudad</p>
                <p className="text-xs font-semibold">{ciudad}</p>
              </div>
            </div>

            {/* Valor a Recaudar */}
            <div className="bg-accent p-3 rounded text-center">
              <p className="text-[10px] text-muted-foreground uppercase">Valor a Recaudar</p>
              <p className="text-2xl font-bold text-green-600">
                {pedido.metodo_pago === "anticipado" ? (
                  <span className="text-primary">PAGADO</span>
                ) : (
                  `$${pedido.valor_recaudar?.toLocaleString("es-CO") || "0"}`
                )}
              </p>
            </div>

            {/* Footer */}
            <div className="mt-3 pt-3 border-t-2 border-dashed border-muted text-center">
              <p className="text-[10px] text-muted-foreground">Kompras Plus - Tu aliado de última milla</p>
              <p className="text-[10px] text-muted-foreground">Tel: 324 222 3825</p>
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
