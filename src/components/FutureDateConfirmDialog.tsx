import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { CalendarClock } from "lucide-react";
import { formatDeliveryDateLong } from "@/lib/dateUtils";

interface FutureDateConfirmDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  fechaEntrega: string | null;
  numeroGuia?: string | null;
}

/**
 * Confirmation dialog shown when assigning a courier to an order
 * that has a future delivery date.
 */
const FutureDateConfirmDialog = ({
  isOpen,
  onClose,
  onConfirm,
  fechaEntrega,
  numeroGuia,
}: FutureDateConfirmDialogProps) => {
  const formattedDate = formatDeliveryDateLong(fechaEntrega);

  return (
    <AlertDialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2">
            <CalendarClock className="h-5 w-5 text-amber-500" />
            Despacho Anticipado
          </AlertDialogTitle>
          <AlertDialogDescription className="text-base">
            {numeroGuia ? (
              <>
                El pedido <span className="font-semibold text-foreground">{numeroGuia}</span> está programado para el{" "}
                <span className="font-semibold text-foreground">{formattedDate}</span>.
              </>
            ) : (
              <>
                Este pedido está programado para el{" "}
                <span className="font-semibold text-foreground">{formattedDate}</span>.
              </>
            )}
            <br />
            <br />
            ¿Confirmas que quieres despacharlo hoy?
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={onClose}>Cancelar</AlertDialogCancel>
          <AlertDialogAction onClick={onConfirm} className="bg-primary">
            Sí, despachar hoy
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
};

export default FutureDateConfirmDialog;
