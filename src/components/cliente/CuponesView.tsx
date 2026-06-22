import { useState } from "react";
import {
  Tag,
  Plus,
  Loader2,
  Power,
  Copy,
  Calendar,
  TicketPercent,
  TicketX,
  Pencil,
  Archive,
} from "lucide-react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  useCupones,
  useCrearCupon,
  useActualizarCupon,
  useArchivarCupon,
  type Cupon,
} from "@/hooks/useCupones";
import { cn } from "@/lib/utils";
import { formatCOP } from "@/lib/tarifas";

const CuponesView = () => {
  const { data: cupones, isLoading } = useCupones();
  const crear = useCrearCupon();
  const actualizar = useActualizarCupon();
  const archivar = useArchivarCupon();

  const [modalOpen, setModalOpen] = useState(false);

  // Form state
  const [code, setCode] = useState("");
  const [tipo, setTipo] = useState<"percent" | "fixed">("percent");
  const [valor, setValor] = useState("");
  const [minPedido, setMinPedido] = useState("");
  const [maxUsos, setMaxUsos] = useState("");
  const [validUntil, setValidUntil] = useState("");
  const [descripcion, setDescripcion] = useState("");

  const reset = () => {
    setCode("");
    setTipo("percent");
    setValor("");
    setMinPedido("");
    setMaxUsos("");
    setValidUntil("");
    setDescripcion("");
  };

  const handleSubmit = async () => {
    if (!code.trim() || !valor.trim()) {
      toast.error("Código y valor son obligatorios");
      return;
    }
    const valorNum = Number(valor);
    if (!Number.isFinite(valorNum) || valorNum <= 0) {
      toast.error("El valor debe ser un número positivo");
      return;
    }
    if (tipo === "percent" && valorNum > 100) {
      toast.error("El porcentaje no puede superar 100");
      return;
    }
    try {
      await crear.mutateAsync({
        code: code.trim().toUpperCase(),
        tipo,
        valor: valorNum,
        min_pedido: Number(minPedido) || 0,
        max_usos: maxUsos ? Number(maxUsos) : null,
        valid_until: validUntil ? new Date(validUntil).toISOString() : null,
        descripcion: descripcion.trim() || null,
      });
      toast.success(`Cupón ${code.toUpperCase()} creado`);
      reset();
      setModalOpen(false);
    } catch (e: any) {
      toast.error(e?.message || "No se pudo crear el cupón");
    }
  };

  const toggleActivo = async (c: Cupon) => {
    try {
      await actualizar.mutateAsync({ id: c.id, activa: !c.activa });
      toast.success(c.activa ? "Cupón desactivado" : "Cupón reactivado");
    } catch (e: any) {
      toast.error(e?.message || "No se pudo actualizar");
    }
  };

  const handleArchivar = async (c: Cupon) => {
    if (!confirm(`¿Archivar el cupón ${c.code}? No podrá usarse más.`)) return;
    try {
      await archivar.mutateAsync(c.id);
      toast.success("Cupón archivado");
    } catch (e: any) {
      toast.error(e?.message || "No se pudo archivar");
    }
  };

  const copy = (code: string) => {
    navigator.clipboard.writeText(code);
    toast.success(`Código ${code} copiado`);
  };

  const activos = cupones?.filter((c) => c.activa) ?? [];
  const inactivos = cupones?.filter((c) => !c.activa) ?? [];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-black tracking-tight flex items-center gap-2">
            <TicketPercent className="h-6 w-6 text-primary" />
            Cupones de descuento
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Crea códigos promocionales para tu catálogo público. Los clientes los aplican al hacer checkout.
          </p>
        </div>
        <Button onClick={() => setModalOpen(true)} className="gap-1.5">
          <Plus className="h-4 w-4" /> Nuevo cupón
        </Button>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <KPI title="Activos" value={String(activos.length)} icon={<TicketPercent className="h-4 w-4" />} />
        <KPI title="Inactivos" value={String(inactivos.length)} icon={<TicketX className="h-4 w-4" />} />
        <KPI
          title="Total redenciones"
          value={String((cupones ?? []).reduce((s, c) => s + c.usos_count, 0))}
          icon={<Calendar className="h-4 w-4" />}
        />
        <KPI
          title="Cupones creados"
          value={String(cupones?.length ?? 0)}
          icon={<Tag className="h-4 w-4" />}
        />
      </div>

      {/* Lista */}
      {isLoading ? (
        <div className="flex justify-center py-10">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </div>
      ) : !cupones || cupones.length === 0 ? (
        <div className="border border-dashed border-border rounded-xl p-10 text-center">
          <TicketPercent className="h-12 w-12 mx-auto text-muted-foreground/40" />
          <p className="text-sm text-muted-foreground mt-3">
            Aún no has creado cupones. Crea uno para empezar a ofrecer descuentos.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {cupones.map((c) => (
            <CuponCard
              key={c.id}
              cupon={c}
              onToggle={() => toggleActivo(c)}
              onArchive={() => handleArchivar(c)}
              onCopy={() => copy(c.code)}
            />
          ))}
        </div>
      )}

      {/* Modal crear */}
      <Dialog open={modalOpen} onOpenChange={(o) => (o ? setModalOpen(true) : (reset(), setModalOpen(false)))}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Nuevo cupón</DialogTitle>
            <DialogDescription>
              Define un código que tus clientes podrán aplicar en el checkout para obtener descuento.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <Label>Código del cupón *</Label>
              <Input
                value={code}
                onChange={(e) => setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9_-]/g, ""))}
                placeholder="BIENVENIDA10"
                className="font-mono tracking-wide"
                maxLength={32}
              />
              <p className="text-[10px] text-muted-foreground mt-1">Solo letras, números, guion y guion bajo.</p>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Tipo *</Label>
                <Select value={tipo} onValueChange={(v) => setTipo(v as "percent" | "fixed")}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="percent">Porcentaje (%)</SelectItem>
                    <SelectItem value="fixed">Monto fijo ($)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Valor * {tipo === "percent" ? "(1-100)" : "(COP)"}</Label>
                <Input
                  type="number"
                  min={1}
                  value={valor}
                  onChange={(e) => setValor(e.target.value)}
                  placeholder={tipo === "percent" ? "10" : "5000"}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Pedido mínimo (COP)</Label>
                <Input
                  type="number"
                  min={0}
                  value={minPedido}
                  onChange={(e) => setMinPedido(e.target.value)}
                  placeholder="0"
                />
              </div>
              <div>
                <Label>Máx. usos</Label>
                <Input
                  type="number"
                  min={1}
                  value={maxUsos}
                  onChange={(e) => setMaxUsos(e.target.value)}
                  placeholder="Ilimitado"
                />
              </div>
            </div>
            <div>
              <Label>Válido hasta</Label>
              <Input
                type="datetime-local"
                value={validUntil}
                onChange={(e) => setValidUntil(e.target.value)}
              />
              <p className="text-[10px] text-muted-foreground mt-1">Déjalo vacío para que no expire.</p>
            </div>
            <div>
              <Label>Descripción (opcional)</Label>
              <Textarea
                value={descripcion}
                onChange={(e) => setDescripcion(e.target.value)}
                placeholder="Promoción de bienvenida..."
                rows={2}
                className="resize-none"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => (reset(), setModalOpen(false))} disabled={crear.isPending}>
              Cancelar
            </Button>
            <Button onClick={handleSubmit} disabled={crear.isPending}>
              {crear.isPending && <Loader2 className="h-4 w-4 animate-spin mr-1" />}
              Crear cupón
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

const KPI = ({ title, value, icon }: { title: string; value: string; icon: React.ReactNode }) => (
  <div className="rounded-xl border border-border bg-card p-3">
    <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
      {icon} {title}
    </div>
    <p className="text-2xl font-bold mt-1 tabular-nums">{value}</p>
  </div>
);

const CuponCard = ({
  cupon,
  onToggle,
  onArchive,
  onCopy,
}: {
  cupon: Cupon;
  onToggle: () => void;
  onArchive: () => void;
  onCopy: () => void;
}) => {
  const usosLabel = cupon.max_usos ? `${cupon.usos_count} / ${cupon.max_usos}` : `${cupon.usos_count}`;
  const expired = cupon.valid_until ? new Date(cupon.valid_until) < new Date() : false;
  const agotado = cupon.max_usos != null && cupon.usos_count >= cupon.max_usos;

  return (
    <div
      className={cn(
        "rounded-xl border bg-card p-4 flex flex-col gap-3",
        cupon.activa && !expired && !agotado ? "border-border" : "border-border/60 opacity-70",
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5 flex-wrap">
            <button
              type="button"
              onClick={onCopy}
              className="font-mono font-bold text-base text-foreground hover:text-primary transition-colors flex items-center gap-1"
              title="Copiar código"
            >
              {cupon.code}
              <Copy className="h-3 w-3 opacity-50" />
            </button>
            {expired && <Badge variant="destructive" className="text-[9px]">Vencido</Badge>}
            {agotado && !expired && <Badge variant="secondary" className="text-[9px]">Agotado</Badge>}
            {!cupon.activa && <Badge variant="outline" className="text-[9px]">Inactivo</Badge>}
          </div>
          {cupon.descripcion && (
            <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">{cupon.descripcion}</p>
          )}
        </div>
        <div className="flex items-center gap-1">
          <Switch checked={cupon.activa} onCheckedChange={onToggle} aria-label="Activar/desactivar" />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2 text-[11px]">
        <div className="rounded-md bg-muted/50 px-2 py-1.5">
          <p className="text-muted-foreground">Descuento</p>
          <p className="font-bold text-foreground">
            {cupon.tipo === "percent" ? `${cupon.valor}%` : formatCOP(cupon.valor)}
          </p>
        </div>
        <div className="rounded-md bg-muted/50 px-2 py-1.5">
          <p className="text-muted-foreground">Usos</p>
          <p className="font-bold text-foreground tabular-nums">{usosLabel}</p>
        </div>
        {cupon.min_pedido > 0 && (
          <div className="rounded-md bg-muted/50 px-2 py-1.5 col-span-2">
            <p className="text-muted-foreground">Mínimo de compra</p>
            <p className="font-semibold text-foreground">{formatCOP(cupon.min_pedido)}</p>
          </div>
        )}
        {cupon.valid_until && (
          <div className="rounded-md bg-muted/50 px-2 py-1.5 col-span-2">
            <p className="text-muted-foreground">Vence</p>
            <p className="font-semibold text-foreground">
              {new Date(cupon.valid_until).toLocaleString("es-CO", { dateStyle: "medium", timeStyle: "short" })}
            </p>
          </div>
        )}
      </div>

      <button
        type="button"
        onClick={onArchive}
        className="self-end text-[11px] text-muted-foreground hover:text-destructive flex items-center gap-1"
      >
        <Archive className="h-3 w-3" /> Archivar
      </button>
    </div>
  );
};

export default CuponesView;
