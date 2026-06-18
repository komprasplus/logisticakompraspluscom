import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import {
  ArrowLeft,
  ArrowUpRight,
  CheckCircle2,
  FileText,
  Loader2,
  Package,
  Pencil,
  PiggyBank,
  Plus,
  PowerOff,
  Search,
  Store as StoreIcon,
  Truck,
  XCircle,
} from "lucide-react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Skeleton } from "@/components/ui/skeleton";

interface Acuerdo {
  acuerdo_id: string;
  tienda: string | null;
  email: string;
  nombre_acuerdo: string | null;
  tarifa_local: number;
  tarifa_regional: number;
  tarifa_nacional: number;
  peso_base_kg: number;
  tarifa_kg_adicional: number;
  vigente_desde: string | null;
  vigente_hasta: string | null;
  activo: boolean;
  notas: string | null;
  pedidos_con_acuerdo: number;
  ahorro_por_envio_local: number;
  total_ahorrado_estimado: number;
}

interface TiendaResultado {
  user_id: string;
  full_name: string | null;
  email: string;
  pedidos_totales: number;
  tiene_acuerdo_activo: boolean;
}

interface FormState {
  email: string;
  tienda_nombre: string;
  nombre_acuerdo: string;
  tarifa_local: string;
  tarifa_regional: string;
  tarifa_nacional: string;
  peso_base_kg: string;
  tarifa_kg_adicional: string;
  notas: string;
}

const EMPTY_FORM: FormState = {
  email: "",
  tienda_nombre: "",
  nombre_acuerdo: "",
  tarifa_local: "",
  tarifa_regional: "",
  tarifa_nacional: "",
  peso_base_kg: "",
  tarifa_kg_adicional: "",
  notas: "",
};

const copFormatter = new Intl.NumberFormat("es-CO", {
  style: "currency",
  currency: "COP",
  maximumFractionDigits: 0,
});

const formatCOP = (value: number | null | undefined) =>
  copFormatter.format(Number(value ?? 0));

const parseInteger = (value: string): number | null => {
  if (!value.trim()) return null;
  const cleaned = value.replace(/[^\d-]/g, "");
  if (!cleaned) return null;
  const n = Number(cleaned);
  return Number.isFinite(n) ? Math.round(n) : null;
};

const parseDecimal = (value: string): number | null => {
  if (!value.trim()) return null;
  const cleaned = value.replace(/[^\d.,-]/g, "").replace(",", ".");
  if (!cleaned) return null;
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : null;
};

const AdminAcuerdosFletes = () => {
  const [acuerdos, setAcuerdos] = useState<Acuerdo[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Acuerdo | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [submitting, setSubmitting] = useState(false);

  // Typeahead de tienda
  const [search, setSearch] = useState("");
  const [tiendas, setTiendas] = useState<TiendaResultado[]>([]);
  const [searchingTiendas, setSearchingTiendas] = useState(false);
  const [showResults, setShowResults] = useState(false);
  const searchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Confirm desactivar
  const [confirmTarget, setConfirmTarget] = useState<Acuerdo | null>(null);
  const [confirmBusy, setConfirmBusy] = useState(false);

  const cargarAcuerdos = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    else setRefreshing(true);
    try {
      const { data, error } = await (supabase.rpc as any)(
        "admin_listar_acuerdos_flete",
      );
      if (error) throw error;
      setAcuerdos((data ?? []) as Acuerdo[]);
    } catch (err) {
      console.error("[acuerdos] listar:", err);
      toast.error("No se pudieron cargar los acuerdos");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    cargarAcuerdos();
  }, [cargarAcuerdos]);

  // Typeahead con debounce
  useEffect(() => {
    if (editing) return; // En edición no buscamos
    if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
    if (!search.trim()) {
      setTiendas([]);
      setSearchingTiendas(false);
      return;
    }
    setSearchingTiendas(true);
    searchTimerRef.current = setTimeout(async () => {
      try {
        const { data, error } = await (supabase.rpc as any)(
          "admin_buscar_tiendas",
          { p_query: search.trim() },
        );
        if (error) throw error;
        setTiendas((data ?? []) as TiendaResultado[]);
      } catch (err) {
        console.error("[acuerdos] buscar tiendas:", err);
        toast.error("Error buscando tiendas");
      } finally {
        setSearchingTiendas(false);
      }
    }, 300);
    return () => {
      if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
    };
  }, [search, editing]);

  const stats = useMemo(() => {
    const activos = acuerdos.filter((a) => a.activo).length;
    const pedidos = acuerdos.reduce(
      (acc, a) => acc + (Number(a.pedidos_con_acuerdo) || 0),
      0,
    );
    const ahorro = acuerdos.reduce(
      (acc, a) => acc + (Number(a.total_ahorrado_estimado) || 0),
      0,
    );
    return { activos, pedidos, ahorro };
  }, [acuerdos]);

  const abrirNuevo = () => {
    setEditing(null);
    setForm(EMPTY_FORM);
    setSearch("");
    setTiendas([]);
    setShowResults(false);
    setModalOpen(true);
  };

  const abrirEditar = (a: Acuerdo) => {
    setEditing(a);
    setForm({
      email: a.email,
      tienda_nombre: a.tienda ?? "",
      nombre_acuerdo: a.nombre_acuerdo ?? "",
      tarifa_local: String(a.tarifa_local ?? ""),
      tarifa_regional: String(a.tarifa_regional ?? ""),
      tarifa_nacional: String(a.tarifa_nacional ?? ""),
      peso_base_kg: String(a.peso_base_kg ?? ""),
      tarifa_kg_adicional: String(a.tarifa_kg_adicional ?? ""),
      notas: a.notas ?? "",
    });
    setSearch("");
    setTiendas([]);
    setShowResults(false);
    setModalOpen(true);
  };

  const seleccionarTienda = (t: TiendaResultado) => {
    setForm((f) => ({
      ...f,
      email: t.email,
      tienda_nombre: t.full_name ?? "",
    }));
    setSearch(t.full_name ?? t.email);
    setShowResults(false);
  };

  const validarForm = (): string | null => {
    if (!form.email.trim()) return "Selecciona una tienda";
    if (!form.nombre_acuerdo.trim())
      return "El nombre del acuerdo es obligatorio";
    const tl = parseInteger(form.tarifa_local);
    const tr = parseInteger(form.tarifa_regional);
    const tn = parseInteger(form.tarifa_nacional);
    if (tl === null || tl < 0) return "Tarifa local inválida";
    if (tr === null || tr < 0) return "Tarifa regional inválida";
    if (tn === null || tn < 0) return "Tarifa nacional inválida";
    const peso = parseDecimal(form.peso_base_kg);
    const sobrepeso = parseInteger(form.tarifa_kg_adicional);
    if (peso === null || peso <= 0) return "Peso base debe ser mayor a 0";
    if (sobrepeso === null || sobrepeso < 0)
      return "Tarifa por kg adicional inválida";
    return null;
  };

  const guardar = async () => {
    const error = validarForm();
    if (error) {
      toast.error(error);
      return;
    }
    setSubmitting(true);
    try {
      const { error: rpcError } = await (supabase.rpc as any)(
        "admin_crear_acuerdo_por_email",
        {
          p_email_tienda: form.email.trim(),
          p_nombre_acuerdo: form.nombre_acuerdo.trim(),
          p_tarifa_local: parseInteger(form.tarifa_local) ?? 0,
          p_tarifa_regional: parseInteger(form.tarifa_regional) ?? 0,
          p_tarifa_nacional: parseInteger(form.tarifa_nacional) ?? 0,
          p_peso_base_kg: parseDecimal(form.peso_base_kg) ?? 0,
          p_tarifa_kg_adicional: parseInteger(form.tarifa_kg_adicional) ?? 0,
          p_notas: form.notas.trim() || null,
        },
      );
      if (rpcError) throw rpcError;
      toast.success(editing ? "Acuerdo actualizado" : "Acuerdo creado");
      setModalOpen(false);
      cargarAcuerdos(true);
    } catch (err: any) {
      console.error("[acuerdos] guardar:", err);
      toast.error(err?.message || "No se pudo guardar el acuerdo");
    } finally {
      setSubmitting(false);
    }
  };

  const toggleActivo = async (a: Acuerdo) => {
    if (a.activo) {
      setConfirmTarget(a);
      return;
    }
    try {
      const { error } = await (supabase.rpc as any)(
        "admin_reactivar_acuerdo_por_email",
        { p_email_tienda: a.email },
      );
      if (error) throw error;
      toast.success("Acuerdo reactivado");
      cargarAcuerdos(true);
    } catch (err: any) {
      console.error("[acuerdos] reactivar:", err);
      toast.error(err?.message || "No se pudo reactivar");
    }
  };

  const confirmarDesactivar = async () => {
    if (!confirmTarget) return;
    setConfirmBusy(true);
    try {
      const { error } = await (supabase.rpc as any)(
        "admin_desactivar_acuerdo_por_email",
        { p_email_tienda: confirmTarget.email },
      );
      if (error) throw error;
      toast.success("Acuerdo desactivado");
      setConfirmTarget(null);
      cargarAcuerdos(true);
    } catch (err: any) {
      console.error("[acuerdos] desactivar:", err);
      toast.error(err?.message || "No se pudo desactivar");
    } finally {
      setConfirmBusy(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border bg-card">
        <div className="mx-auto max-w-7xl px-4 py-4 sm:px-6 lg:px-8">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3 min-w-0">
              <Link
                to="/admin"
                className="inline-flex items-center justify-center rounded-md p-2 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
                aria-label="Volver al panel admin"
              >
                <ArrowLeft className="h-5 w-5" />
              </Link>
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary flex-shrink-0">
                  <Truck className="h-5 w-5" />
                </div>
                <div className="min-w-0">
                  <h1 className="text-lg font-bold tracking-tight text-foreground truncate sm:text-xl">
                    Acuerdos de Tarifa
                  </h1>
                  <p className="text-xs text-muted-foreground truncate">
                    Tarifas especiales por cliente
                  </p>
                </div>
              </div>
            </div>
            <Button onClick={abrirNuevo} className="gap-2 sm:w-auto">
              <Plus className="h-4 w-4" />
              Nuevo acuerdo
            </Button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        {/* KPIs */}
        <section className="grid grid-cols-1 gap-3 sm:grid-cols-3 sm:gap-4">
          <KpiCard
            label="Acuerdos activos"
            value={loading ? null : stats.activos.toString()}
            icon={CheckCircle2}
            tone="primary"
          />
          <KpiCard
            label="Pedidos cubiertos"
            value={loading ? null : stats.pedidos.toLocaleString("es-CO")}
            icon={Package}
            tone="gold"
          />
          <KpiCard
            label="Ahorro total estimado"
            value={loading ? null : formatCOP(stats.ahorro)}
            icon={PiggyBank}
            tone="pink"
          />
        </section>

        {/* Lista */}
        <section className="mt-6">
          <div className="mb-3 flex items-center justify-between gap-2">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
              Acuerdos {!loading && `(${acuerdos.length})`}
            </h2>
            {refreshing && (
              <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
                <Loader2 className="h-3 w-3 animate-spin" /> Actualizando…
              </span>
            )}
          </div>

          {loading ? (
            <div className="space-y-3">
              {[0, 1, 2].map((i) => (
                <Skeleton key={i} className="h-40 w-full rounded-xl" />
              ))}
            </div>
          ) : acuerdos.length === 0 ? (
            <EmptyState onCreate={abrirNuevo} />
          ) : (
            <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
              {acuerdos.map((a) => (
                <AcuerdoCard
                  key={a.acuerdo_id}
                  acuerdo={a}
                  onEdit={() => abrirEditar(a)}
                  onToggle={() => toggleActivo(a)}
                />
              ))}
            </div>
          )}
        </section>
      </main>

      {/* Modal crear/editar */}
      <Dialog open={modalOpen} onOpenChange={(o) => !submitting && setModalOpen(o)}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {editing ? "Editar acuerdo" : "Nuevo acuerdo de tarifa"}
            </DialogTitle>
            <DialogDescription>
              {editing
                ? `Tienda: ${editing.tienda ?? editing.email}`
                : "Busca la tienda y define las tarifas especiales."}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {/* Typeahead tienda */}
            {!editing && (
              <div className="space-y-1.5">
                <Label htmlFor="acuerdo-tienda">Tienda</Label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="acuerdo-tienda"
                    placeholder="Buscar por nombre o email…"
                    value={search}
                    onChange={(e) => {
                      setSearch(e.target.value);
                      setShowResults(true);
                      if (form.email)
                        setForm((f) => ({ ...f, email: "", tienda_nombre: "" }));
                    }}
                    onFocus={() => setShowResults(true)}
                    className="pl-9"
                    autoComplete="off"
                  />
                  {searchingTiendas && (
                    <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-muted-foreground" />
                  )}
                  {showResults && search.trim() && (
                    <div className="absolute z-10 mt-1 max-h-64 w-full overflow-y-auto rounded-md border border-border bg-popover shadow-md">
                      {tiendas.length === 0 && !searchingTiendas ? (
                        <div className="px-3 py-2 text-sm text-muted-foreground">
                          Sin resultados
                        </div>
                      ) : (
                        tiendas.map((t) => (
                          <button
                            type="button"
                            key={t.user_id}
                            onClick={() => seleccionarTienda(t)}
                            className="flex w-full items-start gap-2 px-3 py-2 text-left text-sm hover:bg-muted transition-colors"
                          >
                            <StoreIcon className="mt-0.5 h-4 w-4 flex-shrink-0 text-muted-foreground" />
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-2">
                                <p className="font-medium text-foreground truncate">
                                  {t.full_name || t.email}
                                </p>
                                {t.tiene_acuerdo_activo && (
                                  <span className="rounded-full bg-primary/10 px-1.5 py-0.5 text-[10px] font-semibold text-primary">
                                    Ya tiene acuerdo
                                  </span>
                                )}
                              </div>
                              <p className="text-xs text-muted-foreground truncate">
                                {t.email} · {t.pedidos_totales} pedidos
                              </p>
                            </div>
                          </button>
                        ))
                      )}
                    </div>
                  )}
                </div>
                {form.email && (
                  <p className="text-xs text-muted-foreground">
                    Seleccionada:{" "}
                    <span className="font-medium text-foreground">
                      {form.tienda_nombre || form.email}
                    </span>
                  </p>
                )}
              </div>
            )}

            <div className="space-y-1.5">
              <Label htmlFor="acuerdo-nombre">Nombre del acuerdo</Label>
              <Input
                id="acuerdo-nombre"
                placeholder="Ej: Tarifa preferencial Q2"
                value={form.nombre_acuerdo}
                onChange={(e) =>
                  setForm((f) => ({ ...f, nombre_acuerdo: e.target.value }))
                }
              />
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <TarifaInput
                id="t-local"
                label="Local"
                value={form.tarifa_local}
                onChange={(v) => setForm((f) => ({ ...f, tarifa_local: v }))}
              />
              <TarifaInput
                id="t-regional"
                label="Regional"
                value={form.tarifa_regional}
                onChange={(v) => setForm((f) => ({ ...f, tarifa_regional: v }))}
              />
              <TarifaInput
                id="t-nacional"
                label="Nacional"
                value={form.tarifa_nacional}
                onChange={(v) => setForm((f) => ({ ...f, tarifa_nacional: v }))}
              />
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="t-peso">Peso base (kg)</Label>
                <Input
                  id="t-peso"
                  type="text"
                  inputMode="decimal"
                  placeholder="2"
                  value={form.peso_base_kg}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, peso_base_kg: e.target.value }))
                  }
                />
              </div>
              <TarifaInput
                id="t-adicional"
                label="Por kg adicional"
                value={form.tarifa_kg_adicional}
                onChange={(v) =>
                  setForm((f) => ({ ...f, tarifa_kg_adicional: v }))
                }
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="t-notas">Notas (opcional)</Label>
              <Textarea
                id="t-notas"
                placeholder="Condiciones, vigencia o detalles del acuerdo"
                value={form.notas}
                onChange={(e) =>
                  setForm((f) => ({ ...f, notas: e.target.value }))
                }
                rows={3}
              />
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-2">
            <Button
              variant="outline"
              onClick={() => setModalOpen(false)}
              disabled={submitting}
            >
              Cancelar
            </Button>
            <Button onClick={guardar} disabled={submitting} className="gap-2">
              {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
              {editing ? "Guardar cambios" : "Crear acuerdo"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Confirmar desactivar */}
      <AlertDialog
        open={!!confirmTarget}
        onOpenChange={(o) => !o && !confirmBusy && setConfirmTarget(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Desactivar acuerdo?</AlertDialogTitle>
            <AlertDialogDescription>
              El acuerdo con{" "}
              <span className="font-medium text-foreground">
                {confirmTarget?.tienda ?? confirmTarget?.email}
              </span>{" "}
              dejará de aplicar a nuevos pedidos. Puedes reactivarlo más tarde.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={confirmBusy}>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={confirmarDesactivar} disabled={confirmBusy}>
              {confirmBusy ? "Desactivando…" : "Desactivar"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

interface KpiCardProps {
  label: string;
  value: string | null;
  icon: React.ComponentType<{ className?: string }>;
  tone: "primary" | "gold" | "pink";
}

const KpiCard = ({ label, value, icon: Icon, tone }: KpiCardProps) => {
  const toneClasses = {
    primary: "bg-primary/10 text-primary",
    gold: "bg-gold/15 text-gold-dark",
    pink: "bg-pink/10 text-pink",
  }[tone];

  return (
    <Card className="flex items-center gap-3 p-4">
      <div
        className={cn(
          "flex h-11 w-11 items-center justify-center rounded-lg flex-shrink-0",
          toneClasses,
        )}
      >
        <Icon className="h-5 w-5" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-xs text-muted-foreground">{label}</p>
        {value === null ? (
          <Skeleton className="mt-1 h-6 w-24" />
        ) : (
          <p className="text-xl font-bold text-foreground truncate">{value}</p>
        )}
      </div>
    </Card>
  );
};

interface AcuerdoCardProps {
  acuerdo: Acuerdo;
  onEdit: () => void;
  onToggle: () => void;
}

const AcuerdoCard = ({ acuerdo, onEdit, onToggle }: AcuerdoCardProps) => {
  return (
    <Card
      className={cn(
        "relative overflow-hidden border-l-4 transition-shadow hover:shadow-md",
        acuerdo.activo ? "border-l-primary" : "border-l-muted-foreground/30 opacity-80",
      )}
    >
      <div className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="font-semibold text-foreground truncate">
                {acuerdo.tienda || acuerdo.email}
              </h3>
              <span
                className={cn(
                  "rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase",
                  acuerdo.activo
                    ? "bg-primary/10 text-primary"
                    : "bg-muted text-muted-foreground",
                )}
              >
                {acuerdo.activo ? "Activo" : "Inactivo"}
              </span>
            </div>
            <p className="text-xs text-muted-foreground truncate">{acuerdo.email}</p>
            {acuerdo.nombre_acuerdo && (
              <p className="mt-1 inline-flex items-center gap-1 text-xs text-muted-foreground">
                <FileText className="h-3 w-3" />
                {acuerdo.nombre_acuerdo}
              </p>
            )}
          </div>
        </div>

        <div className="mt-4 grid grid-cols-3 gap-2 text-center">
          <TarifaCol label="Local" value={acuerdo.tarifa_local} />
          <TarifaCol label="Regional" value={acuerdo.tarifa_regional} />
          <TarifaCol label="Nacional" value={acuerdo.tarifa_nacional} />
        </div>

        <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
          <span>
            Peso base:{" "}
            <span className="font-medium text-foreground">
              {Number(acuerdo.peso_base_kg).toLocaleString("es-CO")} kg
            </span>
          </span>
          <span>
            Sobrepeso:{" "}
            <span className="font-medium text-foreground">
              {formatCOP(acuerdo.tarifa_kg_adicional)} /kg
            </span>
          </span>
        </div>

        {acuerdo.notas && (
          <p className="mt-3 rounded-md bg-muted/50 px-3 py-2 text-xs text-muted-foreground">
            {acuerdo.notas}
          </p>
        )}

        <div className="mt-4 flex items-center justify-between gap-2 border-t border-border pt-3">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
            <span className="inline-flex items-center gap-1 text-muted-foreground">
              <Package className="h-3.5 w-3.5" />
              <span className="font-semibold text-foreground">
                {acuerdo.pedidos_con_acuerdo}
              </span>{" "}
              pedidos
            </span>
            <span className="inline-flex items-center gap-1 text-muted-foreground">
              <ArrowUpRight className="h-3.5 w-3.5 text-pink" />
              <span className="font-semibold text-foreground">
                {formatCOP(acuerdo.total_ahorrado_estimado)}
              </span>{" "}
              ahorro
            </span>
          </div>
          <div className="flex items-center gap-1.5">
            <Button
              size="sm"
              variant="ghost"
              onClick={onEdit}
              className="gap-1.5"
            >
              <Pencil className="h-3.5 w-3.5" />
              Editar
            </Button>
            <Button
              size="sm"
              variant={acuerdo.activo ? "outline" : "default"}
              onClick={onToggle}
              className="gap-1.5"
            >
              {acuerdo.activo ? (
                <>
                  <PowerOff className="h-3.5 w-3.5" />
                  Desactivar
                </>
              ) : (
                <>
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  Reactivar
                </>
              )}
            </Button>
          </div>
        </div>
      </div>
    </Card>
  );
};

const TarifaCol = ({ label, value }: { label: string; value: number }) => (
  <div className="rounded-md bg-muted/40 px-2 py-1.5">
    <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
      {label}
    </p>
    <p className="text-sm font-bold text-foreground">{formatCOP(value)}</p>
  </div>
);

interface TarifaInputProps {
  id: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
}

const TarifaInput = ({ id, label, value, onChange }: TarifaInputProps) => (
  <div className="space-y-1.5">
    <Label htmlFor={id}>{label}</Label>
    <div className="relative">
      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
        $
      </span>
      <Input
        id={id}
        type="text"
        inputMode="numeric"
        placeholder="0"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="pl-7"
      />
    </div>
  </div>
);

const EmptyState = ({ onCreate }: { onCreate: () => void }) => (
  <Card className="flex flex-col items-center justify-center gap-3 p-10 text-center">
    <div className="flex h-14 w-14 items-center justify-center rounded-full bg-primary/10 text-primary">
      <Truck className="h-7 w-7" />
    </div>
    <div>
      <h3 className="text-base font-semibold text-foreground">
        Aún no hay acuerdos
      </h3>
      <p className="mt-1 text-sm text-muted-foreground">
        Crea el primero para asignar tarifas especiales por cliente.
      </p>
    </div>
    <Button onClick={onCreate} className="gap-2">
      <Plus className="h-4 w-4" />
      Crear acuerdo
    </Button>
  </Card>
);

export default AdminAcuerdosFletes;
