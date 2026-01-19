import { motion, AnimatePresence } from "framer-motion";
import { X, Download, ExternalLink } from "lucide-react";

interface EvidencePhotoModalProps {
  imageUrl: string | null;
  isOpen: boolean;
  onClose: () => void;
  title?: string;
}

const EvidencePhotoModal = ({ imageUrl, isOpen, onClose, title = "Foto de Evidencia" }: EvidencePhotoModalProps) => {
  if (!imageUrl) return null;

  const handleDownload = () => {
    window.open(imageUrl, "_blank");
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
            className="absolute inset-0 bg-black/80 backdrop-blur-sm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
          />

          {/* Modal */}
          <motion.div
            className="relative max-w-2xl w-full"
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
          >
            {/* Header */}
            <div className="absolute -top-12 left-0 right-0 flex items-center justify-between">
              <h3 className="text-white font-bold">{title}</h3>
              <div className="flex items-center gap-2">
                <button
                  onClick={handleDownload}
                  className="flex items-center gap-1 rounded-lg bg-white/20 px-3 py-1.5 text-sm text-white hover:bg-white/30 transition-colors"
                >
                  <ExternalLink className="h-4 w-4" />
                  Abrir
                </button>
                <button
                  onClick={onClose}
                  className="flex h-8 w-8 items-center justify-center rounded-full bg-white/20 hover:bg-white/30 transition-colors"
                >
                  <X className="h-5 w-5 text-white" />
                </button>
              </div>
            </div>

            {/* Image */}
            <div className="overflow-hidden rounded-2xl bg-black shadow-elevated">
              <img
                src={imageUrl}
                alt={title}
                className="w-full h-auto max-h-[70vh] object-contain"
              />
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default EvidencePhotoModal;
