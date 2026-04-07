import { useState } from "react";
import { motion } from "framer-motion";
import { Wallet, TrendingUp, Calendar, ArrowUpRight, ArrowDownLeft, Loader2 } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { formatInTimeZone } from "date-fns-tz";
import { isToday } from "date-fns";

interface LedgerRow {
  id: string;
  pedido_id: number | null;
  transaction_type: string;
  amount: number;
  description: string | null;
  created_at: string;
}

const formatCOP = new Intl.NumberFormat("es-CO", {
  style: "currency",
  currency: "COP",
  minimumFractionDigits: 0,
});

const PAGE_SIZE = 15;

const AdminWalletDashboard = () => {
  const [page, setPage] = useState(0);

  // KPIs query
  const { data: kpis, isLoading: loadingKpis } = useQuery({
    queryKey: ["admin-wallet-kpis"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("admin_wallet_ledger")
        .select("amount, transaction_type, created_at");
      if (error) throw error;

      let totalBalance = 0;
      let todayProfit = 0;
      let totalCredits = 0;
      let totalDebits = 0;

      (data ?? []).forEach((row) => {
        const amt = row.amount ?? 0;
        if (row.transaction_type === "CREDIT") {
          totalBalance += amt;
          totalCredits += amt;
        } else {
          totalBalance -= amt;
          totalDebits += amt;
        }
        if (isToday(new Date(row.created_at))) {
          if (row.transaction_type === "CREDIT") todayProfit += amt;
          else todayProfit -= amt;
        }
      });

      return { totalBalance, todayProfit, totalCredits, totalDebits, count: data?.length ?? 0 };
    },
    staleTime: 30_000,
  });

  // Paginated history
  const { data: history, isLoading: loadingHistory } = useQuery({
    queryKey: ["admin-wallet-history", page],
    queryFn: async () => {
      const from = page * PAGE_SIZE;
      const to = from + PAGE_SIZE - 1;
      const { data, error, count } = await supabase
        .from("admin_wallet_ledger")
        .select("*", { count: "exact" })
        .order("created_at", { ascending: false })
        .range(from, to);
      if (error) throw error;
      return { rows: (data ?? []) as LedgerRow[], total: count ?? 0 };
    },
    staleTime: 30_000,
  });

  const totalPages = Math.ceil((history?.total ?? 0) / PAGE_SIZE);

  if (loadingKpis) {
    return (
      <div className="flex justify-center items-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="p-4 space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-xl font-bold text-foreground flex items-center gap-2">
          <Wallet className="h-6 w-6 text-primary" />
          Billetera Admin — Rentabilidad
        </h2>
        <p className="text-sm text-muted-foreground mt-1">
          Libro mayor inmutable de márgenes por envío
        </p>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="border-primary/30">
          <CardContent className="pt-6">
            <p className="text-sm font-medium text-muted-foreground">Saldo Total</p>
            <p className="text-3xl font-black text-primary mt-1">
              {formatCOP.format(kpis?.totalBalance ?? 0)}
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              {kpis?.count ?? 0} transacciones registradas
            </p>
          </CardContent>
        </Card>
        <Card className="border-emerald-500/30">
          <CardContent className="pt-6">
            <div className="flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-emerald-500" />
              <p className="text-sm font-medium text-muted-foreground">Ganancia Hoy</p>
            </div>
            <p className="text-3xl font-black text-emerald-600 dark:text-emerald-400 mt-1">
              {formatCOP.format(kpis?.todayProfit ?? 0)}
            </p>
          </CardContent>
        </Card>
        <Card className="border-muted">
          <CardContent className="pt-6">
            <div className="flex items-center gap-2">
              <Calendar className="h-4 w-4 text-muted-foreground" />
              <p className="text-sm font-medium text-muted-foreground">Créditos / Débitos</p>
            </div>
            <p className="text-lg font-bold mt-1">
              <span className="text-emerald-600 dark:text-emerald-400">
                {formatCOP.format(kpis?.totalCredits ?? 0)}
              </span>
              <span className="text-muted-foreground mx-2">/</span>
              <span className="text-destructive">
                {formatCOP.format(kpis?.totalDebits ?? 0)}
              </span>
            </p>
          </CardContent>
        </Card>
      </div>

      {/* History Table */}
      <Card>
        <CardContent className="pt-6">
          <h3 className="font-semibold mb-4">Historial de Transacciones</h3>

          {loadingHistory ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <>
              <div className="overflow-auto rounded-lg border">
                <table className="w-full text-sm">
                  <thead className="bg-muted/50">
                    <tr>
                      <th className="text-left p-3 font-medium">Fecha</th>
                      <th className="text-left p-3 font-medium">Pedido</th>
                      <th className="text-left p-3 font-medium">Descripción</th>
                      <th className="text-left p-3 font-medium">Tipo</th>
                      <th className="text-right p-3 font-medium">Monto</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(history?.rows ?? []).length === 0 ? (
                      <tr>
                        <td colSpan={5} className="text-center py-8 text-muted-foreground">
                          Sin transacciones registradas aún
                        </td>
                      </tr>
                    ) : (
                      (history?.rows ?? []).map((row) => (
                        <tr key={row.id} className="border-t hover:bg-muted/20 transition-colors">
                          <td className="p-3 text-muted-foreground whitespace-nowrap">
                            {(() => {
                              try {
                                return formatInTimeZone(row.created_at, "America/Bogota", "dd/MM/yy HH:mm");
                              } catch {
                                return "—";
                              }
                            })()}
                          </td>
                          <td className="p-3 font-mono text-xs">
                            #{row.pedido_id ?? "—"}
                          </td>
                          <td className="p-3 max-w-xs truncate">
                            {row.description ?? "—"}
                          </td>
                          <td className="p-3">
                            {row.transaction_type === "CREDIT" ? (
                              <Badge className="bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-300 dark:border-emerald-700 gap-1">
                                <ArrowUpRight className="h-3 w-3" /> Crédito
                              </Badge>
                            ) : (
                              <Badge variant="destructive" className="gap-1">
                                <ArrowDownLeft className="h-3 w-3" /> Débito
                              </Badge>
                            )}
                          </td>
                          <td className={`p-3 text-right font-bold whitespace-nowrap ${
                            row.transaction_type === "CREDIT"
                              ? "text-emerald-600 dark:text-emerald-400"
                              : "text-destructive"
                          }`}>
                            {row.transaction_type === "CREDIT" ? "+" : "-"}
                            {formatCOP.format(row.amount)}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="flex items-center justify-between mt-4">
                  <p className="text-sm text-muted-foreground">
                    Página {page + 1} de {totalPages} ({history?.total} registros)
                  </p>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setPage((p) => Math.max(0, p - 1))}
                      disabled={page === 0}
                    >
                      Anterior
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
                      disabled={page >= totalPages - 1}
                    >
                      Siguiente
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </motion.div>
  );
};

export default AdminWalletDashboard;
