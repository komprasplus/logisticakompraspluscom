import { useState, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  X,
  Upload,
  Image as ImageIcon,
  Loader2,
  Save,
  Package,
  DollarSign,
  Hash,
  Tag,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { formatCOP } from "@/lib/tarifas";

interface CreateProductModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  userId: string;
  defaultFulfillmentValue?: number;
}

interface NewProduct {
  sku: string;
  product_name: string;
  stock_available: number;
  price: number;
  fulfillment_value: number;
  low_stock_threshold: number;
  image_url: string | null;
}

const CreateProductModal = ({
  isOpen,
  onClose,
  onSuccess,
  userId,
  defaultFulfillmentValue = 1900,
}: CreateProductModalProps) => {
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [product, setProduct] = useState<NewProduct>({
    sku: "",
    product_name: "",
    stock_available: 0,
    price: 0,
    fulfillment_value: defaultFulfillmentValue,
    low_stock_threshold: 5,
    image_url: null,
  });

  const resetForm = () => {
    setProduct({
      sku: "",
      product_name: "",
      stock_available: 0,
      price: 0,
      fulfillment_value: defaultFulfillmentValue,
      low_stock_threshold: 5,
      image_url: null,
    });
    setPreviewUrl(null);
  };

  const handleClose = () => {
    resetForm();
    onClose();
  };

  const handleDrag = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  }, []);

  const uploadImage = async (file: File): Promise<string | null> => {
    if (!file.type.startsWith("image/")) {
      toast.error("Solo se permiten archivos de imagen");
      return null;
    }

    // Max 5MB
    if (file.size > 5 * 1024 * 1024) {
      toast.error("La imagen no debe superar 5MB");
      return null;
    }

    setUploading(true);
    try {
      const fileExt = file.name.split(".").pop();
      const fileName = `${userId}/${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from("inventory-images")
        .upload(fileName, file, {
          cacheControl: "3600",
          upsert: false,
        });

      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage
        .from("inventory-images")
        .getPublicUrl(fileName);

      return urlData.publicUrl;
    } catch (error) {
      console.error("Error uploading image:", error);
      toast.error("Error al subir imagen");
      return null;
    } finally {
      setUploading(false);
    }
  };

  const handleDrop = useCallback(
    async (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setDragActive(false);

      const file = e.dataTransfer.files?.[0];
      if (file) {
        // Show preview immediately
        const objectUrl = URL.createObjectURL(file);
        setPreviewUrl(objectUrl);

        const publicUrl = await uploadImage(file);
        if (publicUrl) {
          setProduct((prev) => ({ ...prev, image_url: publicUrl }));
        } else {
          setPreviewUrl(null);
        }
      }
    },
    [userId]
  );

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const objectUrl = URL.createObjectURL(file);
      setPreviewUrl(objectUrl);

      const publicUrl = await uploadImage(file);
      if (publicUrl) {
        setProduct((prev) => ({ ...prev, image_url: publicUrl }));
      } else {
        setPreviewUrl(null);
      }
    }
  };

  const handleSave = async () => {
    if (!product.sku.trim()) {
      toast.error("El SKU es requerido");
      return;
    }
    if (!product.product_name.trim()) {
      toast.error("El nombre del producto es requerido");
      return;
    }

    setSaving(true);
    try {
      const { error } = await (supabase as any).from("inventory").insert({
        client_user_id: userId,
        sku: product.sku.trim().toUpperCase(),
        product_name: product.product_name.trim(),
        stock_available: product.stock_available,
        price: product.price,
        fulfillment_value: product.fulfillment_value,
        low_stock_threshold: product.low_stock_threshold,
        image_url: product.image_url,
      });

      if (error) {
        if (error.code === "23505") {
          toast.error("Ya existe un producto con ese SKU");
        } else {
          throw error;
        }
        return;
      }

      toast.success("✅ Producto creado exitosamente");
      handleClose();
      onSuccess();
    } catch (error) {
      console.error("Error creating product:", error);
      toast.error("Error al crear producto");
    } finally {
      setSaving(false);
    }
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
        {/* Backdrop with blur */}
        <motion.div
          className="absolute inset-0 bg-black/60 backdrop-blur-md"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={handleClose}
        />

        {/* Modal */}
        <motion.div
          className="relative z-10 w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-3xl bg-card/95 backdrop-blur-xl border border-border/50 shadow-2xl"
          initial={{ opacity: 0, scale: 0.9, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.9, y: 20 }}
          transition={{ type: "spring", damping: 25, stiffness: 300 }}
        >
          {/* Header */}
          <div className="sticky top-0 z-10 flex items-center justify-between p-6 pb-4 border-b border-border/50 bg-card/80 backdrop-blur-xl rounded-t-3xl">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10">
                <Package className="h-5 w-5 text-primary" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-foreground">
                  Crear Producto
                </h2>
                <p className="text-xs text-muted-foreground">
                  Añade un nuevo producto al inventario
                </p>
              </div>
            </div>
            <button
              onClick={handleClose}
              className="flex h-9 w-9 items-center justify-center rounded-xl bg-muted/50 hover:bg-muted transition-colors"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* Content */}
          <div className="p-6 space-y-5">
            {/* Image Upload - Drag & Drop */}
            <div
              onDragEnter={handleDrag}
              onDragLeave={handleDrag}
              onDragOver={handleDrag}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              className={cn(
                "relative flex flex-col items-center justify-center rounded-2xl border-2 border-dashed p-6 cursor-pointer transition-all overflow-hidden",
                dragActive
                  ? "border-primary bg-primary/10 scale-[1.02]"
                  : "border-border hover:border-primary/50 hover:bg-muted/30",
                previewUrl && "border-solid border-primary/30"
              )}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleFileSelect}
                className="hidden"
              />

              {uploading ? (
                <div className="flex flex-col items-center gap-2 py-4">
                  <Loader2 className="h-8 w-8 animate-spin text-primary" />
                  <p className="text-sm text-muted-foreground">Subiendo...</p>
                </div>
              ) : previewUrl ? (
                <div className="relative w-full aspect-video">
                  <img
                    src={previewUrl}
                    alt="Preview"
                    className="w-full h-full object-contain rounded-xl"
                  />
                  <div className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 hover:opacity-100 transition-opacity rounded-xl">
                    <p className="text-white text-sm font-medium">
                      Cambiar imagen
                    </p>
                  </div>
                </div>
              ) : (
                <div className="flex flex-col items-center gap-3 py-4">
                  <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-muted">
                    <Upload className="h-6 w-6 text-muted-foreground" />
                  </div>
                  <div className="text-center">
                    <p className="text-sm font-medium text-foreground">
                      Arrastra una imagen aquí
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      o haz clic para seleccionar (máx 5MB)
                    </p>
                  </div>
                </div>
              )}
            </div>

            {/* Product Name */}
            <div className="space-y-2">
              <label className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                <Tag className="h-4 w-4" />
                Nombre del Producto *
              </label>
              <input
                type="text"
                placeholder="ej: Camiseta Negra Premium Talla M"
                value={product.product_name}
                onChange={(e) =>
                  setProduct({ ...product, product_name: e.target.value })
                }
                className="w-full rounded-xl border border-border bg-background py-3 px-4 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all"
              />
            </div>

            {/* SKU */}
            <div className="space-y-2">
              <label className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                <Hash className="h-4 w-4" />
                SKU / Código Interno *
              </label>
              <input
                type="text"
                placeholder="ej: CAM-NEG-M-001"
                value={product.sku}
                onChange={(e) =>
                  setProduct({ ...product, sku: e.target.value })
                }
                className="w-full rounded-xl border border-border bg-background py-3 px-4 text-sm font-mono focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all"
              />
            </div>

            {/* Two columns: Stock & Price */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                  <Package className="h-4 w-4" />
                  Stock Inicial
                </label>
                <input
                  type="number"
                  min="0"
                  value={product.stock_available}
                  onChange={(e) =>
                    setProduct({
                      ...product,
                      stock_available: parseInt(e.target.value) || 0,
                    })
                  }
                  className="w-full rounded-xl border border-border bg-background py-3 px-4 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all"
                />
              </div>

              <div className="space-y-2">
                <label className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                  <DollarSign className="h-4 w-4" />
                  Valor de Venta (COP)
                </label>
                <input
                  type="number"
                  min="0"
                  step="1000"
                  value={product.price}
                  onChange={(e) =>
                    setProduct({
                      ...product,
                      price: parseFloat(e.target.value) || 0,
                    })
                  }
                  className="w-full rounded-xl border border-border bg-background py-3 px-4 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all"
                />
              </div>
            </div>

            {/* Fulfillment Value - Read Only Info */}
            <div className="rounded-xl bg-muted/30 border border-border p-4">
              <div className="flex items-center gap-2 mb-1">
                <DollarSign className="h-4 w-4 text-emerald-500" />
                <span className="text-sm font-medium text-foreground">Tarifa de Fulfillment</span>
              </div>
              <p className="text-lg font-bold text-primary">
                {formatCOP(defaultFulfillmentValue)}
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                Configurada por el administrador. Se aplicará automáticamente a cada despacho.
              </p>
            </div>

            {/* Low Stock Threshold */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-muted-foreground">
                Umbral de Stock Bajo
              </label>
              <input
                type="number"
                min="0"
                value={product.low_stock_threshold}
                onChange={(e) =>
                  setProduct({
                    ...product,
                    low_stock_threshold: parseInt(e.target.value) || 5,
                  })
                }
                className="w-full rounded-xl border border-border bg-background py-3 px-4 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all"
              />
              <p className="text-xs text-muted-foreground">
                Se mostrará alerta cuando el stock sea igual o menor a este
                valor
              </p>
            </div>
          </div>

          {/* Footer */}
          <div className="sticky bottom-0 p-6 pt-4 border-t border-border/50 bg-card/80 backdrop-blur-xl rounded-b-3xl">
            <div className="flex gap-3">
              <button
                onClick={handleClose}
                className="flex-1 rounded-xl border border-border py-3 text-sm font-semibold text-muted-foreground hover:bg-muted transition-colors"
              >
                Cancelar
              </button>
              <motion.button
                onClick={handleSave}
                disabled={saving || uploading}
                className="flex-1 flex items-center justify-center gap-2 rounded-xl bg-primary py-3 text-sm font-semibold text-primary-foreground shadow-lg shadow-primary/30 disabled:opacity-50"
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
              >
                {saving ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Save className="h-4 w-4" />
                )}
                Guardar Producto
              </motion.button>
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};

export default CreateProductModal;
