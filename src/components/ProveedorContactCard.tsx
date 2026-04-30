import { Warehouse, MessageCircle } from "lucide-react";

interface ProveedorContactCardProps {
  storeName: string | null | undefined;
  phone: string | null | undefined;
  /** Optional pre-filled WhatsApp message */
  message?: string;
}

/**
 * Public contact card for a Proveedor.
 * Renders a warehouse icon, the store name, and a WhatsApp button.
 * Use inside the product detail view of the Marketplace catalog.
 */
const ProveedorContactCard = ({ storeName, phone, message }: ProveedorContactCardProps) => {
  if (!storeName && !phone) return null;

  const cleanPhone = (phone || "").replace(/\D/g, "");
  const waUrl = cleanPhone
    ? `https://wa.me/${cleanPhone}${message ? `?text=${encodeURIComponent(message)}` : ""}`
    : null;

  return (
    <div className="neu-flat p-4 rounded-2xl flex items-center gap-3">
      <div className="w-12 h-12 rounded-xl bg-gradient-button flex items-center justify-center flex-shrink-0">
        <Warehouse className="h-6 w-6 text-white" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-xs text-muted-foreground font-medium">Proveedor</p>
        <p className="font-bold text-foreground truncate">{storeName || "Sin nombre"}</p>
      </div>
      {waUrl && (
        <a
          href={waUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="neu-button px-4 py-2 text-white font-semibold text-sm flex items-center gap-2 flex-shrink-0"
          style={{ background: "linear-gradient(135deg, #25D366, #128C7E)" }}
        >
          <MessageCircle className="h-4 w-4" />
          <span className="hidden sm:inline">WhatsApp</span>
        </a>
      )}
    </div>
  );
};

export default ProveedorContactCard;
