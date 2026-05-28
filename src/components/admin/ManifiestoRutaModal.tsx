import { useEffect, useMemo, useRef, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Printer, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface PedidoLite {
  id: number;
  numero_guia: string | null;
  cliente_nombre: string | null;
  client_phone: string | null;
  direccion_entrega: string | null;
  barrio: string | null;
  municipio?: string | null;
  zona: string | null;
  valor_recaudar: number | null;
  metodo_pago: string | null;
  producto_nombre: string | null;
  motorizado_asignado: string | null;
}

interface OrderItem {
  pedido_id: number;
  product_name: string;
  quantity: number;
  variant_name?: string | null;
}

interface Props {
  open: boolean;
  onClose: () => void;
  pedidos: PedidoLite[];
}

const formatMoney = (v: number | null | undefined) =>
  `$${(v ?? 0).toLocaleString("es-CO")}`;

const ManifiestoRutaModal = ({ open, onClose, pedidos }: Props) => {
  const printRef = useRef<HTMLDivElement>(null);
  const [loading, setLoading] = useState(false);
  const [itemsByPedido, setItemsByPedido] = useState<Record<number, OrderItem[]>>({});

  useEffect(() => {
    if (!open || pedidos.length === 0) {
      setItemsByPedido({});
      return;
    }
    let mounted = true;
    (async () => {
      setLoading(true);
      try {
        const ids = pedidos.map((p) => p.id);
        const { data, error } = await supabase
          .from("order_items")
          .select("pedido_id, product_name, quantity, product_variants:variant_id(variant_name)")
          .in("pedido_id", ids);
        if (error) throw error;
        if (!mounted) return;
        const grouped: Record<number, OrderItem[]> = {};
        (data || []).forEach((r: any) => {
          const item: OrderItem = {
            pedido_id: r.pedido_id,
            product_name: r.product_name,
            quantity: r.quantity ?? 1,
            variant_name: r.product_variants?.variant_name ?? null,
          };
          if (!grouped[r.pedido_id]) grouped[r.pedido_id] = [];
          grouped[r.pedido_id].push(item);
        });
        setItemsByPedido(grouped);
      } catch (err) {
        console.error("Error fetching items for manifiesto ruta:", err);
        toast.error("No se pudieron cargar los items de los pedidos");
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, [open, pedidos]);

  const motorizadoNombre = useMemo(() => {
    const set = new Set(pedidos.map((p) => p.motorizado_asignado).filter(Boolean));
    if (set.size === 1) return Array.from(set)[0] as string;
    return null;
  }, [pedidos]);

  const totalRecaudar = useMemo(
    () =>
      pedidos.reduce((acc, p) => {
        if (p.metodo_pago === "anticipado") return acc;
        return acc + (p.valor_recaudar ?? 0);
      }, 0),
    [pedidos],
  );

  const fechaHora = useMemo(
    () => new Date().toLocaleString("es-CO", { dateStyle: "long", timeStyle: "short" }),
    [open],
  );

  const manifiestoNumero = useMemo(() => {
    const d = new Date();
    const datePart = d.toISOString().slice(0, 10).replace(/-/g, "");
    const rnd = Math.random().toString(36).slice(2, 6).toUpperCase();
    return `RUTA-${datePart}-${rnd}`;
  }, [open]);

  const handlePrint = () => {
    if (!printRef.current) return;
    const w = window.open("", "_blank");
    if (!w) {
      toast.error("No se pudo abrir la ventana de impresión");
      return;
    }
    w.document.write(`<!DOCTYPE html><html><head><title>Manifiesto de Ruta</title>
      <style>
        * { box-sizing: border-box; }
        body { font-family: Arial, Helvetica, sans-serif; margin: 0; padding: 14mm; color: #0f172a; }
        h1,h2,h3 { margin: 0; }
        table { width: 100%; border-collapse: collapse; font-size: 9pt; }
        th, td { border: 1px solid #94a3b8; padding: 4px 6px; vertical-align: top; text-align: left; }
        thead th { background: #0d9488; color: #fff; font-size: 8.5pt; }
        tbody tr:nth-child(even) { background: #f1f5f9; }
        .header { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 2px solid #0d9488; padding-bottom: 8px; margin-bottom: 10px; }
        .meta { display: grid; grid-template-columns: repeat(2, 1fr); gap: 4px 16px; font-size: 10pt; margin-bottom: 10px; }
        .meta strong { color: #0d9488; }
        .totals { margin-top: 10px; background: #0d9488; color: #fff; padding: 8px 12px; border-radius: 4px; display:flex; justify-content: space-between; font-size: 11pt; font-weight: bold; }
        .sign { margin-top: 30px; display: grid; grid-template-columns: 1fr 1fr; gap: 40px; }
        .sign-box { border-top: 1px solid #334155; padding-top: 6px; text-align: center; font-size: 9pt; }
        .sign-box small { color: #64748b; }
        .muted { color: #64748b; font-size: 8pt; }
        @page { size: A4; margin: 10mm; }
        @media print { body { padding: 0; } }
      </style></head><body>${printRef.current.innerHTML}</body></html>`);
    w.document.close();
    w.focus();
    setTimeout(() => {
      w.print();
      w.close();
    }, 300);
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-5xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>Manifiesto de Ruta — Vista previa</DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-auto bg-muted/40 p-4 rounded-lg">
          <div ref={printRef} className="bg-white p-6 shadow-sm mx-auto" style={{ maxWidth: "210mm" }}>
            <div className="header">
              <div>
                <h1 style={{ fontSize: "18pt", color: "#0d9488" }}>Manifiesto de Ruta</h1>
                <div className="muted">Plus Envíos · Documento de despacho interno</div>
              </div>
              <div style={{ textAlign: "right", fontSize: "9pt" }}>
                <div><strong>N°:</strong> {manifiestoNumero}</div>
                <div><strong>Fecha:</strong> {fechaHora}</div>
              </div>
            </div>

            <div className="meta">
              <div>
                <strong>Motorizado:</strong>{" "}
                {motorizadoNombre ?? "_____________________________"}
              </div>
              <div>
                <strong>Total Paquetes:</strong> {pedidos.length}
              </div>
              <div>
                <strong>Total a Recaudar:</strong> {formatMoney(totalRecaudar)}
              </div>
              <div>
                <strong>Generado:</strong> {fechaHora}
              </div>
            </div>

            <table>
              <thead>
                <tr>
                  <th style={{ width: "4%" }}>#</th>
                  <th style={{ width: "10%" }}>Guía</th>
                  <th style={{ width: "16%" }}>Destinatario</th>
                  <th style={{ width: "22%" }}>Dirección y Barrio</th>
                  <th style={{ width: "11%" }}>Teléfono</th>
                  <th style={{ width: "19%" }}>Productos</th>
                  <th style={{ width: "10%" }}>A Cobrar</th>
                  <th style={{ width: "8%" }}>Firma/Estado</th>
                </tr>
              </thead>
              <tbody>
                {pedidos.map((p, idx) => {
                  const items = itemsByPedido[p.id] || [];
                  const productLines = items.length
                    ? items.map(
                        (it) =>
                          `${it.quantity}x ${it.product_name}${it.variant_name ? ` (${it.variant_name})` : ""}`,
                      )
                    : [p.producto_nombre || "Paquete estándar"];
                  const isPagado = p.metodo_pago === "anticipado";
                  return (
                    <tr key={p.id}>
                      <td>{idx + 1}</td>
                      <td>{p.numero_guia || `KP-${p.id}`}</td>
                      <td>{p.cliente_nombre || "—"}</td>
                      <td>
                        {p.direccion_entrega || "—"}
                        {p.barrio ? <div className="muted">{p.barrio}{p.municipio ? ` · ${p.municipio}` : ""}</div> : null}
                      </td>
                      <td>{p.client_phone || "—"}</td>
                      <td>
                        {productLines.map((l, i) => (
                          <div key={i}>{l}</div>
                        ))}
                      </td>
                      <td style={{ fontWeight: "bold" }}>
                        {isPagado ? "PAGADO" : formatMoney(p.valor_recaudar)}
                      </td>
                      <td></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>

            <div className="totals">
              <span>Total Paquetes: {pedidos.length}</span>
              <span>Total a Recaudar: {formatMoney(totalRecaudar)}</span>
            </div>

            <div className="sign">
              <div className="sign-box">
                <div>Entregado por (Despachador)</div>
                <small>Nombre / C.C. / Firma</small>
              </div>
              <div className="sign-box">
                <div>Recibido por (Motorizado)</div>
                <small>Nombre / C.C. / Firma</small>
              </div>
            </div>

            <div className="muted" style={{ textAlign: "center", marginTop: 20 }}>
              Plus Envíos · Conservar copia para auditoría de ruta
            </div>
          </div>
        </div>

        <div className="flex gap-3 mt-4 pt-4 border-t print:hidden">
          <Button variant="outline" className="flex-1" onClick={onClose}>
            Cerrar
          </Button>
          <Button className="flex-1 gap-2" onClick={handlePrint} disabled={loading}>
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Cargando productos...
              </>
            ) : (
              <>
                <Printer className="h-4 w-4" />
                Imprimir Manifiesto
              </>
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default ManifiestoRutaModal;
