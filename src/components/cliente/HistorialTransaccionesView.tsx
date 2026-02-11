import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { DollarSign, Loader2, FileText, ArrowDownCircle, Download, ExternalLink } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import EvidencePhotoModal from "@/components/EvidencePhotoModal";
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
  comprobante_url: string | null;
  created_at: string;
}

const HistorialTransaccionesView = () => {
  const [transacciones, setTransacciones] = useState<Transaccion[]>([]);
  const [loading, setLoading] = useState(true);
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const { user, loading: authLoading } = useAuth();

  useEffect(() => {
    // CRITICAL: Wait for auth to be fully ready before fetching
    if (authLoading) return;
    if (!user?.id) {
      setLoading(false);
      return;
    }

    const fetchTransacciones = async () => {
      const { data, error } = await supabase
        .from("transacciones_billetera")
        .select("*")
        .eq("client_user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(50);

      if (error) {
        console.warn("[HistorialTransacciones] Error:", error.message);
      } else {
        setTransacciones(data || []);
      }
      setLoading(false);
    };

    fetchTransacciones();
  }, [user?.id, authLoading]);

  const isImageUrl = (url: string) => /\.(jpg|jpeg|png|gif|webp)$/i.test(url);

  const handleComprobanteClick = (url: string) => {
    if (isImageUrl(url)) {
      setPreviewImage(url);
    } else {
      window.open(url, "_blank");
    }
  };

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
                    <TableHead className="text-center">Soporte</TableHead>
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
                        {new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0 }).format(tx.monto)}
                      </TableCell>
                      <TableCell className="text-right text-sm text-muted-foreground">
                        {new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0 }).format(tx.saldo_anterior)}
                      </TableCell>
                      <TableCell className="text-right text-sm font-medium">
                        {new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0 }).format(tx.saldo_nuevo)}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground max-w-[200px] truncate">
                        {tx.notas || "—"}
                      </TableCell>
                      <TableCell className="text-center">
                        {tx.comprobante_url ? (
                          <button
                            onClick={() => handleComprobanteClick(tx.comprobante_url!)}
                            className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
                          >
                            {isImageUrl(tx.comprobante_url) ? (
                              <><ExternalLink className="h-3.5 w-3.5" /> Ver</>
                            ) : (
                              <><Download className="h-3.5 w-3.5" /> PDF</>
                            )}
                          </button>
                        ) : (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <EvidencePhotoModal
        imageUrl={previewImage}
        isOpen={!!previewImage}
        onClose={() => setPreviewImage(null)}
        title="Comprobante de Pago"
      />
    </motion.div>
  );
};

export default HistorialTransaccionesView;
