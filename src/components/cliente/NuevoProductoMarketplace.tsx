/**
 * NuevoProductoMarketplace — Modal avanzado para crear productos.
 *
 * Reemplaza al CreateProductModal antiguo en la vista de Inventario.
 * Incluye: descripción, categorías, selector Simple/Variable + variantes,
 * 3 imágenes con compresión.
 *
 * Lógica de guardado por tipo de cuenta:
 *  - proveedor → inserta en `marketplace_products` (con variantes opcionales)
 *    y refleja una fila en `inventory` con `is_public = true` para que se
 *    publique en la Megabodega/Catálogo de Suministro.
 *  - dropshipper / legacy → inserta solo en `inventory` con `is_public = false`
 *    (privado, fulfillment). El selector Simple/Variable y variantes se
 *    ocultan porque el inventario privado no soporta variantes.
 */

import { useState, useRef, useCallback } from "react";
import { motion } from "framer-motion";
import { Package, Loader2, Save, X, Plus, Tag, Upload, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { compressImage } from "@/lib/imageCompression";
import { CATEGORY_TREE, CATEGORY_KEYS } from "@/lib/categoryTree";

const MAX_DESCRIPTION = 5000;
const MAX_IMAGE_BYTES = 1024 * 1024;

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  userId: string;
  tipoCuenta?: string | null;
  organizacionId?: string | null;
}

const NuevoProductoMarketplace = ({
  isOpen,
  onClose,
  onSuccess,
  userId,
  tipoCuenta,
  organizacionId,
}: Props) => {
  const isProveedor = tipoCuenta === "proveedor";

  const [saving, setSaving] = useState(false);
  const [uploadingImages, setUploadingImages] = useState(false);

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [especificaciones, setEspecificaciones] = useState("");
  const [garantia, setGarantia] = useState("");
  const [sku, setSku] = useState("");
  const [costPrice, setCostPrice] = useState("");
  const [suggestedPrice, setSuggestedPrice] = useState("");
  const [stock, setStock] = useState("");
  const [productType, setProductType] = useState("Simple");
  const [category, setCategory] = useState("");
  const [subcategory, setSubcategory] = useState("");

  const [attributeNames, setAttributeNames] = useState<string[]>([]);
  const [attributeValues, setAttributeValues] = useState<Record<string, string[]>>({});
  const [newAttrName, setNewAttrName] = useState("");
  const [variants, setVariants] = useState<
    Array<{
      variant_name: string;
      sku: string;
      price: string;
      cost_price: string;
      stock: string;
      attributes: Record<string, string>;
    }>
  >([]);

  const [imageFiles, setImageFiles] = useState<(File | null)[]>([null, null, null]);
  const [imagePreviews, setImagePreviews] = useState<(string | null)[]>([null, null, null]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const resetAndClose = () => {
    setName("");
    setDescription("");
    setEspecificaciones("");
    setGarantia("");
    setSku("");
    setCostPrice("");
    setSuggestedPrice("");
    setStock("");
    setProductType("Simple");
    setCategory("");
    setAttributeNames([]);
    setAttributeValues({});
    setNewAttrName("");
    setVariants([]);
    setImageFiles([null, null, null]);
    setImagePreviews([null, null, null]);
    onClose();
  };

  const handleImageSelect = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = Array.from(e.target.files || []);
      if (!files.length) return;

      const newFiles = [...imageFiles];
      const newPreviews = [...imagePreviews];

      for (const file of files) {
        const slot = newFiles.findIndex((f) => !f);
        if (slot < 0) {
          toast.error("Máximo 3 imágenes");
          break;
        }
        try {
          const compressed = await compressImage(file, MAX_IMAGE_BYTES);
          newFiles[slot] = new File([compressed.blob], file.name, { type: "image/jpeg" });
          newPreviews[slot] = compressed.base64;
        } catch {
          newFiles[slot] = file;
          newPreviews[slot] = URL.createObjectURL(file);
        }
      }
      setImageFiles(newFiles);
      setImagePreviews(newPreviews);
      if (fileInputRef.current) fileInputRef.current.value = "";
    },
    [imageFiles, imagePreviews],
  );

  const removeImage = (i: number) => {
    const nf = [...imageFiles];
    nf[i] = null;
    setImageFiles(nf);
    const np = [...imagePreviews];
    np[i] = null;
    setImagePreviews(np);
  };

  const uploadImages = async (): Promise<(string | null)[]> => {
    const urls: (string | null)[] = [null, null, null];
    setUploadingImages(true);
    try {
      const folder = organizacionId || userId;
      for (let i = 0; i < 3; i++) {
        const file = imageFiles[i];
        if (!file) continue;
        const path = `${folder}/${Date.now()}_${i}_${file.name.replace(/[^a-zA-Z0-9.]/g, "_")}`;
        const { error } = await supabase.storage
          .from("marketplace-images")
          .upload(path, file, { upsert: true });
        if (error) throw error;
        const { data: pub } = supabase.storage.from("marketplace-images").getPublicUrl(path);
        urls[i] = pub.publicUrl;
      }
    } finally {
      setUploadingImages(false);
    }
    return urls;
  };

  const addAttribute = () => {
    const a = newAttrName.trim();
    if (!a || attributeNames.includes(a)) return;
    setAttributeNames([...attributeNames, a]);
    setAttributeValues({ ...attributeValues, [a]: [] });
    setNewAttrName("");
  };

  const removeAttribute = (a: string) => {
    setAttributeNames(attributeNames.filter((x) => x !== a));
    const nv = { ...attributeValues };
    delete nv[a];
    setAttributeValues(nv);
    setVariants([]);
  };

  const addAttrValue = (a: string, v: string) => {
    const val = v.trim();
    if (!val || attributeValues[a]?.includes(val)) return;
    setAttributeValues({ ...attributeValues, [a]: [...(attributeValues[a] || []), val] });
  };

  const removeAttrValue = (a: string, v: string) => {
    setAttributeValues({
      ...attributeValues,
      [a]: (attributeValues[a] || []).filter((x) => x !== v),
    });
    setVariants([]);
  };

  const generateVariants = () => {
    const keys = attributeNames.filter((a) => (attributeValues[a] || []).length > 0);
    if (!keys.length) {
      toast.error("Define al menos un atributo con valores");
      return;
    }
    let combos: Record<string, string>[] = [{}];
    for (const k of keys) {
      const next: Record<string, string>[] = [];
      for (const c of combos) {
        for (const v of attributeValues[k]) {
          next.push({ ...c, [k]: v });
        }
      }
      combos = next;
    }
    const generated = combos.map((attrs, i) => ({
      variant_name: Object.values(attrs).join(" / "),
      sku: `${sku || "SKU"}-${i + 1}`,
      price: suggestedPrice || "0",
      cost_price: costPrice || "0",
      stock: "0",
      attributes: attrs,
    }));
    setVariants(generated);
    toast.success(`${generated.length} variantes generadas`);
  };

  const updateVariant = (i: number, field: string, value: string) => {
    const u = [...variants];
    (u[i] as any)[field] = value;
    setVariants(u);
  };

  const handleSave = async () => {
    if (!name.trim() || !sku.trim()) {
      toast.error("Nombre y SKU son obligatorios");
      return;
    }
    if (isProveedor && (!category || !subcategory)) {
      toast.error("Selecciona Categoría y Subcategoría");
      return;
    }
    if (productType === "Variable" && variants.length === 0) {
      toast.error("Genera las variantes antes de guardar");
      return;
    }

    setSaving(true);
    try {
      const imgUrls = await uploadImages();
      const totalStock =
        productType === "Variable"
          ? variants.reduce((s, v) => s + (Number(v.stock) || 0), 0)
          : Number(stock) || 0;

      if (isProveedor) {
        if (!organizacionId) {
          toast.error("Tu cuenta no tiene organización asignada");
          return;
        }
        // 1) Insertar en marketplace_products (catálogo público)
        const { data: inserted, error: mpErr } = await (supabase as any)
          .from("marketplace_products")
          .insert({
            product_name: name.trim(),
            description: description.trim() || null,
            sku: sku.trim(),
            cost_price: Number(costPrice) || 0,
            suggested_price: Number(suggestedPrice) || 0,
            stock_available: totalStock,
            image_url: imgUrls[0] || null,
            image_url_2: imgUrls[1] || null,
            image_url_3: imgUrls[2] || null,
            product_type: productType,
            category: category || null,
            subcategory: subcategory || null,
            organizacion_id: organizacionId,
            created_by: userId,
            is_active: true,
          })
          .select("id")
          .single();
        if (mpErr) throw mpErr;
        const productId = inserted.id;

        // 2) Variantes (si Variable)
        if (productType === "Variable" && variants.length > 0) {
          const rows = variants.map((v) => ({
            product_id: productId,
            variant_name: v.variant_name,
            sku: v.sku,
            price: Number(v.price) || null,
            cost_price: Number(v.cost_price) || null,
            stock_available: Number(v.stock) || 0,
            attributes: v.attributes,
            organizacion_id: organizacionId,
          }));
          const { error: vErr } = await (supabase as any)
            .from("product_variants")
            .insert(rows);
          if (vErr) console.error("Error insertando variantes:", vErr);
        }

        // 3) Reflejar en inventory (privado del proveedor) con is_public=true
        const { error: invErr } = await (supabase as any).from("inventory").insert({
          client_user_id: userId,
          sku: sku.trim().toUpperCase(),
          product_name: name.trim(),
          stock_available: totalStock,
          price: Number(suggestedPrice) || 0,
          low_stock_threshold: 5,
          image_url: imgUrls[0] || null,
          is_public: true,
        });
        if (invErr) console.error("Error reflejando en inventario:", invErr);

        toast.success("Producto publicado en el Catálogo de Suministro");
      } else {
        // Dropshipper / legacy: solo inventario privado
        const { error } = await (supabase as any).from("inventory").insert({
          client_user_id: userId,
          sku: sku.trim().toUpperCase(),
          product_name: name.trim(),
          stock_available: totalStock,
          price: Number(suggestedPrice) || Number(costPrice) || 0,
          low_stock_threshold: 5,
          image_url: imgUrls[0] || null,
          is_public: false,
        });
        if (error) {
          if (error.code === "23505") {
            toast.error(`Ya existe un producto con el SKU "${sku.trim().toUpperCase()}"`);
            return;
          }
          throw error;
        }
        toast.success("Producto agregado a tu inventario privado");
      }

      onSuccess();
      resetAndClose();
    } catch (e: any) {
      console.error(e);
      toast.error(e.message || "Error al guardar producto");
    } finally {
      setSaving(false);
    }
  };

  const activeSlots = imagePreviews.filter(Boolean).length;

  return (
    <Dialog open={isOpen} onOpenChange={(v) => !v && !saving && resetAndClose()}>
      <DialogContent className="sm:max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-lg">
            <Package className="h-5 w-5 text-primary" />
            {isProveedor ? "Nuevo Producto Marketplace" : "Nuevo Producto"}
          </DialogTitle>
          {isProveedor && (
            <p className="text-xs text-muted-foreground">
              Se publicará automáticamente en el Catálogo de Suministro (Megabodega).
            </p>
          )}
        </DialogHeader>

        <div className="space-y-5 py-2">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">
                Nombre del Producto *
              </label>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Ej: Camiseta Básica"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">SKU *</label>
              <Input value={sku} onChange={(e) => setSku(e.target.value)} placeholder="SKU-001" />
            </div>
            {isProveedor && (
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">
                  Tipo de Producto
                </label>
                <Select value={productType} onValueChange={setProductType}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Simple">Simple</SelectItem>
                    <SelectItem value="Variable">Variable</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">
                Precio de Costo
              </label>
              <Input
                type="number"
                min={0}
                value={costPrice}
                onChange={(e) => setCostPrice(e.target.value)}
                placeholder="$0"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">
                {isProveedor ? "Precio Sugerido (PVP)" : "Precio de Venta"}
              </label>
              <Input
                type="number"
                min={0}
                value={suggestedPrice}
                onChange={(e) => setSuggestedPrice(e.target.value)}
                placeholder="$0"
              />
            </div>
            {productType === "Simple" && (
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">
                  Stock Actual
                </label>
                <Input
                  type="number"
                  min={0}
                  value={stock}
                  onChange={(e) => setStock(e.target.value)}
                  placeholder="0"
                />
              </div>
            )}
          </div>

          {isProveedor && (
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">
                  Categoría *
                </label>
                <Select
                  value={category}
                  onValueChange={(v) => {
                    setCategory(v);
                    setSubcategory(""); // reset subcategoría al cambiar la principal
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Seleccionar categoría..." />
                  </SelectTrigger>
                  <SelectContent>
                    {CATEGORY_KEYS.map((c) => (
                      <SelectItem key={c} value={c}>
                        {c}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">
                  Subcategoría *
                </label>
                <Select
                  value={subcategory}
                  onValueChange={setSubcategory}
                  disabled={!category}
                >
                  <SelectTrigger>
                    <SelectValue
                      placeholder={
                        category ? "Seleccionar subcategoría..." : "Elige una categoría primero"
                      }
                    />
                  </SelectTrigger>
                  <SelectContent>
                    {(CATEGORY_TREE[category] || []).map((s) => (
                      <SelectItem key={s} value={s}>
                        {s}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}


          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1 block">
              Descripción
            </label>
            <Textarea
              value={description}
              onChange={(e) => {
                if (e.target.value.length <= MAX_DESCRIPTION) setDescription(e.target.value);
              }}
              placeholder="Descripción detallada del producto..."
              rows={4}
              className="resize-none"
            />
            <p
              className={cn(
                "text-xs mt-1 text-right",
                description.length > MAX_DESCRIPTION * 0.9
                  ? "text-destructive"
                  : "text-muted-foreground",
              )}
            >
              Caracteres: {description.length}/{MAX_DESCRIPTION}
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">
                Especificaciones
              </label>
              <Textarea
                value={especificaciones}
                onChange={(e) => setEspecificaciones(e.target.value)}
                placeholder="Ej: Medidas 30x20 cm, peso 500g, material acero inoxidable..."
                rows={4}
                className="resize-none"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">
                Garantía
              </label>
              <Textarea
                value={garantia}
                onChange={(e) => setGarantia(e.target.value)}
                placeholder="Ej: 30 días por defectos de fábrica."
                rows={4}
                className="resize-none"
              />
            </div>
          </div>

          {isProveedor && productType === "Variable" && (
            <div className="space-y-4 border border-primary/20 rounded-xl p-4 bg-primary/5">
              <h4 className="text-sm font-semibold text-foreground flex items-center gap-2">
                <Tag className="h-4 w-4 text-primary" /> Atributos y Variantes
              </h4>

              <div className="flex gap-2">
                <Input
                  value={newAttrName}
                  onChange={(e) => setNewAttrName(e.target.value)}
                  placeholder="Nombre del atributo (ej: Color, Talla)"
                  className="flex-1"
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      addAttribute();
                    }
                  }}
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={addAttribute}
                  className="gap-1"
                >
                  <Plus className="h-3.5 w-3.5" /> Añadir
                </Button>
              </div>

              {attributeNames.map((attr) => (
                <div key={attr} className="space-y-2 bg-background/80 rounded-lg p-3 border">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-foreground">{attr}</span>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6"
                      onClick={() => removeAttribute(attr)}
                    >
                      <Trash2 className="h-3 w-3 text-destructive" />
                    </Button>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {(attributeValues[attr] || []).map((val) => (
                      <span
                        key={val}
                        className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-primary/10 text-primary text-xs"
                      >
                        {val}
                        <button
                          type="button"
                          onClick={() => removeAttrValue(attr, val)}
                          className="hover:text-destructive"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </span>
                    ))}
                  </div>
                  <Input
                    placeholder={`Agregar valor para ${attr} (Enter)`}
                    className="text-xs h-8"
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        addAttrValue(attr, (e.target as HTMLInputElement).value);
                        (e.target as HTMLInputElement).value = "";
                      }
                    }}
                  />
                </div>
              ))}

              {attributeNames.length > 0 && (
                <Button
                  type="button"
                  onClick={generateVariants}
                  variant="secondary"
                  className="w-full gap-2"
                >
                  <Package className="h-4 w-4" /> Generar Variantes
                </Button>
              )}

              {variants.length > 0 && (
                <div className="border rounded-lg overflow-hidden">
                  <div className="max-h-60 overflow-y-auto">
                    <table className="w-full text-xs">
                      <thead className="bg-muted sticky top-0">
                        <tr>
                          <th className="px-2 py-1.5 text-left font-medium">Variante</th>
                          <th className="px-2 py-1.5 text-left font-medium">SKU</th>
                          <th className="px-2 py-1.5 text-left font-medium">Precio</th>
                          <th className="px-2 py-1.5 text-left font-medium">Costo</th>
                          <th className="px-2 py-1.5 text-left font-medium">Stock</th>
                        </tr>
                      </thead>
                      <tbody>
                        {variants.map((v, i) => (
                          <tr key={i} className="border-t">
                            <td className="px-2 py-1.5 font-medium">{v.variant_name}</td>
                            <td className="px-2 py-1">
                              <Input
                                value={v.sku}
                                onChange={(e) => updateVariant(i, "sku", e.target.value)}
                                className="h-7 text-xs"
                              />
                            </td>
                            <td className="px-2 py-1">
                              <Input
                                type="number"
                                value={v.price}
                                onChange={(e) => updateVariant(i, "price", e.target.value)}
                                className="h-7 text-xs w-20"
                              />
                            </td>
                            <td className="px-2 py-1">
                              <Input
                                type="number"
                                value={v.cost_price}
                                onChange={(e) => updateVariant(i, "cost_price", e.target.value)}
                                className="h-7 text-xs w-20"
                              />
                            </td>
                            <td className="px-2 py-1">
                              <Input
                                type="number"
                                value={v.stock}
                                onChange={(e) => updateVariant(i, "stock", e.target.value)}
                                className="h-7 text-xs w-16"
                              />
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <div className="bg-muted px-3 py-1.5 text-xs text-muted-foreground">
                    {variants.length} variantes · Stock total:{" "}
                    {variants.reduce((s, v) => s + (Number(v.stock) || 0), 0)}
                  </div>
                </div>
              )}
            </div>
          )}

          <div>
            <label className="text-xs font-medium text-muted-foreground mb-2 block">
              Imágenes del Producto (máx. 3)
            </label>
            <div className="grid grid-cols-3 gap-3">
              {[0, 1, 2].map((i) => {
                const src = imagePreviews[i];
                return (
                  <div
                    key={i}
                    className={cn(
                      "relative aspect-square rounded-xl border-2 border-dashed flex items-center justify-center overflow-hidden transition-all",
                      src
                        ? "border-primary/40 bg-primary/5"
                        : "border-border bg-muted/50 hover:border-primary/30 hover:bg-muted",
                    )}
                  >
                    {src ? (
                      <>
                        <img
                          src={src}
                          alt={`Imagen ${i + 1}`}
                          className="h-full w-full object-cover rounded-lg"
                        />
                        <button
                          type="button"
                          onClick={() => removeImage(i)}
                          className="absolute top-1.5 right-1.5 bg-destructive text-destructive-foreground rounded-full p-1 shadow-md hover:scale-110 transition-transform"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </>
                    ) : (
                      <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        className="flex flex-col items-center gap-1.5 text-muted-foreground hover:text-primary transition-colors p-4"
                      >
                        <Upload className="h-6 w-6" />
                        <span className="text-[10px] font-medium">Subir imagen</span>
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              multiple
              className="hidden"
              onChange={handleImageSelect}
            />
            <p className="text-xs text-muted-foreground mt-1.5">
              Las imágenes se comprimen automáticamente a máx. 1MB. {activeSlots}/3 subidas.
            </p>
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={resetAndClose} disabled={saving || uploadingImages}>
            <X className="h-4 w-4 mr-1" /> Cancelar
          </Button>
          <Button onClick={handleSave} disabled={saving || uploadingImages}>
            {saving || uploadingImages ? (
              <Loader2 className="h-4 w-4 animate-spin mr-1" />
            ) : (
              <Save className="h-4 w-4 mr-1" />
            )}
            {isProveedor ? "Publicar Producto" : "Crear Producto"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default NuevoProductoMarketplace;
