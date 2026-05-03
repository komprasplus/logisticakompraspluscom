import { useEffect, useState, useCallback } from "react";
import { motion } from "framer-motion";
import { useQueryClient } from "@tanstack/react-query";
import { Loader2, Package, RefreshCw, MapPin, User, Phone, ShoppingBag, CheckCircle2, Eye, Store, DollarSign } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";

interface ProveedorPedido {
  id: number;
  numero_guia: string | null;
  cliente_nombre: string | null;
  client_phone: string | null;
  direccion_entrega: string | null;
  municipio: string | null;
  estado: string | null;
  fecha_creacion: string | null;
  valor_producto: number | null;
  valor_recaudar: number | null;
  dropshipper_nombre: string | null;
  items: Array<{ product_name: string; quantity: number; sku: string | null }>;
}

const formatCOP = (n: number | null | undefined) =>
  typeof n === "number"
    ? n.toLocaleString("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 })
    : "—";

const ProveedorPedidosView = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [pedidos, setPedidos] = useState<ProveedorPedido[]>([]);
  const [loading, setLoading] = useState(true);
  const [packingId, setPackingId] = useState<number | null>(null);
  const [selected, setSelected] = useState<ProveedorPedido | null>(null);

  const fetchPedidos = useCallback(async () => {
    if (!user?.id) return;
    setLoading(true);
    try {
      // 🔒 STRICT FILTER: Find inventory items owned by THIS provider
      const { data: myInventory, error: invError } = await supabase
        .from("inventory")
        .select("id")
        .eq("client_user_id", user.id)
        .eq("is_deleted", false);

      if (invError) {
        console.error("❌ inventory:", invError.message);
        toast.error(invError.message);
        setLoading(false);
        return;
      }

      const myInventoryIds = (myInventory ?? []).map((i: any) => i.id);
      if (myInventoryIds.length === 0) {
        setPedidos([]);
        setLoading(false);
        return;
      }

      // 🔒 STRICT JOIN: order_items where inventory_item_id belongs to this provider
      const { data: myItems, error: itemsErr } = await supabase
        .from("order_items")
        .select("pedido_id, product_name, quantity, sku, inventory_item_id")
        .in("inventory_item_id", myInventoryIds);

      if (itemsErr) {
        console.error("❌ order_items:", itemsErr.message);
        toast.error(itemsErr.message);
        setLoading(false);
        return;
      }

      const pedidoIds = Array.from(new Set((myItems ?? []).map((it: any) => it.pedido_id)));
      if (pedidoIds.length === 0) {
        setPedidos([]);
        setLoading(false);
        return;
      }

      const { data: pedidosData, error } = await supabase
        .from("pedidos")
        .select("*")
        .in("id", pedidoIds)
        .eq("estado", "en_preparacion")
        .order("fecha_creacion", { ascending: false });

      if (error) {
        console.error("❌ Error real de Supabase:", error.message, error.details, error.hint);
        toast.error(error.message);
        setLoading(false);
        return;
      }

      const dropshipperIds = Array.from(
        new Set((pedidosData ?? []).map((p: any) => p.client_user_id).filter(Boolean))
      );

      const itemsByPedido = new Map<number, Array<{ product_name: string; quantity: number; sku: string | null }>>();
      const namesByUser = new Map<string, string>();

      // Only show this provider's items in the card (not other suppliers' items in same order)
      (myItems ?? []).forEach((it: any) => {
        if (!itemsByPedido.has(it.pedido_id)) itemsByPedido.set(it.pedido_id, []);
        itemsByPedido.get(it.pedido_id)!.push({
          product_name: it.product_name,
          quantity: it.quantity,
          sku: it.sku,
        });
      });

      if (dropshipperIds.length > 0) {
        const { data: profs } = await supabase
          .from("profiles")
          .select("user_id, nombre_completo, nombre_tienda")
          .in("user_id", dropshipperIds as string[]);
        (profs ?? []).forEach((pr: any) => {
          namesByUser.set(pr.user_id, pr.nombre_tienda || pr.nombre_completo || "Dropshipper");
        });
      }

      const merged: ProveedorPedido[] = (pedidosData ?? []).map((p: any) => ({
        id: p.id,
        numero_guia: p.numero_guia,
        cliente_nombre: p.cliente_nombre,
        client_phone: p.client_phone,
        direccion_entrega: p.direccion_entrega,
        municipio: p.municipio,
        estado: p.estado,
        fecha_creacion: p.fecha_creacion,
        valor_producto: p.valor_producto,
        valor_recaudar: p.valor_recaudar,
        dropshipper_nombre: namesByUser.get(p.client_user_id) ?? null,
        items: itemsByPedido.get(p.id) ?? [],
      }));

      setPedidos(merged);
    } catch (e: any) {
      console.error("❌ fetchPedidos crash:", e);
      toast.error(e?.message ?? "Error inesperado al cargar pedidos");
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  useEffect(() => { fetchPedidos(); }, [fetchPedidos]);

  const handlePack = async (e: React.MouseEvent<HTMLButtonElement>, pedidoId: number) => {
    e.preventDefault();
    e.stopPropagation();
    setPackingId(pedidoId);
    try {
      const { data, error } = await supabase.rpc("proveedor_generar_guia" as any, {
        p_pedido_id: pedidoId,
      });

      if (error) throw error;
      if (data && (data as any).success === false) {
        throw new Error((data as any).error || "No se pudo generar la guía");
      }

      setSelected(null);
      toast.success("Guía generada");
      await queryClient.invalidateQueries({ queryKey: ["pedidos"] });
      await queryClient.invalidateQueries({ queryKey: ["proveedor-pedidos"] });
      setPedidos((prev) => prev.filter((p) => p.id !== pedidoId));
    } catch (error: any) {
      console.error("Error en Supabase:", error);
      toast.error(`Error: ${error?.message || "No se pudo actualizar"}`);
    } finally {
      setPackingId(null);
    }
  };

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <ShoppingBag className="h-6 w-6 text-primary" />
            Pedidos por Empacar
          </h1>
          <p className="text-sm text-muted-foreground">Pedidos en preparación que contienen tus productos.</p>
        </div>
        <Button variant="outline" onClick={() => fetchPedidos()} disabled={loading}>
          <RefreshCw className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`} />
          Actualizar
        </Button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : pedidos.length === 0 ? (
        <div className="rounded-2xl border border-dashed p-12 text-center text-muted-foreground">
          <Package className="h-10 w-10 mx-auto mb-3 opacity-40" />
          <p className="font-semibold">No hay pedidos por empacar.</p>
          <p className="text-sm">Cuando un dropshipper envíe un pedido a bodega, aparecerá aquí.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {pedidos.map((p) => (
            <div key={p.id} className="rounded-2xl border bg-card p-4 space-y-3 shadow-sm">
              <div className="flex items-center justify-between">
                <span className="text-xs font-mono text-muted-foreground">{p.numero_guia ?? `#${p.id}`}</span>
                <Badge className="bg-amber-500/15 text-amber-700 dark:text-amber-300 border-0">En preparación</Badge>
              </div>
              <div className="space-y-1 text-sm">
                <p className="flex items-center gap-2"><User className="h-3.5 w-3.5 text-muted-foreground" />{p.cliente_nombre ?? "Sin nombre"}</p>
                <p className="flex items-center gap-2 text-muted-foreground"><MapPin className="h-3.5 w-3.5" />{[p.municipio].filter(Boolean).join(" · ") || "—"}</p>
              </div>
              <div className="rounded-lg bg-muted/40 p-2 space-y-1">
                {p.items.map((it, i) => (
                  <div key={i} className="text-xs flex justify-between gap-2">
                    <span className="truncate">{it.product_name} {it.sku ? `(${it.sku})` : ""}</span>
                    <span className="font-semibold">x{it.quantity}</span>
                  </div>
                ))}
              </div>
              <Button
                type="button"
                className="w-full"
                onClick={(e) => { e.preventDefault(); setSelected(p); }}
              >
                <Eye className="h-4 w-4 mr-2" /> Ver Detalle y Gestionar
              </Button>
            </div>
          ))}
        </div>
      )}

      {/* Modal de detalles 2 columnas */}
      <Dialog open={!!selected} onOpenChange={(o) => { if (!o) setSelected(null); }}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Package className="h-5 w-5 text-primary" />
              Detalle del Pedido {selected?.numero_guia ?? `#${selected?.id}`}
            </DialogTitle>
            <DialogDescription>
              Revisa los productos a empacar y los datos de envío antes de generar la guía.
            </DialogDescription>
          </DialogHeader>

          {selected && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Columna Izquierda: producto y dropshipper */}
              <div className="space-y-3 rounded-xl border bg-muted/30 p-4">
                <h3 className="text-sm font-semibold flex items-center gap-2">
                  <ShoppingBag className="h-4 w-4 text-primary" /> Productos a empacar
                </h3>
                <div className="space-y-2">
                  {selected.items.length === 0 ? (
                    <p className="text-xs text-muted-foreground">Sin items asignados a tu inventario.</p>
                  ) : selected.items.map((it, i) => (
                    <div key={i} className="text-sm rounded-lg bg-background p-2 border">
                      <div className="flex justify-between font-medium">
                        <span className="truncate">{it.product_name}</span>
                        <span>x{it.quantity}</span>
                      </div>
                      {it.sku && <p className="text-xs text-muted-foreground font-mono">SKU: {it.sku}</p>}
                    </div>
                  ))}
                </div>

                <div className="pt-2 border-t space-y-1 text-sm">
                  <p className="flex items-center gap-2">
                    <DollarSign className="h-3.5 w-3.5 text-muted-foreground" />
                    Valor producto: <span className="font-semibold">{formatCOP(selected.valor_producto)}</span>
                  </p>
                  <p className="flex items-center gap-2">
                    <DollarSign className="h-3.5 w-3.5 text-muted-foreground" />
                    A recaudar (COD): <span className="font-semibold">{formatCOP(selected.valor_recaudar)}</span>
                  </p>
                  <p className="flex items-center gap-2">
                    <Store className="h-3.5 w-3.5 text-muted-foreground" />
                    Dropshipper: <span className="font-semibold">{selected.dropshipper_nombre ?? "—"}</span>
                  </p>
                </div>
              </div>

              {/* Columna Derecha: cliente final */}
              <div className="space-y-3 rounded-xl border bg-muted/30 p-4">
                <h3 className="text-sm font-semibold flex items-center gap-2">
                  <User className="h-4 w-4 text-primary" /> Cliente final
                </h3>
                <div className="space-y-2 text-sm">
                  <p className="flex items-center gap-2">
                    <User className="h-3.5 w-3.5 text-muted-foreground" />
                    <span className="font-semibold">{selected.cliente_nombre ?? "—"}</span>
                  </p>
                  <p className="flex items-center gap-2">
                    <Phone className="h-3.5 w-3.5 text-muted-foreground" />
                    {selected.client_phone ?? "—"}
                  </p>
                  <p className="flex items-start gap-2">
                    <MapPin className="h-3.5 w-3.5 text-muted-foreground mt-0.5" />
                    <span>{selected.direccion_entrega ?? "—"}</span>
                  </p>
                  <p className="flex items-center gap-2 text-muted-foreground">
                    <MapPin className="h-3.5 w-3.5" /> {selected.municipio ?? "—"}
                  </p>
                </div>
              </div>
            </div>
          )}

          <DialogFooter className="gap-2">
            <Button type="button" variant="outline" onClick={() => setSelected(null)} disabled={packingId !== null}>
              Cancelar
            </Button>
            <Button
              type="button"
              onClick={(e) => selected && handlePack(e, selected.id)}
              disabled={!selected || packingId !== null}
              className="bg-gradient-to-r from-primary to-primary/80 text-primary-foreground"
            >
              {packingId !== null ? (
                <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Despachando...</>
              ) : (
                <><CheckCircle2 className="h-4 w-4 mr-2" /> Generar Guía / Empacar</>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </motion.div>
  );
};

export default ProveedorPedidosView;
