import { useState, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { format, startOfDay, endOfDay, startOfWeek, endOfWeek, subDays } from "date-fns";
import { es } from "date-fns/locale";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  CalendarIcon, DollarSign, TrendingUp, Truck, ArrowRightLeft, Users, Download,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { formatCOP } from "@/lib/tarifas";
import { toast } from "sonner";
import type { DateRange } from "react-day-picker";

type PeriodFilter = "hoy" | "semana" | "30d" | "custom";

const LiquidacionAliadosPanel = () => {
  const [period, setPeriod] = useState<PeriodFilter>("hoy");
  const [customRange, setCustomRange] = useState<DateRange | undefined>(undefined);
  const [selectedAlly, setSelectedAlly] = useState<string>("all");

  const dateRange = useMemo(() => {
    const now = new Date();
    if (period === "hoy") return { from: startOfDay(now), to: endOfDay(now) };
    if (period === "semana") return { from: startOfWeek(now, { locale: es }), to: endOfWeek(now, { locale: es }) };
    if (period === "30d") return { from: startOfDay(subDays(now, 30)), to: endOfDay(now) };
    if (period === "custom" && customRange?.from)
      return { from: startOfDay(customRange.from), to: endOfDay(customRange.to ?? customRange.from) };
    return { from: startOfDay(now), to: endOfDay(now) };
  }, [period, customRange]);

  const { data: allies = [] } = useQuery({
    queryKey: ["liquidacion-allies"],
    queryFn: async () => {
      const { data: roles } = await supabase
        .from("user_roles").select("user_id").eq("role", "aliado_logistico");
      if (!roles?.length) return [];
      const { data: profiles } = await supabase
        .from("profiles").select("user_id, full_name")
        .in("user_id", roles.map((r) => r.user_id));
      return profiles || [];
    },
    staleTime: 10 * 60 * 1000,
  });

  const { data: guias = [], isLoading } = useQuery({
    queryKey: ["liquidacion-aliados", dateRange.from.toISOString(), dateRange.to.toISOString(), selectedAlly],
    queryFn: async () => {
      let q = supabase
        .from("pedidos")
        .select("id, numero_guia, cliente_nombre, producto_nombre, estado, valor_recaudar, valor_flete, flete_tienda, flete_aliado, municipio, motorizado_asignado, motorizado_id, aliado_logistico_id, fecha_actualizacion, fecha_entrega, metodo_pago")
        .in("estado", ["Entregado", "entregado", "Liquidado", "liquidado"])
        .gte("fecha_actualizacion", dateRange.from.toISOString())
        .lte("fecha_actualizacion", dateRange.to.toISOString())
        .order("fecha_actualizacion", { ascending: false });

      if (selectedAlly !== "all") {
        q = q.or(`aliado_logistico_id.eq.${selectedAlly},motorizado_id.eq.${selectedAlly}`);
      } else {
        q = q.or("aliado_logistico_id.not.is.null,flete_aliado.not.is.null");
      }
      const { data, error } = await q;
      if (error) throw error;
      return data || [];
    },
  });

  const kpis = useMemo(() => {
    let totalRecaudado = 0, fleteRetenido = 0, fleteTiendaTotal = 0, fleteAliadoTotal = 0;
    guias.forEach((g: any) => {
      const isCOD = String(g.metodo_pago || "").toLowerCase() !== "anticipado";
      if (isCOD) totalRecaudado += g.valor_recaudar || 0;
      fleteRetenido += g.flete_aliado || 0;
      fleteTiendaTotal += g.flete_tienda || g.valor_flete || 0;
      fleteAliadoTotal += g.flete_aliado || 0;
    });
    return {
      totalRecaudado,
      fleteRetenido,
      aTransferir: totalRecaudado - fleteRetenido,
      margenOperativo: fleteTiendaTotal - fleteAliadoTotal,
      totalGuias: guias.length,
    };
  }, [guias]);

  const selectedAllyName = selectedAlly === "all"
    ? "Todos_los_Aliados"
    : (allies.find((a) => a.user_id === selectedAlly)?.full_name || "Aliado").replace(/\s+/g, "_");

  const handleExportCSV = () => {
    if (!guias.length) {
      toast.error("No hay datos para exportar");
      return;
    }
    const headers = ["Guia", "Cliente", "Municipio", "Estado", "Tipo Pago", "Recaudo", "Flete Tienda", "Flete Aliado", "Margen", "Fecha"];
    const escape = (v: any) => {
      const s = String(v ?? "");
      return /[",\n;]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    };
    const rows = guias.map((g: any) => {
      const ft = g.flete_tienda || g.valor_flete || 0;
      const fa = g.flete_aliado || 0;
      return [
        g.numero_guia || `#${g.id}`,
        g.cliente_nombre || "",
        g.municipio || "",
        g.estado,
        String(g.metodo_pago || "").toLowerCase() === "anticipado" ? "Anticipado" : "COD",
        g.valor_recaudar || 0, ft, fa, ft - fa,
        g.fecha_actualizacion ? format(new Date(g.fecha_actualizacion), "yyyy-MM-dd HH:mm") : "",
      ].map(escape).join(",");
    });
    // KPI summary at the bottom
    rows.push("");
    rows.push(["TOTALES", "", "", "", "", kpis.totalRecaudado, "", kpis.fleteRetenido, kpis.margenOperativo, ""].map(escape).join(","));

    const csv = "\uFEFF" + [headers.join(","), ...rows].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `Liquidacion_${selectedAllyName}_${format(dateRange.from, "yyyy-MM-dd")}_${format(dateRange.to, "yyyy-MM-dd")}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast.success(`Descargadas ${guias.length} guías`);
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h2 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <Truck className="h-6 w-6 text-primary" />
            Liquidación de Aliados Logísticos
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            Conciliación de recaudo y flete retenido por empresas aliadas
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {(["hoy", "semana", "30d"] as PeriodFilter[]).map((p) => (
            <Button key={p} size="sm" variant={period === p ? "default" : "outline"} onClick={() => setPeriod(p)}>
              {p === "hoy" ? "Hoy" : p === "semana" ? "Semana" : "30 días"}
            </Button>
          ))}
          <Popover>
            <PopoverTrigger asChild>
              <Button size="sm" variant={period === "custom" ? "default" : "outline"} className="gap-1">
                <CalendarIcon className="h-4 w-4" />
                {period === "custom" && customRange?.from
                  ? `${format(customRange.from, "dd MMM", { locale: es })}${customRange.to ? ` - ${format(customRange.to, "dd MMM", { locale: es })}` : ""}`
                  : "Rango"}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="end">
              <Calendar
                mode="range"
                selected={customRange}
                onSelect={(r) => { setCustomRange(r); setPeriod("custom"); }}
                locale={es}
                numberOfMonths={2}
                className={cn("p-3 pointer-events-auto")}
              />
            </PopoverContent>
          </Popover>
          <Button size="sm" onClick={handleExportCSV} className="gap-1">
            <Download className="h-4 w-4" />
            Descargar Liquidación
          </Button>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <Users className="h-5 w-5 text-muted-foreground" />
        <Select value={selectedAlly} onValueChange={setSelectedAlly}>
          <SelectTrigger className="w-[280px]">
            <SelectValue placeholder="Seleccionar Aliado" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos los Aliados</SelectItem>
            {allies.map((a) => (
              <SelectItem key={a.user_id} value={a.user_id}>{a.full_name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        {selectedAlly !== "all" && (
          <Badge variant="secondary" className="text-xs">{selectedAllyName.replace(/_/g, " ")}</Badge>
        )}
        <Badge variant="outline" className="text-xs">
          {format(dateRange.from, "dd MMM", { locale: es })} → {format(dateRange.to, "dd MMM", { locale: es })}
        </Badge>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <KPICard title="Total Recaudado" value={formatCOP(kpis.totalRecaudado)} subtitle={`${kpis.totalGuias} guías entregadas`} icon={DollarSign} color="from-blue-500 to-cyan-500" />
        <KPICard title="Flete Retenido (Aliado)" value={formatCOP(kpis.fleteRetenido)} subtitle="Pago del aliado logístico" icon={Truck} color="from-orange-500 to-red-500" />
        <KPICard title="A Transferir a Central" value={formatCOP(kpis.aTransferir)} subtitle="El aliado debe consignar" icon={ArrowRightLeft} color="from-emerald-500 to-teal-500" />
        <KPICard title="Margen Operativo" value={formatCOP(kpis.margenOperativo)} subtitle="flete_tienda − flete_aliado" icon={TrendingUp} color="from-violet-500 to-purple-500" />
      </div>

      <div className="rounded-xl border border-border bg-card overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/50">
              <TableHead>Guía</TableHead>
              <TableHead>Cliente</TableHead>
              <TableHead>Municipio</TableHead>
              <TableHead>Estado</TableHead>
              <TableHead>Pago</TableHead>
              <TableHead className="text-right">Recaudo</TableHead>
              <TableHead className="text-right">Flete Tienda</TableHead>
              <TableHead className="text-right">Flete Aliado</TableHead>
              <TableHead className="text-right">Margen</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow><TableCell colSpan={9} className="text-center py-8 text-muted-foreground">Cargando guías...</TableCell></TableRow>
            ) : guias.length === 0 ? (
              <TableRow><TableCell colSpan={9} className="text-center py-8 text-muted-foreground">No hay guías con aliado logístico en este período</TableCell></TableRow>
            ) : (
              guias.map((g: any) => {
                const ft = g.flete_tienda || g.valor_flete || 0;
                const fa = g.flete_aliado || 0;
                return (
                  <TableRow key={g.id}>
                    <TableCell className="font-mono text-sm">{g.numero_guia || `#${g.id}`}</TableCell>
                    <TableCell>{g.cliente_nombre || "—"}</TableCell>
                    <TableCell>{g.municipio || "—"}</TableCell>
                    <TableCell><Badge variant="outline" className="text-xs">{g.estado}</Badge></TableCell>
                    <TableCell className="text-xs">{String(g.metodo_pago || "").toLowerCase() === "anticipado" ? "Anticipado" : "COD"}</TableCell>
                    <TableCell className="text-right font-medium">{formatCOP(g.valor_recaudar)}</TableCell>
                    <TableCell className="text-right">{formatCOP(ft)}</TableCell>
                    <TableCell className="text-right text-orange-600 font-medium">{formatCOP(fa)}</TableCell>
                    <TableCell className="text-right text-emerald-600 font-bold">{formatCOP(ft - fa)}</TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
};

const KPICard = ({ title, value, subtitle, icon: Icon, color }: {
  title: string; value: string; subtitle: string; icon: any; color: string;
}) => (
  <div className="rounded-xl border border-border bg-card p-5 space-y-2">
    <div className="flex items-center justify-between">
      <p className="text-sm text-muted-foreground font-medium">{title}</p>
      <div className={cn("w-9 h-9 rounded-lg bg-gradient-to-br flex items-center justify-center", color)}>
        <Icon className="h-4 w-4 text-white" />
      </div>
    </div>
    <p className="text-2xl font-bold text-foreground">{value}</p>
    <p className="text-xs text-muted-foreground">{subtitle}</p>
  </div>
);

export default LiquidacionAliadosPanel;
