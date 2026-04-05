import { useState } from "react";
import { motion } from "framer-motion";
import {
  Package, DollarSign, Hash, ImageIcon, Loader2, Save, X, Plus, Edit2, Trash2,
  Search, Tag, ToggleLeft, ToggleRight,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { formatCOP } from "@/lib/tarifas";

interface MarketplaceProduct {
  id: string;
  product_name: string;
  description: string | null;
  sku: string;
  cost_price: number;
  suggested_price: number;
  stock_available: number;
  image_url: string | null;
  is_active: boolean;
  created_at: string;
}

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
  const [imageUrl, setImageUrl] = useState("");

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
    setSuggestedPrice(""); setStock(""); setImageUrl("");
    setEditing(null); setShowForm(false);
  };

  const openEdit = (p: MarketplaceProduct) => {
    setEditing(p);
    setName(p.product_name);
    setDescription(p.description || "");
    setSku(p.sku);
    setCostPrice(String(p.cost_price));
    setSuggestedPrice(String(p.suggested_price));
    setStock(String(p.stock_available));
    setImageUrl(p.image_url || "");
    setShowForm(true);
  };

  const handleSave = async () => {
    if (!name.trim() || !sku.trim()) {
      toast.error("Nombre y SKU son obligatorios");
      return;
    }
    setSaving(true);
    try {
      const payload = {
        product_name: name.trim(),
        description: description.trim() || null,
        sku: sku.trim(),
        cost_price: Number(costPrice) || 0,
        suggested_price: Number(suggestedPrice) || 0,
        stock_available: Number(stock) || 0,
        image_url: imageUrl.trim() || null,
        organizacion_id: orgId,
        ...(editing ? {} : { created_by: user?.id }),
      };

      if (editing) {
        const { error } = await (supabase as any)
          .from("marketplace_products")
          .update(payload)
          .eq("id", editing.id);
        if (error) throw error;
        toast.success("Producto actualizado");
      } else {
        const { error } = await (supabase as any)
          .from("marketplace_products")
          .insert(payload);
        if (error) throw error;
        toast.success("Producto creado en el marketplace");
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
    const { error } = await (supabase as any)
      .from("marketplace_products")
      .update({ is_active: !p.is_active })
      .eq("id", p.id);
    if (error) { toast.error("Error al cambiar estado"); return; }
    toast.success(p.is_active ? "Producto desactivado" : "Producto activado");
    queryClient.invalidateQueries({ queryKey: ["marketplace-products"] });
  };

  const filtered = products.filter(p =>
    p.product_name.toLowerCase().includes(search.toLowerCase()) ||
    p.sku.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-foreground flex items-center gap-2">
            <Tag className="h-5 w-5 text-primary" />
            Marketplace Interno
          </h2>
          <p className="text-sm text-muted-foreground">
            Productos disponibles para las tiendas
          </p>
        </div>
        <Button onClick={() => { resetForm(); setShowForm(true); }} className="gap-2">
          <Plus className="h-4 w-4" /> Nuevo Producto
        </Button>
      </div>

      {/* Search */}
      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Buscar por nombre o SKU..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="pl-9"
        />
      </div>

      {/* Products Grid */}
      {isLoading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <Package className="h-12 w-12 mx-auto mb-3 opacity-40" />
          <p>No hay productos en el marketplace</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filtered.map(p => (
            <motion.div
              key={p.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              className={cn(
                "neu-flat rounded-2xl overflow-hidden transition-all hover:shadow-elevated",
                !p.is_active && "opacity-60",
              )}
            >
              {/* Image */}
              <div className="h-36 bg-muted flex items-center justify-center overflow-hidden">
                {p.image_url ? (
                  <img src={p.image_url} alt={p.product_name} className="h-full w-full object-cover" />
                ) : (
                  <ImageIcon className="h-10 w-10 text-muted-foreground/40" />
                )}
              </div>

              <div className="p-4 space-y-2">
                <div className="flex items-start justify-between">
                  <h3 className="font-semibold text-sm text-foreground line-clamp-2">{p.product_name}</h3>
                  <span className={cn(
                    "text-[10px] px-1.5 py-0.5 rounded-full font-medium",
                    p.is_active ? "bg-emerald-100 text-emerald-700" : "bg-muted text-muted-foreground",
                  )}>
                    {p.is_active ? "Activo" : "Inactivo"}
                  </span>
                </div>

                <p className="text-xs text-muted-foreground font-mono">SKU: {p.sku}</p>

                <div className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">Costo: {formatCOP(p.cost_price)}</span>
                  <span className="font-semibold text-primary">PVP: {formatCOP(p.suggested_price)}</span>
                </div>

                <div className="flex items-center justify-between">
                  <span className={cn(
                    "text-xs font-medium",
                    p.stock_available === 0 ? "text-destructive" : p.stock_available < 5 ? "text-amber-600" : "text-foreground",
                  )}>
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

      {/* Create/Edit Dialog */}
      <Dialog open={showForm} onOpenChange={v => { if (!v) resetForm(); }}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Package className="h-5 w-5 text-primary" />
              {editing ? "Editar Producto" : "Nuevo Producto Marketplace"}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div>
              <label className="text-xs font-medium text-muted-foreground">Nombre *</label>
              <Input value={name} onChange={e => setName(e.target.value)} placeholder="Ej: Camiseta Básica" />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground">Descripción</label>
              <Textarea value={description} onChange={e => setDescription(e.target.value)} placeholder="Descripción del producto..." rows={2} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-medium text-muted-foreground">SKU *</label>
                <Input value={sku} onChange={e => setSku(e.target.value)} placeholder="SKU-001" />
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground">Stock Actual</label>
                <Input type="number" min={0} value={stock} onChange={e => setStock(e.target.value)} placeholder="0" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-medium text-muted-foreground">Precio de Costo</label>
                <Input type="number" min={0} value={costPrice} onChange={e => setCostPrice(e.target.value)} placeholder="0" />
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground">Precio Sugerido (PVP)</label>
                <Input type="number" min={0} value={suggestedPrice} onChange={e => setSuggestedPrice(e.target.value)} placeholder="0" />
              </div>
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground">URL de Imagen</label>
              <Input value={imageUrl} onChange={e => setImageUrl(e.target.value)} placeholder="https://..." />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={resetForm} disabled={saving}>
              <X className="h-4 w-4 mr-1" /> Cancelar
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Save className="h-4 w-4 mr-1" />}
              {editing ? "Actualizar" : "Crear Producto"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default MarketplaceProductForm;
