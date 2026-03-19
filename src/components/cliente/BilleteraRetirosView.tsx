import { useState, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Wallet,
  Plus,
  Building2,
  Smartphone,
  Shield,
  Clock,
  CheckCircle2,
  XCircle,
  Trash2,
  Star,
  Loader2,
  AlertCircle,
  ArrowUpRight,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { formatInTimeZone } from "date-fns-tz";
import { es } from "date-fns/locale";

// ─── Constants ────────────────────────────────────────────────────────────────

const BOLD_BANKS = [
  "Bold CF",
  "Bancamia S.A.",
  "Bancolombia",
  "Bancoldex",
  "Ban100",
  "Banco Agrario",
  "Banco AV Villas",
  "Banco Btg Pactual Colombia S.A.",
  "Banco Caja Social",
  "Banco Citibank",
  "Banco Contactar",
  "Banco Coopcentral",
  "Banco Davivienda",
  "Banco de Bogotá",
  "Banco de Occidente",
  "Banco Falabella",
  "Banco GNB Sudameris",
  "Banco Itaú",
  "Banco JP Morgan",
  "Banco Mundo Mujer",
  "Banco Pichincha S.A.",
  "Banco Popular",
  "Banco Santander de Negocios",
  "Banco Serfinanza",
  "Banco Union",
  "Banco W S.A.",
  "Bancoomeva",
  "BBVA Colombia",
  "CFA COOPERATIVA FINANCIERA",
  "Coink",
  "Coltefinanciera",
  "Confiar Cooperativa Financiera",
  "Crezcamos S.A. Compañía de Financiamiento",
  "Daviplata",
  "Ding Tecnipagos SA",
  "GLOBAL66",
  "Iris",
  "JFK Cooperativa Financiera",
  "Lulo Bank",
  "Movii SA",
  "Nequi",
  "NU",
  "Pibank",
  "Powwi",
  "Rappipay",
  "Santander Consumer",
  "Scotiabank Colpatria",
  "Uala",
];

const DOC_TYPES = [
  { value: "CEDULA", label: "Cédula de Ciudadanía" },
  { value: "NIT", label: "NIT" },
  { value: "CEDULA_EXTRANJERIA", label: "Cédula de Extranjería" },
  { value: "PASAPORTE", label: "Pasaporte" },
  { value: "PPT", label: "PPT" },
  { value: "REGISTRO_CIVIL", label: "Registro Civil" },
];

const ACCOUNT_TYPES = [
  { value: "Ahorros", label: "Cuenta de ahorros" },
  { value: "Corriente", label: "Cuenta corriente" },
  { value: "Deposito electronico", label: "Depósito electrónico" },
];

const formatCOP = new Intl.NumberFormat("es-CO", {
  style: "currency",
  currency: "COP",
  minimumFractionDigits: 0,
});

// ─── Types ────────────────────────────────────────────────────────────────────

interface PaymentMethod {
  id: string;
  user_id: string;
  bank_name: string | null;
  account_type: string | null;
  account_number: string | null;
  bre_b_key: string | null;
  key_type: string | null;
  is_primary: boolean;
  method_type: string;
  payment_mode: string;
  recipient_doc_type: string | null;
  recipient_doc_number: string | null;
  recipient_name: string | null;
  created_at: string;
}

interface WithdrawalRequest {
  id: string;
  user_id: string;
  payment_method_id: string | null;
  amount: number;
  status: string;
  requested_at: string;
  processed_at: string | null;
  admin_notes: string | null;
}

// ─── Component ────────────────────────────────────────────────────────────────

const BilleteraRetirosView = () => {
  const { user, profile } = useAuth();
  const queryClient = useQueryClient();
  const userId = user?.id;

  // Local state
  const [showAddMethod, setShowAddMethod] = useState(false);
  const [showWithdrawModal, setShowWithdrawModal] = useState(false);
  const [addMethodTab, setAddMethodTab] = useState<"BANK_ACCOUNT" | "KEY">("BANK_ACCOUNT");

  // Common fields
  const [recipientDocType, setRecipientDocType] = useState("");
  const [recipientDocNumber, setRecipientDocNumber] = useState("");
  const [recipientName, setRecipientName] = useState("");

  // Bank fields
  const [bankName, setBankName] = useState("");
  const [accountType, setAccountType] = useState("");
  const [accountNumber, setAccountNumber] = useState("");

  // Key fields
  const [keyValue, setKeyValue] = useState("");

  // Withdrawal form
  const [withdrawAmount, setWithdrawAmount] = useState("");
  const [selectedMethodId, setSelectedMethodId] = useState("");

  // ── Queries ───────────────────────────────────────────────────────────────

  const orgId = profile?.organizacion_id;

  const balanceQuery = useQuery({
    queryKey: ["wallet-balance", userId, orgId],
    queryFn: async () => {
      // Source of truth: transacciones_billetera
      // All queries include organizacion_id for multi-tenant RLS compliance
      const [creditosRes, pagosRes, withdrawalsRes, pendingWRes] = await Promise.all([
        supabase
          .from("transacciones_billetera")
          .select("monto")
          .eq("client_user_id", userId!)
          .eq("organizacion_id", orgId!)
          .eq("tipo", "CREDITO_ENTREGA"),
        supabase
          .from("transacciones_billetera")
          .select("monto")
          .eq("client_user_id", userId!)
          .eq("organizacion_id", orgId!)
          .eq("tipo", "PAGO_TIENDA"),
        supabase
          .from("withdrawal_requests")
          .select("amount")
          .eq("user_id", userId!)
          .eq("status", "Approved"),
        supabase
          .from("withdrawal_requests")
          .select("amount")
          .eq("user_id", userId!)
          .eq("status", "Pending"),
      ]);

      // Total earned from deliveries (auto-created by DB trigger on estado→Entregado/Liquidado)
      const totalCreditos = (creditosRes.data ?? []).reduce((sum, t) => sum + (t.monto ?? 0), 0);

      // Payments already sent by admin to this store
      const totalPagado = (pagosRes.data ?? []).reduce((sum, t) => sum + (t.monto ?? 0), 0);

      // Approved withdrawal requests (already paid out)
      const totalWithdrawn = (withdrawalsRes.data ?? []).reduce((sum, w) => sum + (w.amount ?? 0), 0);

      // Pending withdrawal requests (reserved, not yet paid)
      const totalPending = (pendingWRes.data ?? []).reduce((sum, w) => sum + (w.amount ?? 0), 0);

      const available = Math.max(0, totalCreditos - totalPagado - totalWithdrawn - totalPending);
      return { available, totalPending };
    },
    enabled: !!userId && !!orgId,
    staleTime: 60_000,
    refetchInterval: 2 * 60_000,
  });

  const methodsQuery = useQuery({
    queryKey: ["payment-methods", userId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("user_payment_methods")
        .select("*")
        .eq("user_id", userId!)
        .order("is_primary", { ascending: false });
      if (error) throw error;
      return (data ?? []) as PaymentMethod[];
    },
    enabled: !!userId,
    staleTime: 2 * 60_000,
  });

  const withdrawalsQuery = useQuery({
    queryKey: ["withdrawal-requests", userId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("withdrawal_requests")
        .select("*")
        .eq("user_id", userId!)
        .order("requested_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      return (data ?? []) as WithdrawalRequest[];
    },
    enabled: !!userId,
    staleTime: 60_000,
  });

  // ── Mutations ─────────────────────────────────────────────────────────────

  const addMethodMutation = useMutation({
    mutationFn: async () => {
      if (!recipientDocType || !recipientDocNumber || !recipientName) {
        throw new Error("Completa los datos del destinatario (documento y nombre)");
      }
      if (recipientDocNumber.length < 4 || recipientDocNumber.length > 15) {
        throw new Error("El número de documento debe tener entre 4 y 15 caracteres");
      }
      if (recipientName.length > 100) {
        throw new Error("El nombre no puede superar 100 caracteres");
      }

      const payload: Record<string, unknown> = {
        user_id: userId,
        method_type: addMethodTab === "BANK_ACCOUNT" ? "bank" : "breb",
        payment_mode: addMethodTab,
        is_primary: (methodsQuery.data?.length ?? 0) === 0,
        recipient_doc_type: recipientDocType,
        recipient_doc_number: recipientDocNumber.trim(),
        recipient_name: recipientName.trim(),
      };

      if (addMethodTab === "BANK_ACCOUNT") {
        if (!bankName || !accountType || !accountNumber) throw new Error("Completa todos los campos bancarios");
        if (accountNumber.length < 4 || accountNumber.length > 17) throw new Error("El número de cuenta debe tener entre 4 y 17 dígitos");
        payload.bank_name = bankName;
        payload.account_type = accountType;
        payload.account_number = accountNumber;
      } else {
        if (!keyValue) throw new Error("Ingresa la llave (celular o identificador)");
        if (keyValue.length < 4 || keyValue.length > 50) throw new Error("La llave debe tener entre 4 y 50 caracteres");
        payload.bre_b_key = keyValue;
        payload.key_type = "Celular";
      }

      const { error } = await supabase.from("user_payment_methods").insert(payload as any);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Método de pago agregado exitosamente");
      queryClient.invalidateQueries({ queryKey: ["payment-methods", userId] });
      resetAddForm();
      setShowAddMethod(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const deleteMethodMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("user_payment_methods").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Método eliminado");
      queryClient.invalidateQueries({ queryKey: ["payment-methods", userId] });
    },
    onError: () => toast.error("Error al eliminar"),
  });

  const withdrawMutation = useMutation({
    mutationFn: async () => {
      const amt = parseFloat(withdrawAmount);
      if (isNaN(amt) || amt < 1000) throw new Error("El monto mínimo de retiro es $1.000");
      if (amt > (balanceQuery.data?.available ?? 0)) throw new Error("El monto supera tu saldo disponible");
      if (!selectedMethodId) throw new Error("Selecciona un método de pago");

      const { error } = await supabase.from("withdrawal_requests").insert({
        user_id: userId,
        payment_method_id: selectedMethodId,
        amount: amt,
        status: "Pending",
      } as any);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Tu solicitud de retiro está siendo procesada", {
        description: "Recibirás tu pago en las próximas 24-48 horas hábiles.",
      });
      queryClient.invalidateQueries({ queryKey: ["withdrawal-requests", userId] });
      queryClient.invalidateQueries({ queryKey: ["wallet-balance", userId] });
      setShowWithdrawModal(false);
      setWithdrawAmount("");
      setSelectedMethodId("");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  // ── Helpers ───────────────────────────────────────────────────────────────

  const resetAddForm = () => {
    setBankName("");
    setAccountType("");
    setAccountNumber("");
    setKeyValue("");
    setRecipientDocType("");
    setRecipientDocNumber("");
    setRecipientName("");
    setAddMethodTab("BANK_ACCOUNT");
  };

  const getMethodLabel = (m: PaymentMethod) => {
    if (m.payment_mode === "BANK_ACCOUNT" || m.method_type === "bank") {
      return `${m.bank_name ?? "—"} · ${m.account_type ?? ""} · ****${(m.account_number ?? "").slice(-4)}`;
    }
    return `Llave · ${m.bre_b_key ?? "—"}`;
  };

  const statusConfig: Record<string, { label: string; variant: "default" | "secondary" | "destructive"; icon: typeof Clock }> = {
    Pending: { label: "Pendiente", variant: "secondary", icon: Clock },
    Approved: { label: "Pagado", variant: "default", icon: CheckCircle2 },
    Rejected: { label: "Rechazado", variant: "destructive", icon: XCircle },
  };

  const balance = balanceQuery.data?.available ?? 0;
  const pendingAmount = balanceQuery.data?.totalPending ?? 0;

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">

      {/* ─── Section 1: Balance Card ─────────────────────────────────────── */}
      <Card className="relative overflow-hidden border-0 bg-gradient-to-br from-primary/10 via-card to-secondary/10">
        <div className="absolute top-0 right-0 w-40 h-40 bg-primary/5 rounded-full -translate-y-1/2 translate-x-1/2" />
        <div className="absolute bottom-0 left-0 w-32 h-32 bg-secondary/5 rounded-full translate-y-1/2 -translate-x-1/2" />
        <CardContent className="relative pt-8 pb-8 px-6 sm:px-8">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-6">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <Wallet className="h-5 w-5 text-primary" />
                <p className="text-sm font-medium text-muted-foreground">Saldo Disponible</p>
              </div>
              <p className="text-4xl sm:text-5xl font-black text-foreground tracking-tight">
                {balanceQuery.isLoading ? (
                  <Loader2 className="h-8 w-8 animate-spin text-primary" />
                ) : (
                  formatCOP.format(balance)
                )}
              </p>
              {pendingAmount > 0 && (
                <p className="text-sm text-muted-foreground mt-2 flex items-center gap-1">
                  <Clock className="h-3.5 w-3.5" />
                  {formatCOP.format(pendingAmount)} en retiros pendientes
                </p>
              )}
            </div>
            <Button
              size="lg"
              onClick={() => setShowWithdrawModal(true)}
              disabled={balance <= 0 || (methodsQuery.data?.length ?? 0) === 0}
              className="gap-2 text-base font-bold px-8 py-6 rounded-2xl shadow-lg hover:shadow-xl transition-shadow"
            >
              <ArrowUpRight className="h-5 w-5" />
              Retirar Dinero
            </Button>
          </div>
          {(methodsQuery.data?.length ?? 0) === 0 && !methodsQuery.isLoading && (
            <p className="text-xs text-amber-600 mt-3 flex items-center gap-1">
              <AlertCircle className="h-3.5 w-3.5" />
              Agrega un método de pago antes de solicitar un retiro
            </p>
          )}
        </CardContent>
      </Card>

      {/* ─── Section 2: Payment Methods ──────────────────────────────────── */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-4">
          <CardTitle className="text-lg flex items-center gap-2">
            <Building2 className="h-5 w-5 text-primary" />
            Cuentas Inscritas
          </CardTitle>
          <Button variant="outline" size="sm" onClick={() => setShowAddMethod(true)} className="gap-1.5 rounded-xl">
            <Plus className="h-4 w-4" />
            Agregar
          </Button>
        </CardHeader>
        <CardContent>
          {methodsQuery.isLoading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
            </div>
          ) : (methodsQuery.data?.length ?? 0) === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Building2 className="h-10 w-10 mx-auto mb-3 opacity-30" />
              <p className="text-sm">No tienes cuentas registradas</p>
              <Button variant="link" onClick={() => setShowAddMethod(true)} className="mt-2 gap-1">
                <Plus className="h-4 w-4" /> Agregar método de pago
              </Button>
            </div>
          ) : (
            <div className="grid gap-3">
              {methodsQuery.data!.map((m) => (
                <motion.div
                  key={m.id}
                  initial={{ opacity: 0, scale: 0.97 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="flex items-center gap-3 p-4 rounded-2xl border bg-card hover:bg-muted/30 transition-colors"
                >
                  <div className={`flex items-center justify-center w-10 h-10 rounded-xl ${
                    (m.payment_mode === "BANK_ACCOUNT" || m.method_type === "bank") ? "bg-blue-100 text-blue-600" : "bg-purple-100 text-purple-600"
                  }`}>
                    {(m.payment_mode === "BANK_ACCOUNT" || m.method_type === "bank") ? <Building2 className="h-5 w-5" /> : <Smartphone className="h-5 w-5" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold truncate">{getMethodLabel(m)}</p>
                    <p className="text-xs text-muted-foreground">
                      {m.recipient_name ? `${m.recipient_name} · ` : ""}
                      {(m.payment_mode === "BANK_ACCOUNT" || m.method_type === "bank") ? "Cuenta Bancaria" : "Llave · Pago Inmediato"}
                    </p>
                  </div>
                  {m.is_primary && (
                    <Badge variant="secondary" className="gap-1 text-xs">
                      <Star className="h-3 w-3" /> Principal
                    </Badge>
                  )}
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => deleteMethodMutation.mutate(m.id)}
                    disabled={deleteMethodMutation.isPending}
                    className="text-muted-foreground hover:text-destructive"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </motion.div>
              ))}
            </div>
          )}

          <div className="flex items-center gap-2 mt-5 p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-400">
            <Shield className="h-4 w-4 flex-shrink-0" />
            <p className="text-xs">Tus datos bancarios están encriptados y seguros</p>
          </div>
        </CardContent>
      </Card>

      {/* ─── Section 3: Withdrawal History ───────────────────────────────── */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Clock className="h-5 w-5 text-primary" />
            Historial de Retiros
          </CardTitle>
        </CardHeader>
        <CardContent>
          {withdrawalsQuery.isLoading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
            </div>
          ) : (withdrawalsQuery.data?.length ?? 0) === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <ArrowUpRight className="h-10 w-10 mx-auto mb-3 opacity-30" />
              <p className="text-sm">Aún no has realizado retiros</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-muted-foreground">
                    <th className="text-left py-3 px-2 font-medium">Fecha</th>
                    <th className="text-right py-3 px-2 font-medium">Monto</th>
                    <th className="text-center py-3 px-2 font-medium">Estado</th>
                    <th className="text-left py-3 px-2 font-medium hidden sm:table-cell">Notas Admin</th>
                  </tr>
                </thead>
                <tbody>
                  {withdrawalsQuery.data!.map((w) => {
                    const sc = statusConfig[w.status] ?? statusConfig.Pending;
                    const Icon = sc.icon;
                    return (
                      <tr key={w.id} className="border-b last:border-0 hover:bg-muted/30 transition-colors">
                        <td className="py-3 px-2 whitespace-nowrap">
                          {formatInTimeZone(new Date(w.requested_at), "America/Bogota", "dd MMM yyyy", { locale: es })}
                        </td>
                        <td className="py-3 px-2 text-right font-bold">{formatCOP.format(w.amount)}</td>
                        <td className="py-3 px-2 text-center">
                          <Badge
                            variant={sc.variant}
                            className={`gap-1 ${
                              w.status === "Pending"
                                ? "bg-amber-100 text-amber-700 border-amber-200"
                                : w.status === "Approved"
                                ? "bg-emerald-100 text-emerald-700 border-emerald-200"
                                : ""
                            }`}
                          >
                            <Icon className="h-3 w-3" />
                            {sc.label}
                          </Badge>
                        </td>
                        <td className="py-3 px-2 text-muted-foreground hidden sm:table-cell max-w-[200px] truncate" title={w.admin_notes ?? undefined}>
                          {w.admin_notes ?? "—"}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ─── Modal: Add Payment Method ───────────────────────────────────── */}
      <Dialog open={showAddMethod} onOpenChange={setShowAddMethod}>
        <DialogContent className="sm:max-w-lg rounded-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Plus className="h-5 w-5 text-primary" />
              Agregar Método de Pago
            </DialogTitle>
            <DialogDescription>
              Registra una cuenta bancaria o llave para recibir tus retiros. Los datos deben coincidir con el formato Bold.
            </DialogDescription>
          </DialogHeader>

          {/* Common recipient fields */}
          <div className="space-y-4 mt-2">
            <div className="p-3 rounded-xl bg-muted/50 border space-y-3">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Datos del Destinatario</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs">Tipo de Documento</Label>
                  <Select value={recipientDocType} onValueChange={setRecipientDocType}>
                    <SelectTrigger className="h-9"><SelectValue placeholder="Selecciona" /></SelectTrigger>
                    <SelectContent>
                      {DOC_TYPES.map((d) => (
                        <SelectItem key={d.value} value={d.value}>{d.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Número de Documento</Label>
                  <Input
                    placeholder="Ej: 1234567890"
                    value={recipientDocNumber}
                    onChange={(e) => setRecipientDocNumber(e.target.value.replace(/[^0-9a-zA-Z]/g, "").slice(0, 15))}
                    maxLength={15}
                    className="h-9"
                  />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Nombre del Destinatario</Label>
                <Input
                  placeholder="Nombre completo o razón social"
                  value={recipientName}
                  onChange={(e) => setRecipientName(e.target.value.slice(0, 100))}
                  maxLength={100}
                  className="h-9"
                />
              </div>
            </div>
          </div>

          <Tabs value={addMethodTab} onValueChange={(v) => setAddMethodTab(v as "BANK_ACCOUNT" | "KEY")} className="mt-2">
            <TabsList className="w-full">
              <TabsTrigger value="BANK_ACCOUNT" className="flex-1 gap-1.5">
                <Building2 className="h-4 w-4" /> Cuenta Bancaria
              </TabsTrigger>
              <TabsTrigger value="KEY" className="flex-1 gap-1.5">
                <Smartphone className="h-4 w-4" /> Llave / Bre-B
              </TabsTrigger>
            </TabsList>

            <TabsContent value="BANK_ACCOUNT" className="space-y-4 mt-4">
              <div className="space-y-2">
                <Label>Banco Destino</Label>
                <Select value={bankName} onValueChange={setBankName}>
                  <SelectTrigger><SelectValue placeholder="Selecciona un banco" /></SelectTrigger>
                  <SelectContent className="max-h-60">
                    {BOLD_BANKS.map((b) => (
                      <SelectItem key={b} value={b}>{b}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Tipo de Cuenta</Label>
                <Select value={accountType} onValueChange={setAccountType}>
                  <SelectTrigger><SelectValue placeholder="Tipo" /></SelectTrigger>
                  <SelectContent>
                    {ACCOUNT_TYPES.map((t) => (
                      <SelectItem key={t} value={t}>{t}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Número de Cuenta</Label>
                <Input
                  placeholder="Ej: 12345678901"
                  value={accountNumber}
                  onChange={(e) => setAccountNumber(e.target.value.replace(/\D/g, "").slice(0, 17))}
                  maxLength={17}
                />
              </div>
            </TabsContent>

            <TabsContent value="KEY" className="space-y-4 mt-4">
              <div className="space-y-2">
                <Label>Llave (Celular o Identificador)</Label>
                <Input
                  placeholder="Ej: 3001234567"
                  value={keyValue}
                  onChange={(e) => setKeyValue(e.target.value.slice(0, 50))}
                  maxLength={50}
                />
                <p className="text-xs text-muted-foreground">Ingresa el número de celular o identificador registrado en Bold/Bre-B</p>
              </div>
            </TabsContent>
          </Tabs>

          <DialogFooter className="mt-4">
            <Button variant="outline" onClick={() => { resetAddForm(); setShowAddMethod(false); }}>
              Cancelar
            </Button>
            <Button
              onClick={() => addMethodMutation.mutate()}
              disabled={addMethodMutation.isPending}
              className="gap-1.5"
            >
              {addMethodMutation.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
              Guardar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ─── Modal: Withdraw ─────────────────────────────────────────────── */}
      <Dialog open={showWithdrawModal} onOpenChange={setShowWithdrawModal}>
        <DialogContent className="sm:max-w-md rounded-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ArrowUpRight className="h-5 w-5 text-primary" />
              Solicitar Retiro
            </DialogTitle>
            <DialogDescription>
              Selecciona una cuenta y el monto que deseas retirar.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 mt-2">
            <div className="p-3 rounded-xl bg-primary/5 border border-primary/10 text-center">
              <p className="text-xs text-muted-foreground">Saldo Disponible</p>
              <p className="text-2xl font-black text-foreground">{formatCOP.format(balance)}</p>
            </div>

            <div className="space-y-2">
              <Label>Método de Pago</Label>
              <Select value={selectedMethodId} onValueChange={setSelectedMethodId}>
                <SelectTrigger><SelectValue placeholder="Selecciona una cuenta" /></SelectTrigger>
                <SelectContent>
                  {(methodsQuery.data ?? []).map((m) => (
                    <SelectItem key={m.id} value={m.id}>
                      {getMethodLabel(m)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Monto a Retirar</Label>
              <Input
                type="number"
                placeholder="$ 0"
                value={withdrawAmount}
                onChange={(e) => setWithdrawAmount(e.target.value)}
                min={1000}
                max={balance}
              />
              <p className="text-xs text-muted-foreground">Monto mínimo: $1.000</p>
              {parseFloat(withdrawAmount) > balance && (
                <p className="text-xs text-destructive flex items-center gap-1">
                  <AlertCircle className="h-3 w-3" /> El monto supera tu saldo disponible
                </p>
              )}
            </div>
          </div>

          <DialogFooter className="mt-4">
            <Button variant="outline" onClick={() => setShowWithdrawModal(false)}>
              Cancelar
            </Button>
            <Button
              onClick={() => withdrawMutation.mutate()}
              disabled={withdrawMutation.isPending || !selectedMethodId || !withdrawAmount || parseFloat(withdrawAmount) > balance}
              className="gap-1.5"
            >
              {withdrawMutation.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
              Confirmar Retiro
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </motion.div>
  );
};

export default BilleteraRetirosView;
