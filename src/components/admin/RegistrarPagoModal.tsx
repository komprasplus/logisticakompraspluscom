import { useState, useEffect } from "react";
import { DollarSign, Loader2, AlertTriangle, Store } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface StoreBalance {
  user_id: string;
  store_name: string | null;
  full_name: string;
  saldoPendiente: number;
}

interface RegistrarPagoModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onPaymentComplete?: () => void;
}

const RegistrarPagoModal = ({ open, onOpenChange, onPaymentComplete }: RegistrarPagoModalProps) => {
  const [stores, setStores] = useState<StoreBalance[]>([]);
  const [selectedStoreId, setSelectedStoreId] = useState<string>("");
  const [monto, setMonto] = useState("");
  const [notas, setNotas] = useState("");
  const [loading, setLoading] = useState(false);
  const [fetchingStores, setFetchingStores] = useState(false);

  const selectedStore = stores.find((s) => s.user_id === selectedStoreId);

  useEffect(() => {
    if (open) {
      fetchStoreBalances();
      setSelectedStoreId("");
      setMonto("");
      setNotas("");
    }
  }, [open]);

  const fetchStoreBalances = async () => {
    setFetchingStores(true);
    try {
      const { data: roles } = await supabase
        .from("user_roles")
        .select("user_id")
        .eq("role", "cliente");

      if (!roles || roles.length === 0) {
        setStores([]);
        return;
      }

      const clientIds = roles.map((r) => r.user_id);

      const { data: profiles } = await supabase
        .from("profiles")
        .select("user_id, full_name, store_name")
        .in("user_id", clientIds)
        .eq("status", "activo");

      const { data: pedidos } = await supabase
        .from("pedidos")
        .select("id, client_user_id, utilidad")
        .eq("estado", "Liquidado")
        .in("client_user_id", clientIds);

      const storeData: StoreBalance[] = (profiles || []).map((p) => {
        const clientPedidos = (pedidos || []).filter(
          (ped) => ped.client_user_id === p.user_id
        );
        const saldoPendiente = clientPedidos.reduce(
          (sum, ped) => sum + (ped.utilidad || 0),
          0
        );
        return {
          user_id: p.user_id,
          store_name: p.store_name,
          full_name: p.full_name,
          saldoPendiente,
        };
      });

      setStores(storeData.filter((s) => s.saldoPendiente > 0));
    } catch (error) {
      console.error("Error fetching store balances:", error);
      toast.error("Error al cargar tiendas");
    } finally {
      setFetchingStores(false);
    }
  };

  const montoNumerico = parseFloat(monto) || 0;
  const exceedsSaldo = selectedStore && montoNumerico > selectedStore.saldoPendiente;
  const nuevoSaldo = selectedStore ? selectedStore.saldoPendiente - montoNumerico : 0;

  const handleSubmit = async () => {
    if (!selectedStore || montoNumerico <= 0) return;

    if (exceedsSaldo) {
      toast.warning("El monto supera el saldo pendiente de la tienda");
      return;
    }

    setLoading(true);
    try {
      // 1. Record the transaction
      const { error: txError } = await supabase
        .from("transacciones_billetera")
        .insert({
          client_user_id: selectedStore.user_id,
          tipo: "PAGO_TIENDA",
          monto: montoNumerico,
          saldo_anterior: selectedStore.saldoPendiente,
          saldo_nuevo: nuevoSaldo,
          notas: notas.trim() || null,
        });

      if (txError) throw txError;

      // 2. If payment covers full balance, mark orders as Pagado
      if (nuevoSaldo <= 0) {
        const { data: liquidados } = await supabase
          .from("pedidos")
          .select("id")
          .eq("estado", "Liquidado")
          .eq("client_user_id", selectedStore.user_id);

        if (liquidados && liquidados.length > 0) {
          const { error: updateError } = await supabase
            .from("pedidos")
            .update({
              estado: "Pagado",
              fecha_actualizacion: new Date().toISOString(),
            })
            .in("id", liquidados.map((p) => p.id));

          if (updateError) throw updateError;
        }
      }

      toast.success(
        `Pago de $${montoNumerico.toLocaleString("es-CO")} registrado para ${selectedStore.store_name || selectedStore.full_name}`,
        {
          description: nuevoSaldo > 0
            ? `Saldo restante: $${nuevoSaldo.toLocaleString("es-CO")}`
            : "Saldo liquidado completamente",
        }
      );

      onOpenChange(false);
      onPaymentComplete?.();
    } catch (error) {
      console.error("Error registering payment:", error);
      toast.error("Error al registrar el pago");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <DollarSign className="h-5 w-5 text-emerald-600" />
            Registrar Pago Realizado
          </DialogTitle>
          <DialogDescription>
            Selecciona la tienda, ingresa el monto pagado y registra el comprobante.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Store Selector */}
          <div className="space-y-2">
            <Label>Tienda</Label>
            {fetchingStores ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" /> Cargando tiendas...
              </div>
            ) : (
              <Select value={selectedStoreId} onValueChange={setSelectedStoreId}>
                <SelectTrigger>
                  <SelectValue placeholder="Seleccionar tienda" />
                </SelectTrigger>
                <SelectContent>
                  {stores.map((s) => (
                    <SelectItem key={s.user_id} value={s.user_id}>
                      <div className="flex items-center gap-2">
                        <Store className="h-3.5 w-3.5 text-muted-foreground" />
                        {s.store_name || s.full_name} — ${s.saldoPendiente.toLocaleString("es-CO")}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>

          {/* Balance Display */}
          {selectedStore && (
            <div className="rounded-lg bg-muted p-4 space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Saldo Pendiente Actual</span>
                <span className="font-bold text-lg text-foreground">
                  ${selectedStore.saldoPendiente.toLocaleString("es-CO")}
                </span>
              </div>
              {montoNumerico > 0 && (
                <>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Monto a Pagar</span>
                    <span className="font-medium text-red-500">
                      -${montoNumerico.toLocaleString("es-CO")}
                    </span>
                  </div>
                  <hr className="border-border" />
                  <div className="flex justify-between">
                    <span className="text-sm font-medium">Nuevo Saldo</span>
                    <span className={`font-bold text-lg ${nuevoSaldo > 0 ? "text-amber-600" : "text-emerald-600"}`}>
                      ${Math.max(0, nuevoSaldo).toLocaleString("es-CO")}
                    </span>
                  </div>
                </>
              )}
            </div>
          )}

          {/* Amount Input */}
          <div className="space-y-2">
            <Label>Monto Pagado ($)</Label>
            <Input
              type="number"
              placeholder="0"
              min="0"
              value={monto}
              onChange={(e) => setMonto(e.target.value)}
            />
            {exceedsSaldo && (
              <div className="flex items-center gap-1.5 text-sm text-amber-600">
                <AlertTriangle className="h-4 w-4" />
                El monto excede el saldo pendiente de ${selectedStore?.saldoPendiente.toLocaleString("es-CO")}
              </div>
            )}
          </div>

          {/* Notes */}
          <div className="space-y-2">
            <Label>Notas / Comprobante</Label>
            <Textarea
              placeholder="Ej: Transferencia Bancolombia #12345 — 07/02/2026"
              value={notas}
              onChange={(e) => setNotas(e.target.value)}
              rows={2}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
            Cancelar
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={loading || !selectedStoreId || montoNumerico <= 0 || !!exceedsSaldo}
            className="bg-emerald-600 hover:bg-emerald-700 text-white"
          >
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
                Procesando...
              </>
            ) : (
              "Registrar Pago"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default RegistrarPagoModal;
