import { useState } from "react";
import { XCircle, Loader2, AlertTriangle } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

interface Pedido {
  id: number;
  numero_guia: string | null;
  cliente_nombre: string | null;
  client_phone: string | null;
}

interface CancelOrderModalProps {
  pedido: Pedido | null;
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (pedidoId: number) => Promise<void>;
}

const CancelOrderModal = ({ pedido, isOpen, onClose, onConfirm }: CancelOrderModalProps) => {
  const [isLoading, setIsLoading] = useState(false);

  const handleConfirm = async () => {
    if (!pedido) return;
    
    setIsLoading(true);
    try {
      await onConfirm(pedido.id);
      onClose();
    } catch (error) {
      console.error("Error cancelling order:", error);
    } finally {
      setIsLoading(false);
    }
  };

  if (!pedido) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-destructive">
            <AlertTriangle className="h-5 w-5" />
            Anular Pedido
          </DialogTitle>
          <DialogDescription className="pt-2">
            ¿Deseas anular este pedido? Se notificará al cliente.
          </DialogDescription>
        </DialogHeader>

        <div className="rounded-lg bg-muted/50 p-4 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Número de Guía:</span>
            <span className="font-semibold text-foreground">
              {pedido.numero_guia || `#${pedido.id}`}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Cliente:</span>
            <span className="font-medium text-foreground">
              {pedido.cliente_nombre || "Sin nombre"}
            </span>
          </div>
        </div>

        <div className="rounded-lg bg-orange-50 dark:bg-orange-950/30 border border-orange-200 dark:border-orange-800 p-3">
          <p className="text-sm text-orange-800 dark:text-orange-200">
            ⚠️ Esta acción es irreversible. El pedido dejará de aparecer en el mapa 
            y en la lista del motorizado. El cliente recibirá una notificación.
          </p>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button
            type="button"
            variant="outline"
            onClick={onClose}
            disabled={isLoading}
          >
            Cancelar
          </Button>
          <Button
            type="button"
            variant="destructive"
            onClick={handleConfirm}
            disabled={isLoading}
            className="gap-2"
          >
            {isLoading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Anulando...
              </>
            ) : (
              <>
                <XCircle className="h-4 w-4" />
                Confirmar Anulación
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default CancelOrderModal;
