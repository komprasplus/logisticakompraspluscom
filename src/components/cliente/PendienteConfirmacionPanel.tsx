import { useMemo, useState } from "react";
import { AlertTriangle, CheckCircle2, Loader2, MapPin, Phone, ShoppingBag, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface PendingOrder {
  id: number;
  numero_guia: string | null;
  cliente_nombre: string | null;
  client_phone: string | null;
  direccion_entrega: string | null;
  municipio?: string | null;
  barrio: string | null;
  producto_nombre: string | null;
  observaciones?: string | null;
  integration_partner?: string | null;
  fecha_creacion: string | null;
}

interface PendienteConfirmacionPanelProps {
  pedidos: PendingOrder[];
  onConfirmed: () => void;
}

// Heuristic flags so the dropshipper sees what to fix
const flagsFor = (p: PendingOrder) => {
  const flags: string[] = [];
  if (!p.cliente_nombre || p.cliente_nombre.trim().length < 3) flags.push("Nombre incompleto");
  if (!p.client_phone || p.client_phone.replace(/\D/g, "").length < 10)
    flags.push("Teléfono inválido");
  if (!p.direccion_entrega || p.direccion_entrega.trim().length < 10)
    flags.push("Dirección muy corta");
  if (!p.municipio || p.municipio.trim().length < 2) flags.push("Sin ciudad");
  return flags;
};

const PendienteConfirmacionPanel = ({ pedidos, onConfirmed }: PendienteConfirmacionPanelProps) => {
  const { toast } = useToast();
  const [editing, setEditing] = useState<PendingOrder | null>(null);
  const [form, setForm] = useState({
    cliente_nombre: "",
    client_phone: "",
    direccion_entrega: "",
    municipio: "",
    barrio: "",
    observaciones: "",
  });
  const [saving, setSaving] = useState(false);

  const count = pedidos.length;

  const sorted = useMemo(
    () =>
      [...pedidos].sort((a, b) => {
        const da = a.fecha_creacion ? new Date(a.fecha_creacion).getTime() : 0;
        const db = b.fecha_creacion ? new Date(b.fecha_creacion).getTime() : 0;
        return db - da;
      }),
    [pedidos],
  );

  const openEditor = (p: PendingOrder) => {
    setEditing(p);
    setForm({
      cliente_nombre: p.cliente_nombre ?? "",
      client_phone: p.client_phone ?? "",
      direccion_entrega: p.direccion_entrega ?? "",
      municipio: p.municipio ?? "",
      barrio: p.barrio ?? "",
      observaciones: p.observaciones ?? "",
    });
  };

  const handleConfirm = async () => {
    if (!editing) return;
    if (!form.cliente_nombre.trim() || !form.client_phone.trim() || !form.direccion_entrega.trim() || !form.municipio.trim()) {
      toast({
        title: "Datos incompletos",
        description: "Nombre, teléfono, ciudad y dirección son obligatorios.",
        variant: "destructive",
      });
      return;
    }

    setSaving(true);
    const { error } = await supabase
      .from("pedidos")
      .update({
        cliente_nombre: form.cliente_nombre.trim(),
        client_phone: form.client_phone.trim(),
        direccion_entrega: form.direccion_entrega.trim(),
        municipio: form.municipio.trim(),
        barrio: form.barrio.trim() || null,
        observaciones: form.observaciones.trim() || null,
        estado: "en_preparacion",
        fecha_actualizacion: new Date().toISOString(),
      })
      .eq("id", editing.id);
    setSaving(false);

    if (error) {
      console.error("confirm pendiente error:", error);
      toast({ title: "Error", description: "No se pudo confirmar el pedido.", variant: "destructive" });
      return;
    }

    // Reconcilia propiedad de proveedor (matchea por SKU o por ID de inventario)
    try {
      const { data: rec, error: recErr } = await supabase.rpc("reconcile_order_supplier_ownership", {
        p_pedido_id: editing.id,
      });
      if (recErr) console.warn("reconcile error:", recErr.message);
      else console.log("✅ Reconciliación proveedor:", rec);
    } catch (e) {
      console.warn("reconcile exception:", e);
    }

    toast({
      title: "✅ Pedido confirmado",
      description: "Enviado a bodega. El proveedor ya puede empacarlo.",
    });
    setEditing(null);
    onConfirmed();
  };

  if (count === 0) return null;

  return (
    <>
      <div className="rounded-2xl border-2 border-amber-400/60 bg-amber-50/80 dark:bg-amber-500/10 backdrop-blur p-4 sm:p-5 space-y-4">
        <div className="flex items-start sm:items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-amber-500 text-white flex items-center justify-center shadow-lg shadow-amber-500/30">
              <AlertTriangle className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-base sm:text-lg font-bold text-amber-900 dark:text-amber-100 flex items-center gap-2">
                ⚠️ Pendientes por Confirmar
                <Badge className="bg-red-500 text-white text-xs px-2 py-0.5 animate-pulse">{count}</Badge>
              </h3>
              <p className="text-xs sm:text-sm text-amber-800/80 dark:text-amber-200/80">
                Pedidos automáticos esperando tu revisión antes de salir a bodega.
              </p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {sorted.map((p) => {
            const flags = flagsFor(p);
            const hasFlags = flags.length > 0;
            return (
              <button
                type="button"
                key={p.id}
                onClick={() => openEditor(p)}
                className={`text-left rounded-xl border p-3 bg-background/80 hover:bg-background transition shadow-sm hover:shadow-md ${
                  hasFlags ? "border-red-400/60" : "border-amber-300/60"
                }`}
              >
                <div className="flex items-center justify-between gap-2 mb-1.5">
                  <span className="text-[10px] font-mono text-muted-foreground truncate">
                    {p.numero_guia ?? `#${p.id}`}
                  </span>
                  {p.integration_partner && (
                    <Badge variant="secondary" className="text-[10px] gap-1 px-1.5 py-0">
                      <ShoppingBag className="h-3 w-3" /> {p.integration_partner}
                    </Badge>
                  )}
                </div>
                <p className="text-sm font-semibold text-foreground truncate flex items-center gap-1.5">
                  <User className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
                  {p.cliente_nombre || "Sin nombre"}
                </p>
                <p className="text-xs text-muted-foreground truncate flex items-center gap-1.5">
                  <Phone className="h-3 w-3 flex-shrink-0" />
                  {p.client_phone || "Sin teléfono"}
                </p>
                <p className="text-xs text-muted-foreground truncate flex items-center gap-1.5">
                  <MapPin className="h-3 w-3 flex-shrink-0" />
                  {[p.direccion_entrega, p.municipio].filter(Boolean).join(" · ") || "Sin dirección"}
                </p>

                {hasFlags && (
                  <div className="mt-2 flex flex-wrap gap-1">
                    {flags.map((f) => (
                      <span
                        key={f}
                        className="text-[10px] font-medium bg-red-500/15 text-red-700 dark:text-red-300 rounded px-1.5 py-0.5"
                      >
                        ⚠ {f}
                      </span>
                    ))}
                  </div>
                )}
              </button>
            );
          })}
        </div>
      </div>

      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Revisar y corregir pedido</DialogTitle>
            <DialogDescription>
              Verifica los datos del cliente. Al confirmar, el pedido pasa a bodega para empaque.
            </DialogDescription>
          </DialogHeader>

          {editing && (
            <div className="space-y-3 py-2">
              <div className="rounded-lg bg-muted/50 p-2 text-xs flex items-center justify-between">
                <span className="font-mono text-muted-foreground">{editing.numero_guia ?? `#${editing.id}`}</span>
                <span className="text-muted-foreground truncate ml-2">{editing.producto_nombre}</span>
              </div>

              <div>
                <Label htmlFor="conf-name">Nombre del cliente *</Label>
                <Input
                  id="conf-name"
                  value={form.cliente_nombre}
                  onChange={(e) => setForm((f) => ({ ...f, cliente_nombre: e.target.value }))}
                />
              </div>
              <div>
                <Label htmlFor="conf-phone">Teléfono *</Label>
                <Input
                  id="conf-phone"
                  inputMode="tel"
                  value={form.client_phone}
                  onChange={(e) => setForm((f) => ({ ...f, client_phone: e.target.value }))}
                />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label htmlFor="conf-city">Ciudad *</Label>
                  <Input
                    id="conf-city"
                    value={form.municipio}
                    onChange={(e) => setForm((f) => ({ ...f, municipio: e.target.value }))}
                  />
                </div>
                <div>
                  <Label htmlFor="conf-barrio">Barrio</Label>
                  <Input
                    id="conf-barrio"
                    value={form.barrio}
                    onChange={(e) => setForm((f) => ({ ...f, barrio: e.target.value }))}
                  />
                </div>
              </div>
              <div>
                <Label htmlFor="conf-address">Dirección *</Label>
                <Input
                  id="conf-address"
                  value={form.direccion_entrega}
                  onChange={(e) => setForm((f) => ({ ...f, direccion_entrega: e.target.value }))}
                />
              </div>
              <div>
                <Label htmlFor="conf-notes">Notas para el motorizado</Label>
                <Textarea
                  id="conf-notes"
                  rows={3}
                  value={form.observaciones}
                  onChange={(e) => setForm((f) => ({ ...f, observaciones: e.target.value }))}
                />
              </div>
            </div>
          )}

          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setEditing(null)} disabled={saving}>
              Cancelar
            </Button>
            <Button
              onClick={handleConfirm}
              disabled={saving}
              className="bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 text-white py-5 text-base font-bold rounded-xl"
            >
              {saving ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" /> Confirmando...
                </>
              ) : (
                <>
                  <CheckCircle2 className="h-5 w-5 mr-2" /> Confirmar y Enviar a Bodega
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default PendienteConfirmacionPanel;
