import { useMemo, useState } from "react";
import {
  Bike,
  Plus,
  Loader2,
  Trash2,
  DollarSign,
  Search,
  Tag,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  useMotorizadosList,
  useTarifasMotorizado,
  useUpsertTarifa,
  useArchivarTarifa,
} from "@/hooks/useMotorizadoTarifas";
import { formatCOP } from "@/lib/tarifas";
import { cn } from "@/lib/utils";

const TIPO_LABELS: Record<string, string> = {
  entrega: "Entrega",
  devolucion: "Devolución",
  recoleccion: "Recolección",
};

const MUNICIPIOS_SUGERIDOS = [
  "*",
  "Bogotá",
  "Soacha",
  "Sibaté",
  "Chía",
  "Cota",
  "Funza",
  "Mosquera",
  "Madrid",
];

const AdminTarifasMotorizados = () => {
  const { data: motorizados, isLoading: loadingMotorizados } = useMotorizadosList();
  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return motorizados ?? [];
    return (motorizados ?? []).filter(
      (m) =>
        m.full_name?.toLowerCase().includes(q) ||
        m.email?.toLowerCase().includes(q) ||
        m.phone?.includes(q),
    );
  }, [motorizados, search]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-black tracking-tight flex items-center gap-2">
          <Bike className="h-6 w-6 text-primary" />
          Tarifas Motorizados
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Configura el valor que cada motorizado gana por entrega/devolución/recolección
          según el municipio. La tarifa se aplica automáticamente cuando el pedido
          cambia a estado <strong>Entregado</strong>.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[320px_1fr] gap-4">
        {/* Lista de motorizados */}
        <div className="rounded-xl border border-border bg-card">
          <div className="p-3 border-b border-border">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Buscar motorizado..."
                className="pl-9 h-9"
              />
            </div>
          </div>
          <div className="max-h-[60vh] overflow-y-auto divide-y divide-border">
            {loadingMotorizados ? (
              <div className="flex justify-center py-10">
                <Loader2 className="h-5 w-5 animate-spin text-primary" />
              </div>
            ) : filtered.length === 0 ? (
              <p className="text-xs text-muted-foreground p-6 text-center">
                Sin motorizados activos.
              </p>
            ) : (
              filtered.map((m) => (
                <button
                  key={m.user_id}
                  type="button"
                  onClick={() => setSelectedId(m.user_id)}
                  className={cn(
                    "w-full text-left px-3 py-2.5 hover:bg-muted/40 transition-colors",
                    selectedId === m.user_id && "bg-primary/10 border-l-2 border-primary",
                  )}
                >
                  <p className="text-sm font-semibold text-foreground truncate">
                    {m.full_name || "(sin nombre)"}
                  </p>
                  <p className="text-[11px] text-muted-foreground truncate">
                    {m.phone || m.email || ""}
                  </p>
                </button>
              ))
            )}
          </div>
        </div>

        {/* Panel de tarifas */}
        <div>
          {selectedId ? (
            <TarifasPanel
              motorizadoId={selectedId}
              motorizadoNombre={motorizados?.find((m) => m.user_id === selectedId)?.full_name ?? ""}
            />
          ) : (
            <div className="rounded-xl border border-dashed border-border p-10 text-center text-sm text-muted-foreground">
              <Bike className="h-10 w-10 mx-auto text-muted-foreground/40" />
              <p className="mt-2">Selecciona un motorizado para gestionar sus tarifas.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

interface TarifasPanelProps {
  motorizadoId: string;
  motorizadoNombre: string;
}

const TarifasPanel = ({ motorizadoId, motorizadoNombre }: TarifasPanelProps) => {
  const { data: tarifas, isLoading } = useTarifasMotorizado(motorizadoId);
  const upsert = useUpsertTarifa();
  const archivar = useArchivarTarifa();

  const [modalOpen, setModalOpen] = useState(false);
  const [municipio, setMunicipio] = useState("Bogotá");
  const [tipo, setTipo] = useState<"entrega" | "devolucion" | "recoleccion">("entrega");
  const [valor, setValor] = useState("");
  const [vigenteDesde, setVigenteDesde] = useState(() => new Date().toISOString().slice(0, 10));
  const [vigenteHasta, setVigenteHasta] = useState("");
  const [notas, setNotas] = useState("");

  const reset = () => {
    setMunicipio("Bogotá");
    setTipo("entrega");
    setValor("");
    setVigenteDesde(new Date().toISOString().slice(0, 10));
    setVigenteHasta("");
    setNotas("");
  };

  const handleSubmit = async () => {
    const v = Number(valor);
    if (!municipio.trim() || !Number.isFinite(v) || v < 0) {
      toast.error("Municipio y valor obligatorios");
      return;
    }
    try {
      await upsert.mutateAsync({
        motorizadoId,
        municipio: municipio.trim(),
        tipo,
        valor: v,
        vigente_desde: vigenteDesde || undefined,
        vigente_hasta: vigenteHasta || null,
        notas: notas.trim() || null,
      });
      toast.success("Tarifa guardada");
      reset();
      setModalOpen(false);
    } catch (e: any) {
      toast.error(e?.message || "No se pudo guardar");
    }
  };

  const handleArchivar = async (id: string) => {
    if (!confirm("¿Archivar esta tarifa? El motorizado dejará de cobrarla en pedidos nuevos.")) return;
    try {
      await archivar.mutateAsync({ id, motorizadoId });
      toast.success("Tarifa archivada");
    } catch (e: any) {
      toast.error(e?.message || "Error");
    }
  };

  const activas = (tarifas ?? []).filter((t) => t.activa);
  const inactivas = (tarifas ?? []).filter((t) => !t.activa);

  return (
    <div className="rounded-xl border border-border bg-card">
      <div className="flex items-center justify-between gap-3 p-4 border-b border-border">
        <div>
          <h2 className="text-sm font-bold text-foreground">{motorizadoNombre}</h2>
          <p className="text-[11px] text-muted-foreground font-mono">{motorizadoId}</p>
        </div>
        <Button size="sm" onClick={() => setModalOpen(true)} className="gap-1.5">
          <Plus className="h-3.5 w-3.5" /> Nueva tarifa
        </Button>
      </div>

      <div className="p-4">
        {isLoading ? (
          <div className="flex justify-center py-10">
            <Loader2 className="h-5 w-5 animate-spin text-primary" />
          </div>
        ) : (tarifas ?? []).length === 0 ? (
          <div className="border border-dashed border-border rounded-lg p-8 text-center">
            <DollarSign className="h-10 w-10 mx-auto text-muted-foreground/40" />
            <p className="text-sm text-muted-foreground mt-2">
              Sin tarifas configuradas. Este motorizado <strong>NO ganará dinero</strong> por sus entregas hasta que crees una.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {activas.length > 0 && (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="text-[10px] uppercase tracking-wider text-muted-foreground border-b border-border">
                    <tr>
                      <th className="text-left py-2">Municipio</th>
                      <th className="text-left py-2">Tipo</th>
                      <th className="text-right py-2">Valor</th>
                      <th className="text-left py-2 pl-3">Vigencia</th>
                      <th className="text-left py-2">Notas</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {activas.map((t) => (
                      <tr key={t.id} className="border-b border-border last:border-0">
                        <td className="py-2 font-semibold text-foreground">
                          {t.municipio === "*" ? (
                            <Badge variant="outline" className="text-[10px]">Cualquier municipio</Badge>
                          ) : (
                            t.municipio
                          )}
                        </td>
                        <td className="py-2 text-foreground">{TIPO_LABELS[t.tipo] ?? t.tipo}</td>
                        <td className="py-2 text-right font-bold tabular-nums" style={{ color: "var(--catalog-primary, #1B2959)" }}>
                          {formatCOP(t.valor)}
                        </td>
                        <td className="py-2 pl-3 text-[11px] text-muted-foreground">
                          desde {new Date(t.vigente_desde).toLocaleDateString("es-CO")}
                          {t.vigente_hasta ? ` · hasta ${new Date(t.vigente_hasta).toLocaleDateString("es-CO")}` : ""}
                        </td>
                        <td className="py-2 text-[11px] text-muted-foreground line-clamp-1 max-w-[180px]">
                          {t.notas || "—"}
                        </td>
                        <td className="py-2 text-right">
                          <button
                            type="button"
                            onClick={() => handleArchivar(t.id)}
                            className="text-muted-foreground hover:text-destructive p-1"
                            title="Archivar"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {inactivas.length > 0 && (
              <details className="text-xs text-muted-foreground">
                <summary className="cursor-pointer hover:text-foreground">
                  Archivadas ({inactivas.length})
                </summary>
                <ul className="mt-2 space-y-1 ml-3">
                  {inactivas.map((t) => (
                    <li key={t.id}>
                      {t.municipio} · {TIPO_LABELS[t.tipo]} · {formatCOP(t.valor)}
                    </li>
                  ))}
                </ul>
              </details>
            )}
          </div>
        )}
      </div>

      {/* Modal crear */}
      <Dialog open={modalOpen} onOpenChange={(o) => (o ? setModalOpen(true) : (reset(), setModalOpen(false)))}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Tag className="h-5 w-5 text-primary" /> Nueva tarifa
            </DialogTitle>
            <DialogDescription>
              Define cuánto gana este motorizado por cada operación según el municipio.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Municipio *</Label>
                <Select value={municipio} onValueChange={setMunicipio}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {MUNICIPIOS_SUGERIDOS.map((m) => (
                      <SelectItem key={m} value={m}>
                        {m === "*" ? "★ Cualquier municipio (default)" : m}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-[10px] text-muted-foreground mt-1">
                  Usa "Cualquier municipio" como tarifa fallback cuando no hay regla específica.
                </p>
              </div>
              <div>
                <Label>Tipo *</Label>
                <Select value={tipo} onValueChange={(v) => setTipo(v as any)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="entrega">Entrega</SelectItem>
                    <SelectItem value="devolucion">Devolución</SelectItem>
                    <SelectItem value="recoleccion">Recolección</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div>
              <Label>Valor por operación (COP) *</Label>
              <Input
                type="number"
                min={0}
                value={valor}
                onChange={(e) => setValor(e.target.value)}
                placeholder="8000"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Vigente desde *</Label>
                <Input type="date" value={vigenteDesde} onChange={(e) => setVigenteDesde(e.target.value)} />
              </div>
              <div>
                <Label>Vigente hasta (opcional)</Label>
                <Input type="date" value={vigenteHasta} onChange={(e) => setVigenteHasta(e.target.value)} />
              </div>
            </div>

            <div>
              <Label>Notas (opcional)</Label>
              <Input value={notas} onChange={(e) => setNotas(e.target.value)} placeholder="Acuerdo verbal 2026..." />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => (reset(), setModalOpen(false))} disabled={upsert.isPending}>
              Cancelar
            </Button>
            <Button onClick={handleSubmit} disabled={upsert.isPending}>
              {upsert.isPending && <Loader2 className="h-4 w-4 animate-spin mr-1" />}
              Guardar tarifa
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AdminTarifasMotorizados;
