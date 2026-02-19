import { useState, useCallback, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  X,
  Loader2,
  ArrowDownCircle,
  ArrowUpCircle,
  Receipt,
  AlertCircle,
  RefreshCw,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  Download,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { formatInTimeZone } from "date-fns-tz";
import { es } from "date-fns/locale";
import { formatCOP } from "@/lib/tarifas";
import EvidencePhotoModal from "@/components/EvidencePhotoModal";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

// ─── Constants ────────────────────────────────────────────────────────────────

const PAGE_SIZE = 10;
const TZ = "America/Bogota";

const isImageUrl = (url: string): boolean => {
  try {
    return /\.(jpg|jpeg|png|gif|webp)$/i.test(new URL(url).pathname);
  } catch {
    return /\.(jpg|jpeg|png|gif|webp)(\?.*)?$/i.test(url);
  }
};

const fmtDate = (iso: string) =>
  formatInTimeZone(new Date(iso), TZ, "dd MMM yyyy HH:mm", { locale: es });

// ─── Types ────────────────────────────────────────────────────────────────────

interface Transaccion {
  id: string;
  tipo: string;
  monto: number;
  concepto: string | null;
  notas: string | null;
  comprobante_url: string | null;
  created_at: string;
  pedido_id: number | null;
}

interface LedgerDrawerProps {
  isOpen: boolean;
  onClose: () => void;
}

// ─── Sub-components ───────────────────────────────────────────────────────────

const TipoBadge = ({ tipo }: { tipo: string }) => {
  const isCredito = tipo === "CREDITO_ENTREGA";
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold ${
        isCredito
          ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400"
          : "bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400"
      }`}
    >
      {isCredito ? (
        <ArrowDownCircle className="h-3 w-3" aria-hidden />
      ) : (
        <ArrowUpCircle className="h-3 w-3" aria-hidden />
      )}
      {isCredito ? "Ingreso" : "Débito"}
    </span>
  );
};

// ─── Main Component ───────────────────────────────────────────────────────────

const LedgerDrawer = ({ isOpen, onClose }: LedgerDrawerProps) => {
  const { user, profile, loading: authLoading } = useAuth();

  const [txs, setTxs] = useState<Transaccion[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [page, setPage] = useState(0); // 0-indexed
  const [loading, setLoading] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [previewImage, setPreviewImage] = useState<string | null>(null);

  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));

  const fetchPage = useCallback(
    async (p: number) => {
      if (!user?.id || !profile?.organizacion_id) return;
      setLoading(true);
      setFetchError(null);

      const from = p * PAGE_SIZE;
      const to = from + PAGE_SIZE - 1;

      const { data, error, count } = await supabase
        .from("transacciones_billetera")
        .select(
          "id, tipo, monto, concepto, notas, comprobante_url, created_at, pedido_id",
          { count: "exact" }
        )
        .eq("client_user_id", user.id)
        .eq("organizacion_id", profile.organizacion_id)
        .order("created_at", { ascending: false })
        .range(from, to);

      setLoading(false);

      if (error) {
        console.warn("[LedgerDrawer] Error:", error.message);
        setFetchError("No se pudo cargar el historial. Verifica tu conexión.");
        return;
      }

      setTxs(data ?? []);
      setTotalCount(count ?? 0);
    },
    [user?.id, profile?.organizacion_id]
  );

  // Fetch on open / page change
  useEffect(() => {
    if (isOpen && !authLoading) {
      fetchPage(page);
    }
  }, [isOpen, page, fetchPage, authLoading]);

  // Reset page when drawer opens
  useEffect(() => {
    if (isOpen) setPage(0);
  }, [isOpen]);

  const handleComprobanteClick = (url: string) => {
    if (isImageUrl(url)) {
      setPreviewImage(url);
    } else {
      window.open(url, "_blank", "noopener,noreferrer");
    }
  };

  // Build a readable concept string from the transaction record
  const buildConcepto = (tx: Transaccion): string => {
    if (tx.concepto) return tx.concepto;
    if (tx.pedido_id) return `Recaudo de pedido #${tx.pedido_id}`;
    if (tx.tipo === "PAGO_TIENDA") return "Pago de tienda";
    return "Movimiento de billetera";
  };

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <>
      {/* Backdrop */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            key="ledger-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm"
            aria-hidden="true"
          />
        )}
      </AnimatePresence>

      {/* Drawer panel */}
      <AnimatePresence>
        {isOpen && (
          <motion.aside
            key="ledger-panel"
            role="dialog"
            aria-modal="true"
            aria-label="Historial de movimientos de billetera"
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ type: "spring", stiffness: 300, damping: 30 }}
            className="fixed right-0 top-0 bottom-0 z-50 flex w-full max-w-2xl flex-col bg-background shadow-2xl border-l border-border"
          >
            {/* Header */}
            <div className="flex items-center justify-between border-b border-border px-6 py-4">
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-amber-500/10">
                  <Receipt className="h-5 w-5 text-amber-500" aria-hidden />
                </div>
                <div>
                  <h2 className="text-base font-bold text-foreground">Historial de Movimientos</h2>
                  <p className="text-xs text-muted-foreground">
                    {totalCount > 0 ? `${totalCount} registros` : "Cargando..."}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={onClose}
                aria-label="Cerrar historial"
                className="rounded-lg p-2 text-muted-foreground hover:bg-muted/60 hover:text-foreground transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Body */}
            <div className="flex-1 overflow-y-auto px-4 py-4 space-y-2">
              {loading ? (
                <div className="flex h-40 items-center justify-center" role="status" aria-label="Cargando...">
                  <Loader2 className="h-7 w-7 animate-spin text-amber-500" />
                </div>
              ) : fetchError ? (
                <div className="flex flex-col items-center gap-3 py-12 text-center">
                  <AlertCircle className="h-10 w-10 text-destructive opacity-60" />
                  <p className="text-sm text-muted-foreground">{fetchError}</p>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => fetchPage(page)}
                    className="gap-2"
                  >
                    <RefreshCw className="h-4 w-4" /> Reintentar
                  </Button>
                </div>
              ) : txs.length === 0 ? (
                <div className="flex flex-col items-center justify-center gap-3 py-16 text-center">
                  <Receipt className="h-12 w-12 text-muted-foreground/30" aria-hidden />
                  <p className="text-sm text-muted-foreground">
                    No hay movimientos registrados aún
                  </p>
                </div>
              ) : (
                <div className="space-y-2">
                  {txs.map((tx) => {
                    const isCredito = tx.tipo === "CREDITO_ENTREGA";
                    const concepto = buildConcepto(tx);

                    return (
                      <motion.div
                        key={tx.id}
                        initial={{ opacity: 0, y: 6 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="flex items-start gap-4 rounded-xl border border-border bg-card px-4 py-3 hover:bg-muted/30 transition-colors"
                      >
                        {/* Icon */}
                        <div
                          className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${
                            isCredito
                              ? "bg-emerald-100 dark:bg-emerald-900/30"
                              : "bg-rose-100 dark:bg-rose-900/30"
                          }`}
                        >
                          {isCredito ? (
                            <ArrowDownCircle className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                          ) : (
                            <ArrowUpCircle className="h-4 w-4 text-rose-600 dark:text-rose-400" />
                          )}
                        </div>

                        {/* Info */}
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <TipoBadge tipo={tx.tipo} />
                            {tx.pedido_id && (
                              <span className="text-xs text-muted-foreground font-mono">
                                #{tx.pedido_id}
                              </span>
                            )}
                          </div>
                          <p
                            className="mt-0.5 text-sm font-medium text-foreground leading-snug truncate"
                            title={concepto}
                          >
                            {concepto}
                          </p>
                          {tx.notas && (
                            <p
                              className="text-xs text-muted-foreground truncate"
                              title={tx.notas}
                            >
                              {tx.notas}
                            </p>
                          )}
                          <p className="mt-1 text-xs text-muted-foreground">
                            {fmtDate(tx.created_at)}
                          </p>
                        </div>

                        {/* Amount + comprobante */}
                        <div className="flex shrink-0 flex-col items-end gap-1.5">
                          <span
                            className={`text-base font-bold tabular-nums ${
                              isCredito
                                ? "text-emerald-600 dark:text-emerald-400"
                                : "text-rose-600 dark:text-rose-400"
                            }`}
                          >
                            {isCredito ? "+" : "-"}
                            {formatCOP(tx.monto)}
                          </span>
                          {tx.comprobante_url && (
                            <button
                              type="button"
                              onClick={() => handleComprobanteClick(tx.comprobante_url!)}
                              aria-label={
                                isImageUrl(tx.comprobante_url)
                                  ? "Ver comprobante"
                                  : "Descargar comprobante PDF"
                              }
                              className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
                            >
                              {isImageUrl(tx.comprobante_url) ? (
                                <>
                                  <ExternalLink className="h-3 w-3" /> Ver
                                </>
                              ) : (
                                <>
                                  <Download className="h-3 w-3" /> PDF
                                </>
                              )}
                            </button>
                          )}
                        </div>
                      </motion.div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Pagination footer */}
            {totalCount > PAGE_SIZE && (
              <div className="flex items-center justify-between border-t border-border px-6 py-3">
                <p className="text-xs text-muted-foreground">
                  {page * PAGE_SIZE + 1}–{Math.min((page + 1) * PAGE_SIZE, totalCount)} de {totalCount}
                </p>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="icon"
                    className="h-8 w-8"
                    onClick={() => setPage((p) => p - 1)}
                    disabled={page === 0 || loading}
                    aria-label="Página anterior"
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <span className="text-xs text-muted-foreground min-w-[60px] text-center">
                    {page + 1} / {totalPages}
                  </span>
                  <Button
                    variant="outline"
                    size="icon"
                    className="h-8 w-8"
                    onClick={() => setPage((p) => p + 1)}
                    disabled={page >= totalPages - 1 || loading}
                    aria-label="Página siguiente"
                  >
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            )}
          </motion.aside>
        )}
      </AnimatePresence>

      <EvidencePhotoModal
        imageUrl={previewImage}
        isOpen={!!previewImage}
        onClose={() => setPreviewImage(null)}
        title="Comprobante de Pago"
      />
    </>
  );
};

export default LedgerDrawer;
