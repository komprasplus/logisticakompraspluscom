import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import {
  AlertTriangle,
  Loader2,
  Store,
  Search,
  ArrowDownCircle,
  ArrowUpCircle,
  Wallet,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
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

// ─── Tipos ────────────────────────────────────────────────────────────────────

interface StoreItem {
  user_id: string;
  store_name: string | null;
  full_name: string;
  email: string | null;
  organizacion_id: string | null;
  saldoActual: number;
}

type MovimientoTipo = "DEBITO" | "CREDITO";

interface AjusteManualBilleteraModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onComplete?: () => void;
}

// ─── Helper ───────────────────────────────────────────────────────────────────

const formatCOP = (n: number): string =>
  new Intl.NumberFormat("es-CO", {
    style: "currency",
    currency: "COP",
    minimumFractionDigits: 0,
  }).format(n);

// ─── Componente ───────────────────────────────────────────────────────────────

const AjusteManualBilleteraModal = ({
  open,
  onOpenChange,
  onComplete,
}: AjusteManualBilleteraModalProps) => {
  const { user, profile } = useAuth();

  const [stores, setStores] = useState<StoreItem[]>([]);
  const [search, setSearch] = useState("");
  const [selectedStoreId, setSelectedStoreId] = useState("");
  const [tipoMov, setTipoMov] = useState<MovimientoTipo>("DEBITO");
  const [monto, setMonto] = useState("");
  const [motivo, setMotivo] = useState("");
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(false);
  const cancelRef = useRef(false);

  // ── Derivados ──────────────────────────────────────────────────────────────

  const selectedStore = useMemo(
    () => stores.find((s) => s.user_id === selectedStoreId) ?? null,
    [stores, selectedStoreId],
  );

  const montoNumerico = useMemo(() => Math.max(0, parseFloat(monto) || 0), [monto]);

  const motivoTrimmed = motivo.trim();

  const canSubmit =
    !!selectedStoreId &&
    montoNumerico > 0 &&
    motivoTrimmed.length >= 10 &&
    !loading;

  const nuevoSaldoEstimado = useMemo(() => {
    if (!selectedStore) return 0;
    const delta = tipoMov === "CREDITO" ? montoNumerico : -montoNumerico;
    return Math.max(0, selectedStore.saldoActual + delta);
  }, [selectedStore, tipoMov, montoNumerico]);

  const filteredStores = useMemo(() => {
    if (!search.trim()) return stores;
    const q = search.toLowerCase();
    return stores.filter(
      (s) =>
        (s.store_name ?? "").toLowerCase().includes(q) ||
        s.full_name.toLowerCase().includes(q) ||
        (s.email ?? "").toLowerCase().includes(q),
    );
  }, [stores, search]);

  // ── Fetch tiendas + saldos ─────────────────────────────────────────────────

  const fetchStoresWithBalances = useCallback(async () => {
    setFetching(true);
    try {
      // 1. IDs de clientes
      const { data: roles, error: rolesErr } = await supabase
        .from("user_roles")
        .select("user_id")
        .eq("role", "cliente");
      if (rolesErr) throw rolesErr;

      const clientIds = (roles ?? []).map((r) => r.user_id);
      if (clientIds.length === 0) {
        if (!cancelRef.current) setStores([]);
        return;
      }

      // 2. Perfiles + transacciones + retiros en paralelo
      const [profilesRes, txsRes, withdrawalsRes] = await Promise.all([
        supabase
          .from("profiles")
          .select("user_id, full_name, store_name, email, organizacion_id")
          .in("user_id", clientIds)
          .eq("status", "activo"),
        supabase
          .from("transacciones_billetera")
          .select("client_user_id, tipo, monto")
          .in("client_user_id", clientIds),
        supabase
          .from("withdrawal_requests")
          .select("user_id, amount, status")
          .in("user_id", clientIds)
          .in("status", ["Approved", "Pending"]),
      ]);

      if (profilesRes.error) throw profilesRes.error;
      if (txsRes.error) throw txsRes.error;
      if (withdrawalsRes.error) throw withdrawalsRes.error;
      if (cancelRef.current) return;

      // 3. Calcular saldos por tienda
      // Saldo = CREDITO_ENTREGA + TRANSFER_IN + AJUSTE_CREDITO
      //       − PAGO_TIENDA − TRANSFER_OUT − DEBITO_DEVOLUCION − AJUSTE_DEBITO − retiros
      const saldoMap = new Map<string, number>();
      for (const tx of txsRes.data ?? []) {
        const sign =
          tx.tipo === "CREDITO_ENTREGA" ||
          tx.tipo === "TRANSFER_IN" ||
          tx.tipo === "AJUSTE_CREDITO"
            ? 1
            : tx.tipo === "PAGO_TIENDA" ||
              tx.tipo === "TRANSFER_OUT" ||
              tx.tipo === "DEBITO_DEVOLUCION" ||
              tx.tipo === "AJUSTE_DEBITO"
            ? -1
            : 0;
        const prev = saldoMap.get(tx.client_user_id) ?? 0;
        saldoMap.set(tx.client_user_id, prev + sign * (tx.monto ?? 0));
      }
      for (const w of withdrawalsRes.data ?? []) {
        const prev = saldoMap.get(w.user_id) ?? 0;
        saldoMap.set(w.user_id, prev - (w.amount ?? 0));
      }

      const data: StoreItem[] = (profilesRes.data ?? [])
        .map((p) => ({
          user_id: p.user_id,
          store_name: p.store_name,
          full_name: p.full_name,
          email: p.email,
          organizacion_id: p.organizacion_id,
          saldoActual: Math.max(0, saldoMap.get(p.user_id) ?? 0),
        }))
        .sort((a, b) => (b.saldoActual ?? 0) - (a.saldoActual ?? 0));

      setStores(data);
    } catch (err) {
      if (cancelRef.current) return;
      console.error("[AjusteManual] Error cargando tiendas:", err);
      toast.error("Error al cargar tiendas y saldos");
    } finally {
      if (!cancelRef.current) setFetching(false);
    }
  }, []);

  // Reset al abrir
  useEffect(() => {
    cancelRef.current = false;
    if (open) {
      setSelectedStoreId("");
      setMonto("");
      setMotivo("");
      setSearch("");
      setTipoMov("DEBITO");
      fetchStoresWithBalances();
    }
    return () => {
      cancelRef.current = true;
    };
  }, [open, fetchStoresWithBalances]);

  // ── Submit ─────────────────────────────────────────────────────────────────

  const handleSubmit = useCallback(async () => {
    if (!canSubmit || !selectedStore) return;

    // Confirmación extra para descuentos que excedan el saldo
    if (tipoMov === "DEBITO" && montoNumerico > selectedStore.saldoActual) {
      const ok = window.confirm(
        `⚠️ El descuento ($${formatCOP(montoNumerico)}) supera el saldo actual ($${formatCOP(
          selectedStore.saldoActual,
        )}). El saldo quedará en $0. ¿Continuar?`,
      );
      if (!ok) return;
    }

    setLoading(true);
    try {
      const tipoBd = tipoMov === "CREDITO" ? "AJUSTE_CREDITO" : "AJUSTE_DEBITO";
      const concepto =
        tipoMov === "CREDITO"
          ? `Ajuste manual: Abono (Ingreso) por conciliación`
          : `Ajuste manual: Descuento (Egreso) por conciliación`;

      const { error: insertErr } = await supabase
        .from("transacciones_billetera")
        .insert({
          client_user_id: selectedStore.user_id,
          organizacion_id: selectedStore.organizacion_id,
          tipo: tipoBd,
          monto: montoNumerico,
          concepto,
          notas: motivoTrimmed,
          saldo_anterior: selectedStore.saldoActual,
          saldo_nuevo: nuevoSaldoEstimado,
          created_by: user?.id ?? null,
          metadata: {
            ajuste_manual: true,
            tipo_movimiento: tipoMov,
            ejecutado_por_id: user?.id ?? null,
            ejecutado_por_nombre: profile?.full_name ?? null,
            tienda_user_id: selectedStore.user_id,
            tienda_nombre: selectedStore.store_name ?? selectedStore.full_name,
            saldo_anterior: selectedStore.saldoActual,
            saldo_estimado_nuevo: nuevoSaldoEstimado,
            timestamp_iso: new Date().toISOString(),
          },
        });

      if (insertErr) throw insertErr;

      toast.success(
        `${tipoMov === "CREDITO" ? "Abono" : "Descuento"} de ${formatCOP(montoNumerico)} aplicado`,
        {
          description: `Tienda: ${selectedStore.store_name ?? selectedStore.full_name} · Nuevo saldo estimado: ${formatCOP(
            nuevoSaldoEstimado,
          )}`,
        },
      );

      onOpenChange(false);
      onComplete?.();
    } catch (err) {
      console.error("[AjusteManual] Error insertando ajuste:", err);
      const msg = err instanceof Error ? err.message : "Error desconocido";
      toast.error(`Error al registrar el ajuste: ${msg}`);
    } finally {
      if (!cancelRef.current) setLoading(false);
    }
  }, [
    canSubmit,
    selectedStore,
    tipoMov,
    montoNumerico,
    motivoTrimmed,
    nuevoSaldoEstimado,
    user?.id,
    profile?.full_name,
    onOpenChange,
    onComplete,
  ]);

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl rounded-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-destructive">
            <AlertTriangle className="h-5 w-5" />
            Ajuste Manual de Saldo
          </DialogTitle>
          <DialogDescription>
            Inyecta una transacción de conciliación para sanear la billetera de una tienda.
            Cada movimiento queda registrado con trazabilidad completa.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Selector de Tienda */}
          <div className="space-y-2">
            <Label className="flex items-center gap-1.5">
              <Store className="h-3.5 w-3.5" />
              Tienda a ajustar
            </Label>

            {/* Buscador */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Buscar por nombre, tienda o email…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9 rounded-xl"
                disabled={fetching}
              />
            </div>

            <Select
              value={selectedStoreId}
              onValueChange={setSelectedStoreId}
              disabled={fetching}
            >
              <SelectTrigger className="rounded-xl">
                <SelectValue
                  placeholder={
                    fetching ? "Cargando tiendas…" : "Selecciona una tienda"
                  }
                />
              </SelectTrigger>
              <SelectContent className="max-h-72">
                {filteredStores.length === 0 ? (
                  <div className="py-6 text-center text-sm text-muted-foreground">
                    {fetching ? "Cargando…" : "Sin resultados"}
                  </div>
                ) : (
                  filteredStores.map((s) => (
                    <SelectItem key={s.user_id} value={s.user_id}>
                      <div className="flex flex-col text-left">
                        <span className="font-medium">
                          {s.store_name ?? s.full_name}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          Saldo: {formatCOP(s.saldoActual)}
                          {s.email ? ` · ${s.email}` : ""}
                        </span>
                      </div>
                    </SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>

            {selectedStore && (
              <div className="flex items-center justify-between rounded-xl border bg-muted/40 px-3 py-2 text-sm">
                <span className="flex items-center gap-2 text-muted-foreground">
                  <Wallet className="h-4 w-4" />
                  Saldo actual
                </span>
                <span className="font-bold text-foreground">
                  {formatCOP(selectedStore.saldoActual)}
                </span>
              </div>
            )}
          </div>

          {/* Tipo de movimiento */}
          <div className="space-y-2">
            <Label>Tipo de movimiento</Label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setTipoMov("DEBITO")}
                className={`flex items-center justify-center gap-2 rounded-xl border-2 px-3 py-2.5 text-sm font-semibold transition ${
                  tipoMov === "DEBITO"
                    ? "border-destructive bg-destructive/10 text-destructive"
                    : "border-border text-muted-foreground hover:bg-muted"
                }`}
              >
                <ArrowUpCircle className="h-4 w-4" />
                Descuento (Egreso)
              </button>
              <button
                type="button"
                onClick={() => setTipoMov("CREDITO")}
                className={`flex items-center justify-center gap-2 rounded-xl border-2 px-3 py-2.5 text-sm font-semibold transition ${
                  tipoMov === "CREDITO"
                    ? "border-emerald-500 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                    : "border-border text-muted-foreground hover:bg-muted"
                }`}
              >
                <ArrowDownCircle className="h-4 w-4" />
                Abono (Ingreso)
              </button>
            </div>
          </div>

          {/* Monto */}
          <div className="space-y-2">
            <Label htmlFor="monto-ajuste">Monto a ajustar (COP)</Label>
            <Input
              id="monto-ajuste"
              type="number"
              inputMode="numeric"
              min={0}
              step={1000}
              placeholder="0"
              value={monto}
              onChange={(e) => setMonto(e.target.value)}
              className="rounded-xl text-lg font-semibold"
            />
          </div>

          {/* Vista previa de saldo */}
          {selectedStore && montoNumerico > 0 && (
            <div className="rounded-xl border border-dashed bg-card p-3 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Saldo actual</span>
                <span className="font-medium">
                  {formatCOP(selectedStore.saldoActual)}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">
                  {tipoMov === "CREDITO" ? "+ Abono" : "− Descuento"}
                </span>
                <span
                  className={`font-medium ${
                    tipoMov === "CREDITO"
                      ? "text-emerald-600 dark:text-emerald-400"
                      : "text-destructive"
                  }`}
                >
                  {tipoMov === "CREDITO" ? "+" : "−"}
                  {formatCOP(montoNumerico)}
                </span>
              </div>
              <div className="mt-1 flex items-center justify-between border-t pt-1">
                <span className="font-semibold">Nuevo saldo estimado</span>
                <span className="font-bold text-primary">
                  {formatCOP(nuevoSaldoEstimado)}
                </span>
              </div>
            </div>
          )}

          {/* Motivo / Observación obligatorio */}
          <div className="space-y-2">
            <Label htmlFor="motivo-ajuste">
              Motivo / Observación{" "}
              <span className="text-destructive">* obligatorio</span>
            </Label>
            <Textarea
              id="motivo-ajuste"
              placeholder="Ej: Cruce de cuentas por pago realizado en marzo. Autorizado por el cliente vía email del 12/03/2026."
              value={motivo}
              onChange={(e) => setMotivo(e.target.value)}
              rows={3}
              className="rounded-xl"
            />
            <p className="text-xs text-muted-foreground">
              Mínimo 10 caracteres. Esta justificación quedará en el historial para
              auditoría. ({motivoTrimmed.length}/10)
            </p>
          </div>

          {/* Aviso de trazabilidad */}
          <div className="flex gap-2 rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-300">
            <AlertTriangle className="h-4 w-4 flex-shrink-0" />
            <p>
              Este movimiento crea un registro permanente en{" "}
              <code className="rounded bg-amber-100 px-1 dark:bg-amber-900/40">
                transacciones_billetera
              </code>{" "}
              con tipo{" "}
              <strong>
                {tipoMov === "CREDITO" ? "AJUSTE_CREDITO" : "AJUSTE_DEBITO"}
              </strong>
              . El saldo se recalcula automáticamente. No se sobrescribe nada.
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="ghost"
            onClick={() => onOpenChange(false)}
            disabled={loading}
          >
            Cancelar
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={!canSubmit}
            variant={tipoMov === "DEBITO" ? "destructive" : "default"}
          >
            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {tipoMov === "CREDITO"
              ? `Aplicar Abono ${montoNumerico > 0 ? `(+${formatCOP(montoNumerico)})` : ""}`
              : `Aplicar Descuento ${montoNumerico > 0 ? `(−${formatCOP(montoNumerico)})` : ""}`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default AjusteManualBilleteraModal;
