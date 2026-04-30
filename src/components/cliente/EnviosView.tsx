import { useState, useMemo } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Package, AlertTriangle, RotateCcw } from "lucide-react";
import PedidosView from "./PedidosView";
import NovedadesView from "./NovedadesView";
import DevolucionesView from "./DevolucionesView";

interface Pedido {
  id: number;
  numero_guia: string | null;
  cliente_nombre: string | null;
  client_phone: string | null;
  direccion_entrega: string | null;
  barrio: string | null;
  zona: string | null;
  municipio?: string | null;
  producto_nombre: string | null;
  valor_recaudar: number | null;
  valor_producto?: number | null;
  valor_flete?: number | null;
  utilidad?: number | null;
  metodo_pago: string | null;
  fecha_entrega: string | null;
  estado: string | null;
  corte_horario: string | null;
  fecha_creacion: string | null;
  foto_evidencia: string | null;
  tipo_novedad: string | null;
}

interface EnviosViewProps {
  pedidos: Pedido[];
  loading: boolean;
  onEdit: (pedido: Pedido) => void;
  onPrint: (pedido: Pedido) => void;
  onRespond: (pedido: Pedido) => void;
  onViewEvidence: (url: string) => void;
  onRefresh: () => void;
  error?: Error | null;
  hasCache?: boolean;
  /** Tab inicial — permite saltar directo a "novedades" o "devoluciones" desde links legacy */
  initialTab?: "todos" | "novedades" | "devoluciones";
}

/**
 * Vista consolidada de Envíos.
 * Reemplaza los antiguos ítems del sidebar "Mis Pedidos", "Novedades" y
 * "Devoluciones" agrupándolos en un único contenedor con pestañas para
 * eliminar saltos de página y reducir fatiga visual.
 */
const EnviosView = ({
  pedidos,
  loading,
  onEdit,
  onPrint,
  onRespond,
  onViewEvidence,
  onRefresh,
  error,
  hasCache,
  initialTab = "todos",
}: EnviosViewProps) => {
  const [tab, setTab] = useState<string>(initialTab);

  const counts = useMemo(() => {
    let novedades = 0;
    let devoluciones = 0;
    for (const p of pedidos) {
      const e = p.estado?.toLowerCase();
      if (e === "novedad") novedades++;
      if (e === "devolución" || e === "devolucion") devoluciones++;
    }
    return { novedades, devoluciones };
  }, [pedidos]);

  return (
    <div className="space-y-4">
      <Tabs value={tab} onValueChange={setTab} className="w-full">
        <TabsList className="grid w-full grid-cols-3 max-w-xl">
          <TabsTrigger value="todos" className="gap-2">
            <Package className="h-4 w-4" />
            <span>Todos</span>
          </TabsTrigger>
          <TabsTrigger value="novedades" className="gap-2 relative">
            <AlertTriangle className="h-4 w-4" />
            <span>Novedades</span>
            {counts.novedades > 0 && (
              <span className="ml-1 inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-orange-500 px-1 text-[10px] font-bold text-white">
                {counts.novedades > 99 ? "99+" : counts.novedades}
              </span>
            )}
          </TabsTrigger>
          <TabsTrigger value="devoluciones" className="gap-2 relative">
            <RotateCcw className="h-4 w-4" />
            <span>Devoluciones</span>
            {counts.devoluciones > 0 && (
              <span className="ml-1 inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white">
                {counts.devoluciones > 99 ? "99+" : counts.devoluciones}
              </span>
            )}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="todos" className="mt-4">
          <PedidosView
            pedidos={pedidos}
            loading={loading}
            onEdit={onEdit}
            onPrint={onPrint}
            onRespond={onRespond}
            onViewEvidence={onViewEvidence}
            error={error}
            hasCache={hasCache}
          />
        </TabsContent>

        <TabsContent value="novedades" className="mt-4">
          <NovedadesView
            pedidos={pedidos}
            loading={loading}
            onRespond={onRespond}
            onPrint={onPrint}
            onViewEvidence={onViewEvidence}
            onRefresh={onRefresh}
          />
        </TabsContent>

        <TabsContent value="devoluciones" className="mt-4">
          <DevolucionesView pedidos={pedidos} loading={loading} />
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default EnviosView;
