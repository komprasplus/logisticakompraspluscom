import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Loader2, Trash2, AlertTriangle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";

interface Profile {
  id: string;
  user_id: string;
  full_name: string;
  email: string | null;
}

interface DeleteUserModalProps {
  isOpen: boolean;
  onClose: () => void;
  onUserDeleted: () => void;
  user: Profile | null;
}

const DeleteUserModal = ({ isOpen, onClose, onUserDeleted, user }: DeleteUserModalProps) => {
  const [confirmText, setConfirmText] = useState("");
  const [loading, setLoading] = useState(false);

  const isConfirmValid = confirmText === "ELIMINAR";

  const handleDelete = async () => {
    if (!user || !isConfirmValid) return;

    setLoading(true);

    try {
      const { data, error } = await supabase.rpc('delete_user_completely', {
        target_user_id: user.user_id,
      });

      if (error) throw error;

      toast.success(`Usuario ${user.full_name} eliminado completamente (auth + perfil)`);
      onUserDeleted();
      handleClose();
    } catch (error: any) {
      console.error("Error deleting user:", error);
      toast.error(error.message || "Error al eliminar el usuario");
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setConfirmText("");
    onClose();
  };

  if (!user) return null;

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4"
          onClick={(e) => e.target === e.currentTarget && handleClose()}
        >
          <motion.div
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.95, opacity: 0 }}
            className="w-full max-w-md rounded-2xl bg-card p-6 shadow-xl"
          >
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-destructive/10">
                  <Trash2 className="h-5 w-5 text-destructive" />
                </div>
                <h2 className="text-lg font-bold text-foreground">Eliminar Usuario</h2>
              </div>
              <button
                onClick={handleClose}
                className="rounded-lg p-2 text-muted-foreground hover:bg-muted transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Warning */}
            <div className="rounded-xl bg-destructive/10 border border-destructive/20 p-4 mb-6">
              <div className="flex items-start gap-3">
                <AlertTriangle className="h-5 w-5 text-destructive flex-shrink-0 mt-0.5" />
                <div>
                  <p className="font-medium text-destructive">¡Esta acción es irreversible!</p>
                  <p className="text-sm text-muted-foreground mt-1">
                    Estás a punto de eliminar permanentemente al usuario:
                  </p>
                  <div className="mt-2 p-3 rounded-lg bg-background">
                    <p className="font-semibold text-foreground">{user.full_name}</p>
                    <p className="text-sm text-muted-foreground">{user.email || "Sin correo"}</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Confirmation Input */}
            <div className="mb-6">
              <label className="block text-sm font-medium text-foreground mb-2">
                Escribe <span className="font-bold text-destructive">ELIMINAR</span> para confirmar:
              </label>
              <Input
                type="text"
                value={confirmText}
                onChange={(e) => setConfirmText(e.target.value.toUpperCase())}
                placeholder="ELIMINAR"
                className="text-center font-mono tracking-widest uppercase"
              />
            </div>

            {/* Actions */}
            <div className="flex gap-3">
              <button
                type="button"
                onClick={handleClose}
                className="flex-1 rounded-lg border border-border bg-background py-2.5 text-sm font-medium text-foreground hover:bg-muted transition-colors"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleDelete}
                disabled={loading || !isConfirmValid}
                className="flex-1 flex items-center justify-center gap-2 rounded-lg bg-destructive py-2.5 text-sm font-medium text-destructive-foreground hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Eliminando...
                  </>
                ) : (
                  <>
                    <Trash2 className="h-4 w-4" />
                    Eliminar Usuario
                  </>
                )}
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default DeleteUserModal;
