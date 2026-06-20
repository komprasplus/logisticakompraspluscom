import { useEffect, useMemo, useState } from "react";
import {
  Archive,
  Banknote,
  CheckCircle2,
  Copy,
  ExternalLink,
  Lock,
  PackageCheck,
  Pencil,
  Plus,
  RefreshCw,
  Save,
  Search,
  Star,
  Tag,
  Trash2,
  Unlock,
  X,
} from "lucide-react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import { formatCOPShort } from "@/lib/payments";
import { useQueryClient } from "@tanstack/react-query";
import {
  canCreateMore,
  planLabel,
  PROVEEDOR_PLAN_QK,
  useProveedorPlan,
} from "@/hooks/useProveedorPlan";
import UpgradePlanDialog from "./UpgradePlanDialog";
import {
  useActualizarListaPrecio,
  useArchivarListaPrecio,
  useCrearListaPrecio,
  useEliminarPrecioItem,
  useListasPrecios,
  usePreciosLista,
  useUpsertPrecioItem,
  type CrearListaPrecioInput,
  type ListaPrecio,
} from "@/hooks/useListasPrecios";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
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
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";

interface FormState {
  nombre: string;
  slug: string;
  descripcion: string;
  moq_lista: string;
  es_publica: boolean;
  codigo_acceso: string;
  es_default: boolean;
}

const EMPTY_FORM: FormState = {
  nombre: "",
  slug: "",
  descripcion: "",
  moq_lista: "1",
  es_publica: true,
  codigo_acceso: "",
  es_default: false,
};

const slugify = (s: string): string =>
  s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);

const ListasPreciosView = () => {
  const { data: listas = [], isLoading, refetch, isFetching } = useListasPrecios();
  const { data: planInfo } = useProveedorPlan();
  const qc = useQueryClient();
  const [proveedorSlug, setProveedorSlug] = useState<string | null>(null);

  // Detectar callback de Bold (?upgrade=success) y refrescar plan con polling
  // hasta detectar el cambio del catalog_plan (el webhook procesa async).
  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    if (params.get("upgrade") !== "success") return;
    // Limpiar el query param para que no se vuelva a disparar al refrescar.
    params.delete("upgrade");
    const search = params.toString();
    const clean =
      window.location.pathname + (search ? `?${search}` : "") + window.location.hash;
    window.history.replaceState(null, "", clean);

    const initialPlan = planInfo?.plan ?? "free";
    const toastId = toast.loading(
      "Procesando tu pago… esto puede tardar unos segundos.",
    );
    let stopped = false;
    let attempts = 0;
    const MAX_ATTEMPTS = 12; // 12 × 3s = 36s
    const interval = window.setInterval(async () => {
      if (stopped) return;
      attempts += 1;
      try {
        await qc.invalidateQueries({ queryKey: PROVEEDOR_PLAN_QK });
        const updated = qc.getQueryData(PROVEEDOR_PLAN_QK) as any;
        if (updated?.plan && updated.plan !== initialPlan) {
          stopped = true;
          window.clearInterval(interval);
          toast.success(
            `¡Listo! Tu plan se actualizó a ${String(updated.plan).toUpperCase()}.`,
            { id: toastId, duration: 6000 },
          );
        }
      } catch {
        // ignorar y reintentar
      }
      if (!stopped && attempts >= MAX_ATTEMPTS) {
        window.clearInterval(interval);
        toast.info(
          "El pago aún no se ha confirmado. Si ya pagaste, refresca la página en un par de minutos o contáctanos.",
          { id: toastId, duration: 10000 },
        );
      }
    }, 3000);

    return () => {
      stopped = true;
      window.clearInterval(interval);
    };
    // Solo correr una vez al montar; usamos planInfo lazily.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<ListaPrecio | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [slugTouched, setSlugTouched] = useState(false);

  const [archivarTarget, setArchivarTarget] = useState<ListaPrecio | null>(null);
  const [editorListaId, setEditorListaId] = useState<string | null>(null);

  // Paywall state
  const [upgradeOpen, setUpgradeOpen] = useState(false);
  const [upgradeReason, setUpgradeReason] = useState<string | undefined>();

  const canCreate = planInfo ? canCreateMore(planInfo) : true;
  const canPrivate = planInfo?.limits.allow_private ?? true;
  const planMax = planInfo?.limits.max_price_lists ?? null;
  const planUsage = planInfo?.usage.price_lists_activas ?? 0;
  const planMaxLabel = planMax === -1 || planMax === null ? "∞" : String(planMax);

  const openUpgrade = (reason?: string) => {
    setUpgradeReason(reason);
    setUpgradeOpen(true);
  };

  const crearMut = useCrearListaPrecio();
  const actualizarMut = useActualizarListaPrecio();
  const archivarMut = useArchivarListaPrecio();
  const submitting = crearMut.isPending || actualizarMut.isPending;

  // Catalog slug del proveedor (para construir el link público)
  useEffect(() => {
    const fetchSlug = async () => {
      const { data } = await supabase.auth.getUser();
      if (!data?.user) return;
      const { data: profile } = await supabase
        .from("profiles")
        .select("catalog_slug")
        .eq("user_id", data.user.id)
        .maybeSingle();
      setProveedorSlug(profile?.catalog_slug ?? null);
    };
    fetchSlug();
  }, []);

  const stats = useMemo(() => {
    const activas = listas.filter((l) => l.activa).length;
    const totalItems = listas.reduce((acc, l) => acc + Number(l.items_count ?? 0), 0);
    const porDefecto = listas.find((l) => l.es_default && l.activa)?.nombre ?? "—";
    return { activas, totalItems, porDefecto };
  }, [listas]);

  const abrirNueva = () => {
    if (!canCreate) {
      openUpgrade(
        `Tu plan ${planInfo ? planLabel(planInfo.plan).toUpperCase() : "FREE"} permite máximo ${planMaxLabel} lista${planMax === 1 ? "" : "s"} de precios.`,
      );
      return;
    }
    setEditing(null);
    setForm(EMPTY_FORM);
    setSlugTouched(false);
    setModalOpen(true);
  };

  const abrirEditar = (l: ListaPrecio) => {
    setEditing(l);
    setForm({
      nombre: l.nombre,
      slug: l.slug,
      descripcion: l.descripcion ?? "",
      moq_lista: String(l.moq_lista ?? 1),
      es_publica: l.es_publica,
      codigo_acceso: "",
      es_default: l.es_default,
    });
    setSlugTouched(true);
    setModalOpen(true);
  };

  const handleNombreChange = (v: string) => {
    setForm((f) => ({
      ...f,
      nombre: v,
      slug: slugTouched ? f.slug : slugify(v),
    }));
  };

  const validar = (): string | null => {
    if (!form.nombre.trim()) return "El nombre es obligatorio";
    if (!form.slug.trim()) return "El slug es obligatorio";
    if (!/^[a-z0-9-]+$/.test(form.slug.trim()))
      return "El slug solo puede contener letras minúsculas, números y guiones";
    const moq = Number(form.moq_lista);
    if (!Number.isFinite(moq) || moq < 1) return "MOQ inválido (mínimo 1)";
    if (!form.es_publica && !editing && !form.codigo_acceso.trim())
      return "Una lista privada requiere un código de acceso";
    return null;
  };

  const guardar = async () => {
    const err = validar();
    if (err) {
      toast.error(err);
      return;
    }
    const input: CrearListaPrecioInput = {
      nombre: form.nombre.trim(),
      slug: form.slug.trim(),
      descripcion: form.descripcion.trim() || null,
      moq_lista: Number(form.moq_lista),
      es_publica: form.es_publica,
      codigo_acceso: form.es_publica ? null : form.codigo_acceso.trim() || null,
      es_default: form.es_default,
    };
    try {
      if (editing) {
        await actualizarMut.mutateAsync({ id: editing.id, ...input });
        toast.success("Lista actualizada");
      } else {
        await crearMut.mutateAsync(input);
        toast.success("Lista creada");
      }
      setModalOpen(false);
    } catch (e: any) {
      toast.error(e?.message || "No se pudo guardar la lista");
    }
  };

  const confirmarArchivar = async () => {
    if (!archivarTarget) return;
    try {
      await archivarMut.mutateAsync(archivarTarget.id);
      toast.success("Lista archivada");
      setArchivarTarget(null);
    } catch (e: any) {
      toast.error(e?.message || "No se pudo archivar");
    }
  };

  const copyLink = (lista: ListaPrecio) => {
    if (!proveedorSlug) {
      toast.error("Aún no tienes catálogo público activo");
      return;
    }
    const url = `${window.location.origin}/${proveedorSlug}/catalogo/${lista.slug}`;
    navigator.clipboard.writeText(url).then(
      () => toast.success("Link copiado al portapapeles"),
      () => toast.error("No se pudo copiar el link"),
    );
  };

  const openLink = (lista: ListaPrecio) => {
    if (!proveedorSlug) {
      toast.error("Aún no tienes catálogo público activo");
      return;
    }
    const url = `${window.location.origin}/${proveedorSlug}/catalogo/${lista.slug}`;
    window.open(url, "_blank", "noopener,noreferrer");
  };

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-foreground">
            Listas de precios
          </h1>
          <p className="text-sm text-muted-foreground">
            Genera varias listas (mayorista, dropshipper, cliente final…) y
            comparte cada una con su propio link.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => refetch()}
            disabled={isFetching}
            className="gap-1.5"
          >
            <RefreshCw
              className={cn("h-4 w-4", isFetching && "animate-spin")}
            />
            Refrescar
          </Button>
          <Button onClick={abrirNueva} className="gap-2">
            <Plus className="h-4 w-4" />
            Nueva lista
          </Button>
          {planInfo && (
            <button
              type="button"
              onClick={() => openUpgrade()}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-semibold transition-colors hover:opacity-90",
                planInfo.plan === "free" &&
                  "bg-muted text-muted-foreground border-border",
                planInfo.plan === "pro" &&
                  "bg-primary/10 text-primary border-primary/30",
                (planInfo.plan === "premium" || planInfo.plan === "business") &&
                  "bg-gold/15 text-gold-dark border-gold/40",
              )}
              title="Tu plan actual · click para ver opciones"
            >
              <Tag className="h-3 w-3" />
              Plan {planLabel(planInfo.plan)}
              <span className="text-muted-foreground font-normal">
                · {planUsage}/{planMaxLabel}
              </span>
            </button>
          )}
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <KpiCard
          icon={Tag}
          label="Listas activas"
          value={isLoading ? null : String(stats.activas)}
          tone="primary"
        />
        <KpiCard
          icon={Star}
          label="Lista por defecto"
          value={isLoading ? null : stats.porDefecto}
          tone="gold"
        />
        <KpiCard
          icon={PackageCheck}
          label="Productos con precio override"
          value={isLoading ? null : String(stats.totalItems)}
          tone="pink"
        />
      </div>

      {/* Lista */}
      {isLoading ? (
        <div className="space-y-3">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-40 w-full rounded-xl" />
          ))}
        </div>
      ) : listas.length === 0 ? (
        <EmptyState onCreate={abrirNueva} />
      ) : (
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
          {listas.map((l) => (
            <ListaCard
              key={l.id}
              lista={l}
              proveedorSlug={proveedorSlug}
              onEditar={() => abrirEditar(l)}
              onEditarPrecios={() => setEditorListaId(l.id)}
              onArchivar={() => setArchivarTarget(l)}
              onCopyLink={() => copyLink(l)}
              onOpenLink={() => openLink(l)}
            />
          ))}
        </div>
      )}

      {/* Modal Crear/Editar */}
      <Dialog open={modalOpen} onOpenChange={(o) => !submitting && setModalOpen(o)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {editing ? "Editar lista de precios" : "Nueva lista de precios"}
            </DialogTitle>
            <DialogDescription>
              {editing
                ? "Ajusta el nombre, slug, MOQ o privacidad de tu lista."
                : "Configura una lista nueva (mayorista, dropshipper, etc.)."}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-2">
            <div className="space-y-1.5">
              <Label htmlFor="lista-nombre">Nombre</Label>
              <Input
                id="lista-nombre"
                placeholder="Ej: Mayorista, Dropshipper, Cliente final"
                value={form.nombre}
                onChange={(e) => handleNombreChange(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="lista-slug">Slug (para el link público)</Label>
              <Input
                id="lista-slug"
                placeholder="mayorista"
                value={form.slug}
                onChange={(e) => {
                  setForm((f) => ({ ...f, slug: slugify(e.target.value) }));
                  setSlugTouched(true);
                }}
              />
              {proveedorSlug && form.slug && (
                <p className="text-[11px] text-muted-foreground truncate">
                  Link: <span className="font-mono">/{proveedorSlug}/catalogo/{form.slug}</span>
                </p>
              )}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="lista-descripcion">Descripción (opcional)</Label>
              <Textarea
                id="lista-descripcion"
                rows={2}
                placeholder="Para clientes con cupo mensual mínimo..."
                value={form.descripcion}
                onChange={(e) =>
                  setForm((f) => ({ ...f, descripcion: e.target.value }))
                }
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="lista-moq">MOQ (cant. mínima por orden)</Label>
                <Input
                  id="lista-moq"
                  inputMode="numeric"
                  type="text"
                  value={form.moq_lista}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, moq_lista: e.target.value }))
                  }
                />
              </div>
              <div className="space-y-1.5">
                <Label className="block">Marcar como default</Label>
                <div className="flex h-10 items-center">
                  <Switch
                    checked={form.es_default}
                    onCheckedChange={(v) =>
                      setForm((f) => ({ ...f, es_default: v }))
                    }
                  />
                  <span className="ml-2 text-xs text-muted-foreground">
                    {form.es_default ? "Sí" : "No"}
                  </span>
                </div>
              </div>
            </div>

            <div className="space-y-2 rounded-lg border border-border bg-muted/40 p-3">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-semibold flex items-center gap-1.5">
                    {form.es_publica ? (
                      <Unlock className="h-3.5 w-3.5 text-success" />
                    ) : (
                      <Lock className="h-3.5 w-3.5 text-pink" />
                    )}
                    Lista pública
                  </p>
                  <p className="text-[11px] text-muted-foreground">
                    {form.es_publica
                      ? "Cualquiera con el link la puede ver."
                      : "Requiere código de acceso."}
                  </p>
                </div>
                <Switch
                  checked={form.es_publica}
                  disabled={!canPrivate && form.es_publica}
                  onCheckedChange={(v) => {
                    if (!v && !canPrivate) {
                      openUpgrade(
                        "Las listas privadas con código de acceso requieren plan Premium o superior.",
                      );
                      return;
                    }
                    setForm((f) => ({ ...f, es_publica: v }));
                  }}
                />
              </div>
              {!form.es_publica && (
                <Input
                  placeholder="Código de acceso"
                  value={form.codigo_acceso}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, codigo_acceso: e.target.value }))
                  }
                />
              )}
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
              <Save className="h-4 w-4" />
              {editing ? "Guardar cambios" : "Crear lista"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Confirmación archivar */}
      <AlertDialog
        open={!!archivarTarget}
        onOpenChange={(o) => !o && !archivarMut.isPending && setArchivarTarget(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Archivar lista?</AlertDialogTitle>
            <AlertDialogDescription>
              La lista{" "}
              <span className="font-medium text-foreground">
                {archivarTarget?.nombre}
              </span>{" "}
              dejará de estar disponible en links públicos. Los precios se
              conservan por si quieres reactivarla luego.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={archivarMut.isPending}>
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmarArchivar}
              disabled={archivarMut.isPending}
            >
              {archivarMut.isPending ? "Archivando…" : "Archivar"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Editor de precios (sheet) */}
      <PrecioEditorSheet
        listaId={editorListaId}
        lista={listas.find((l) => l.id === editorListaId) ?? null}
        onClose={() => setEditorListaId(null)}
      />

      {/* Upgrade dialog (paywall) */}
      <UpgradePlanDialog
        open={upgradeOpen}
        onOpenChange={setUpgradeOpen}
        currentPlan={planInfo?.plan ?? "free"}
        reason={upgradeReason}
      />
    </div>
  );
};

// ──────────────────────────────────────────────────────────────────────
// Subcomponentes
// ──────────────────────────────────────────────────────────────────────

interface KpiProps {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string | null;
  tone: "primary" | "gold" | "pink";
}

const KpiCard = ({ icon: Icon, label, value, tone }: KpiProps) => {
  const toneClasses = {
    primary: "bg-primary/10 text-primary",
    gold: "bg-gold/15 text-gold-dark",
    pink: "bg-pink/10 text-pink",
  }[tone];
  return (
    <Card className="flex items-center gap-3 p-4">
      <div
        className={cn(
          "flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-lg",
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
          <p className="truncate text-xl font-bold text-foreground">{value}</p>
        )}
      </div>
    </Card>
  );
};

interface ListaCardProps {
  lista: ListaPrecio;
  proveedorSlug: string | null;
  onEditar: () => void;
  onEditarPrecios: () => void;
  onArchivar: () => void;
  onCopyLink: () => void;
  onOpenLink: () => void;
}

const ListaCard = ({
  lista,
  proveedorSlug,
  onEditar,
  onEditarPrecios,
  onArchivar,
  onCopyLink,
  onOpenLink,
}: ListaCardProps) => {
  return (
    <Card
      className={cn(
        "overflow-hidden border-l-4 transition-shadow hover:shadow-md",
        lista.activa
          ? lista.es_default
            ? "border-l-gold"
            : "border-l-primary"
          : "border-l-muted-foreground/30 opacity-80",
      )}
    >
      <div className="p-4">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-1.5">
              <h3 className="truncate font-semibold text-foreground">
                {lista.nombre}
              </h3>
              {lista.es_default && (
                <span className="inline-flex items-center gap-0.5 rounded-full bg-gold/15 px-2 py-0.5 text-[10px] font-semibold uppercase text-gold-dark">
                  <Star className="h-2.5 w-2.5" /> Default
                </span>
              )}
              {!lista.activa && (
                <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-semibold uppercase text-muted-foreground">
                  Archivada
                </span>
              )}
              {!lista.es_publica && (
                <span className="inline-flex items-center gap-0.5 rounded-full bg-pink/10 px-2 py-0.5 text-[10px] font-semibold text-pink">
                  <Lock className="h-2.5 w-2.5" /> Privada
                </span>
              )}
            </div>
            <p className="mt-0.5 font-mono text-[11px] text-muted-foreground truncate">
              {proveedorSlug
                ? `/${proveedorSlug}/catalogo/${lista.slug}`
                : `/.../catalogo/${lista.slug}`}
            </p>
            {lista.descripcion && (
              <p className="mt-1 text-xs text-muted-foreground line-clamp-2">
                {lista.descripcion}
              </p>
            )}
          </div>
        </div>

        <div className="mt-3 grid grid-cols-3 gap-2 text-center">
          <Stat label="MOQ" value={String(lista.moq_lista)} />
          <Stat label="Items override" value={String(lista.items_count)} />
          <Stat label="Moneda" value={lista.moneda} />
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-border pt-3">
          <Button
            size="sm"
            onClick={onEditarPrecios}
            disabled={!lista.activa}
            className="gap-1.5"
          >
            <Banknote className="h-3.5 w-3.5" />
            Editar precios
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={onEditar}
            className="gap-1.5"
          >
            <Pencil className="h-3.5 w-3.5" />
            Editar lista
          </Button>
          <div className="ml-auto flex items-center gap-1">
            <Button
              size="sm"
              variant="ghost"
              onClick={onCopyLink}
              className="gap-1.5"
            >
              <Copy className="h-3.5 w-3.5" />
              Copiar link
            </Button>
            <Button size="sm" variant="ghost" onClick={onOpenLink}>
              <ExternalLink className="h-3.5 w-3.5" />
            </Button>
            {lista.activa && (
              <Button
                size="sm"
                variant="ghost"
                onClick={onArchivar}
                className="text-muted-foreground hover:text-pink"
              >
                <Archive className="h-3.5 w-3.5" />
              </Button>
            )}
          </div>
        </div>
      </div>
    </Card>
  );
};

const Stat = ({ label, value }: { label: string; value: string }) => (
  <div className="rounded-md bg-muted/40 px-2 py-1.5">
    <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
      {label}
    </p>
    <p className="text-sm font-bold text-foreground">{value}</p>
  </div>
);

const EmptyState = ({ onCreate }: { onCreate: () => void }) => (
  <Card className="flex flex-col items-center justify-center gap-3 p-10 text-center">
    <div className="flex h-14 w-14 items-center justify-center rounded-full bg-primary/10 text-primary">
      <Tag className="h-7 w-7" />
    </div>
    <div>
      <h3 className="text-base font-semibold text-foreground">
        Aún no tienes listas de precios
      </h3>
      <p className="mt-1 text-sm text-muted-foreground">
        Crea la primera (Mayorista, Dropshipper, Cliente final…) y obtén un
        link único por cada una.
      </p>
    </div>
    <Button onClick={onCreate} className="gap-2">
      <Plus className="h-4 w-4" />
      Crear primera lista
    </Button>
  </Card>
);

// ──────────────────────────────────────────────────────────────────────
// Editor de precios por producto (sheet)
// ──────────────────────────────────────────────────────────────────────

interface PrecioEditorSheetProps {
  listaId: string | null;
  lista: ListaPrecio | null;
  onClose: () => void;
}

const PrecioEditorSheet = ({
  listaId,
  lista,
  onClose,
}: PrecioEditorSheetProps) => {
  const { data: items = [], isLoading } = usePreciosLista(listaId);
  const upsertMut = useUpsertPrecioItem();
  const eliminarMut = useEliminarPrecioItem();
  const [search, setSearch] = useState("");
  const [drafts, setDrafts] = useState<Record<string, { precio: string; min_qty: string }>>({});

  // Reset drafts cuando cambia la lista o llegan datos nuevos.
  useEffect(() => {
    if (!items.length) return;
    setDrafts((prev) => {
      const next: typeof prev = { ...prev };
      items.forEach((it) => {
        if (!next[it.product_id]) {
          next[it.product_id] = {
            precio: it.precio_lista != null ? String(it.precio_lista) : "",
            min_qty: it.min_quantity != null ? String(it.min_quantity) : "",
          };
        }
      });
      return next;
    });
  }, [items]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return items;
    return items.filter((it) =>
      [it.product_name, it.sku, it.category]
        .filter(Boolean)
        .some((s) => (s as string).toLowerCase().includes(q)),
    );
  }, [items, search]);

  const guardar = async (productId: string) => {
    if (!listaId) return;
    const draft = drafts[productId];
    if (!draft) return;
    const precio = Number(draft.precio.replace(/[^\d.]/g, ""));
    if (!Number.isFinite(precio) || precio < 0) {
      toast.error("Precio inválido");
      return;
    }
    const minQty = draft.min_qty.trim() ? Number(draft.min_qty) : null;
    try {
      await upsertMut.mutateAsync({
        listaId,
        productId,
        precio,
        minQuantity: minQty,
      });
      toast.success("Precio guardado");
    } catch (e: any) {
      toast.error(e?.message || "No se pudo guardar el precio");
    }
  };

  const quitar = async (productId: string) => {
    if (!listaId) return;
    try {
      await eliminarMut.mutateAsync({ listaId, productId });
      setDrafts((prev) => {
        const next = { ...prev };
        delete next[productId];
        return next;
      });
      toast.success("Override eliminado");
    } catch (e: any) {
      toast.error(e?.message || "No se pudo quitar el override");
    }
  };

  return (
    <Sheet open={!!listaId} onOpenChange={(o) => !o && onClose()}>
      <SheetContent
        side="right"
        className="w-full max-w-3xl sm:max-w-3xl flex flex-col p-0"
      >
        <SheetHeader className="border-b border-border p-4">
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <SheetTitle className="truncate">
                Precios — {lista?.nombre ?? "Cargando…"}
              </SheetTitle>
              <p className="text-xs text-muted-foreground">
                Edita el precio de cada producto en esta lista. Si dejas vacío,
                cae al precio base del inventario.
              </p>
            </div>
            <Button variant="ghost" size="sm" onClick={onClose}>
              <X className="h-4 w-4" />
            </Button>
          </div>
          <div className="relative mt-2">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Buscar por nombre, SKU o categoría…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto p-4 space-y-2">
          {isLoading ? (
            [0, 1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-16 w-full rounded-lg" />
            ))
          ) : filtered.length === 0 ? (
            <Card className="p-6 text-center text-sm text-muted-foreground">
              No hay productos que coincidan con tu búsqueda.
            </Card>
          ) : (
            filtered.map((it) => {
              const draft = drafts[it.product_id] ?? { precio: "", min_qty: "" };
              const hasChanges =
                (it.precio_lista != null
                  ? String(it.precio_lista)
                  : "") !== draft.precio ||
                (it.min_quantity != null
                  ? String(it.min_quantity)
                  : "") !== draft.min_qty;
              return (
                <Card
                  key={it.product_id}
                  className={cn(
                    "p-3 transition-colors",
                    it.tiene_override && "border-primary/30 bg-primary/[0.02]",
                  )}
                >
                  <div className="flex items-center gap-3">
                    {it.image_url ? (
                      <img
                        src={it.image_url}
                        alt=""
                        loading="lazy"
                        className="h-12 w-12 flex-shrink-0 rounded-md object-cover border border-border"
                      />
                    ) : (
                      <div className="h-12 w-12 flex-shrink-0 rounded-md bg-muted" />
                    )}
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <p className="truncate text-sm font-semibold text-foreground">
                          {it.product_name}
                        </p>
                        {it.tiene_override && (
                          <span className="inline-flex items-center gap-0.5 rounded-full bg-primary/10 px-1.5 py-0.5 text-[9px] font-bold uppercase text-primary">
                            <CheckCircle2 className="h-2.5 w-2.5" /> Override
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] text-muted-foreground">
                        SKU {it.sku || "—"} ·{" "}
                        {it.category || "Sin categoría"} · Stock{" "}
                        <span className="font-medium text-foreground">
                          {it.stock_available}
                        </span>
                      </p>
                      <p className="text-[11px] text-muted-foreground">
                        Precio base inventario:{" "}
                        <span className="font-semibold text-foreground">
                          {it.precio_base != null
                            ? formatCOPShort(it.precio_base)
                            : "—"}
                        </span>
                      </p>
                    </div>
                    <div className="flex flex-col gap-1.5 sm:flex-row">
                      <div className="flex flex-col">
                        <Label className="text-[10px] uppercase tracking-wider text-muted-foreground">
                          Precio
                        </Label>
                        <Input
                          inputMode="numeric"
                          placeholder="—"
                          value={draft.precio}
                          onChange={(e) =>
                            setDrafts((p) => ({
                              ...p,
                              [it.product_id]: {
                                ...draft,
                                precio: e.target.value,
                              },
                            }))
                          }
                          className="h-9 w-28"
                        />
                      </div>
                      <div className="flex flex-col">
                        <Label className="text-[10px] uppercase tracking-wider text-muted-foreground">
                          MOQ
                        </Label>
                        <Input
                          inputMode="numeric"
                          placeholder={String(lista?.moq_lista ?? 1)}
                          value={draft.min_qty}
                          onChange={(e) =>
                            setDrafts((p) => ({
                              ...p,
                              [it.product_id]: {
                                ...draft,
                                min_qty: e.target.value,
                              },
                            }))
                          }
                          className="h-9 w-20"
                        />
                      </div>
                      <div className="flex items-end gap-1">
                        <Button
                          size="sm"
                          onClick={() => guardar(it.product_id)}
                          disabled={!hasChanges || upsertMut.isPending}
                          className="gap-1"
                        >
                          <Save className="h-3 w-3" />
                          Guardar
                        </Button>
                        {it.tiene_override && (
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => quitar(it.product_id)}
                            className="text-muted-foreground hover:text-pink"
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        )}
                      </div>
                    </div>
                  </div>
                </Card>
              );
            })
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
};

export default ListasPreciosView;
