import { useState } from "react";
import { motion } from "framer-motion";
import { ShoppingCart, Loader2, Minus, Plus } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { formatCOP } from "@/lib/tarifas";

interface InventoryItem {
  id: string;
  client_user_id: string;
  sku: string;
  product_name: string;
  stock_available: number;
  price: number;
}

interface InventoryOrderButtonProps {
  item: InventoryItem;
  onCreateOrder: (item: InventoryItem, quantity: number) => void;
}

const InventoryOrderButton = ({ item, onCreateOrder }: InventoryOrderButtonProps) => {
  const [showQuantity, setShowQuantity] = useState(false);
  const [quantity, setQuantity] = useState(1);
  const [creating, setCreating] = useState(false);

  const isOutOfStock = item.stock_available === 0;
  const maxQuantity = item.stock_available;

  const handleIncrement = () => {
    if (quantity < maxQuantity) {
      setQuantity(quantity + 1);
    }
  };

  const handleDecrement = () => {
    if (quantity > 1) {
      setQuantity(quantity - 1);
    }
  };

  const handleCreateOrder = async () => {
    if (isOutOfStock) {
      toast.error("Producto sin stock disponible");
      return;
    }

    if (quantity > maxQuantity) {
      toast.error(`Solo hay ${maxQuantity} unidades disponibles`);
      return;
    }

    setCreating(true);
    try {
      onCreateOrder(item, quantity);
      setShowQuantity(false);
      setQuantity(1);
    } catch (error) {
      console.error("Error creating order:", error);
    } finally {
      setCreating(false);
    }
  };

  if (isOutOfStock) {
    return (
      <button
        disabled
        className="w-full mt-3 flex items-center justify-center gap-2 rounded-xl bg-muted py-2.5 text-xs font-medium text-muted-foreground cursor-not-allowed"
      >
        Sin stock
      </button>
    );
  }

  if (!showQuantity) {
    return (
      <motion.button
        onClick={() => setShowQuantity(true)}
        className="w-full mt-3 flex items-center justify-center gap-2 rounded-xl bg-primary/10 py-2.5 text-xs font-semibold text-primary hover:bg-primary/20 transition-colors"
        whileHover={{ scale: 1.02 }}
        whileTap={{ scale: 0.98 }}
      >
        <ShoppingCart className="h-3.5 w-3.5" />
        Crear Orden
      </motion.button>
    );
  }

  return (
    <motion.div
      className="mt-3 space-y-2"
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
    >
      {/* Quantity Selector */}
      <div className="flex items-center justify-between rounded-xl border border-border bg-background p-2">
        <button
          onClick={handleDecrement}
          disabled={quantity <= 1}
          className={cn(
            "flex h-8 w-8 items-center justify-center rounded-lg transition-colors",
            quantity <= 1
              ? "bg-muted text-muted-foreground cursor-not-allowed"
              : "bg-primary/10 text-primary hover:bg-primary/20"
          )}
        >
          <Minus className="h-4 w-4" />
        </button>
        
        <div className="text-center">
          <span className="text-lg font-bold text-foreground">{quantity}</span>
          <span className="text-xs text-muted-foreground ml-1">
            / {maxQuantity} disponibles
          </span>
        </div>
        
        <button
          onClick={handleIncrement}
          disabled={quantity >= maxQuantity}
          className={cn(
            "flex h-8 w-8 items-center justify-center rounded-lg transition-colors",
            quantity >= maxQuantity
              ? "bg-muted text-muted-foreground cursor-not-allowed"
              : "bg-primary/10 text-primary hover:bg-primary/20"
          )}
        >
          <Plus className="h-4 w-4" />
        </button>
      </div>

      {/* Price Preview */}
      <div className="flex items-center justify-between text-xs text-muted-foreground px-1">
        <span>Total producto:</span>
        <span className="font-semibold text-foreground">
          {formatCOP(item.price * quantity)}
        </span>
      </div>

      {/* Confirm Button */}
      <motion.button
        onClick={handleCreateOrder}
        disabled={creating}
        className="w-full flex items-center justify-center gap-2 rounded-xl bg-primary py-2.5 text-xs font-semibold text-primary-foreground hover:opacity-90 transition-opacity"
        whileHover={{ scale: 1.02 }}
        whileTap={{ scale: 0.98 }}
      >
        {creating ? (
          <>
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
            Creando...
          </>
        ) : (
          <>
            <ShoppingCart className="h-3.5 w-3.5" />
            Confirmar ({quantity} {quantity === 1 ? "unidad" : "unidades"})
          </>
        )}
      </motion.button>

      {/* Cancel */}
      <button
        onClick={() => {
          setShowQuantity(false);
          setQuantity(1);
        }}
        className="w-full text-xs text-muted-foreground hover:text-foreground transition-colors py-1"
      >
        Cancelar
      </button>
    </motion.div>
  );
};

export default InventoryOrderButton;
