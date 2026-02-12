import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { DollarSign, Loader2, AlertTriangle, Store, Upload, FileText, X, AlertCircle } from "lucide-react";
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

// ─── Tipos ────────────────────────────────────────────────────────────────────

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

// ─── Constantes ───────────────────────────────────────────────────────────────

const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024; // 10 MB
const ALLOWED_MIME_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "image/gif", "application/pdf"]);

/** Formatea un número como COP */
const formatCOP = (n: number): string => n.toLocaleString("es-CO");

// ─── Componente ───────────────────────────────────────────────────────────────

const RegistrarPagoModal = ({ open, onOpenChange, onPaymentComplete }: RegistrarPagoModalProps) => {
  const [stores, setStores] = useState<StoreBalance[]>([]);
  const [selectedStoreId, setSelectedStoreId] = useState("");
  const [monto, setMonto] = useState("");
  const [notas, setNotas] = useState("");
  const [loading, setLoading] = useState(false);
  const [fetchingStores, setFetchingStores] = useState(false);
  const [fetchError, setFetchError] = useState(false);
  const [comprobanteFile, setComprobanteFile] = useState<File | null>(null);
  const [uploadingFile, setUploadingFile] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const cancelRef = useRef(false);

  // ── Derivados ──────────────────────────────────────────────────────────────

  const selectedStore = useMemo(
    () => stores.find((s) => s.user_id === selectedStoreId) ?? null,
    [stores, selectedStoreId],
  );

  const montoNumerico = useMemo(
    () => Math.max(0, parseFloat(monto) || 0), // FIX: nunca negativo
    [monto],
  );

  const nuevoSaldo = selectedStore
    ? Math.max(0, selectedStore.saldoPendiente - montoNumerico) // FIX: clampear a 0
    : 0;

  const exceedsSaldo = selectedStore != null && montoNumerico > selectedStore.saldoPendiente;

  const canSubmit = !!selectedStoreId && montoNumerico > 0 && !exceedsSaldo && !loading && !uploadingFile;

  // ── Fetch de balances ──────────────────────────────────────────────────────

  /*
    FIX: `fetchStoreBalances` en useCallback para incluirla en el useEffect.

    FIX CRÍTICO — errores silenciosos:
    Las 4 queries originales no verificaban `error` — si cualquiera fallaba
    el cálculo continuaba con `undefined` como datos, produciendo saldos
    incorrectos sin ninguna alerta al usuario. Ahora cada error se lanza.

    FIX — queries paralelas:
    roles → profiles era secuencial. Ahora roles, pedidos y pagos se
    lanzan en paralelo con Promise.all.
  */
  const fetchStoreBalances = useCallback(async () => {
    setFetchingStores(true);
    setFetchError(false);

    try {
      // 1. Obtener IDs de clientes
      const { data: roles, error: rolesError } = await supabase
        .from("user_roles")
        .select("user_id")
        .eq("role", "cliente");

      if (rolesError) throw rolesError;
      if (!roles || roles.length === 0) {
        if (!cancelRef.current) setStores([]);
        return;
      }

      const clientIds = roles.map((r) => r.user_id);

      // 2. Lanzar perfiles, pedidos y pagos en paralelo
      const [profilesRes, pedidosRes, pagosRes] = await Promise.all([
        supabase
          .from("profiles")
          .select("user_id, full_name, store_name")
          .in("user_id", clientIds)
          .eq("status", "activo"),
        supabase
          .from("pedidos")
          .select("client_user_id, utilidad")
          .in("estado", ["Entregado", "Liquidado"])
          .in("client_user_id", clientIds),
        supabase.from("transacciones_billetera").select("client_user_id, monto").in("client_user_id", clientIds),
      ]);

      if (profilesRes.error) throw profilesRes.error;
      if (pedidosRes.error) throw pedidosRes.error;
      if (pagosRes.error) throw pagosRes.error;

      if (cancelRef.current) return;

      const profiles = profilesRes.data ?? [];
      const pedidos = pedidosRes.data ?? [];
      const pagos = pagosRes.data ?? [];

      // Precalcular mapas para O(n) en lugar de O(n²) con .filter por cada tienda
      const utilidadPorCliente = new Map<string, number>();
      for (const ped of pedidos) {
        const prev = utilidadPorCliente.get(ped.client_user_id) ?? 0;
        utilidadPorCliente.set(ped.client_user_id, prev + (ped.utilidad ?? 0));
      }

      const pagadoPorCliente = new Map<string, number>();
      for (const pago of pagos) {
        const prev = pagadoPorCliente.get(pago.client_user_id) ?? 0;
        pagadoPorCliente.set(pago.client_user_id, prev + (pago.monto ?? 0));
      }

      const storeData: StoreBalance[] = profiles
        .map((p) => ({
          user_id: p.user_id,
          store_name: p.store_name,
          full_name: p.full_name,
          saldoPendiente: (utilidadPorCliente.get(p.user_id) ?? 0) - (pagadoPorCliente.get(p.user_id) ?? 0),
        }))
        .filter((s) => s.saldoPendiente > 0)
        .sort((a, b) => b.saldoPendiente - a.saldoPendiente); // Ordenar por saldo desc

      setStores(storeData);
    } catch (error) {
      if (cancelRef.current) return;
      console.error("Error fetching store balances:", error);
      toast.error("Error al cargar tiendas");
      setFetchError(true);
    } finally {
      if (!cancelRef.current) setFetchingStores(false);
    }
  }, []);

  useEffect(() => {
    cancelRef.current = false;
    if (open) {
      fetchStoreBalances();
      setSelectedStoreId("");
      setMonto("");
      setNotas("");
      setComprobanteFile(null);
    }
    return () => {
      cancelRef.current = true;
    };
  }, [open, fetchStoreBalances]);

  // ── Manejo de archivo ──────────────────────────────────────────────────────

  const handleFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // FIX: validar tipo MIME en JS además del atributo `accept`
    // (el atributo accept puede bypassearse fácilmente)
    if (!ALLOWED_MIME_TYPES.has(file.type)) {
      toast.error("Solo se permiten imágenes (JPG, PNG, WebP, GIF) o PDF");
      if (fileInputRef.current) fileInputRef.current.value = "";
      return;
    }

    if (file.size > MAX_FILE_SIZE_BYTES) {
      toast.error("El archivo no puede superar 10 MB");
      if (fileInputRef.current) fileInputRef.current.value = "";
      return;
    }

    setComprobanteFile(file);
  }, []);

  const clearFile = useCallback(() => {
    setComprobanteFile(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }, []);

  // ── Upload de comprobante ──────────────────────────────────────────────────

  const uploadComprobante = useCallback(
    async (clientUserId: string): Promise<string | null> => {
      if (!comprobanteFile) return null;
      setUploadingFile(true);
      try {
        const ext = comprobanteFile.name.split(".").pop() ?? "bin";
        const fileName = `${clientUserId}/${Date.now()}.${ext}`;

        const { error } = await supabase.storage
          .from("comprobantes-pagos")
          .upload(fileName, comprobanteFile, { contentType: comprobanteFile.type });

        if (error) throw error;

        const { data: urlData } = supabase.storage.from("comprobantes-pagos").getPublicUrl(fileName);

        return urlData.publicUrl;
      } catch (error) {
        console.error("Error uploading comprobante:", error);
        toast.error("Error al subir el comprobante");
        return null;
      } finally {
        if (!cancelRef.current) setUploadingFile(false);
      }
    },
    [comprobanteFile],
  );

  // ── Submit ─────────────────────────────────────────────────────────────────

  const handleSubmit = useCallback(async () => {
    if (!canSubmit || !selectedStore) return;

    setLoading(true);
    try {
      const comprobanteUrl = await uploadComprobante(selectedStore.user_id);

      // FIX: usar nuevoSaldo ya clameado a ≥ 0 en vez del raw calculado
      const { error: txError } = await supabase.from("transacciones_billetera").insert({
        client_user_id: selectedStore.user_id,
        tipo: "PAGO_TIENDA",
        monto: montoNumerico,
        saldo_anterior: selectedStore.saldoPendiente,
        saldo_nuevo: nuevoSaldo, // FIX: valor clameado
        notas: notas.trim() || null,
        comprobante_url: comprobanteUrl,
      });

      if (txError) throw txError;

      // Marcar pedidos como Pagado si el saldo queda a 0
      if (nuevoSaldo <= 0) {
        const { data: liquidados, error: fetchLiqErr } = await supabase
          .from("pedidos")
          .select("id")
          .eq("estado", "Liquidado")
          .eq("client_user_id", selectedStore.user_id);

        if (fetchLiqErr) throw fetchLiqErr;

        if (liquidados && liquidados.length > 0) {
          // FIX: batch update con ids explícitos
          const { error: updateError } = await supabase
            .from("pedidos")
            .update({
              estado: "Pagado",
              fecha_actualizacion: new Date().toISOString(),
            })
            .in(
              "id",
              liquidados.map((p) => p.id),
            );

          if (updateError) throw updateError;
        }
      }

      toast.success(
        `Pago de $${formatCOP(montoNumerico)} registrado para ${selectedStore.store_name ?? selectedStore.full_name}`,
        {
          description:
            nuevoSaldo > 0 ? `Saldo restante: $${formatCOP(nuevoSaldo)}` : "Saldo liquidado completamente ✅",
        },
      );

      onOpenChange(false);
      onPaymentComplete?.();
    } catch (error) {
      console.error("Error registering payment:", error);
      toast.error("Error al registrar el pago");
    } finally {
      if (!cancelRef.current) setLoading(false);
    }
  }, [canSubmit, selectedStore, montoNumerico, nuevoSaldo, notas, uploadComprobante, onOpenChange, onPaymentComplete]);

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <DollarSign className="h-5 w-5 text-emerald-600" />
            Registrar Pago Realizado
          </DialogTitle>
          <DialogDescription>Selecciona la tienda, ingresa el monto pagado y adjunta el comprobante.</DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Selector de tienda */}
          <div className="space-y-2">
            <Label>Tienda</Label>
            {fetchingStores ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                Cargando tiendas...
              </div>
            ) : fetchError ? (
              // FIX: estado de error con retry en lugar de selector vacío
              <div className="flex items-center gap-3 rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                <AlertCircle className="h-4 w-4 flex-shrink-0" />
                <span className="flex-1">Error al cargar tiendas</span>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={fetchStoreBalances}
                  className="h-auto py-0.5 px-2 text-destructive hover:text-destructive"
                >
                  Reintentar
                </Button>
              </div>
            ) : stores.length === 0 ? (
              <p className="text-sm text-muted-foreground py-2">No hay tiendas con saldo pendiente</p>
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
                        {s.store_name ?? s.full_name} — ${formatCOP(s.saldoPendiente)}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>

          {/* Resumen de saldo */}
          {selectedStore && (
            <div className="rounded-lg bg-muted p-4 space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Saldo Pendiente Actual</span>
                <span className="font-bold text-lg text-foreground">${formatCOP(selectedStore.saldoPendiente)}</span>
              </div>
              {montoNumerico > 0 && (
                <>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Monto a Pagar</span>
                    <span className="font-medium text-red-500">-${formatCOP(montoNumerico)}</span>
                  </div>
                  <hr className="border-border" />
                  <div className="flex justify-between">
                    <span className="text-sm font-medium">Nuevo Saldo</span>
                    <span className={`font-bold text-lg ${nuevoSaldo > 0 ? "text-amber-600" : "text-emerald-600"}`}>
                      ${formatCOP(nuevoSaldo)}
                    </span>
                  </div>
                </>
              )}
            </div>
          )}

          {/* Monto */}
          <div className="space-y-2">
            <Label htmlFor="monto-input">Monto Pagado ($)</Label>
            <Input
              id="monto-input"
              type="number"
              placeholder="0"
              min="0"
              step="1"
              inputMode="numeric" // FIX: teclado numérico en móvil
              value={monto}
              onChange={(e) => setMonto(e.target.value)}
            />
            {exceedsSaldo && (
              <div className="flex items-center gap-1.5 text-sm text-amber-600">
                <AlertTriangle className="h-4 w-4 flex-shrink-0" />
                El monto excede el saldo de ${formatCOP(selectedStore!.saldoPendiente)}
              </div>
            )}
          </div>

          {/* Comprobante */}
          <div className="space-y-2">
            <Label>Comprobante (PDF o Imagen)</Label>
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
                <span className="text-sm truncate flex-1" title={comprobanteFile.name}>
                  {comprobanteFile.name}
                </span>
                {/* FIX: aria-label en el botón de cerrar */}
                <button
                  type="button"
                  onClick={clearFile}
                  className="text-muted-foreground hover:text-foreground"
                  aria-label="Eliminar archivo seleccionado"
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

          {/* Notas */}
          <div className="space-y-2">
            <Label htmlFor="notas-input">Notas / Referencia</Label>
            <Textarea
              id="notas-input"
              placeholder="Ej: Transferencia Bancolombia #12345 — 07/02/2026"
              value={notas}
              onChange={(e) => setNotas(e.target.value)}
              rows={2}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading || uploadingFile}>
            Cancelar
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={!canSubmit}
            className="bg-emerald-600 hover:bg-emerald-700 text-white disabled:opacity-50"
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
