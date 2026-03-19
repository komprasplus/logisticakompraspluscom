import { useState, useMemo } from "react";
import { motion } from "framer-motion";
import {
  DollarSign,
  Clock,
  CheckCircle2,
  XCircle,
  Download,
  Loader2,
  Building2,
  Smartphone,
  Filter,
  Key,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableHeader,
  TableHead,
  TableBody,
  TableRow,
  TableCell,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { formatInTimeZone } from "date-fns-tz";
import { isToday, parseISO } from "date-fns";

// ─── Types ─────────────────────────────────────────────────────────────────────

interface WithdrawalRow {
  id: string;
  user_id: string;
  payment_method_id: string | null;
  amount: number;
  status: string;
  requested_at: string;
  processed_at: string | null;
  admin_notes: string | null;
}

interface PaymentMethodRow {
  id: string;
  user_id: string;
  bank_name: string | null;
  account_type: string | null;
  account_number: string | null;
  bre_b_key: string | null;
  key_type: string | null;
  method_type: string;
  payment_mode: string;
  recipient_doc_type: string | null;
  recipient_doc_number: string | null;
  recipient_name: string | null;
}

interface ProfileRow {
  user_id: string;
  full_name: string;
  store_name: string | null;
}

// ─── Helpers ───────────────────────────────────────────────────────────────────

const formatCOP = new Intl.NumberFormat("es-CO", {
  style: "currency",
  currency: "COP",
  minimumFractionDigits: 0,
});

const formatDate = (iso: string) => {
  try {
    return formatInTimeZone(iso, "America/Bogota", "dd/MM/yyyy HH:mm");
  } catch {
    return "—";
  }
};

const getMethodLabel = (m: PaymentMethodRow | undefined) => {
  if (!m) return "—";
  if (m.payment_mode === "BANK_ACCOUNT" || m.method_type === "bank") {
    const acctShort = (m.account_number ?? "").slice(-4);
    return `${m.bank_name ?? "—"} · ${m.account_type ?? ""} · ****${acctShort}`;
  }
  return `Llave · ${m.bre_b_key ?? "—"}`;
};

const escapeCSV = (val: string) => {
  if (val.includes(",") || val.includes('"') || val.includes("\n")) {
    return `"${val.replace(/"/g, '""')}"`;
  }
  return `"${val}"`;
};

// ─── Component ─────────────────────────────────────────────────────────────────

const AdminFinanzasPanel = () => {
  const queryClient = useQueryClient();
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [confirmAction, setConfirmAction] = useState<{
    id: string;
    action: "Approved" | "Rejected";
  } | null>(null);
  const [adminNotes, setAdminNotes] = useState("");

  // ── Queries ─────────────────────────────────────────────────────────────────

  const withdrawalsQuery = useQuery({
    queryKey: ["admin-withdrawals"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("withdrawal_requests")
        .select("*")
        .order("requested_at", { ascending: false })
        .limit(500);
      if (error) throw error;
      return (data ?? []) as WithdrawalRow[];
    },
    staleTime: 30_000,
  });

  const paymentMethodsQuery = useQuery({
    queryKey: ["admin-payment-methods"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("user_payment_methods")
        .select("id, user_id, bank_name, account_type, account_number, bre_b_key, key_type, method_type, payment_mode, recipient_doc_type, recipient_doc_number, recipient_name");
      if (error) throw error;
      const map: Record<string, PaymentMethodRow> = {};
      (data ?? []).forEach((m) => { map[m.id] = m as PaymentMethodRow; });
      return map;
    },
    staleTime: 5 * 60_000,
  });

  const profilesQuery = useQuery({
    queryKey: ["admin-client-profiles-finanzas"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("user_id, full_name, store_name");
      if (error) throw error;
      const map: Record<string, ProfileRow> = {};
      (data ?? []).forEach((p) => { map[p.user_id] = p as ProfileRow; });
      return map;
    },
    staleTime: 5 * 60_000,
  });

  // ── Mutation ────────────────────────────────────────────────────────────────

  const updateStatusMutation = useMutation({
    mutationFn: async ({ id, status, notes }: { id: string; status: string; notes: string }) => {
      const updates: Record<string, unknown> = {
        status,
        admin_notes: notes || null,
      };
      if (status === "Approved") {
        updates.processed_at = new Date().toISOString();
      }
      const { error } = await supabase
        .from("withdrawal_requests")
        .update(updates)
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: (_, vars) => {
      toast.success(vars.status === "Approved" ? "Retiro marcado como Pagado ✅" : "Retiro rechazado");
      queryClient.invalidateQueries({ queryKey: ["admin-withdrawals"] });
      setConfirmAction(null);
      setAdminNotes("");
    },
    onError: () => toast.error("Error al actualizar el estado"),
  });

  // ── Derived data ────────────────────────────────────────────────────────────

  const withdrawals = withdrawalsQuery.data ?? [];
  const methods = paymentMethodsQuery.data ?? {};
  const profiles = profilesQuery.data ?? {};

  const kpis = useMemo(() => {
    const pending = withdrawals.filter((w) => w.status === "Pending");
    const approved = withdrawals.filter((w) => w.status === "Approved");
    const todayCount = withdrawals.filter((w) => {
      try { return isToday(parseISO(w.requested_at)); } catch { return false; }
    }).length;

    return {
      totalPending: pending.reduce((s, w) => s + w.amount, 0),
      todayCount,
      totalPaid: approved.reduce((s, w) => s + w.amount, 0),
    };
  }, [withdrawals]);

  const filtered = useMemo(() => {
    if (statusFilter === "all") return withdrawals;
    return withdrawals.filter((w) => w.status === statusFilter);
  }, [withdrawals, statusFilter]);

  // ── CSV Export: ACH (Bank Accounts) ────────────────────────────────────────

  const exportACH = () => {
    const pending = withdrawals.filter((w) => w.status === "Pending");
    const achRows = pending.filter((w) => {
      const m = w.payment_method_id ? methods[w.payment_method_id] : undefined;
      return m && (m.payment_mode === "BANK_ACCOUNT" || m.method_type === "bank");
    });

    if (achRows.length === 0) {
      toast.info("No hay solicitudes pendientes con cuenta bancaria para exportar");
      return;
    }

    const header = [
      "Tipo de documento del destinatario",
      "Número de documento del destinatario",
      "Nombre del destinatario",
      "Banco destino",
      "Tipo de cuenta del destinatario",
      "Número de cuenta destino",
      "Valor a enviar",
      "Referencia de pago",
      "Descripción",
    ].map(escapeCSV).join(",");

    const rows = achRows.map((w) => {
      const m = methods[w.payment_method_id!]!;
      return [
        escapeCSV((m.recipient_doc_type ?? "CEDULA").toUpperCase()),
        escapeCSV(m.recipient_doc_number ?? ""),
        escapeCSV(m.recipient_name ?? ""),
        escapeCSV(m.bank_name ?? ""),
        escapeCSV(m.account_type ?? "Cuenta de ahorros"),
        escapeCSV(m.account_number ?? ""),
        String(Math.round(w.amount)),
        escapeCSV(w.id),
        escapeCSV("Pago Plus Envios"),
      ].join(",");
    });

    const csv = [header, ...rows].join("\n");
    downloadCSV(csv, `lote_cuentas_ACH_${new Date().toISOString().slice(0, 10)}.csv`);
    toast.success(`${achRows.length} transferencias ACH exportadas`);
  };

  // ── CSV Export: Keys (Bre-B) ──────────────────────────────────────────────

  const exportKeys = () => {
    const pending = withdrawals.filter((w) => w.status === "Pending");
    const keyRows = pending.filter((w) => {
      const m = w.payment_method_id ? methods[w.payment_method_id] : undefined;
      return m && (m.payment_mode === "KEY" || m.method_type === "breb");
    });

    if (keyRows.length === 0) {
      toast.info("No hay solicitudes pendientes con llave/Bre-B para exportar");
      return;
    }

    const header = [
      "Tipo de documento del destinatario",
      "Número de documento del destinatario",
      "Llave",
      "Valor a enviar",
      "Referencia de pago",
      "Descripción",
    ].map(escapeCSV).join(",");

    const rows = keyRows.map((w) => {
      const m = methods[w.payment_method_id!]!;
      return [
        escapeCSV((m.recipient_doc_type ?? "CEDULA").toUpperCase()),
        escapeCSV(m.recipient_doc_number ?? ""),
        escapeCSV(m.bre_b_key ?? ""),
        String(Math.round(w.amount)),
        escapeCSV(w.id),
        escapeCSV("Pago Plus Envios"),
      ].join(",");
    });

    const csv = [header, ...rows].join("\n");
    downloadCSV(csv, `lote_llaves_BreB_${new Date().toISOString().slice(0, 10)}.csv`);
    toast.success(`${keyRows.length} transferencias con llave exportadas`);
  };

  const downloadCSV = (csv: string, filename: string) => {
    const bom = "\uFEFF";
    const blob = new Blob([bom + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    link.click();
    URL.revokeObjectURL(url);
  };

  // ── Status badge ───────────────────────────────────────────────────────────

  const statusBadge = (status: string) => {
    switch (status) {
      case "Pending":
        return (
          <Badge className="bg-amber-100 text-amber-800 border-amber-200 dark:bg-amber-900/30 dark:text-amber-300 dark:border-amber-800 gap-1">
            <Clock className="h-3 w-3" /> Pendiente
          </Badge>
        );
      case "Approved":
        return (
          <Badge className="bg-emerald-100 text-emerald-800 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-300 dark:border-emerald-800 gap-1">
            <CheckCircle2 className="h-3 w-3" /> Pagado
          </Badge>
        );
      case "Rejected":
        return (
          <Badge className="bg-red-100 text-red-800 border-red-200 dark:bg-red-900/30 dark:text-red-300 dark:border-red-800 gap-1">
            <XCircle className="h-3 w-3" /> Rechazado
          </Badge>
        );
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  // ── Loading state ──────────────────────────────────────────────────────────

  if (withdrawalsQuery.isLoading || profilesQuery.isLoading) {
    return (
      <div className="flex justify-center items-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="p-4 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-foreground flex items-center gap-2">
            <DollarSign className="h-6 w-6 text-primary" />
            Admin Finanzas — Retiros
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            Gestiona las solicitudes de retiro de las tiendas
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button onClick={exportACH} className="gap-2 rounded-xl" variant="outline">
            <Building2 className="h-4 w-4" />
            Exportar Lote Cuentas (ACH)
          </Button>
          <Button onClick={exportKeys} className="gap-2 rounded-xl" variant="outline">
            <Key className="h-4 w-4" />
            Exportar Lote Llaves (Bre-B)
          </Button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="border-amber-200 dark:border-amber-800">
          <CardContent className="pt-6">
            <p className="text-sm font-medium text-muted-foreground">Total Pendiente por Pagar</p>
            <p className="text-3xl font-black text-amber-600 mt-1">{formatCOP.format(kpis.totalPending)}</p>
          </CardContent>
        </Card>
        <Card className="border-sky-200 dark:border-sky-800">
          <CardContent className="pt-6">
            <p className="text-sm font-medium text-muted-foreground">Solicitudes de Hoy</p>
            <p className="text-3xl font-black text-sky-600 mt-1">{kpis.todayCount}</p>
          </CardContent>
        </Card>
        <Card className="border-emerald-200 dark:border-emerald-800">
          <CardContent className="pt-6">
            <p className="text-sm font-medium text-muted-foreground">Total Pagado Histórico</p>
            <p className="text-3xl font-black text-emerald-600 mt-1">{formatCOP.format(kpis.totalPaid)}</p>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3">
        <Filter className="h-4 w-4 text-muted-foreground" />
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-48 rounded-xl">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos</SelectItem>
            <SelectItem value="Pending">Pendientes</SelectItem>
            <SelectItem value="Approved">Pagados</SelectItem>
            <SelectItem value="Rejected">Rechazados</SelectItem>
          </SelectContent>
        </Select>
        <span className="text-sm text-muted-foreground">{filtered.length} solicitudes</span>
      </div>

      {/* Data Table */}
      <Card>
        <div className="overflow-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Fecha</TableHead>
                <TableHead>Tienda</TableHead>
                <TableHead className="text-right">Monto</TableHead>
                <TableHead>Método de Pago</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead className="text-right">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-12 text-muted-foreground">
                    No hay solicitudes de retiro
                  </TableCell>
                </TableRow>
              ) : (
                filtered.map((w) => {
                  const profile = profiles[w.user_id];
                  const method = w.payment_method_id ? methods[w.payment_method_id] : undefined;
                  return (
                    <TableRow key={w.id}>
                      <TableCell className="text-sm whitespace-nowrap">
                        {formatDate(w.requested_at)}
                      </TableCell>
                      <TableCell>
                        <div>
                          <p className="font-semibold text-sm">
                            {profile?.store_name || profile?.full_name || "—"}
                          </p>
                          {profile?.store_name && (
                            <p className="text-xs text-muted-foreground">{profile.full_name}</p>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-right font-bold text-sm">
                        {formatCOP.format(w.amount)}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2 text-sm">
                          {(method?.payment_mode === "BANK_ACCOUNT" || method?.method_type === "bank") ? (
                            <Building2 className="h-4 w-4 text-blue-500 flex-shrink-0" />
                          ) : (
                            <Smartphone className="h-4 w-4 text-purple-500 flex-shrink-0" />
                          )}
                          <span className="truncate max-w-[200px]">{getMethodLabel(method)}</span>
                        </div>
                      </TableCell>
                      <TableCell>{statusBadge(w.status)}</TableCell>
                      <TableCell className="text-right">
                        {w.status === "Pending" ? (
                          <div className="flex items-center justify-end gap-2">
                            <Button
                              size="sm"
                              variant="outline"
                              className="gap-1 text-emerald-600 border-emerald-200 hover:bg-emerald-50 dark:hover:bg-emerald-950/30 rounded-lg"
                              onClick={() => setConfirmAction({ id: w.id, action: "Approved" })}
                            >
                              <CheckCircle2 className="h-3.5 w-3.5" />
                              Pagar
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              className="gap-1 text-red-600 border-red-200 hover:bg-red-50 dark:hover:bg-red-950/30 rounded-lg"
                              onClick={() => setConfirmAction({ id: w.id, action: "Rejected" })}
                            >
                              <XCircle className="h-3.5 w-3.5" />
                              Rechazar
                            </Button>
                          </div>
                        ) : (
                          <span className="text-xs text-muted-foreground">
                            {w.processed_at ? formatDate(w.processed_at) : "—"}
                          </span>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </div>
      </Card>

      {/* Confirm Dialog */}
      <AlertDialog open={!!confirmAction} onOpenChange={(o) => !o && setConfirmAction(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {confirmAction?.action === "Approved"
                ? "¿Confirmar pago de este retiro?"
                : "¿Rechazar esta solicitud?"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {confirmAction?.action === "Approved"
                ? "Esto marcará el retiro como pagado y registrará la fecha de procesamiento."
                : "El monto será liberado del saldo bloqueado del cliente."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="py-2">
            <Textarea
              placeholder="Notas del administrador (opcional)"
              value={adminNotes}
              onChange={(e) => setAdminNotes(e.target.value)}
              className="rounded-xl"
            />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => { setConfirmAction(null); setAdminNotes(""); }}>
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (confirmAction) {
                  updateStatusMutation.mutate({
                    id: confirmAction.id,
                    status: confirmAction.action,
                    notes: adminNotes,
                  });
                }
              }}
              className={
                confirmAction?.action === "Approved"
                  ? "bg-emerald-600 hover:bg-emerald-700"
                  : "bg-red-600 hover:bg-red-700"
              }
              disabled={updateStatusMutation.isPending}
            >
              {updateStatusMutation.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              {confirmAction?.action === "Approved" ? "Confirmar Pago" : "Confirmar Rechazo"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </motion.div>
  );
};

export default AdminFinanzasPanel;
