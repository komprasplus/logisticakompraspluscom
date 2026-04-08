import { useState, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { format, startOfDay, endOfDay, startOfWeek, endOfWeek } from "date-fns";
import { es } from "date-fns/locale";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue
} from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow
} from "@/components/ui/table";
import {
  CalendarIcon, DollarSign, TrendingUp, Truck, ArrowRightLeft, Users
} from "lucide-react";
import { cn } from "@/lib/utils";
import { formatCOP } from "@/lib/tarifas";

type PeriodFilter = "hoy" | "semana" | "custom";

const LiquidacionAliadosPanel = () => {
  const [period, setPeriod] = useState<PeriodFilter>("hoy");
  const [customDate, setCustomDate] = useState<Date | undefined>(undefined);
  const [selectedAlly, setSelectedAlly] = useState<string>("all");

  const dateRange = useMemo(() => {
    const now = new Date();
    if (period === "hoy") return { from: startOfDay(now), to: endOfDay(now) };
    if (period === "semana") return { from: startOfWeek(now, { locale: es }), to: endOfWeek(now, { locale: es }) };
    if (period === "custom" && customDate) return { from: startOfDay(customDate), to: endOfDay(customDate) };
    return { from: startOfDay(now), to: endOfDay(now) };
  }, [period, customDate]);

  // Fetch coordinador_rutas users as allies
  const { data: allies = [] } = useQuery({
    queryKey: ["liquidacion-allies"],
    queryFn: async () => {
      const { data: roles } = await supabase
        .from("user_roles")
        .select("user_id")
        .eq("role", "coordinador_rutas");
      if (!roles || roles.length === 0) return [];
      const { data: profiles } = await supabase
        .from("profiles")
        .select("user_id, full_name")
        .in("user_id", roles.map((r) => r.user_id));
      return profiles || [];
    },
    staleTime: 10 * 60 * 1000,
  });

  const { data: guias = [], isLoading } = useQuery({
    queryKey: ["liquidacion-aliados", dateRange.from.toISOString(), dateRange.to.toISOString()],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("pedidos")
        .select("id, numero_guia, cliente_nombre, producto_nombre, estado, valor_recaudar, valor_flete, flete_tienda, flete_aliado, municipio, motorizado_asignado, motorizado_id, fecha_actualizacion, metodo_pago")
        .in("estado", ["Entregado", "entregado", "Liquidado", "liquidado"])
        .gte("fecha_actualizacion", dateRange.from.toISOString())
        .lte("fecha_actualizacion", dateRange.to.toISOString())
        .not("flete_aliado", "is", null)
        .order("fecha_actualizacion", { ascending: false });
      if (error) throw error;
      return data || [];
    },
  });

  // Filter by selected ally
  const filteredGuias = useMemo(() => {
    if (selectedAlly === "all") return guias;
    return guias.filter((g: any) => g.motorizado_id === selectedAlly || g.motorizado_asignado === selectedAlly);
  }, [guias, selectedAlly]);

  const kpis = useMemo(() => {
    let totalRecaudado = 0;
    let fleteRetenido = 0;
    let fleteTiendaTotal = 0;
    let fleteAliadoTotal = 0;

    filteredGuias.forEach((g: any) => {
      totalRecaudado += g.valor_recaudar || 0;
      fleteRetenido += g.flete_aliado || 0;
      fleteTiendaTotal += g.flete_tienda || g.valor_flete || 0;
      fleteAliadoTotal += g.flete_aliado || 0;
    });

    return {
      totalRecaudado,
      fleteRetenido,
      aTransferir: totalRecaudado - fleteRetenido,
      margenOperativo: fleteTiendaTotal - fleteAliadoTotal,
      totalGuias: filteredGuias.length,
    };
  }, [filteredGuias]);

  const selectedAllyName = selectedAlly === "all"
    ? "Todos los Aliados"
    : allies.find((a) => a.user_id === selectedAlly)?.full_name || "Aliado";

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h2 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <Truck className="h-6 w-6 text-primary" />
            Liquidación de Aliados Logísticos
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            Conciliación de recaudo y flete retenido por aliados
          </p>
        </div>

        <div className="flex items-center gap-2">
          {(["hoy", "semana"] as PeriodFilter[]).map((p) => (
            <Button key={p} size="sm" variant={period === p ? "default" : "outline"} onClick={() => setPeriod(p)}>
              {p === "hoy" ? "Hoy" : "Semana"}
            </Button>
          ))}
          <Popover>
            <PopoverTrigger asChild>
              <Button size="sm" variant={period === "custom" ? "default" : "outline"} className="gap-1">
                <CalendarIcon className="h-4 w-4" />
                {period === "custom" && customDate ? format(customDate, "dd MMM", { locale: es }) : "Fecha"}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="end">
              <Calendar mode="single" selected={customDate} onSelect={(d) => { setCustomDate(d); setPeriod("custom"); }} locale={es} />
            </PopoverContent>
          </Popover>
        </div>
      </div>

      {/* Ally Selector */}
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
          <Badge variant="secondary" className="text-xs">{selectedAllyName}</Badge>
        )}
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <KPICard title="Total Recaudado" value={formatCOP(kpis.totalRecaudado)} subtitle={`${kpis.totalGuias} guías entregadas`} icon={DollarSign} color="from-blue-500 to-cyan-500" />
        <KPICard title="Flete Retenido (Aliado)" value={formatCOP(kpis.fleteRetenido)} subtitle="Pago del aliado logístico" icon={Truck} color="from-orange-500 to-red-500" />
        <KPICard title="A Transferir a Central" value={formatCOP(kpis.aTransferir)} subtitle="El aliado debe consignar" icon={ArrowRightLeft} color="from-emerald-500 to-teal-500" />
        <KPICard title="Margen Operativo" value={formatCOP(kpis.margenOperativo)} subtitle="flete_tienda − flete_aliado" icon={TrendingUp} color="from-violet-500 to-purple-500" />
      </div>

      {/* Table */}
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
            ) : filteredGuias.length === 0 ? (
              <TableRow><TableCell colSpan={9} className="text-center py-8 text-muted-foreground">No hay guías con aliado logístico en este período</TableCell></TableRow>
            ) : (
              filteredGuias.map((g: any) => {
                const ft = g.flete_tienda || g.valor_flete || 0;
                const fa = g.flete_aliado || 0;
                return (
                  <TableRow key={g.id}>
                    <TableCell className="font-mono text-sm">{g.numero_guia || `#${g.id}`}</TableCell>
                    <TableCell>{g.cliente_nombre || "—"}</TableCell>
                    <TableCell>{g.municipio || "—"}</TableCell>
                    <TableCell><Badge variant="outline" className="text-xs">{g.estado}</Badge></TableCell>
                    <TableCell className="text-xs">{g.metodo_pago === "anticipado" ? "Anticipado" : "COD"}</TableCell>
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
