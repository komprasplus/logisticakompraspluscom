import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Loader2, Store, DollarSign, Save, Package } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { formatCOP } from "@/lib/tarifas";
import { Switch } from "@/components/ui/switch";

interface StoreProfile {
  id: string;
  user_id: string;
  full_name: string;
  store_name?: string | null;
  fulfillment_rate?: number | null;
}

interface EditStoreModalProps {
  isOpen: boolean;
  onClose: () => void;
  store: StoreProfile | null;
  onSuccess: () => void;
}

const FULFILLMENT_OPTIONS = [1900, 2000, 2200];

const EditStoreModal = ({ isOpen, onClose, store, onSuccess }: EditStoreModalProps) => {
  const [storeName, setStoreName] = useState("");
  const [fulfillmentEnabled, setFulfillmentEnabled] = useState(true);
  const [fulfillmentRate, setFulfillmentRate] = useState<number>(1900);
  const [customRate, setCustomRate] = useState<string>("");
  const [useCustomRate, setUseCustomRate] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (store && isOpen) {
      setStoreName(store.store_name || "");
      const rate = store.fulfillment_rate ?? 0;
      
      // If rate is 0, fulfillment is disabled
      if (rate === 0) {
        setFulfillmentEnabled(false);
        setFulfillmentRate(1900);
        setUseCustomRate(false);
        setCustomRate("");
      } else if (FULFILLMENT_OPTIONS.includes(rate)) {
        setFulfillmentEnabled(true);
        setFulfillmentRate(rate);
        setUseCustomRate(false);
        setCustomRate("");
      } else {
        setFulfillmentEnabled(true);
        setUseCustomRate(true);
        setCustomRate(rate.toString());
        setFulfillmentRate(rate);
      }
    }
  }, [store, isOpen]);

  const handleSave = async () => {
    if (!store) return;

    // If fulfillment is disabled, set rate to 0
    const finalRate = fulfillmentEnabled 
      ? (useCustomRate ? parseFloat(customRate) || 1900 : fulfillmentRate)
      : 0;

    if (fulfillmentEnabled && (finalRate < 0 || finalRate > 50000)) {
      toast.error("La tarifa debe estar entre $0 y $50.000");
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase
        .from("profiles")
        .update({
          store_name: storeName.trim() || null,
          fulfillment_rate: finalRate,
        })
        .eq("user_id", store.user_id);

      if (error) throw error;

      toast.success("Tienda actualizada correctamente");
      onSuccess();
      onClose();
    } catch (error) {
      console.error("Error updating store:", error);
      toast.error("Error al actualizar la tienda");
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen || !store) return null;

  const displayRate = fulfillmentEnabled 
    ? (useCustomRate ? parseFloat(customRate) || 0 : fulfillmentRate)
    : 0;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4"
        onClick={(e) => e.target === e.currentTarget && onClose()}
      >
        <motion.div
          initial={{ scale: 0.95, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.95, opacity: 0 }}
          className="w-full max-w-md rounded-2xl bg-card p-6 shadow-xl"
        >
          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
                <Store className="h-5 w-5 text-primary" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-foreground">Editar Tienda</h2>
                <p className="text-xs text-muted-foreground">{store.full_name}</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="rounded-lg p-2 text-muted-foreground hover:bg-muted transition-colors"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          <div className="space-y-5">
            {/* Store Name */}
            <div>
              <label className="block text-sm font-medium text-foreground mb-1">
                Nombre de la Tienda
              </label>
              <div className="relative">
                <Store className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <input
                  type="text"
                  value={storeName}
                  onChange={(e) => setStoreName(e.target.value)}
                  placeholder="Mi Tienda Online"
                  className="w-full rounded-lg border border-border bg-background py-2.5 pl-10 pr-4 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                />
              </div>
            </div>

            {/* Fulfillment Service Toggle */}
            <div className="rounded-xl border border-border bg-muted/20 p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10">
                    <Package className="h-4 w-4 text-primary" />
                  </div>
                  <div>
                    <p className="font-medium text-foreground">Servicio de Fulfillment</p>
                    <p className="text-xs text-muted-foreground">
                      {fulfillmentEnabled ? "Cobro por despacho activo" : "Sin cobro de fulfillment"}
                    </p>
                  </div>
                </div>
                <Switch
                  checked={fulfillmentEnabled}
                  onCheckedChange={setFulfillmentEnabled}
                />
              </div>
            </div>

            {/* Fulfillment Rate - Only show when enabled */}
            <AnimatePresence>
              {fulfillmentEnabled && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  className="overflow-hidden"
                >
                  <label className="flex items-center gap-2 text-sm font-medium text-foreground mb-2">
                    <DollarSign className="h-4 w-4 text-primary" />
                    Tarifa de Fulfillment *
                  </label>
                  <p className="text-xs text-muted-foreground mb-3">
                    Esta tarifa se aplicará automáticamente a todas las órdenes de esta tienda
                  </p>
                  
                  {/* Preset Options */}
                  <div className="grid grid-cols-3 gap-2 mb-3">
                    {FULFILLMENT_OPTIONS.map((value) => (
                      <button
                        key={value}
                        type="button"
                        onClick={() => {
                          setFulfillmentRate(value);
                          setUseCustomRate(false);
                          setCustomRate("");
                        }}
                        className={cn(
                          "py-2.5 rounded-xl text-sm font-semibold transition-all",
                          !useCustomRate && fulfillmentRate === value
                            ? "bg-primary text-primary-foreground shadow-lg shadow-primary/30"
                            : "bg-muted/50 text-muted-foreground hover:bg-muted"
                        )}
                      >
                        {formatCOP(value)}
                      </button>
                    ))}
                  </div>

                  {/* Custom Rate Toggle */}
                  <div className="flex items-center gap-2 mb-2">
                    <input
                      type="checkbox"
                      id="useCustomRate"
                      checked={useCustomRate}
                      onChange={(e) => {
                        setUseCustomRate(e.target.checked);
                        if (!e.target.checked) {
                          setCustomRate("");
                        }
                      }}
                      className="h-4 w-4 rounded border-border text-primary focus:ring-primary"
                    />
                    <label htmlFor="useCustomRate" className="text-sm text-muted-foreground">
                      Usar tarifa personalizada
                    </label>
                  </div>

                  {/* Custom Rate Input */}
                  {useCustomRate && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: "auto" }}
                      exit={{ opacity: 0, height: 0 }}
                    >
                      <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">$</span>
                        <input
                          type="number"
                          min="0"
                          max="50000"
                          step="100"
                          value={customRate}
                          onChange={(e) => setCustomRate(e.target.value)}
                          placeholder="0"
                          className="w-full rounded-lg border border-border bg-background py-2.5 pl-8 pr-4 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                        />
                      </div>
                    </motion.div>
                  )}
                </motion.div>
              )}
            </AnimatePresence>

            {/* Summary */}
            <div className="rounded-lg bg-muted/30 border border-border p-3">
              <div className="flex justify-between items-center text-sm">
                <span className="text-muted-foreground">Tarifa aplicada:</span>
                <span className={cn(
                  "font-bold",
                  displayRate === 0 ? "text-muted-foreground" : "text-primary"
                )}>
                  {displayRate === 0 ? "$0 (No aplica)" : formatCOP(displayRate)}
                </span>
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-3 mt-6">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 rounded-lg border border-border bg-background py-2.5 text-sm font-medium text-foreground hover:bg-muted transition-colors"
            >
              Cancelar
            </button>
            <button
              onClick={handleSave}
              disabled={loading}
              className="flex-1 flex items-center justify-center gap-2 rounded-lg bg-primary py-2.5 text-sm font-medium text-primary-foreground hover:opacity-90 transition-opacity disabled:opacity-50"
            >
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Guardando...
                </>
              ) : (
                <>
                  <Save className="h-4 w-4" />
                  Guardar Cambios
                </>
              )}
            </button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};

export default EditStoreModal;
