import { useMemo } from "react";
import { Banknote, Package, User } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";

interface Pedido {
  id: number;
  estado: string | null;
  motorizado_asignado: string | null;
  motorizado_id: string | null;
  valor_recaudar: number | null;
}

interface RecaudoPanelProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  pedidos: Pedido[];
}

interface MotorizadoGroup {
  name: string;
  count: number;
  total: number;
}

const formatCurrency = (value: number) =>
  new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 }).format(value);

const RecaudoPanel = ({ open, onOpenChange, pedidos }: RecaudoPanelProps) => {
  const { groups, grandTotal, maxTotal } = useMemo(() => {
    const enRuta = pedidos.filter(
      (p) => p.estado && ["En Ruta", "en ruta", "EN_RUTA", "En ruta"].includes(p.estado)
    );

    const map = new Map<string, MotorizadoGroup>();
    for (const p of enRuta) {
      const key = p.motorizado_asignado || "Sin asignar";
      const existing = map.get(key);
      const valor = p.valor_recaudar ?? 0;
      if (existing) {
        existing.count += 1;
        existing.total += valor;
      } else {
        map.set(key, { name: key, count: 1, total: valor });
      }
    }

    const sorted = Array.from(map.values()).sort((a, b) => b.total - a.total);
    const grand = sorted.reduce((sum, g) => sum + g.total, 0);
    const max = sorted.length > 0 ? sorted[0].total : 1;

    return { groups: sorted, grandTotal: grand, maxTotal: max };
  }, [pedidos]);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-md overflow-y-auto">
        <SheetHeader className="pb-4 border-b border-border">
          <SheetTitle className="flex items-center gap-2">
            <Banknote className="h-5 w-5 text-primary" />
            Recaudo Activo por Motorizado
          </SheetTitle>
          <p className="text-sm text-muted-foreground">
            Solo guías en estado <span className="font-medium text-foreground">En Ruta</span>
          </p>
        </SheetHeader>

        {/* Summary card */}
        <div className="mt-4 rounded-xl border border-border bg-muted/30 p-4 backdrop-blur-sm">
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Total en calle</span>
            <span className="text-xl font-bold text-foreground">{formatCurrency(grandTotal)}</span>
          </div>
          <div className="mt-1 flex items-center gap-4 text-xs text-muted-foreground">
            <span className="flex items-center gap-1">
              <User className="h-3 w-3" />
              {groups.length} motorizado{groups.length !== 1 ? "s" : ""}
            </span>
            <span className="flex items-center gap-1">
              <Package className="h-3 w-3" />
              {groups.reduce((s, g) => s + g.count, 0)} paquetes
            </span>
          </div>
        </div>

        {/* List */}
        <div className="mt-4 space-y-3">
          {groups.length === 0 && (
            <p className="text-center text-sm text-muted-foreground py-8">
              No hay guías en ruta actualmente.
            </p>
          )}
          {groups.map((g) => (
            <div
              key={g.name}
              className="rounded-lg border border-border bg-card p-3 shadow-sm hover:shadow-md transition-shadow"
            >
              <div className="flex items-center justify-between mb-1.5">
                <div className="flex items-center gap-2 min-w-0">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                    <User className="h-4 w-4" />
                  </div>
                  <span className="text-sm font-medium truncate">{g.name}</span>
                </div>
                <span className="text-sm font-bold text-foreground whitespace-nowrap ml-2">
                  {formatCurrency(g.total)}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <Progress value={(g.total / maxTotal) * 100} className="h-2 flex-1" />
                <span className="text-xs text-muted-foreground whitespace-nowrap">
                  {g.count} paq.
                </span>
              </div>
            </div>
          ))}
        </div>
      </SheetContent>
    </Sheet>
  );
};

export default RecaudoPanel;
