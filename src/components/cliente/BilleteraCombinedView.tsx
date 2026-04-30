import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { History, ArrowUpRight, Send } from "lucide-react";
import BilleteraRetirosView from "./BilleteraRetirosView";
import HistorialTransaccionesView from "./HistorialTransaccionesView";
import P2PTransferWidget from "./P2PTransferWidget";

interface BilleteraCombinedViewProps {
  /** Tab inicial — permite saltar directo desde links legacy (/retiros, /transferencias) */
  initialTab?: "retiros" | "transferir" | "historial";
}

/**
 * Vista consolidada de Billetera.
 * Refactor IA: reemplaza los ítems independientes "Billetera", "Retiros" y
 * "Transferir" del sidebar por un único contenedor con pestañas:
 *   - Retirar Dinero (header con saldo + botón retirar)
 *   - Transferir (P2P)
 *   - Historial de Movimientos
 */
const BilleteraCombinedView = ({ initialTab = "retiros" }: BilleteraCombinedViewProps) => {
  const [tab, setTab] = useState<string>(initialTab);

  return (
    <div className="space-y-4">
      <Tabs value={tab} onValueChange={setTab} className="w-full">
        <TabsList className="grid w-full grid-cols-3 max-w-xl">
          <TabsTrigger value="retiros" className="gap-2">
            <ArrowUpRight className="h-4 w-4" />
            <span>Retirar</span>
          </TabsTrigger>
          <TabsTrigger value="transferir" className="gap-2">
            <Send className="h-4 w-4" />
            <span>Transferir</span>
          </TabsTrigger>
          <TabsTrigger value="historial" className="gap-2">
            <History className="h-4 w-4" />
            <span>Historial</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="retiros" className="mt-4">
          {/* BilleteraRetirosView ya incluye el header con saldo grande
              + botón "Retirar Dinero" + métodos de pago. */}
          <BilleteraRetirosView />
        </TabsContent>

        <TabsContent value="transferir" className="mt-4">
          <div className="max-w-md mx-auto">
            <P2PTransferWidget />
          </div>
        </TabsContent>

        <TabsContent value="historial" className="mt-4">
          <HistorialTransaccionesView />
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default BilleteraCombinedView;
