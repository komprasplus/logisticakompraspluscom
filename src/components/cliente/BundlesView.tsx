import { useMemo, useState } from "react";
import {
  Package,
  Plus,
  Loader2,
  Layers,
  Archive,
  Search,
  X,
  Check,
} from "lucide-react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  useBundles,
  useCrearBundle,
  useActualizarBundle,
  useArchivarBundle,
  useInventarioPublico,
  type Bundle,
} from "@/hooks/useBundles";
import { formatCOP } from "@/lib/tarifas";
import { cn } from "@/lib/utils";

const slugify = (s: string) =>
  s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 60);

const BundlesView = () => {
  const { data: bundles, isLoading } = useBundles();
  const { data: inventario } = useInventarioPublico();
  const crear = useCrearBundle();
  const actualizar = useActualizarBundle();
  const archivar = useArchivarBundle();

  const [modalOpen, setModalOpen] = useState(false);
  const [nombre, setNombre] = useState("");
  const [slug, setSlug] = useState("");
  const [descripcion, setDescripcion] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [descuentoTipo, setDescuentoTipo] = useState<"percent" | "fixed">("percent");
  const [descuentoValor, setDescuentoValor] = useState("");
  const [items, setItems] = useState<Record<string, number>>({}); // productId → qty
  const [searchProducts, setSearchProducts] = useState("");

  const reset = () => {
    setNombre("");
    setSlug("");
    setDescripcion("");
    setImageUrl("");
    setDescuentoTipo("percent");
    setDescuentoValor("");
    setItems({});
    setSearchProducts("");
  };

  const filteredProducts = useMemo(() => {
    const q = searchProducts.trim().toLowerCase();
    if (!q) return inventario ?? [];
    return (inventario ?? []).filter(
      (p) => p.product_name.toLowerCase().includes(q) || p.sku.toLowerCase().includes(q),
    );
  }, [inventario, searchProducts]);

  const selectedProductsList = useMemo(() => {
    return Object.entries(items).map(([productId, qty]) => {
      const p = inventario?.find((x) => x.id === productId);
      return { id: productId, qty, ...(p ?? {}) };
    });
  }, [items, inventario]);

  const subtotal = useMemo(() => {
    return selectedProductsList.reduce(
      (s, it) => s + (Number((it as any).cost_price ?? (it as any).price ?? 0) * it.qty),
      0,
    );
  }, [selectedProductsList]);

  const ahorroEstimado = useMemo(() => {
    const v = Number(descuentoValor) || 0;
    if (descuentoTipo === "percent") return Math.round((subtotal * v) / 100);
    return Math.min(v, subtotal);
  }, [descuentoTipo, descuentoValor, subtotal]);

  const handleSubmit = async () => {
    if (!nombre.trim() || !slug.trim() || !descuentoValor || Object.keys(items).length === 0) {
      toast.error("Nombre, slug, descuento e items son obligatorios");
      return;
    }
    const valorNum = Number(descuentoValor);
    if (descuentoTipo === "percent" && (valorNum <= 0 || valorNum > 80)) {
      toast.error("El porcentaje debe estar entre 1 y 80");
      return;
    }
    try {
      await crear.mutateAsync({
        nombre: nombre.trim(),
        slug: slug.trim(),
        descuento_tipo: descuentoTipo,
        descuento_valor: valorNum,
        descripcion: descripcion.trim() || null,
        image_url: imageUrl.trim() || null,
        items: Object.entries(items).map(([product_id, quantity]) => ({ product_id, quantity })),
      });
      toast.success(`Combo "${nombre}" creado`);
      reset();
      setModalOpen(false);
    } catch (e: any) {
      toast.error(e?.message || "No se pudo crear el combo");
    }
  };

  const toggleActivo = async (b: Bundle) => {
    try {
      await actualizar.mutateAsync({ id: b.id, activo: !b.activo });
      toast.success(b.activo ? "Combo desactivado" : "Combo reactivado");
    } catch (e: any) {
      toast.error(e?.message || "Error");
    }
  };

  const handleArchivar = async (b: Bundle) => {
    if (!confirm(`¿Archivar "${b.nombre}"?`)) return;
    try {
      await archivar.mutateAsync(b.id);
      toast.success("Combo archivado");
    } catch (e: any) {
      toast.error(e?.message || "Error");
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-black tracking-tight flex items-center gap-2">
            <Layers className="h-6 w-6 text-primary" />
            Combos (Bundles)
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Agrupa productos con descuento. El combo se publica en el catálogo y
            sube tu ticket promedio.
          </p>
        </div>
        <Button onClick={() => setModalOpen(true)} className="gap-1.5">
          <Plus className="h-4 w-4" /> Nuevo combo
        </Button>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-10">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </div>
      ) : !bundles || bundles.length === 0 ? (
        <div className="border border-dashed border-border rounded-xl p-10 text-center">
          <Layers className="h-12 w-12 mx-auto text-muted-foreground/40" />
          <p className="text-sm text-muted-foreground mt-3">
            Aún no tienes combos. Crea uno para empezar a ofrecer descuentos por agrupación.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {bundles.map((b) => {
            const total = b.items.reduce(
              (s, it) => s + (Number(it.price ?? 0) * it.quantity),
              0,
            );
            const ahorro =
              b.descuento_tipo === "percent"
                ? Math.round((total * b.descuento_valor) / 100)
                : Math.min(b.descuento_valor, total);
            const final = Math.max(0, total - ahorro);

            return (
              <div
                key={b.id}
                className={cn(
                  "rounded-xl border bg-card p-4 flex flex-col gap-3",
                  b.activo ? "border-border" : "border-border/60 opacity-70",
                )}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <h3 className="font-bold text-foreground truncate">{b.nombre}</h3>
                    <p className="text-[11px] text-muted-foreground font-mono">{b.slug}</p>
                  </div>
                  <Switch checked={b.activo} onCheckedChange={() => toggleActivo(b)} />
                </div>
                {b.descripcion && (
                  <p className="text-xs text-muted-foreground line-clamp-2">{b.descripcion}</p>
                )}
                <div className="bg-muted/50 rounded-md p-2 space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-muted-foreground">Suma productos</span>
                    <span className="tabular-nums">{formatCOP(total)}</span>
                  </div>
                  <div className="flex items-center justify-between text-xs text-emerald-600">
                    <span>
                      Descuento{" "}
                      {b.descuento_tipo === "percent" ? `${b.descuento_valor}%` : "fijo"}
                    </span>
                    <span className="tabular-nums">-{formatCOP(ahorro)}</span>
                  </div>
                  <div className="flex items-center justify-between text-sm font-bold pt-1 border-t border-border">
                    <span>Precio combo</span>
                    <span className="tabular-nums text-primary">{formatCOP(final)}</span>
                  </div>
                </div>
                <div className="text-[11px] text-muted-foreground">
                  {b.items_count} producto{b.items_count !== 1 ? "s" : ""}:
                  <span className="ml-1 text-foreground">
                    {b.items.slice(0, 3).map((it) => `${it.quantity}× ${it.product_name}`).join(", ")}
                    {b.items.length > 3 && ` +${b.items.length - 3} más`}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => handleArchivar(b)}
                  className="self-end text-[11px] text-muted-foreground hover:text-destructive flex items-center gap-1"
                >
                  <Archive className="h-3 w-3" /> Archivar
                </button>
              </div>
            );
          })}
        </div>
      )}

      {/* Modal crear bundle */}
      <Dialog open={modalOpen} onOpenChange={(o) => (o ? setModalOpen(true) : (reset(), setModalOpen(false)))}>
        <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Layers className="h-5 w-5 text-primary" /> Nuevo combo
            </DialogTitle>
            <DialogDescription>
              Selecciona los productos y define el descuento que aplicará al combo en el catálogo público.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Nombre del combo *</Label>
                <Input
                  value={nombre}
                  onChange={(e) => {
                    setNombre(e.target.value);
                    if (!slug || slug === slugify(nombre)) setSlug(slugify(e.target.value));
                  }}
                  placeholder="Pack barbería esencial"
                />
              </div>
              <div>
                <Label>Slug (URL) *</Label>
                <Input
                  value={slug}
                  onChange={(e) => setSlug(slugify(e.target.value))}
                  placeholder="pack-barberia"
                  className="font-mono"
                />
              </div>
            </div>

            <div>
              <Label>Descripción (opcional)</Label>
              <Textarea
                value={descripcion}
                onChange={(e) => setDescripcion(e.target.value)}
                rows={2}
                className="resize-none"
                placeholder="Combo ideal para empezar..."
              />
            </div>

            <div>
              <Label>Imagen del combo (URL, opcional)</Label>
              <Input
                value={imageUrl}
                onChange={(e) => setImageUrl(e.target.value)}
                placeholder="https://..."
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Tipo de descuento *</Label>
                <Select value={descuentoTipo} onValueChange={(v) => setDescuentoTipo(v as "percent" | "fixed")}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="percent">Porcentaje (%)</SelectItem>
                    <SelectItem value="fixed">Monto fijo ($)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>
                  Valor * {descuentoTipo === "percent" ? "(1-80)" : "(COP)"}
                </Label>
                <Input
                  type="number"
                  min={1}
                  value={descuentoValor}
                  onChange={(e) => setDescuentoValor(e.target.value)}
                />
              </div>
            </div>

            <div className="rounded-md bg-muted/50 p-3 space-y-1 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Subtotal items</span>
                <span className="tabular-nums">{formatCOP(subtotal)}</span>
              </div>
              <div className="flex justify-between text-emerald-600">
                <span>Ahorro estimado</span>
                <span className="tabular-nums">-{formatCOP(ahorroEstimado)}</span>
              </div>
              <div className="flex justify-between font-bold pt-1 border-t border-border">
                <span>Precio combo</span>
                <span className="tabular-nums text-primary">{formatCOP(Math.max(0, subtotal - ahorroEstimado))}</span>
              </div>
            </div>

            <div>
              <Label>Productos del combo * ({Object.keys(items).length} seleccionados)</Label>
              <div className="relative mt-1.5">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  value={searchProducts}
                  onChange={(e) => setSearchProducts(e.target.value)}
                  placeholder="Buscar producto..."
                  className="pl-9"
                />
              </div>
              <div className="max-h-64 overflow-y-auto mt-2 border border-border rounded-md divide-y divide-border">
                {filteredProducts.length === 0 ? (
                  <div className="p-4 text-center text-xs text-muted-foreground">
                    No tienes productos públicos. Crea productos primero.
                  </div>
                ) : (
                  filteredProducts.map((p) => {
                    const selected = items[p.id] !== undefined;
                    return (
                      <div
                        key={p.id}
                        className={cn(
                          "flex items-center gap-2 p-2 hover:bg-muted/50 transition-colors",
                          selected && "bg-primary/5",
                        )}
                      >
                        <button
                          type="button"
                          onClick={() => {
                            setItems((prev) => {
                              const next = { ...prev };
                              if (next[p.id] !== undefined) delete next[p.id];
                              else next[p.id] = 1;
                              return next;
                            });
                          }}
                          className={cn(
                            "h-5 w-5 rounded border-2 flex items-center justify-center flex-shrink-0",
                            selected ? "bg-primary border-primary text-primary-foreground" : "border-border",
                          )}
                          aria-label="Seleccionar"
                        >
                          {selected && <Check className="h-3 w-3" />}
                        </button>
                        <div className="h-9 w-9 rounded bg-muted flex-shrink-0 overflow-hidden">
                          {p.image_url ? (
                            <img src={p.image_url} alt={p.product_name} className="h-full w-full object-cover" />
                          ) : (
                            <Package className="h-4 w-4 text-muted-foreground m-auto mt-2" />
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-medium text-foreground truncate">{p.product_name}</p>
                          <p className="text-[10px] text-muted-foreground font-mono">
                            {p.sku} · {formatCOP(p.cost_price ?? p.price ?? 0)} · stock {p.stock_available}
                          </p>
                        </div>
                        {selected && (
                          <Input
                            type="number"
                            min={1}
                            value={items[p.id]}
                            onChange={(e) =>
                              setItems((prev) => ({
                                ...prev,
                                [p.id]: Math.max(1, Number(e.target.value) || 1),
                              }))
                            }
                            className="w-16 h-7 text-xs"
                          />
                        )}
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => (reset(), setModalOpen(false))} disabled={crear.isPending}>
              Cancelar
            </Button>
            <Button onClick={handleSubmit} disabled={crear.isPending}>
              {crear.isPending && <Loader2 className="h-4 w-4 animate-spin mr-1" />}
              Crear combo
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default BundlesView;
