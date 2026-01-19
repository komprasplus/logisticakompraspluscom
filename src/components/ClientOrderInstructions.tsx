import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { MessageSquare, Send, X, Loader2, AlertTriangle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

interface ClientOrderInstructionsProps {
  pedidoId: number;
  numeroGuia: string | null;
  tipoNovedad: string | null;
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

const ClientOrderInstructions = ({
  pedidoId,
  numeroGuia,
  tipoNovedad,
  isOpen,
  onClose,
  onSuccess,
}: ClientOrderInstructionsProps) => {
  const [instructions, setInstructions] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    if (!instructions.trim()) {
      toast.error("Por favor escribe las instrucciones");
      return;
    }

    setLoading(true);
    try {
      // Update the order with the client's additional instructions
      // We'll use the corte_horario field to store additional notes temporarily
      // In production, you'd want a dedicated field or notes table
      const { error } = await supabase
        .from("pedidos")
        .update({
          corte_horario: `INSTRUCCIÓN CLIENTE: ${instructions}`,
          fecha_actualizacion: new Date().toISOString(),
        })
        .eq("id", pedidoId);

      if (error) throw error;

      toast.success("Instrucciones enviadas al motorizado");
      setInstructions("");
      onSuccess?.();
      onClose();
    } catch (error) {
      console.error("Error sending instructions:", error);
      toast.error("Error al enviar las instrucciones");
    } finally {
      setLoading(false);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          {/* Backdrop */}
          <motion.div
            className="absolute inset-0 bg-black/50 backdrop-blur-sm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
          />

          {/* Modal */}
          <motion.div
            className="relative w-full max-w-md rounded-2xl bg-card p-6 shadow-elevated"
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
          >
            {/* Close button */}
            <button
              onClick={onClose}
              className="absolute right-4 top-4 rounded-full p-2 hover:bg-muted transition-colors"
            >
              <X className="h-5 w-5 text-muted-foreground" />
            </button>

            {/* Header */}
            <div className="flex items-center gap-3 mb-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 shadow-lg">
                <MessageSquare className="h-6 w-6 text-primary" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-foreground">
                  Instrucciones Adicionales
                </h3>
                <p className="text-sm text-muted-foreground">
                  Guía: {numeroGuia || `#${pedidoId}`}
                </p>
              </div>
            </div>

            {/* Novedad Alert */}
            {tipoNovedad && (
              <div className="mb-4 rounded-xl bg-orange-500/10 border border-orange-500/20 p-3 flex items-start gap-3">
                <AlertTriangle className="h-5 w-5 text-orange-500 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-semibold text-orange-600">Novedad Reportada</p>
                  <p className="text-xs text-orange-600/80">{tipoNovedad}</p>
                </div>
              </div>
            )}

            {/* Instructions Input */}
            <div className="space-y-3">
              <Textarea
                placeholder="Escribe las instrucciones para el motorizado..."
                value={instructions}
                onChange={(e) => setInstructions(e.target.value)}
                className="min-h-[120px] resize-none"
              />
              <p className="text-xs text-muted-foreground">
                Ejemplo: "Dejar con el portero", "Llamar antes de llegar", "Reagendar para mañana"
              </p>
            </div>

            {/* Actions */}
            <div className="mt-6 flex gap-3">
              <Button
                variant="outline"
                className="flex-1"
                onClick={onClose}
                disabled={loading}
              >
                Cancelar
              </Button>
              <Button
                className="flex-1 gap-2"
                onClick={handleSubmit}
                disabled={loading || !instructions.trim()}
              >
                {loading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Send className="h-4 w-4" />
                )}
                Enviar
              </Button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default ClientOrderInstructions;
