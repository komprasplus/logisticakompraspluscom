import { useEffect, useState, useCallback } from "react";
import { motion } from "framer-motion";
import { Loader2, Package, RefreshCw, MapPin, User, Phone, ShoppingBag, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";

interface ProveedorPedido {
  id: number;
  numero_guia: string | null;
  cliente_nombre: string | null;
  client_phone: string | null;
  direccion_entrega: string | null;
  municipio: string | null;
  estado: string | null;
  fecha_creacion: string | null;
  items: Array<{ product_name: string; quantity: number; sku: string | null }>;
}

const ProveedorPedidosView = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [pedidos, setPedidos] = useState<ProveedorPedido[]>([]);
  const [loading, setLoading] = useState(true);
  const [packingId, setPackingId] = useState<number | null>(null);

  const fetchPedidos = useCallback(async () => {
    if (!user?.id) return;
    setLoading(true);

    // 1. Fetch order_items where I'm the supplier, joined with pedidos in 'en_preparacion'
    const { data, error } = await supabase
      .from("order_items")
      .select(
        `pedido_id, product_name, quantity, sku,
         pedidos!inner(id, numero_guia, cliente_nombre, client_phone, direccion_entrega, municipio, estado, fecha_creacion)`,
      )
      .eq("supplier_user_id", user.id)
      .eq("pedidos.estado", "en_preparacion");

    if (error) {
      console.error("[ProveedorPedidos] error:", error);
      toast({ title: "Error", description: "No se pudieron cargar los pedidos.", variant: "destructive" });
      setLoading(false);
      return;
    }

    // Group by pedido_id
    const grouped = new Map<number, ProveedorPedido>();
    (data ?? []).forEach((row: any) => {
      const p = row.pedidos;
      if (!p) return;
      if (!grouped.has(p.id)) {
        grouped.set(p.id, {
          id: p.id,
          numero_guia: p.numero_guia,
          cliente_nombre: p.cliente_nombre,
          client_phone: p.client_phone,
          direccion_entrega: p.direccion_entrega,
          municipio: p.municipio,
          estado: p.estado,
          fecha_creacion: p.fecha_creacion,
          items: [],
        });
      }
      grouped.get(p.id)!.items.push({
        product_name: row.product_name,
        quantity: row.quantity,
        sku: row.sku,
      });
    });

    setPedidos(Array.from(grouped.values()).sort((a, b) =>
      (b.fecha_creacion ?? "").localeCompare(a.fecha_creacion ?? ""),
    ));
    setLoading(false);
  }, [user?.id, toast]);

  useEffect(() => { fetchPedidos(); }, [fetchPedidos]);

  const handlePack = async (pedidoId: number) => {
    setPackingId(pedidoId);
    const { error } = await supabase
      .from("pedidos")
      .update({ estado: "despachado", fecha_actualizacion: new Date().toISOString() })
      .eq("id", pedidoId);
    setPackingId(null);

    if (error) {
      toast({ title: "Error", description: "No se pudo despachar el pedido.", variant: "destructive" });
      return;
    }
    toast({ title: "✅ Pedido despachado", description: "El pedido pasó a logística." });
    setPedidos((prev) => prev.filter((p) => p.id !== pedidoId));
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
        <Button variant="outline" onClick={fetchPedidos} disabled={loading}>
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
                <p className="flex items-center gap-2 text-muted-foreground"><Phone className="h-3.5 w-3.5" />{p.client_phone ?? "—"}</p>
                <p className="flex items-center gap-2 text-muted-foreground"><MapPin className="h-3.5 w-3.5" />{[p.direccion_entrega, p.municipio].filter(Boolean).join(" · ") || "—"}</p>
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
                className="w-full bg-gradient-to-r from-primary to-primary/80 text-primary-foreground"
                onClick={() => handlePack(p.id)}
                disabled={packingId === p.id}
              >
                {packingId === p.id ? (
                  <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Despachando...</>
                ) : (
                  <><CheckCircle2 className="h-4 w-4 mr-2" /> Generar Guía / Empacar</>
                )}
              </Button>
            </div>
          ))}
        </div>
      )}
    </motion.div>
  );
};

export default ProveedorPedidosView;
