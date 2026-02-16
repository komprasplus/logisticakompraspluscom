import { useState, useEffect, useCallback, useMemo } from "react";
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

const COLOMBIAN_BANKS = [
  "Bancolombia",
  "Banco de Bogotá",
  "Davivienda",
  "BBVA Colombia",
  "Banco de Occidente",
  "Banco Popular",
  "Banco AV Villas",
  "Banco Caja Social",
  "Scotiabank Colpatria",
  "Banco Agrario",
  "Banco Falabella",
  "Banco Pichincha",
  "Banco GNB Sudameris",
  "Banco Itaú",
  "Nequi",
  "Daviplata",
  "Lulo Bank",
  "Nu Colombia",
  "Rappipay",
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
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const userId = user?.id;

  // Local state
  const [showAddMethod, setShowAddMethod] = useState(false);
  const [showWithdrawModal, setShowWithdrawModal] = useState(false);
  const [addMethodTab, setAddMethodTab] = useState<"bank" | "breb">("bank");

  // Form state for adding payment method
  const [bankName, setBankName] = useState("");
  const [accountType, setAccountType] = useState("");
  const [accountNumber, setAccountNumber] = useState("");
  const [breBKey, setBreBKey] = useState("");
  const [keyType, setKeyType] = useState("");

  // Withdrawal form
  const [withdrawAmount, setWithdrawAmount] = useState("");
  const [selectedMethodId, setSelectedMethodId] = useState("");

  // ── Queries ───────────────────────────────────────────────────────────────

  // Balance query (sum of transacciones_billetera)
  const balanceQuery = useQuery({
    queryKey: ["wallet-balance", userId],
    queryFn: async () => {
      // Get total utilidad from delivered/liquidated orders
      const { data: pedidos } = await supabase
        .from("pedidos")
        .select("utilidad, valor_recaudar, valor_flete, metodo_pago, estado")
        .eq("client_user_id", userId!)
        .in("estado", ["Entregado", "Liquidado"]);

      const totalUtilidad = (pedidos ?? [])
        .filter((p) => p.metodo_pago !== "anticipado")
        .reduce((sum, p) => {
          const utilidad = p.utilidad ?? ((p.valor_recaudar || 0) - (p.valor_flete || 12000));
          return sum + utilidad;
        }, 0);

      // Get total payments already received
      const { data: txs } = await supabase
        .from("transacciones_billetera")
        .select("monto")
        .eq("client_user_id", userId!);

      const totalPagado = (txs ?? []).reduce((sum, t) => sum + (t.monto || 0), 0);

      // Get total approved withdrawals
      const { data: withdrawals } = await supabase
        .from("withdrawal_requests")
        .select("amount, status")
        .eq("user_id", userId!)
        .eq("status", "Approved");

      const totalWithdrawn = (withdrawals ?? []).reduce((sum, w) => sum + (w.amount || 0), 0);

      // Get total pending withdrawals (locked funds)
      const { data: pendingW } = await supabase
        .from("withdrawal_requests")
        .select("amount")
        .eq("user_id", userId!)
        .eq("status", "Pending");

      const totalPending = (pendingW ?? []).reduce((sum, w) => sum + (w.amount || 0), 0);

      const available = Math.max(0, totalUtilidad - totalPagado - totalWithdrawn - totalPending);
      return { available, totalPending };
    },
    enabled: !!userId,
    staleTime: 60_000,
  });

  // Payment methods query
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

  // Withdrawal history query
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
      const payload: Record<string, unknown> = {
        user_id: userId,
        method_type: addMethodTab,
        is_primary: (methodsQuery.data?.length ?? 0) === 0,
      };

      if (addMethodTab === "bank") {
        if (!bankName || !accountType || !accountNumber) throw new Error("Completa todos los campos");
        payload.bank_name = bankName;
        payload.account_type = accountType;
        payload.account_number = accountNumber;
      } else {
        if (!keyType || !breBKey) throw new Error("Completa todos los campos");
        payload.key_type = keyType;
        payload.bre_b_key = breBKey;
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
      if (isNaN(amt) || amt <= 0) throw new Error("Ingresa un monto válido");
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
    setBreBKey("");
    setKeyType("");
    setAddMethodTab("bank");
  };

  const getMethodLabel = (m: PaymentMethod) => {
    if (m.method_type === "bank") {
      return `${m.bank_name} · ${m.account_type} · ****${(m.account_number ?? "").slice(-4)}`;
    }
    return `Bre-B (${m.key_type}) · ${m.bre_b_key}`;
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
                    m.method_type === "bank" ? "bg-blue-100 text-blue-600" : "bg-purple-100 text-purple-600"
                  }`}>
                    {m.method_type === "bank" ? <Building2 className="h-5 w-5" /> : <Smartphone className="h-5 w-5" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold truncate">{getMethodLabel(m)}</p>
                    <p className="text-xs text-muted-foreground">
                      {m.method_type === "bank" ? "Cuenta Bancaria" : "Bre-B · Pago Inmediato"}
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

          {/* Security message */}
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
        <DialogContent className="sm:max-w-md rounded-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Plus className="h-5 w-5 text-primary" />
              Agregar Método de Pago
            </DialogTitle>
            <DialogDescription>
              Registra una cuenta bancaria o llave Bre-B para recibir tus retiros.
            </DialogDescription>
          </DialogHeader>

          <Tabs value={addMethodTab} onValueChange={(v) => setAddMethodTab(v as "bank" | "breb")} className="mt-2">
            <TabsList className="w-full">
              <TabsTrigger value="bank" className="flex-1 gap-1.5">
                <Building2 className="h-4 w-4" /> Cuenta Bancaria
              </TabsTrigger>
              <TabsTrigger value="breb" className="flex-1 gap-1.5">
                <Smartphone className="h-4 w-4" /> Bre-B
              </TabsTrigger>
            </TabsList>

            <TabsContent value="bank" className="space-y-4 mt-4">
              <div className="space-y-2">
                <Label>Banco</Label>
                <Select value={bankName} onValueChange={setBankName}>
                  <SelectTrigger><SelectValue placeholder="Selecciona un banco" /></SelectTrigger>
                  <SelectContent>
                    {COLOMBIAN_BANKS.map((b) => (
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
                    <SelectItem value="Ahorros">Ahorros</SelectItem>
                    <SelectItem value="Corriente">Corriente</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Número de Cuenta</Label>
                <Input
                  placeholder="Ej: 123456789"
                  value={accountNumber}
                  onChange={(e) => setAccountNumber(e.target.value.replace(/\D/g, ""))}
                  maxLength={20}
                />
              </div>
            </TabsContent>

            <TabsContent value="breb" className="space-y-4 mt-4">
              <div className="space-y-2">
                <Label>Tipo de Llave</Label>
                <Select value={keyType} onValueChange={setKeyType}>
                  <SelectTrigger><SelectValue placeholder="Tipo de llave" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Celular">Celular</SelectItem>
                    <SelectItem value="Email">Email</SelectItem>
                    <SelectItem value="NIT">NIT / Documento</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Valor de la Llave</Label>
                <Input
                  placeholder={keyType === "Email" ? "correo@ejemplo.com" : keyType === "NIT" ? "123456789" : "3001234567"}
                  value={breBKey}
                  onChange={(e) => setBreBKey(e.target.value)}
                  maxLength={50}
                />
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
                min={1}
                max={balance}
              />
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
