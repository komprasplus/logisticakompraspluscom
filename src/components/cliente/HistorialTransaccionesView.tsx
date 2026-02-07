import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { DollarSign, Loader2, FileText, ArrowDownCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface Transaccion {
  id: string;
  tipo: string;
  monto: number;
  saldo_anterior: number;
  saldo_nuevo: number;
  notas: string | null;
  created_at: string;
}

const HistorialTransaccionesView = () => {
  const [transacciones, setTransacciones] = useState<Transaccion[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchTransacciones = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from("transacciones_billetera")
        .select("*")
        .eq("client_user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(50);

      if (!error) setTransacciones(data || []);
      setLoading(false);
    };

    fetchTransacciones();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <FileText className="h-5 w-5 text-primary" />
            Historial de Pagos Recibidos
          </CardTitle>
        </CardHeader>
        <CardContent>
          {transacciones.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <DollarSign className="h-12 w-12 mx-auto mb-3 opacity-30" />
              <p>No hay transacciones registradas aún</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/50">
                    <TableHead>Fecha</TableHead>
                    <TableHead>Tipo</TableHead>
                    <TableHead className="text-right">Monto</TableHead>
                    <TableHead className="text-right">Saldo Anterior</TableHead>
                    <TableHead className="text-right">Saldo Nuevo</TableHead>
                    <TableHead>Notas</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {transacciones.map((tx) => (
                    <TableRow key={tx.id}>
                      <TableCell className="text-sm whitespace-nowrap">
                        {format(new Date(tx.created_at), "dd MMM yyyy HH:mm", { locale: es })}
                      </TableCell>
                      <TableCell>
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-emerald-100 text-emerald-700">
                          <ArrowDownCircle className="h-3 w-3" />
                          Pago Recibido
                        </span>
                      </TableCell>
                      <TableCell className="text-right font-bold text-emerald-600">
                        ${tx.monto.toLocaleString("es-CO")}
                      </TableCell>
                      <TableCell className="text-right text-sm text-muted-foreground">
                        ${tx.saldo_anterior.toLocaleString("es-CO")}
                      </TableCell>
                      <TableCell className="text-right text-sm font-medium">
                        ${tx.saldo_nuevo.toLocaleString("es-CO")}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground max-w-[200px] truncate">
                        {tx.notas || "—"}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </motion.div>
  );
};

export default HistorialTransaccionesView;
