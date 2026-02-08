import { useState, useEffect, useRef } from "react";
import { DollarSign, Loader2, AlertTriangle, Store, Upload, FileText, X } from "lucide-react";
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
  const [comprobanteFile, setComprobanteFile] = useState<File | null>(null);
  const [uploadingFile, setUploadingFile] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const selectedStore = stores.find((s) => s.user_id === selectedStoreId);

  useEffect(() => {
    if (open) {
      fetchStoreBalances();
      setSelectedStoreId("");
      setMonto("");
      setNotas("");
      setComprobanteFile(null);
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

      // Fetch orders with pending balance: Entregado or Liquidado
      const { data: pedidos } = await supabase
        .from("pedidos")
        .select("id, client_user_id, utilidad")
        .in("estado", ["Entregado", "Liquidado"])
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

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const maxSize = 10 * 1024 * 1024; // 10MB
    if (file.size > maxSize) {
      toast.error("El archivo no puede superar 10MB");
      return;
    }
    setComprobanteFile(file);
  };

  const uploadComprobante = async (clientUserId: string): Promise<string | null> => {
    if (!comprobanteFile) return null;
    setUploadingFile(true);
    try {
      const ext = comprobanteFile.name.split(".").pop() || "pdf";
      const fileName = `${clientUserId}/${Date.now()}.${ext}`;
      const { error } = await supabase.storage
        .from("comprobantes-pagos")
        .upload(fileName, comprobanteFile);
      if (error) throw error;
      const { data: urlData } = supabase.storage
        .from("comprobantes-pagos")
        .getPublicUrl(fileName);
      return urlData.publicUrl;
    } catch (error) {
      console.error("Error uploading comprobante:", error);
      toast.error("Error al subir el comprobante");
      return null;
    } finally {
      setUploadingFile(false);
    }
  };

  const handleSubmit = async () => {
    if (!selectedStore || montoNumerico <= 0) return;

    if (exceedsSaldo) {
      toast.warning("El monto supera el saldo pendiente de la tienda");
      return;
    }

    setLoading(true);
    try {
      // Upload comprobante if present
      const comprobanteUrl = await uploadComprobante(selectedStore.user_id);

      // Record the transaction
      const { error: txError } = await supabase
        .from("transacciones_billetera")
        .insert({
          client_user_id: selectedStore.user_id,
          tipo: "PAGO_TIENDA",
          monto: montoNumerico,
          saldo_anterior: selectedStore.saldoPendiente,
          saldo_nuevo: nuevoSaldo,
          notas: notas.trim() || null,
          comprobante_url: comprobanteUrl,
        });

      if (txError) throw txError;

      // If payment covers full balance, mark orders as Pagado
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
            Selecciona la tienda, ingresa el monto pagado y adjunta el comprobante.
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

          {/* Comprobante Upload */}
          <div className="space-y-2">
            <Label>Cargar Comprobante (PDF/Imagen)</Label>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*,.pdf"
              onChange={handleFileChange}
              className="hidden"
            />
            {comprobanteFile ? (
              <div className="flex items-center gap-2 rounded-lg border border-border bg-muted/50 px-3 py-2">
                <FileText className="h-4 w-4 text-primary flex-shrink-0" />
                <span className="text-sm truncate flex-1">{comprobanteFile.name}</span>
                <button
                  type="button"
                  onClick={() => { setComprobanteFile(null); if (fileInputRef.current) fileInputRef.current.value = ""; }}
                  className="text-muted-foreground hover:text-foreground"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            ) : (
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="w-full gap-2"
                onClick={() => fileInputRef.current?.click()}
              >
                <Upload className="h-4 w-4" />
                Seleccionar archivo
              </Button>
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
            disabled={loading || uploadingFile || !selectedStoreId || montoNumerico <= 0 || !!exceedsSaldo}
            className="bg-emerald-600 hover:bg-emerald-700 text-white"
          >
            {loading || uploadingFile ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
                {uploadingFile ? "Subiendo..." : "Procesando..."}
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
