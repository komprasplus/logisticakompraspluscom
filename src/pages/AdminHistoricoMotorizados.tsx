import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import {
  ArrowLeft,
  Bike,
  Calendar,
  Download,
  Loader2,
  Package,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  DollarSign,
  Users,
  TrendingUp,
} from "lucide-react";
import { toast } from "sonner";
import * as XLSX from "xlsx";
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
import { supabase } from "@/integrations/supabase/client";
import { useMotorizadosList } from "@/hooks/useMotorizadoTarifas";
import { cn } from "@/lib/utils";

interface KPIs {
  total: number;
  entregados: number;
  devueltos: number;
  novedades: number;
  en_proceso: number;
  valor_recaudar_total: number;
  valor_recaudado_entregado: number;
  valor_producto_total: number;
  motorizados_distintos: number;
}

interface DiaRow {
  fecha: string;
  total: number;
  entregados: number;
  devueltos: number;
  novedades: number;
  cod_recaudado: number;
}

interface MotorizadoRow {
  motorizado_id: string;
  full_name: string | null;
  phone: string | null;
  total: number;
  entregados: number;
  devueltos: number;
  novedades: number;
  cod_recaudado: number;
  pct_efectividad: number;
}

interface PedidoRow {
  id: number;
  numero_guia: string | null;
  fecha: string;
  cliente_nombre: string | null;
  direccion_entrega: string | null;
  municipio: string | null;
  estado: string | null;
  valor_recaudar: number | null;
  valor_producto: number | null;
  metodo_pago: string | null;
  motorizado_id: string | null;
  motorizado_nombre: string | null;
}

interface HistoricoPayload {
  kpis: KPIs;
  por_dia: DiaRow[];
  por_motorizado: MotorizadoRow[];
  pedidos: PedidoRow[];
  from: string;
  to: string;
}

const formatCOP = (v: number | null | undefined) =>
  v == null ? "—" : `$${Math.round(v).toLocaleString("es-CO")}`;

const formatDate = (iso: string) =>
  new Date(iso).toLocaleDateString("es-CO", { day: "2-digit", month: "short", year: "numeric" });

const formatDateTime = (iso: string) =>
  new Date(iso).toLocaleString("es-CO", {
    day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit",
  });

const todayISO = () => new Date().toISOString().slice(0, 10);
const daysAgoISO = (n: number) => {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().slice(0, 10);
};

type Preset = "hoy" | "ayer" | "7d" | "30d" | "mes" | "custom";

const AdminHistoricoMotorizados = () => {
  const [preset, setPreset] = useState<Preset>("7d");
  const [from, setFrom] = useState(daysAgoISO(7));
  const [to, setTo] = useState(todayISO());
  const [motorizadoId, setMotorizadoId] = useState<string>("__all__");

  const { data: motorizados } = useMotorizadosList();

  const applyPreset = (p: Preset) => {
    setPreset(p);
    if (p === "hoy") {
      setFrom(todayISO());
      setTo(todayISO());
    } else if (p === "ayer") {
      setFrom(daysAgoISO(1));
      setTo(daysAgoISO(1));
    } else if (p === "7d") {
      setFrom(daysAgoISO(7));
      setTo(todayISO());
    } else if (p === "30d") {
      setFrom(daysAgoISO(30));
      setTo(todayISO());
    } else if (p === "mes") {
      const now = new Date();
      const first = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10);
      setFrom(first);
      setTo(todayISO());
    }
  };

  const queryKey = useMemo(
    () => ["admin-historico-motorizados", motorizadoId, from, to] as const,
    [motorizadoId, from, to],
  );

  const { data, isFetching, error, refetch } = useQuery({
    queryKey,
    queryFn: async (): Promise<HistoricoPayload> => {
      const { data, error } = await (supabase.rpc as any)("admin_historico_motorizado", {
        p_motorizado_id: motorizadoId === "__all__" ? null : motorizadoId,
        p_from: from,
        p_to: to,
      });
      if (error) throw error;
      return data as HistoricoPayload;
    },
    staleTime: 30 * 1000,
    refetchOnWindowFocus: false,
  });

  const kpis = data?.kpis;
  const porDia = data?.por_dia ?? [];
  const porMotorizado = data?.por_motorizado ?? [];
  const pedidos = data?.pedidos ?? [];

  const exportExcel = () => {
    if (!data) return;
    try {
      const wb = XLSX.utils.book_new();

      // Hoja 1: KPIs
      const kpisSheet = XLSX.utils.json_to_sheet([
        { Concepto: "Total pedidos", Valor: data.kpis.total },
        { Concepto: "Entregados", Valor: data.kpis.entregados },
        { Concepto: "Devueltos", Valor: data.kpis.devueltos },
        { Concepto: "Novedades", Valor: data.kpis.novedades },
        { Concepto: "En proceso", Valor: data.kpis.en_proceso },
        { Concepto: "COD recaudado", Valor: data.kpis.valor_recaudado_entregado },
        { Concepto: "COD pendiente", Valor: data.kpis.valor_recaudar_total },
        { Concepto: "Motorizados distintos", Valor: data.kpis.motorizados_distintos },
        { Concepto: "Rango desde", Valor: from },
        { Concepto: "Rango hasta", Valor: to },
      ]);
      XLSX.utils.book_append_sheet(wb, kpisSheet, "Resumen");

      // Hoja 2: por día
      if (porDia.length > 0) {
        const diaSheet = XLSX.utils.json_to_sheet(
          porDia.map((d) => ({
            Fecha: d.fecha,
            Total: d.total,
            Entregados: d.entregados,
            Devueltos: d.devueltos,
            Novedades: d.novedades,
            "COD recaudado": d.cod_recaudado,
          })),
        );
        XLSX.utils.book_append_sheet(wb, diaSheet, "Por día");
      }

      // Hoja 3: por motorizado
      if (porMotorizado.length > 0) {
        const motoSheet = XLSX.utils.json_to_sheet(
          porMotorizado.map((m) => ({
            Motorizado: m.full_name ?? m.motorizado_id,
            Teléfono: m.phone ?? "",
            Total: m.total,
            Entregados: m.entregados,
            Devueltos: m.devueltos,
            Novedades: m.novedades,
            "COD recaudado": m.cod_recaudado,
            "% Efectividad": m.pct_efectividad,
          })),
        );
        XLSX.utils.book_append_sheet(wb, motoSheet, "Por motorizado");
      }

      // Hoja 4: pedidos detalle
      if (pedidos.length > 0) {
        const pedSheet = XLSX.utils.json_to_sheet(
          pedidos.map((p) => ({
            "N° Guía": p.numero_guia ?? p.id,
            Fecha: p.fecha,
            Cliente: p.cliente_nombre ?? "",
            Dirección: p.direccion_entrega ?? "",
            Municipio: p.municipio ?? "",
            Estado: p.estado ?? "",
            "Método pago": p.metodo_pago ?? "",
            "Valor producto": p.valor_producto ?? 0,
            "Valor recaudar": p.valor_recaudar ?? 0,
            Motorizado: p.motorizado_nombre ?? p.motorizado_id,
          })),
        );
        XLSX.utils.book_append_sheet(wb, pedSheet, "Pedidos");
      }

      const fileName = `historico-motorizados-${from}-a-${to}.xlsx`;
      XLSX.writeFile(wb, fileName);
      toast.success(`Exportado: ${fileName}`);
    } catch (e: any) {
      console.error(e);
      toast.error("Error al exportar");
    }
  };

  const motorizadoLabel =
    motorizadoId === "__all__"
      ? "Todos los motorizados"
      : motorizados?.find((m) => m.user_id === motorizadoId)?.full_name ?? "Motorizado";

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center gap-3">
          <Button asChild variant="outline" size="sm" className="gap-1.5">
            <Link to="/admin">
              <ArrowLeft className="h-4 w-4" /> Volver al admin
            </Link>
          </Button>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-6 space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-black tracking-tight flex items-center gap-2">
            <Bike className="h-6 w-6 text-primary" />
            Histórico de Motorizados
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Filtra por motorizado y rango de fechas. Exporta a Excel todos los detalles.
          </p>
        </div>

        {/* Filtros */}
        <div className="bg-card border border-border rounded-2xl p-4">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
            <div className="md:col-span-1">
              <Label className="text-xs">Motorizado</Label>
              <Select value={motorizadoId} onValueChange={setMotorizadoId}>
                <SelectTrigger className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__all__">★ Todos los motorizados</SelectItem>
                  {(motorizados ?? []).map((m) => (
                    <SelectItem key={m.user_id} value={m.user_id}>
                      {m.full_name ?? m.email ?? m.user_id.slice(0, 8)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Desde</Label>
              <Input
                type="date"
                value={from}
                onChange={(e) => {
                  setFrom(e.target.value);
                  setPreset("custom");
                }}
                max={to}
                className="mt-1"
              />
            </div>
            <div>
              <Label className="text-xs">Hasta</Label>
              <Input
                type="date"
                value={to}
                onChange={(e) => {
                  setTo(e.target.value);
                  setPreset("custom");
                }}
                min={from}
                max={todayISO()}
                className="mt-1"
              />
            </div>
            <div className="flex items-end gap-2">
              <Button
                onClick={() => refetch()}
                disabled={isFetching}
                className="flex-1 gap-1.5"
              >
                {isFetching ? <Loader2 className="h-4 w-4 animate-spin" /> : <Calendar className="h-4 w-4" />}
                Consultar
              </Button>
              <Button
                onClick={exportExcel}
                variant="outline"
                disabled={!data || isFetching}
                title="Exportar a Excel"
              >
                <Download className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {/* Presets */}
          <div className="flex flex-wrap gap-1.5 mt-3">
            {(
              [
                { key: "hoy", label: "Hoy" },
                { key: "ayer", label: "Ayer" },
                { key: "7d", label: "Últimos 7 días" },
                { key: "30d", label: "Últimos 30 días" },
                { key: "mes", label: "Este mes" },
              ] as { key: Preset; label: string }[]
            ).map((p) => (
              <button
                key={p.key}
                type="button"
                onClick={() => applyPreset(p.key)}
                className={cn(
                  "text-[11px] px-2.5 py-1 rounded-full border transition-colors",
                  preset === p.key
                    ? "bg-primary text-primary-foreground border-primary"
                    : "bg-card border-border text-muted-foreground hover:text-foreground",
                )}
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>

        {error && (
          <div className="bg-destructive/10 border border-destructive/40 rounded-xl p-3 text-sm text-destructive">
            Error consultando histórico. Verifica los filtros.
          </div>
        )}

        {/* KPIs */}
        {kpis && (
          <div>
            <div className="text-xs text-muted-foreground mb-2">
              <strong className="text-foreground">{motorizadoLabel}</strong> · {formatDate(from)} → {formatDate(to)}
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
              <KPICard label="Total" value={kpis.total} icon={Package} color="text-foreground" />
              <KPICard label="Entregados" value={kpis.entregados} icon={CheckCircle2} color="text-emerald-600" />
              <KPICard label="Devoluciones" value={kpis.devueltos} icon={XCircle} color="text-rose-600" />
              <KPICard label="Novedades" value={kpis.novedades} icon={AlertTriangle} color="text-amber-600" />
              <KPICard label="En proceso" value={kpis.en_proceso} icon={Package} color="text-blue-600" />
              <KPICard label="COD recaudado" value={formatCOP(kpis.valor_recaudado_entregado)} icon={DollarSign} color="text-emerald-600" />
              <KPICard
                label="% efectividad"
                value={kpis.total > 0 ? `${Math.round((kpis.entregados / kpis.total) * 100)}%` : "—"}
                icon={TrendingUp}
                color="text-violet-600"
              />
            </div>
          </div>
        )}

        {/* Por motorizado (solo cuando todos) */}
        {motorizadoId === "__all__" && porMotorizado.length > 0 && (
          <section className="bg-card border border-border rounded-2xl overflow-hidden">
            <div className="p-3 border-b border-border flex items-center gap-2">
              <Users className="h-4 w-4 text-primary" />
              <h2 className="text-sm font-bold">Por motorizado</h2>
              <span className="text-[11px] text-muted-foreground">{porMotorizado.length} motorizados</span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/40 text-[10px] uppercase tracking-wider text-muted-foreground">
                  <tr>
                    <th className="text-left px-3 py-2">Motorizado</th>
                    <th className="text-right px-3 py-2">Total</th>
                    <th className="text-right px-3 py-2">Entregados</th>
                    <th className="text-right px-3 py-2">Devueltos</th>
                    <th className="text-right px-3 py-2">Novedades</th>
                    <th className="text-right px-3 py-2">COD recaudado</th>
                    <th className="text-right px-3 py-2">Efectividad</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {porMotorizado.map((m) => (
                    <tr key={m.motorizado_id} className="hover:bg-muted/30">
                      <td className="px-3 py-2">
                        <p className="font-semibold text-foreground">{m.full_name ?? "(sin nombre)"}</p>
                        {m.phone && <p className="text-[10px] text-muted-foreground">{m.phone}</p>}
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums">{m.total}</td>
                      <td className="px-3 py-2 text-right tabular-nums text-emerald-600 font-bold">{m.entregados}</td>
                      <td className="px-3 py-2 text-right tabular-nums text-rose-600">{m.devueltos}</td>
                      <td className="px-3 py-2 text-right tabular-nums text-amber-600">{m.novedades}</td>
                      <td className="px-3 py-2 text-right tabular-nums font-semibold">{formatCOP(m.cod_recaudado)}</td>
                      <td className="px-3 py-2 text-right">
                        <Badge
                          className={cn(
                            "tabular-nums",
                            m.pct_efectividad >= 90 ? "bg-emerald-500" :
                            m.pct_efectividad >= 70 ? "bg-blue-500" :
                            m.pct_efectividad >= 50 ? "bg-amber-500" : "bg-rose-500",
                          )}
                        >
                          {m.pct_efectividad}%
                        </Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        )}

        {/* Por día */}
        {porDia.length > 0 && (
          <section className="bg-card border border-border rounded-2xl overflow-hidden">
            <div className="p-3 border-b border-border flex items-center gap-2">
              <Calendar className="h-4 w-4 text-primary" />
              <h2 className="text-sm font-bold">Agrupado por día</h2>
              <span className="text-[11px] text-muted-foreground">{porDia.length} días</span>
            </div>
            <div className="overflow-x-auto max-h-[400px] overflow-y-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/40 text-[10px] uppercase tracking-wider text-muted-foreground sticky top-0">
                  <tr>
                    <th className="text-left px-3 py-2">Fecha</th>
                    <th className="text-right px-3 py-2">Total</th>
                    <th className="text-right px-3 py-2">Entregados</th>
                    <th className="text-right px-3 py-2">Devueltos</th>
                    <th className="text-right px-3 py-2">Novedades</th>
                    <th className="text-right px-3 py-2">COD recaudado</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {porDia.map((d) => (
                    <tr key={d.fecha} className="hover:bg-muted/30">
                      <td className="px-3 py-2 font-semibold">{formatDate(d.fecha)}</td>
                      <td className="px-3 py-2 text-right tabular-nums">{d.total}</td>
                      <td className="px-3 py-2 text-right tabular-nums text-emerald-600 font-bold">{d.entregados}</td>
                      <td className="px-3 py-2 text-right tabular-nums text-rose-600">{d.devueltos}</td>
                      <td className="px-3 py-2 text-right tabular-nums text-amber-600">{d.novedades}</td>
                      <td className="px-3 py-2 text-right tabular-nums font-semibold">{formatCOP(d.cod_recaudado)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        )}

        {/* Detalle de pedidos */}
        {pedidos.length > 0 && (
          <section className="bg-card border border-border rounded-2xl overflow-hidden">
            <div className="p-3 border-b border-border flex items-center gap-2">
              <Package className="h-4 w-4 text-primary" />
              <h2 className="text-sm font-bold">Detalle de pedidos</h2>
              <span className="text-[11px] text-muted-foreground">
                {pedidos.length} {pedidos.length === 500 ? "(máx · refina filtros)" : ""}
              </span>
            </div>
            <div className="overflow-x-auto max-h-[600px] overflow-y-auto">
              <table className="w-full text-xs">
                <thead className="bg-muted/40 text-[10px] uppercase tracking-wider text-muted-foreground sticky top-0">
                  <tr>
                    <th className="text-left px-3 py-2">Guía</th>
                    <th className="text-left px-3 py-2">Fecha</th>
                    <th className="text-left px-3 py-2">Cliente</th>
                    <th className="text-left px-3 py-2">Motorizado</th>
                    <th className="text-left px-3 py-2">Estado</th>
                    <th className="text-left px-3 py-2">Método</th>
                    <th className="text-right px-3 py-2">Valor producto</th>
                    <th className="text-right px-3 py-2">Recaudar</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {pedidos.map((p) => (
                    <tr key={p.id} className="hover:bg-muted/30">
                      <td className="px-3 py-2 font-mono">{p.numero_guia ?? p.id}</td>
                      <td className="px-3 py-2 text-muted-foreground">{formatDateTime(p.fecha)}</td>
                      <td className="px-3 py-2">
                        <p className="font-semibold text-foreground line-clamp-1">{p.cliente_nombre}</p>
                        <p className="text-[10px] text-muted-foreground line-clamp-1">{p.municipio}</p>
                      </td>
                      <td className="px-3 py-2 text-muted-foreground line-clamp-1">{p.motorizado_nombre ?? "—"}</td>
                      <td className="px-3 py-2">
                        <Badge variant="outline" className="text-[10px]">{p.estado}</Badge>
                      </td>
                      <td className="px-3 py-2 text-muted-foreground">{p.metodo_pago ?? "—"}</td>
                      <td className="px-3 py-2 text-right tabular-nums">{formatCOP(p.valor_producto)}</td>
                      <td className="px-3 py-2 text-right tabular-nums font-semibold">{formatCOP(p.valor_recaudar)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        )}

        {isFetching && (
          <div className="text-center py-10">
            <Loader2 className="h-6 w-6 animate-spin text-primary mx-auto" />
          </div>
        )}

        {!isFetching && data && data.pedidos.length === 0 && (
          <div className="border border-dashed border-border rounded-2xl p-10 text-center">
            <Package className="h-10 w-10 mx-auto text-muted-foreground/40" />
            <p className="text-sm text-muted-foreground mt-2">
              No hay pedidos para esos filtros. Prueba otro rango o motorizado.
            </p>
          </div>
        )}
      </main>
    </div>
  );
};

interface KPICardProps {
  label: string;
  value: number | string;
  icon: any;
  color: string;
}
const KPICard = ({ label, value, icon: Icon, color }: KPICardProps) => (
  <div className="rounded-2xl border border-border bg-card p-3 shadow-sm">
    <p className="text-[10px] uppercase tracking-wider text-muted-foreground flex items-center gap-1">
      <Icon className={cn("h-3 w-3", color)} /> {label}
    </p>
    <p className="text-xl font-black mt-1 tabular-nums text-foreground">{value}</p>
  </div>
);

export default AdminHistoricoMotorizados;
