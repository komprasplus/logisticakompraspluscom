import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { 
  AlertTriangle, 
  MapPin, 
  Clock, 
  User, 
  Phone, 
  Image as ImageIcon,
  ExternalLink,
  X,
  ChevronDown,
  ChevronUp,
  LayoutGrid,
  List,
} from "lucide-react";
import { NOVEDAD_OPTIONS } from "@/lib/orderStatuses";
import { Button } from "@/components/ui/button";
import NovedadCompactCard from "@/components/NovedadCompactCard";
import { usePagination } from "@/hooks/usePagination";
import PaginationControls from "@/components/PaginationControls";

interface Pedido {
  id: number;
  numero_guia: string | null;
  cliente_nombre: string | null;
  direccion_entrega: string | null;
  estado: string | null;
  client_phone: string | null;
  latitud: number | null;
  longitud: number | null;
  tipo_novedad: string | null;
  foto_evidencia: string | null;
  fecha_actualizacion: string | null;
  motorizado_asignado: string | null;
  novedad_latitud?: number | null;
  novedad_longitud?: number | null;
}

interface NovedadesPanelProps {
  pedidos: Pedido[];
  onPedidoClick: (pedido: Pedido) => void;
}

const NovedadesPanel = ({ pedidos, onPedidoClick }: NovedadesPanelProps) => {
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<"compact" | "expanded">("compact");

  const novedades = pedidos.filter(
    (p) => p.estado?.toLowerCase().includes("novedad")
  );

  const {
    paginatedItems,
    currentPage,
    totalPages,
    startIndex,
    endIndex,
    totalItems,
    itemsPerPage,
    goToPage,
    setItemsPerPage,
  } = usePagination({ items: novedades, itemsPerPage: 10 });

  if (novedades.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <div className="rounded-full bg-emerald-100 p-4 mb-4">
          <AlertTriangle className="h-8 w-8 text-emerald-600" />
        </div>
        <h3 className="text-lg font-semibold text-foreground">Sin novedades</h3>
        <p className="text-sm text-muted-foreground mt-1">
          Todos los pedidos están en orden 🎉
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <AlertTriangle className="h-5 w-5 text-orange-500" />
          <h2 className="text-lg font-bold text-foreground">
            Novedades ({novedades.length})
          </h2>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex rounded-lg border border-border overflow-hidden">
            <button
              onClick={() => setViewMode("compact")}
              className={`p-2 ${viewMode === "compact" ? "bg-primary text-primary-foreground" : "bg-card text-muted-foreground hover:bg-muted"}`}
            >
              <LayoutGrid className="h-4 w-4" />
            </button>
            <button
              onClick={() => setViewMode("expanded")}
              className={`p-2 ${viewMode === "expanded" ? "bg-primary text-primary-foreground" : "bg-card text-muted-foreground hover:bg-muted"}`}
            >
              <List className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Compact View */}
      <div className="space-y-2">
        {paginatedItems.map((pedido, index) => (
          <NovedadCompactCard
            key={pedido.id}
            pedido={pedido}
            onResolve={onPedidoClick}
            onViewEvidence={setSelectedImage}
            index={index}
          />
        ))}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <PaginationControls
          currentPage={currentPage}
          totalPages={totalPages}
          startIndex={startIndex}
          endIndex={endIndex}
          totalItems={totalItems}
          itemsPerPage={itemsPerPage}
          onPageChange={goToPage}
          onItemsPerPageChange={setItemsPerPage}
        />
      )}

      {/* Image Modal */}
      <AnimatePresence>
        {selectedImage && (
          <motion.div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setSelectedImage(null)}
          >
            <button
              className="absolute top-4 right-4 p-2 rounded-full bg-white/20 hover:bg-white/30 transition-colors"
              onClick={() => setSelectedImage(null)}
            >
              <X className="h-6 w-6 text-white" />
            </button>
            <motion.img
              src={selectedImage}
              alt="Evidencia ampliada"
              className="max-w-full max-h-[90vh] rounded-lg"
              initial={{ scale: 0.9 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0.9 }}
            />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default NovedadesPanel;
