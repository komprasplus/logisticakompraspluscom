import { useState, useRef, useCallback } from "react";
import { motion } from "framer-motion";
import {
  Package, Loader2, Save, X, Plus, Edit2, ImageIcon,
  Search, Tag, ToggleLeft, ToggleRight, Upload, Trash2,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { formatCOP } from "@/lib/tarifas";
import { compressImage, formatFileSize } from "@/lib/imageCompression";

interface MarketplaceProduct {
  id: string;
  product_name: string;
  description: string | null;
  sku: string;
  cost_price: number;
  suggested_price: number;
  stock_available: number;
  image_url: string | null;
  image_url_2: string | null;
  image_url_3: string | null;
  is_active: boolean;
  created_at: string;
  product_type: string;
  category: string | null;
}

const CATEGORIES = [
  "Salud y Belleza",
  "Hogar y Cocina",
  "Tecnología y Gadgets",
  "Moda y Accesorios",
  "Juguetes y Bebés",
  "Deportes y Aire Libre",
  "Autopartes y Accesorios",
  "Otros",
];

const MAX_DESCRIPTION = 5000;
const MAX_IMAGE_BYTES = 1024 * 1024; // 1MB

const MarketplaceProductForm = () => {
  const { user, profile } = useAuth();
  const queryClient = useQueryClient();
  const orgId = profile?.organizacion_id;

  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<MarketplaceProduct | null>(null);
  const [search, setSearch] = useState("");
  const [saving, setSaving] = useState(false);

  // Form fields
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [sku, setSku] = useState("");
  const [costPrice, setCostPrice] = useState("");
  const [suggestedPrice, setSuggestedPrice] = useState("");
  const [stock, setStock] = useState("");
  const [productType, setProductType] = useState("Simple");
  const [category, setCategory] = useState("");

  // Variant fields
  const [attributeNames, setAttributeNames] = useState<string[]>([]);
  const [attributeValues, setAttributeValues] = useState<Record<string, string[]>>({});
  const [newAttrName, setNewAttrName] = useState("");
  const [variants, setVariants] = useState<Array<{
    variant_name: string;
    sku: string;
    price: string;
    cost_price: string;
    stock: string;
    attributes: Record<string, string>;
  }>>([]);

  // Images state: up to 3
  const [imageFiles, setImageFiles] = useState<(File | null)[]>([null, null, null]);
  const [imagePreviews, setImagePreviews] = useState<(string | null)[]>([null, null, null]);
  const [existingUrls, setExistingUrls] = useState<(string | null)[]>([null, null, null]);
  const [uploadingImages, setUploadingImages] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { data: products = [], isLoading } = useQuery({
    queryKey: ["marketplace-products", orgId],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("marketplace_products")
        .select("*")
        .eq("organizacion_id", orgId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as MarketplaceProduct[];
    },
    enabled: !!orgId,
  });

  const resetForm = () => {
    setName(""); setDescription(""); setSku(""); setCostPrice("");
    setSuggestedPrice(""); setStock(""); setProductType("Simple");
    setCategory(""); setEditing(null); setShowForm(false);
    setImageFiles([null, null, null]);
    setImagePreviews([null, null, null]);
    setExistingUrls([null, null, null]);
    setAttributeNames([]); setAttributeValues({});
    setNewAttrName(""); setVariants([]);
  };

  const openEdit = (p: MarketplaceProduct) => {
    setEditing(p);
    setName(p.product_name);
    setDescription(p.description || "");
    setSku(p.sku);
    setCostPrice(String(p.cost_price));
    setSuggestedPrice(String(p.suggested_price));
    setStock(String(p.stock_available));
    setProductType(p.product_type || "Simple");
    setCategory(p.category || "");
    setExistingUrls([p.image_url || null, p.image_url_2 || null, p.image_url_3 || null]);
    setImageFiles([null, null, null]);
    setImagePreviews([null, null, null]);
    setShowForm(true);
  };

  const handleImageSelect = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;

    const newFiles = [...imageFiles];
    const newPreviews = [...imagePreviews];

    for (const file of files) {
      const emptySlot = newFiles.findIndex((f, i) => !f && !existingUrls[i]);
      const slot = emptySlot >= 0 ? emptySlot : newFiles.findIndex(f => !f);
      if (slot < 0) { toast.error("Máximo 3 imágenes"); break; }

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
  }, [imageFiles, imagePreviews, existingUrls]);

  const removeImage = (index: number) => {
    const nf = [...imageFiles]; nf[index] = null; setImageFiles(nf);
    const np = [...imagePreviews]; np[index] = null; setImagePreviews(np);
    const eu = [...existingUrls]; eu[index] = null; setExistingUrls(eu);
  };

  const uploadImages = async (): Promise<(string | null)[]> => {
    const urls: (string | null)[] = [...existingUrls];
    setUploadingImages(true);
    try {
      for (let i = 0; i < 3; i++) {
        const file = imageFiles[i];
        if (!file) continue;
        const path = `${orgId}/${Date.now()}_${i}_${file.name.replace(/[^a-zA-Z0-9.]/g, '_')}`;
        const { error } = await supabase.storage.from("marketplace-images").upload(path, file, { upsert: true });
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
    const attr = newAttrName.trim();
    if (!attr || attributeNames.includes(attr)) return;
    setAttributeNames([...attributeNames, attr]);
    setAttributeValues({ ...attributeValues, [attr]: [] });
    setNewAttrName("");
  };

  const removeAttribute = (attr: string) => {
    setAttributeNames(attributeNames.filter(a => a !== attr));
    const newVals = { ...attributeValues };
    delete newVals[attr];
    setAttributeValues(newVals);
    setVariants([]);
  };

  const addAttrValue = (attr: string, value: string) => {
    const v = value.trim();
    if (!v || attributeValues[attr]?.includes(v)) return;
    setAttributeValues({ ...attributeValues, [attr]: [...(attributeValues[attr] || []), v] });
  };

  const removeAttrValue = (attr: string, value: string) => {
    setAttributeValues({
      ...attributeValues,
      [attr]: (attributeValues[attr] || []).filter(v => v !== value),
    });
    setVariants([]);
  };

  const generateVariants = () => {
    const attrKeys = attributeNames.filter(a => (attributeValues[a] || []).length > 0);
    if (attrKeys.length === 0) { toast.error("Define al menos un atributo con valores"); return; }

    const combos: Record<string, string>[][] = [[]];
    for (const key of attrKeys) {
      const newCombos: Record<string, string>[][] = [];
      for (const combo of combos) {
        for (const val of attributeValues[key]) {
          newCombos.push([...combo, { [key]: val }]);
        }
      }
      combos.length = 0;
      combos.push(...newCombos);
    }

    const generated = (combos as Record<string, string>[][]).map((combo, i) => {
      const attrs = Object.assign({}, ...combo);
      const variantName = Object.values(attrs).join(" / ");
      return {
        variant_name: variantName,
        sku: `${sku || "SKU"}-${i + 1}`,
        price: suggestedPrice || "0",
        cost_price: costPrice || "0",
        stock: "0",
        attributes: attrs,
      };
    });

    setVariants(generated);
    toast.success(`${generated.length} variantes generadas`);
  };

  const updateVariant = (index: number, field: string, value: string) => {
    const updated = [...variants];
    (updated[index] as any)[field] = value;
    setVariants(updated);
  };

  const handleSave = async () => {
    if (!name.trim() || !sku.trim()) {
      toast.error("Nombre y SKU son obligatorios"); return;
    }
    if (productType === "Variable" && variants.length === 0) {
      toast.error("Genera las variantes antes de guardar"); return;
    }
    setSaving(true);
    try {
      const imgUrls = await uploadImages();
      const payload: any = {
        product_name: name.trim(),
        description: description.trim() || null,
        sku: sku.trim(),
        cost_price: Number(costPrice) || 0,
        suggested_price: Number(suggestedPrice) || 0,
        stock_available: productType === "Variable" ? variants.reduce((sum, v) => sum + (Number(v.stock) || 0), 0) : Number(stock) || 0,
        image_url: imgUrls[0] || null,
        image_url_2: imgUrls[1] || null,
        image_url_3: imgUrls[2] || null,
        product_type: productType,
        category: category || null,
        organizacion_id: orgId,
        ...(editing ? {} : { created_by: user?.id }),
      };

      let productId: string;
      if (editing) {
        const { error } = await (supabase as any).from("marketplace_products").update(payload).eq("id", editing.id);
        if (error) throw error;
        productId = editing.id;
        toast.success("Producto actualizado");
      } else {
        const { data: inserted, error } = await (supabase as any).from("marketplace_products").insert(payload).select("id").single();
        if (error) throw error;
        productId = inserted.id;
        toast.success("Producto creado en el marketplace");
      }

      // Save variants for variable products
      if (productType === "Variable" && variants.length > 0) {
        // Delete existing variants if editing
        if (editing) {
          await (supabase as any).from("product_variants").delete().eq("product_id", productId);
        }
        const variantRows = variants.map(v => ({
          product_id: productId,
          variant_name: v.variant_name,
          sku: v.sku,
          price: Number(v.price) || null,
          cost_price: Number(v.cost_price) || null,
          stock_available: Number(v.stock) || 0,
          attributes: v.attributes,
          organizacion_id: orgId,
        }));
        const { error: varError } = await (supabase as any).from("product_variants").insert(variantRows);
        if (varError) console.error("Error saving variants:", varError);
      }

      queryClient.invalidateQueries({ queryKey: ["marketplace-products"] });
      resetForm();
    } catch (e: any) {
      toast.error(e.message || "Error al guardar");
    } finally {
      setSaving(false);
    }
  };

  const toggleActive = async (p: MarketplaceProduct) => {
    const { error } = await (supabase as any).from("marketplace_products").update({ is_active: !p.is_active }).eq("id", p.id);
    if (error) { toast.error("Error al cambiar estado"); return; }
    toast.success(p.is_active ? "Producto desactivado" : "Producto activado");
    queryClient.invalidateQueries({ queryKey: ["marketplace-products"] });
  };

  const filtered = products.filter(p =>
    p.product_name.toLowerCase().includes(search.toLowerCase()) ||
    p.sku.toLowerCase().includes(search.toLowerCase())
  );

  const activeSlots = imagePreviews.map((p, i) => p || existingUrls[i]).filter(Boolean).length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-foreground flex items-center gap-2">
            <Tag className="h-5 w-5 text-primary" /> Marketplace Interno
          </h2>
          <p className="text-sm text-muted-foreground">Productos disponibles para las tiendas</p>
        </div>
        <Button onClick={() => { resetForm(); setShowForm(true); }} className="gap-2">
          <Plus className="h-4 w-4" /> Nuevo Producto
        </Button>
      </div>

      {/* Search */}
      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input placeholder="Buscar por nombre o SKU..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
      </div>

      {/* Products Grid */}
      {isLoading ? (
        <div className="flex justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <Package className="h-12 w-12 mx-auto mb-3 opacity-40" />
          <p>No hay productos en el marketplace</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filtered.map(p => (
            <motion.div key={p.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
              className={cn("neu-flat rounded-2xl overflow-hidden transition-all hover:shadow-elevated", !p.is_active && "opacity-60")}>
              <div className="h-36 bg-muted flex items-center justify-center overflow-hidden">
                {p.image_url ? <img src={p.image_url} alt={p.product_name} className="h-full w-full object-cover" />
                  : <ImageIcon className="h-10 w-10 text-muted-foreground/40" />}
              </div>
              <div className="p-4 space-y-2">
                <div className="flex items-start justify-between">
                  <h3 className="font-semibold text-sm text-foreground line-clamp-2">{p.product_name}</h3>
                  <span className={cn("text-[10px] px-1.5 py-0.5 rounded-full font-medium",
                    p.is_active ? "bg-emerald-100 text-emerald-700" : "bg-muted text-muted-foreground")}>
                    {p.is_active ? "Activo" : "Inactivo"}
                  </span>
                </div>
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <span className="font-mono">SKU: {p.sku}</span>
                  {p.category && <span className="bg-primary/10 text-primary px-1.5 py-0.5 rounded text-[10px]">{p.category}</span>}
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">Costo: {formatCOP(p.cost_price)}</span>
                  <span className="font-semibold text-primary">PVP: {formatCOP(p.suggested_price)}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className={cn("text-xs font-medium",
                    p.stock_available === 0 ? "text-destructive" : p.stock_available < 5 ? "text-amber-600" : "text-foreground")}>
                    Stock: {p.stock_available}
                  </span>
                  <div className="flex gap-1">
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => toggleActive(p)}>
                      {p.is_active ? <ToggleRight className="h-4 w-4 text-emerald-600" /> : <ToggleLeft className="h-4 w-4" />}
                    </Button>
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(p)}>
                      <Edit2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      )}

      {/* Create/Edit Dialog — Premium Redesign */}
      <Dialog open={showForm} onOpenChange={v => { if (!v) resetForm(); }}>
        <DialogContent className="sm:max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-lg">
              <Package className="h-5 w-5 text-primary" />
              {editing ? "Editar Producto" : "Nuevo Producto Marketplace"}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-5 py-2">
            {/* Row 1: Name, SKU, Type */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="sm:col-span-1">
                <label className="text-xs font-medium text-muted-foreground mb-1 block">Nombre del Producto *</label>
                <Input value={name} onChange={e => setName(e.target.value)} placeholder="Ej: Camiseta Básica" />
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">SKU *</label>
                <Input value={sku} onChange={e => setSku(e.target.value)} placeholder="SKU-001" />
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">Tipo de Producto</label>
                <Select value={productType} onValueChange={setProductType}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Simple">Simple</SelectItem>
                    <SelectItem value="Variable">Variable</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Row 2: Cost, PVP, Stock */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">Precio de Costo</label>
                <Input type="number" min={0} value={costPrice} onChange={e => setCostPrice(e.target.value)} placeholder="$0" />
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">Precio Sugerido (PVP)</label>
                <Input type="number" min={0} value={suggestedPrice} onChange={e => setSuggestedPrice(e.target.value)} placeholder="$0" />
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">Stock Actual</label>
                <Input type="number" min={0} value={stock} onChange={e => setStock(e.target.value)} placeholder="0" />
              </div>
            </div>

            {/* Row 3: Category */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">Categoría</label>
                <Select value={category} onValueChange={setCategory}>
                  <SelectTrigger><SelectValue placeholder="Seleccionar categoría..." /></SelectTrigger>
                  <SelectContent>
                    {CATEGORIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Description with char counter */}
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Descripción</label>
              <Textarea
                value={description}
                onChange={e => { if (e.target.value.length <= MAX_DESCRIPTION) setDescription(e.target.value); }}
                placeholder="Descripción detallada del producto..."
                rows={4}
                className="resize-none"
              />
              <p className={cn("text-xs mt-1 text-right",
                description.length > MAX_DESCRIPTION * 0.9 ? "text-destructive" : "text-muted-foreground")}>
                Caracteres: {description.length}/{MAX_DESCRIPTION}
              </p>
            </div>

            {/* Variable Product: Attributes & Variants */}
            {productType === "Variable" && (
              <div className="space-y-4 border border-primary/20 rounded-xl p-4 bg-primary/5">
                <h4 className="text-sm font-semibold text-foreground flex items-center gap-2">
                  <Tag className="h-4 w-4 text-primary" /> Atributos y Variantes
                </h4>

                {/* Add attribute */}
                <div className="flex gap-2">
                  <Input
                    value={newAttrName}
                    onChange={e => setNewAttrName(e.target.value)}
                    placeholder="Nombre del atributo (ej: Color, Talla)"
                    className="flex-1"
                    onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); addAttribute(); } }}
                  />
                  <Button type="button" variant="outline" size="sm" onClick={addAttribute} className="gap-1">
                    <Plus className="h-3.5 w-3.5" /> Añadir
                  </Button>
                </div>

                {/* Attribute values */}
                {attributeNames.map(attr => (
                  <div key={attr} className="space-y-2 bg-background/80 rounded-lg p-3 border">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold text-foreground">{attr}</span>
                      <Button type="button" variant="ghost" size="icon" className="h-6 w-6" onClick={() => removeAttribute(attr)}>
                        <Trash2 className="h-3 w-3 text-destructive" />
                      </Button>
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {(attributeValues[attr] || []).map(val => (
                        <span key={val} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-primary/10 text-primary text-xs">
                          {val}
                          <button type="button" onClick={() => removeAttrValue(attr, val)} className="hover:text-destructive">
                            <X className="h-3 w-3" />
                          </button>
                        </span>
                      ))}
                    </div>
                    <Input
                      placeholder={`Agregar valor para ${attr} (Enter)`}
                      className="text-xs h-8"
                      onKeyDown={e => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          addAttrValue(attr, (e.target as HTMLInputElement).value);
                          (e.target as HTMLInputElement).value = "";
                        }
                      }}
                    />
                  </div>
                ))}

                {/* Generate button */}
                {attributeNames.length > 0 && (
                  <Button type="button" onClick={generateVariants} variant="secondary" className="w-full gap-2">
                    <Package className="h-4 w-4" /> Generar Variantes
                  </Button>
                )}

                {/* Variants table */}
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
                                <Input value={v.sku} onChange={e => updateVariant(i, "sku", e.target.value)} className="h-7 text-xs" />
                              </td>
                              <td className="px-2 py-1">
                                <Input type="number" value={v.price} onChange={e => updateVariant(i, "price", e.target.value)} className="h-7 text-xs w-20" />
                              </td>
                              <td className="px-2 py-1">
                                <Input type="number" value={v.cost_price} onChange={e => updateVariant(i, "cost_price", e.target.value)} className="h-7 text-xs w-20" />
                              </td>
                              <td className="px-2 py-1">
                                <Input type="number" value={v.stock} onChange={e => updateVariant(i, "stock", e.target.value)} className="h-7 text-xs w-16" />
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    <div className="bg-muted px-3 py-1.5 text-xs text-muted-foreground">
                      {variants.length} variantes · Stock total: {variants.reduce((s, v) => s + (Number(v.stock) || 0), 0)}
                    </div>
                  </div>
                )}
              </div>
            )}

            <div>
              <label className="text-xs font-medium text-muted-foreground mb-2 block">Imágenes del Producto (máx. 3)</label>
              <div className="grid grid-cols-3 gap-3">
                {[0, 1, 2].map(i => {
                  const src = imagePreviews[i] || existingUrls[i];
                  return (
                    <div key={i} className={cn(
                      "relative aspect-square rounded-xl border-2 border-dashed flex items-center justify-center overflow-hidden transition-all",
                      src ? "border-primary/40 bg-primary/5" : "border-border bg-muted/50 hover:border-primary/30 hover:bg-muted"
                    )}>
                      {src ? (
                        <>
                          <img src={src} alt={`Imagen ${i + 1}`} className="h-full w-full object-cover rounded-lg" />
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
            <Button variant="outline" onClick={resetForm} disabled={saving || uploadingImages}>
              <X className="h-4 w-4 mr-1" /> Cancelar
            </Button>
            <Button onClick={handleSave} disabled={saving || uploadingImages}>
              {(saving || uploadingImages) ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Save className="h-4 w-4 mr-1" />}
              {editing ? "Actualizar" : "Crear Producto"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default MarketplaceProductForm;
