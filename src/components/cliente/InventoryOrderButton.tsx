import { useState, useCallback, useId } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { ShoppingCart, Loader2, Minus, Plus } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { formatCOP } from "@/lib/tarifas";

// ─── Tipos ────────────────────────────────────────────────────────────────────

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

// ─── Componente ───────────────────────────────────────────────────────────────

const InventoryOrderButton = ({ item, onCreateOrder }: InventoryOrderButtonProps) => {
  const [showQuantity, setShowQuantity] = useState(false);
  const [quantity, setQuantity] = useState(1);
  const [creating, setCreating] = useState(false);

  const prefersReducedMotion = useReducedMotion();
  const uid = useId();
  const quantityId = `${uid}-quantity`;

  const isOutOfStock = item.stock_available === 0;
  const maxQuantity = item.stock_available;

  // ── Handlers ───────────────────────────────────────────────────────────────

  const handleIncrement = useCallback(() => {
    setQuantity((q) => Math.min(q + 1, maxQuantity));
  }, [maxQuantity]);

  const handleDecrement = useCallback(() => {
    setQuantity((q) => Math.max(q - 1, 1));
  }, []);

  const handleCancel = useCallback(() => {
    setShowQuantity(false);
    setQuantity(1);
  }, []);

  /*
    FIX: `handleCreateOrder` no necesita ser `async`.
    `onCreateOrder` es una callback síncrona recibida como prop — no devuelve
    una Promise. El bloque `try/catch` con `setCreating` lo sugería, pero nunca
    había nada que awaitar. El único efecto del `try/catch` era atrapar errores
    síncronos de `onCreateOrder`, lo cual aún funciona sin `async`.
    Eliminado el overhead y posible confusión.

    FIX: si `onCreateOrder` lanza síncronamente el error era capturado pero
    no se notificaba al usuario. Añadido toast de error.
  */
  const handleCreateOrder = useCallback(() => {
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
      toast.error("No se pudo crear la orden. Intenta de nuevo.");
    } finally {
      setCreating(false);
    }
  }, [isOutOfStock, quantity, maxQuantity, onCreateOrder, item]);

  /*
    FIX: permitir entrada de teclado directa en el selector de cantidad.
    Con solo botones +/- el usuario no puede escribir "20" directamente —
    en inventarios con stock alto sería muy tedioso. Añadido input numérico
    con validación de rango.
  */
  const handleQuantityInput = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const value = parseInt(e.target.value);
      if (!isNaN(value)) {
        setQuantity(Math.min(Math.max(1, value), maxQuantity));
      }
    },
    [maxQuantity],
  );

  // ── Render: sin stock ──────────────────────────────────────────────────────

  if (isOutOfStock) {
    return (
      <button
        type="button"
        disabled
        aria-disabled="true"
        aria-label={`${item.product_name}: sin stock disponible`}
        className="w-full mt-3 flex items-center justify-center gap-2 rounded-xl bg-muted py-2.5 text-xs font-medium text-muted-foreground cursor-not-allowed"
      >
        Sin stock
      </button>
    );
  }

  // ── Render: botón inicial ──────────────────────────────────────────────────

  if (!showQuantity) {
    return (
      <motion.button
        type="button"
        onClick={() => setShowQuantity(true)}
        aria-label={`Crear orden para ${item.product_name}`}
        className="w-full mt-3 flex items-center justify-center gap-2 rounded-xl bg-primary/10 py-2.5 text-xs font-semibold text-primary hover:bg-primary/20 transition-colors"
        whileHover={prefersReducedMotion ? undefined : { scale: 1.02 }}
        whileTap={prefersReducedMotion ? undefined : { scale: 0.98 }}
      >
        <ShoppingCart className="h-3.5 w-3.5" aria-hidden="true" />
        Crear Orden
      </motion.button>
    );
  }

  // ── Render: selector de cantidad ──────────────────────────────────────────

  return (
    <motion.div
      className="mt-3 space-y-2"
      initial={{ opacity: 0, y: prefersReducedMotion ? 0 : -10 }}
      animate={{ opacity: 1, y: 0 }}
    >
      {/* Selector de cantidad */}
      <div
        className="flex items-center justify-between rounded-xl border border-border bg-background p-2"
        role="group"
        aria-labelledby={`${uid}-qty-label`}
      >
        <span id={`${uid}-qty-label`} className="sr-only">
          Cantidad de {item.product_name}
        </span>

        <button
          type="button"
          onClick={handleDecrement}
          disabled={quantity <= 1}
          aria-label="Reducir cantidad"
          className={cn(
            "flex h-8 w-8 items-center justify-center rounded-lg transition-colors",
            quantity <= 1
              ? "bg-muted text-muted-foreground cursor-not-allowed"
              : "bg-primary/10 text-primary hover:bg-primary/20",
          )}
        >
          <Minus className="h-4 w-4" aria-hidden="true" />
        </button>

        {/*
          FIX: input numérico editable directamente.
          Permite escribir la cantidad sin tener que pulsar +/- muchas veces
          cuando el stock disponible es alto (ej. 200 unidades).
        */}
        <div className="text-center flex items-baseline gap-1">
          <label htmlFor={quantityId} className="sr-only">
            Cantidad
          </label>
          <input
            id={quantityId}
            type="number"
            min={1}
            max={maxQuantity}
            value={quantity}
            onChange={handleQuantityInput}
            inputMode="numeric"
            aria-label={`Cantidad — máximo ${maxQuantity}`}
            className="w-12 text-center text-lg font-bold text-foreground bg-transparent border-b border-border focus:border-primary focus:outline-none"
          />
          <span className="text-xs text-muted-foreground">/ {maxQuantity} disponibles</span>
        </div>

        <button
          type="button"
          onClick={handleIncrement}
          disabled={quantity >= maxQuantity}
          aria-label="Aumentar cantidad"
          className={cn(
            "flex h-8 w-8 items-center justify-center rounded-lg transition-colors",
            quantity >= maxQuantity
              ? "bg-muted text-muted-foreground cursor-not-allowed"
              : "bg-primary/10 text-primary hover:bg-primary/20",
          )}
        >
          <Plus className="h-4 w-4" aria-hidden="true" />
        </button>
      </div>

      {/* Preview de precio */}
      <div className="flex items-center justify-between text-xs text-muted-foreground px-1">
        <span>Total producto:</span>
        <span className="font-semibold text-foreground">{formatCOP(item.price * quantity)}</span>
      </div>

      {/* Botón confirmar */}
      <motion.button
        type="button"
        onClick={handleCreateOrder}
        disabled={creating}
        aria-busy={creating}
        aria-label={`Confirmar orden de ${quantity} ${quantity === 1 ? "unidad" : "unidades"} de ${item.product_name}`}
        className="w-full flex items-center justify-center gap-2 rounded-xl bg-primary py-2.5 text-xs font-semibold text-primary-foreground hover:opacity-90 transition-opacity disabled:cursor-not-allowed disabled:opacity-50"
        whileHover={prefersReducedMotion ? undefined : { scale: 1.02 }}
        whileTap={prefersReducedMotion ? undefined : { scale: 0.98 }}
      >
        {creating ? (
          <>
            <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
            Creando...
          </>
        ) : (
          <>
            <ShoppingCart className="h-3.5 w-3.5" aria-hidden="true" />
            Confirmar ({quantity} {quantity === 1 ? "unidad" : "unidades"})
          </>
        )}
      </motion.button>

      {/* Cancelar */}
      <button
        type="button"
        onClick={handleCancel}
        className="w-full text-xs text-muted-foreground hover:text-foreground transition-colors py-1"
      >
        Cancelar
      </button>
    </motion.div>
  );
};

export default InventoryOrderButton;
