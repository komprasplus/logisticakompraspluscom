import { useState, useRef, useCallback, useEffect, useId } from "react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { X, Upload, Loader2, Save, Package, DollarSign, Hash, Tag } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { formatCOP } from "@/lib/tarifas";

// ─── Tipos ────────────────────────────────────────────────────────────────────

interface CreateProductModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  userId: string;
}

interface NewProduct {
  sku: string;
  product_name: string;
  stock_available: number;
  price: number;
  low_stock_threshold: number;
  image_url: string | null;
}

interface FulfillmentRateInfo {
  rate: number;
  loaded: boolean;
}

// ─── Constantes ───────────────────────────────────────────────────────────────

const MAX_IMAGE_SIZE_BYTES = 5 * 1024 * 1024; // 5 MB

/*
  FIX: allowlist de MIME types en lugar de `file.type.startsWith("image/")`.
  El prefijo genérico permitía `image/svg+xml`, que puede contener scripts XSS
  que el navegador ejecutaría al renderizarlos en una etiqueta <img>.
*/
const ALLOWED_IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);

const EMPTY_PRODUCT: NewProduct = {
  sku: "",
  product_name: "",
  stock_available: 0,
  price: 0,
  low_stock_threshold: 5,
  image_url: null,
};

// ─── Componente ───────────────────────────────────────────────────────────────

const CreateProductModal = ({ isOpen, onClose, onSuccess, userId }: CreateProductModalProps) => {
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [fulfillmentInfo, setFulfillmentInfo] = useState<FulfillmentRateInfo>({ rate: 0, loaded: false });
  const [product, setProduct] = useState<NewProduct>(EMPTY_PRODUCT);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const cancelRef = useRef(false);
  const prefersReducedMotion = useReducedMotion();

  /*
    FIX: IDs únicos para asociar <label htmlFor> con <input id>.
    Sin esta asociación, hacer clic en el label no enfoca el input
    y los lectores de pantalla no anuncian los labels correctamente.
    `useId` garantiza unicidad incluso con múltiples instancias del modal.
  */
  const uid = useId();
  const idProductName = `${uid}-product-name`;
  const idSku = `${uid}-sku`;
  const idStock = `${uid}-stock`;
  const idPrice = `${uid}-price`;
  const idLowStockThreshold = `${uid}-low-stock`;

  // ── Fetch tarifa fulfillment ───────────────────────────────────────────────

  const fetchFulfillmentRate = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from("profiles")
        .select("fulfillment_rate")
        .eq("user_id", userId)
        .maybeSingle();

      if (cancelRef.current) return;
      if (error) throw error;

      const rate = data?.fulfillment_rate ?? 0;
      setFulfillmentInfo({ rate, loaded: true });
    } catch (error) {
      if (cancelRef.current) return;
      console.error("Error fetching fulfillment rate:", error);
      setFulfillmentInfo({ rate: 0, loaded: true });
    }
  }, [userId]);

  useEffect(() => {
    cancelRef.current = false;
    if (isOpen && userId) fetchFulfillmentRate();
    return () => {
      cancelRef.current = true;
    };
  }, [isOpen, userId, fetchFulfillmentRate]);

  // ── Reset y cierre ────────────────────────────────────────────────────────

  const resetForm = useCallback(() => {
    setProduct(EMPTY_PRODUCT);
    /*
      FIX: revocar el Object URL al hacer reset para liberar la referencia
      al Blob en memoria. Sin esto, cada imagen previsualized crea una
      entrada en la memoria que no se libera nunca.
    */
    setPreviewUrl((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return null;
    });
    setFulfillmentInfo({ rate: 0, loaded: false });
  }, []);

  /*
    FIX: revocar el Object URL también cuando el componente se desmonta
    o cuando el modal se cierra sin pasar por resetForm.
  */
  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
    // Solo al desmontar — previewUrl intencionalmente fuera de deps
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleClose = useCallback(() => {
    resetForm();
    onClose();
  }, [resetForm, onClose]);

  // ── Drag & Drop ───────────────────────────────────────────────────────────

  const handleDrag = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      /*
        FIX: `dragleave` se dispara al pasar sobre elementos hijos dentro
        de la zona de drop, causando parpadeo en el estado visual.
        Se ignora el evento si `relatedTarget` sigue siendo un descendiente
        del contenedor — el drag sigue activo.
      */
      if (e.relatedTarget && e.currentTarget.contains(e.relatedTarget as Node)) return;
      setDragActive(false);
    }
  }, []);

  // ── Upload de imagen ──────────────────────────────────────────────────────

  const uploadImage = useCallback(
    async (file: File): Promise<string | null> => {
      /*
        FIX: validación con allowlist en vez de prefijo genérico.
        `image/svg+xml` es un tipo de imagen pero puede contener scripts XSS.
      */
      if (!ALLOWED_IMAGE_TYPES.has(file.type)) {
        toast.error("Solo se permiten imágenes JPG, PNG, WebP o GIF");
        return null;
      }
      if (file.size > MAX_IMAGE_SIZE_BYTES) {
        toast.error("La imagen no debe superar 5 MB");
        return null;
      }

      setUploading(true);
      try {
        const fileExt = file.name.split(".").pop() ?? "jpg";
        const fileName = `${userId}/${Date.now()}-${Math.random().toString(36).slice(7)}.${fileExt}`;

        const { error: uploadError } = await supabase.storage.from("inventory-images").upload(fileName, file, {
          cacheControl: "3600",
          upsert: false,
          contentType: file.type, // FIX: siempre incluir contentType
        });

        if (uploadError) throw uploadError;

        const { data: urlData } = supabase.storage.from("inventory-images").getPublicUrl(fileName);

        return urlData.publicUrl;
      } catch (error) {
        console.error("Error uploading image:", error);
        toast.error("Error al subir imagen");
        return null;
      } finally {
        if (!cancelRef.current) setUploading(false);
      }
    },
    [userId],
  );

  // ── Procesar archivo seleccionado ─────────────────────────────────────────

  const processFile = useCallback(
    async (file: File) => {
      // Preview inmediato (local)
      const objectUrl = URL.createObjectURL(file);
      setPreviewUrl((prev) => {
        if (prev) URL.revokeObjectURL(prev); // Revocar preview anterior
        return objectUrl;
      });

      const publicUrl = await uploadImage(file);
      if (publicUrl) {
        setProduct((prev) => ({ ...prev, image_url: publicUrl }));
      } else {
        // Si el upload falló, quitar el preview y revocar la URL
        setPreviewUrl((prev) => {
          if (prev) URL.revokeObjectURL(prev);
          return null;
        });
      }
    },
    [uploadImage],
  );

  const handleDrop = useCallback(
    async (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setDragActive(false);
      const file = e.dataTransfer.files?.[0];
      if (file) await processFile(file);
    },
    [processFile],
  );

  const handleFileSelect = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) await processFile(file);
    },
    [processFile],
  );

  // ── Guardar producto ──────────────────────────────────────────────────────

  const handleSave = useCallback(async () => {
    if (!product.sku.trim()) {
      toast.error("El SKU es requerido");
      return;
    }
    if (!product.product_name.trim()) {
      toast.error("El nombre del producto es requerido");
      return;
    }
    /*
      FIX: validar que el precio sea mayor que 0.
      Un producto con valor $0 probablemente es un error del usuario
      y pasaría silenciosamente a la BD.
    */
    if (product.price <= 0) {
      toast.error("El valor de venta debe ser mayor a $0");
      return;
    }

    setSaving(true);
    try {
      /*
        FIX: eliminado el cast `(supabase as any)` que suprimía el chequeo
        de tipos de TypeScript. Si el tipo generado de Supabase no incluye
        "inventory", la solución es regenerar los tipos con `supabase gen types`.
        El cast `as any` enmascara errores de schema que deberían ser visibles.
      */
      const { error } = await supabase.from("inventory").insert({
        client_user_id: userId,
        sku: product.sku.trim().toUpperCase(),
        product_name: product.product_name.trim(),
        stock_available: product.stock_available,
        price: product.price,
        fulfillment_value: fulfillmentInfo.rate,
        low_stock_threshold: product.low_stock_threshold,
        image_url: product.image_url,
      });

      if (error) {
        if (error.code === "23505") {
          toast.error(`Ya existe un producto con el SKU "${product.sku.trim().toUpperCase()}"`);
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
      if (!cancelRef.current) setSaving(false);
    }
  }, [product, userId, fulfillmentInfo.rate, handleClose, onSuccess]);

  // ── Render ─────────────────────────────────────────────────────────────────

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div
        className="fixed inset-0 z-[9999] flex items-center justify-center p-4"
        /*
          FIX: `role="dialog"` y `aria-modal="true"` para que los lectores
          de pantalla anuncien el modal correctamente y sepan que el contenido
          detrás está inactivo.
        */
        role="dialog"
        aria-modal="true"
        aria-labelledby={`${uid}-modal-title`}
      >
        {/* Backdrop */}
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
                <Package className="h-5 w-5 text-primary" aria-hidden="true" />
              </div>
              <div>
                {/* FIX: id vinculado al aria-labelledby del dialog */}
                <h2 id={`${uid}-modal-title`} className="text-lg font-bold text-foreground">
                  Crear Producto
                </h2>
                <p className="text-xs text-muted-foreground">Añade un nuevo producto al inventario</p>
              </div>
            </div>
            <button
              type="button"
              onClick={handleClose}
              className="flex h-9 w-9 items-center justify-center rounded-xl bg-muted/50 hover:bg-muted transition-colors"
              aria-label="Cerrar modal"
            >
              <X className="h-5 w-5" aria-hidden="true" />
            </button>
          </div>

          {/* Contenido */}
          <div className="p-6 space-y-5">
            {/* Zona de carga de imagen */}
            <div
              role="button"
              tabIndex={0}
              aria-label="Área para subir imagen del producto — arrastra una imagen o haz clic"
              onDragEnter={handleDrag}
              onDragLeave={handleDrag}
              onDragOver={handleDrag}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  fileInputRef.current?.click();
                }
              }}
              className={cn(
                "relative flex flex-col items-center justify-center rounded-2xl border-2 border-dashed p-6 cursor-pointer transition-all overflow-hidden",
                dragActive
                  ? "border-primary bg-primary/10 scale-[1.02]"
                  : "border-border hover:border-primary/50 hover:bg-muted/30",
                previewUrl && "border-solid border-primary/30",
              )}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp,image/gif"
                onChange={handleFileSelect}
                className="hidden"
                aria-hidden="true"
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
                    alt="Preview del producto"
                    className="w-full h-full object-contain rounded-xl"
                  />
                  <div className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 hover:opacity-100 transition-opacity rounded-xl">
                    <p className="text-white text-sm font-medium">Cambiar imagen</p>
                  </div>
                </div>
              ) : (
                <div className="flex flex-col items-center gap-3 py-4">
                  <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-muted">
                    <Upload className="h-6 w-6 text-muted-foreground" aria-hidden="true" />
                  </div>
                  <div className="text-center">
                    <p className="text-sm font-medium text-foreground">Arrastra una imagen aquí</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      o haz clic para seleccionar (JPG, PNG, WebP — máx 5 MB)
                    </p>
                  </div>
                </div>
              )}
            </div>

            {/* Nombre del producto */}
            <div className="space-y-2">
              {/* FIX: htmlFor + id para asociar label e input */}
              <label
                htmlFor={idProductName}
                className="flex items-center gap-2 text-sm font-medium text-muted-foreground"
              >
                <Tag className="h-4 w-4" aria-hidden="true" />
                Nombre del Producto *
              </label>
              <input
                id={idProductName}
                type="text"
                placeholder="ej: Camiseta Negra Premium Talla M"
                value={product.product_name}
                onChange={(e) => setProduct((p) => ({ ...p, product_name: e.target.value }))}
                className="w-full rounded-xl border border-border bg-background py-3 px-4 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all"
                required
                autoComplete="off"
              />
            </div>

            {/* SKU */}
            <div className="space-y-2">
              <label htmlFor={idSku} className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                <Hash className="h-4 w-4" aria-hidden="true" />
                SKU / Código Interno *
              </label>
              <input
                id={idSku}
                type="text"
                placeholder="ej: CAM-NEG-M-001"
                value={product.sku}
                onChange={(e) => setProduct((p) => ({ ...p, sku: e.target.value }))}
                className="w-full rounded-xl border border-border bg-background py-3 px-4 text-sm font-mono focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all"
                required
                autoComplete="off"
                spellCheck="false"
              />
            </div>

            {/* Stock y precio */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label htmlFor={idStock} className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                  <Package className="h-4 w-4" aria-hidden="true" />
                  Stock Inicial
                </label>
                <input
                  id={idStock}
                  type="number"
                  min="0"
                  inputMode="numeric"
                  value={product.stock_available}
                  onChange={(e) =>
                    setProduct((p) => ({
                      ...p,
                      /*
                        FIX: `parseInt() || 0` trata el 0 ingresado como falsy.
                        Si el usuario borra el campo y escribe "0", el valor
                        volvía a 0 solo si tipaba algo más — durante la edición
                        el campo se comportaba de forma errática.
                        Usando el valor del input directamente como string y
                        parseando solo al guardar — aquí usamos Math.max(0, ...)
                        para evitar negativos sin suprimir el 0.
                      */
                      stock_available: Math.max(0, parseInt(e.target.value) || 0),
                    }))
                  }
                  className="w-full rounded-xl border border-border bg-background py-3 px-4 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all"
                />
              </div>

              <div className="space-y-2">
                <label htmlFor={idPrice} className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                  <DollarSign className="h-4 w-4" aria-hidden="true" />
                  Valor de Venta (COP)
                </label>
                <input
                  id={idPrice}
                  type="number"
                  min="0"
                  step="1000"
                  inputMode="numeric"
                  value={product.price}
                  onChange={(e) =>
                    setProduct((p) => ({
                      ...p,
                      price: Math.max(0, parseFloat(e.target.value) || 0),
                    }))
                  }
                  className="w-full rounded-xl border border-border bg-background py-3 px-4 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all"
                />
              </div>
            </div>

            {/* Tarifa de fulfillment (solo lectura) */}
            <div className="rounded-xl bg-muted/30 border border-border p-4">
              <div className="flex items-center gap-2 mb-1">
                <DollarSign
                  className={cn("h-4 w-4", fulfillmentInfo.rate > 0 ? "text-emerald-500" : "text-muted-foreground")}
                  aria-hidden="true"
                />
                <span className="text-sm font-medium text-foreground">Tarifa de Fulfillment</span>
              </div>
              {fulfillmentInfo.loaded ? (
                <>
                  <p
                    className={cn(
                      "text-lg font-bold",
                      fulfillmentInfo.rate > 0 ? "text-primary" : "text-muted-foreground",
                    )}
                  >
                    {fulfillmentInfo.rate > 0 ? formatCOP(fulfillmentInfo.rate) : "$0 (No aplica)"}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Tarifa asignada por el administrador según tu plan actual
                  </p>
                </>
              ) : (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  Cargando...
                </div>
              )}
            </div>

            {/* Umbral de stock bajo */}
            <div className="space-y-2">
              <label htmlFor={idLowStockThreshold} className="text-sm font-medium text-muted-foreground">
                Umbral de Stock Bajo
              </label>
              <input
                id={idLowStockThreshold}
                type="number"
                min="0"
                inputMode="numeric"
                value={product.low_stock_threshold}
                onChange={(e) =>
                  setProduct((p) => ({
                    ...p,
                    /*
                      FIX: `parseInt() || 5` hacía que escribir "0" resultara
                      en 5 (ya que `0 || 5 = 5`). Un umbral de 0 es válido
                      (desactivar alertas). Usar `?? 5` sobre valor explícito.
                    */
                    low_stock_threshold: parseInt(e.target.value) >= 0 ? parseInt(e.target.value) : 5,
                  }))
                }
                className="w-full rounded-xl border border-border bg-background py-3 px-4 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all"
              />
              <p className="text-xs text-muted-foreground">
                Se mostrará alerta cuando el stock sea igual o menor a este valor (0 = sin alerta)
              </p>
            </div>
          </div>

          {/* Footer */}
          <div className="sticky bottom-0 p-6 pt-4 border-t border-border/50 bg-card/80 backdrop-blur-xl rounded-b-3xl">
            <div className="flex gap-3">
              <button
                type="button"
                onClick={handleClose}
                className="flex-1 rounded-xl border border-border py-3 text-sm font-semibold text-muted-foreground hover:bg-muted transition-colors"
              >
                Cancelar
              </button>
              <motion.button
                type="button"
                onClick={handleSave}
                disabled={saving || uploading}
                className="flex-1 flex items-center justify-center gap-2 rounded-xl bg-primary py-3 text-sm font-semibold text-primary-foreground shadow-lg shadow-primary/30 disabled:opacity-50 disabled:cursor-not-allowed"
                /*
                  FIX: `prefers-reduced-motion` para las animaciones del botón.
                */
                whileHover={prefersReducedMotion ? undefined : { scale: 1.02 }}
                whileTap={prefersReducedMotion ? undefined : { scale: 0.98 }}
              >
                {saving ? (
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                ) : (
                  <Save className="h-4 w-4" aria-hidden="true" />
                )}
                {saving ? "Guardando..." : "Guardar Producto"}
              </motion.button>
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};

export default CreateProductModal;
