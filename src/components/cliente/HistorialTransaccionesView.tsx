import { useState, useEffect, useCallback, useRef } from "react";
import { motion } from "framer-motion";
import {
  DollarSign,
  Loader2,
  FileText,
  ArrowDownCircle,
  ArrowUpCircle,
  Download,
  ExternalLink,
  AlertCircle,
  RefreshCw,
} from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { formatInTimeZone } from "date-fns-tz";
import { es } from "date-fns/locale";
import EvidencePhotoModal from "@/components/EvidencePhotoModal";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

// ─── Constantes ───────────────────────────────────────────────────────────────

/*
  FIX: magic number `50` extraído como constante con nombre descriptivo.
*/
const TRANSACCIONES_LIMIT = 50;

/*
  FIX: `new Intl.NumberFormat(...)` se instanciaba 3 veces por fila de tabla
  (monto, saldo_anterior, saldo_nuevo) — con 50 filas = 150 instanciaciones
  por render. `Intl.NumberFormat` es costoso de construir.
  Instancia única a nivel de módulo, reutilizada en todos los formateos.
*/
const formatCOPCurrency = new Intl.NumberFormat("es-CO", {
  style: "currency",
  currency: "COP",
  minimumFractionDigits: 0,
});

const formatCOP = (value: number) => formatCOPCurrency.format(value);

/*
  FIX: `isImageUrl` movida fuera del componente.
  Era una función pura sin dependencias del scope recreada en cada render.

  FIX: la regex `/\.(jpg|jpeg|png|gif|webp)$/i` fallaba con URLs de Supabase
  Storage que incluyen query params, por ejemplo:
    `.../image.jpg?token=abc123`  → la regex no matcheaba.
  Corregido extrayendo el pathname de la URL antes de testear la extensión.
*/
const isImageUrl = (url: string): boolean => {
  try {
    const pathname = new URL(url).pathname;
    return /\.(jpg|jpeg|png|gif|webp)$/i.test(pathname);
  } catch {
    // URL relativa u otro formato — fallback a la regex original
    return /\.(jpg|jpeg|png|gif|webp)(\?.*)?$/i.test(url);
  }
};

// ─── Tipos ────────────────────────────────────────────────────────────────────

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

// ─── Componente ───────────────────────────────────────────────────────────────

const HistorialTransaccionesView = () => {
  const [transacciones, setTransacciones] = useState<Transaccion[]>([]);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [previewImage, setPreviewImage] = useState<string | null>(null);

  const cancelRef = useRef(false);
  const { user, loading: authLoading } = useAuth();

  // ── Fetch ──────────────────────────────────────────────────────────────────

  /*
    FIX: `fetchTransacciones` extraído como `useCallback` fuera del efecto.
    Esto permite:
    1. Pasarlo como dependencia en el useEffect sin causar loops.
    2. Reutilizarlo en el botón "Reintentar" del estado de error.
    3. Eliminación de la función recreada en cada render.

    FIX: `select("*")` → columnas explícitas para traer solo lo necesario.
  */
  const fetchTransacciones = useCallback(async () => {
    if (!user?.id) return;

    setLoading(true);
    setFetchError(null);

    const { data, error } = await supabase
      .from("transacciones_billetera")
      .select("id, tipo, monto, saldo_anterior, saldo_nuevo, notas, comprobante_url, created_at")
      .eq("client_user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(TRANSACCIONES_LIMIT);

    if (cancelRef.current) return;

    if (error) {
      console.warn("[HistorialTransacciones] Error:", error.message);
      /*
        FIX: error silencioso reemplazado por estado de error con mensaje.
        La versión original mostraba una lista vacía sin contexto cuando
        la query fallaba — el usuario no podía distinguir "sin datos" de
        "fallo de red". Ahora se muestra un aviso con botón de reintento.
      */
      setFetchError("No se pudo cargar el historial. Verifica tu conexión.");
    } else {
      setTransacciones(data ?? []);
    }

    setLoading(false);
  }, [user?.id]);

  useEffect(() => {
    cancelRef.current = false;

    if (authLoading) return;
    if (!user?.id) {
      setLoading(false);
      return;
    }

    fetchTransacciones();

    return () => {
      cancelRef.current = true;
    };
  }, [user?.id, authLoading, fetchTransacciones]);

  // ── Handlers ───────────────────────────────────────────────────────────────

  const handleComprobanteClick = useCallback((url: string) => {
    if (isImageUrl(url)) {
      setPreviewImage(url);
    } else {
      /*
        FIX: `window.open(url, "_blank")` sin `noopener noreferrer`.
        La página abierta tenía acceso a `window.opener` de esta pestaña,
        permitiendo ataques de reverse-tabnapping. Corregido añadiendo
        `noopener,noreferrer` a través de `windowFeatures`.
      */
      window.open(url, "_blank", "noopener,noreferrer");
    }
  }, []);

  // ── Render ─────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div
        className="flex items-center justify-center py-12"
        role="status"
        aria-label="Cargando historial de transacciones..."
      >
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <FileText className="h-5 w-5 text-primary" aria-hidden="true" />
            Historial de Pagos Recibidos
          </CardTitle>
        </CardHeader>
        <CardContent>
          {/* Estado de error con reintento */}
          {fetchError ? (
            <div className="flex flex-col items-center gap-3 py-8 text-center">
              <AlertCircle className="h-10 w-10 text-destructive opacity-60" />
              <p className="text-sm text-muted-foreground">{fetchError}</p>
              <Button variant="outline" size="sm" onClick={fetchTransacciones} className="gap-2">
                <RefreshCw className="h-4 w-4" />
                Reintentar
              </Button>
            </div>
          ) : transacciones.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <DollarSign className="h-12 w-12 mx-auto mb-3 opacity-30" aria-hidden="true" />
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
                  {transacciones.map((tx) => {
                    // FIX: el badge mostraba SIEMPRE "Pago Recibido" en verde,
                    // sin importar si la transacción era crédito o débito.
                    // Refactor: clasificar por `tipo` y mostrar color + signo coherente.
                    const CREDIT_TYPES = new Set([
                      "CREDITO_ENTREGA",
                      "CREDITO_PROVEEDOR",
                      "TRANSFER_IN",
                      "AJUSTE_CREDITO",
                    ]);
                    const isCredit = CREDIT_TYPES.has(tx.tipo);
                    const LABELS: Record<string, string> = {
                      CREDITO_ENTREGA: "Crédito Entrega",
                      CREDITO_PROVEEDOR: "Venta Proveedor",
                      TRANSFER_IN: "Transferencia Recibida",
                      AJUSTE_CREDITO: "Ajuste (Crédito)",
                      PAGO_TIENDA: "Pago Recibido",
                      TRANSFER_OUT: "Transferencia Enviada",
                      DEBITO_DEVOLUCION: "Débito Devolución",
                      AJUSTE_DEBITO: "Ajuste (Débito)",
                    };
                    const label = LABELS[tx.tipo] ?? (isCredit ? "Crédito" : "Débito");
                    return (
                    <TableRow key={tx.id}>
                      <TableCell className="text-sm whitespace-nowrap">
                        {formatInTimeZone(new Date(tx.created_at), "America/Bogota", "dd MMM yyyy HH:mm", {
                          locale: es,
                        })}
                      </TableCell>
                      <TableCell>
                        <span
                          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${
                            isCredit ? "bg-emerald-100 text-emerald-700" : "bg-red-100 text-red-700"
                          }`}
                        >
                          {isCredit ? (
                            <ArrowDownCircle className="h-3 w-3" aria-hidden="true" />
                          ) : (
                            <ArrowUpCircle className="h-3 w-3" aria-hidden="true" />
                          )}
                          {label}
                        </span>
                      </TableCell>
                      <TableCell
                        className={`text-right font-bold ${isCredit ? "text-emerald-600" : "text-red-600"}`}
                      >
                        {isCredit ? "+" : "−"}
                        {formatCOP(tx.monto)}
                      </TableCell>

                      <TableCell className="text-right text-sm text-muted-foreground">
                        {formatCOP(tx.saldo_anterior)}
                      </TableCell>
                      <TableCell className="text-right text-sm font-medium">{formatCOP(tx.saldo_nuevo)}</TableCell>
                      <TableCell
                        className="text-sm text-muted-foreground max-w-[200px] truncate"
                        /*
                          FIX: el truncate en `<td>` muestra "..." pero el texto
                          completo no era accesible. `title` permite ver el texto
                          completo en hover — útil para notas largas.
                        */
                        title={tx.notas ?? undefined}
                      >
                        {tx.notas ?? "—"}
                      </TableCell>
                      <TableCell className="text-center">
                        {tx.comprobante_url ? (
                          <button
                            type="button"
                            onClick={() => handleComprobanteClick(tx.comprobante_url!)}
                            className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
                            /*
                              FIX: botón sin aria-label — "Ver" o "PDF" no
                              describen a qué transacción corresponde el soporte.
                            */
                            aria-label={
                              isImageUrl(tx.comprobante_url)
                                ? `Ver comprobante de pago del ${formatInTimeZone(new Date(tx.created_at), "America/Bogota", "dd/MM/yyyy", { locale: es })}`
                                : `Descargar PDF del comprobante del ${formatInTimeZone(new Date(tx.created_at), "America/Bogota", "dd/MM/yyyy", { locale: es })}`
                            }
                          >
                            {isImageUrl(tx.comprobante_url) ? (
                              <>
                                <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" /> Ver
                              </>
                            ) : (
                              <>
                                <Download className="h-3.5 w-3.5" aria-hidden="true" /> PDF
                              </>
                            )}
                          </button>
                        ) : (
                          <span className="text-xs text-muted-foreground" aria-label="Sin comprobante">
                            —
                          </span>
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
