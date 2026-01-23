import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Phone, MessageCircle, Copy, CheckCircle2, X, QrCode, Info } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

interface QRPaymentModalProps {
  isOpen: boolean;
  onClose: () => void;
  amount?: number;
  orderId?: number;
  clientName?: string;
}

const SUPPORT_PHONE = "3242223825";
const SUPPORT_WHATSAPP = "573242223825";

const QRPaymentModal = ({ 
  isOpen, 
  onClose, 
  amount = 0,
  orderId,
  clientName 
}: QRPaymentModalProps) => {
  const [copied, setCopied] = useState(false);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("es-CO", {
      style: "currency",
      currency: "COP",
      minimumFractionDigits: 0,
    }).format(value);
  };

  const handleCallSupport = () => {
    window.open(`tel:+57${SUPPORT_PHONE}`, "_self");
  };

  const handleWhatsAppSupport = () => {
    const message = encodeURIComponent(
      `🏍️ *CONFIRMACIÓN DE TRANSFERENCIA*\n\n` +
      `Hola, soy motorizado de Plus Envíos.\n\n` +
      `📦 Pedido #${orderId || "N/A"}\n` +
      `👤 Cliente: ${clientName || "N/A"}\n` +
      `💰 Monto: ${formatCurrency(amount)}\n\n` +
      `El cliente acaba de hacer la transferencia. Por favor confirmar recepción.`
    );
    window.open(`https://wa.me/${SUPPORT_WHATSAPP}?text=${message}`, "_blank");
  };

  const handleCopyAmount = () => {
    navigator.clipboard.writeText(amount.toString());
    setCopied(true);
    toast.success("Monto copiado al portapapeles");
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-md mx-auto p-0 overflow-hidden bg-white z-[10010]">
        <DialogHeader className="sr-only">
          <DialogTitle>Pago con QR</DialogTitle>
        </DialogHeader>
        
        {/* Header with gradient */}
        <div className="bg-gradient-to-br from-rose-500 via-pink-500 to-purple-600 p-6 text-white relative">
          <button
            onClick={onClose}
            className="absolute top-3 right-3 p-2 rounded-full bg-white/20 hover:bg-white/30 transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
          
          <div className="flex items-center gap-2 mb-2">
            <QrCode className="h-6 w-6" />
            <h2 className="text-xl font-bold">Escanea el QR</h2>
          </div>
          <p className="text-white/90 text-sm">
            Paga desde la app de cualquier entidad.
          </p>
        </div>

        {/* QR Code Image */}
        <div className="p-6 flex flex-col items-center">
          <div className="bg-white rounded-2xl shadow-lg p-4 mb-4">
            <img
              src="/qr-pago-bold.jpeg"
              alt="Código QR para pago"
              className="w-64 h-auto rounded-lg"
              onError={(e) => {
                (e.target as HTMLImageElement).src = "/placeholder.svg";
              }}
            />
          </div>
          
          <p className="text-lg font-semibold text-foreground mb-1">
            Juan Gabriel Carranza Velasquez
          </p>
          
          {amount > 0 && (
            <motion.div 
              className="flex items-center gap-2 bg-muted rounded-lg px-4 py-2 mt-2"
              initial={{ scale: 0.9 }}
              animate={{ scale: 1 }}
            >
              <span className="text-sm text-muted-foreground">Monto a pagar:</span>
              <span className="text-xl font-bold text-primary">
                {formatCurrency(amount)}
              </span>
              <button
                onClick={handleCopyAmount}
                className="p-1.5 rounded-md hover:bg-muted-foreground/10 transition-colors"
              >
                {copied ? (
                  <CheckCircle2 className="h-4 w-4 text-green-500" />
                ) : (
                  <Copy className="h-4 w-4 text-muted-foreground" />
                )}
              </button>
            </motion.div>
          )}
        </div>

        {/* Info Box */}
        <div className="mx-6 mb-4 bg-blue-50 rounded-xl p-4 border border-blue-100">
          <div className="flex gap-3">
            <Info className="h-5 w-5 text-blue-500 flex-shrink-0 mt-0.5" />
            <div className="text-sm text-blue-700">
              <p className="font-medium mb-1">El monto máximo que puedes pagar por medio de este QR es $10.000.000.</p>
            </div>
          </div>
        </div>

        {/* Instructions */}
        <div className="px-6 pb-2 space-y-3">
          <div className="flex items-center gap-3 text-sm">
            <div className="h-10 w-10 rounded-full bg-muted flex items-center justify-center flex-shrink-0">
              <span className="text-lg">📱</span>
            </div>
            <div>
              <p className="font-medium text-foreground">Ingresa</p>
              <p className="text-muted-foreground text-xs">Ingresa a la app de tu banco.</p>
            </div>
          </div>
          
          <div className="flex items-center gap-3 text-sm">
            <div className="h-10 w-10 rounded-full bg-muted flex items-center justify-center flex-shrink-0">
              <span className="text-lg">📷</span>
            </div>
            <div>
              <p className="font-medium text-foreground">Escanea</p>
              <p className="text-muted-foreground text-xs">Busca la opción de escanear QR.</p>
            </div>
          </div>
          
          <div className="flex items-center gap-3 text-sm">
            <div className="h-10 w-10 rounded-full bg-muted flex items-center justify-center flex-shrink-0">
              <span className="text-lg">💵</span>
            </div>
            <div>
              <p className="font-medium text-foreground">Paga</p>
              <p className="text-muted-foreground text-xs">Verifica los datos y paga.</p>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="p-6 pt-4 space-y-3 border-t border-border mt-4">
          <Button
            onClick={handleWhatsAppSupport}
            className="w-full bg-green-500 hover:bg-green-600 text-white gap-2 h-12 text-base font-semibold"
          >
            <MessageCircle className="h-5 w-5" />
            Confirmar transferencia con Base
          </Button>
          
          <Button
            onClick={handleCallSupport}
            variant="outline"
            className="w-full gap-2 h-11"
          >
            <Phone className="h-4 w-4" />
            Llamar a Bodega Carrera 20
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default QRPaymentModal;
