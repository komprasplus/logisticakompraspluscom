import { useEffect, useState } from "react";
import { CreditCard, Receipt, TrendingUp, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import MotorizadoWalletWidget from "./MotorizadoWalletWidget";
import MotorizadoMovementsList from "./MotorizadoMovementsList";
import MotorizadoBankAccountForm from "./MotorizadoBankAccountForm";
import { toast } from "sonner";

interface MotorizadoWalletSheetProps {
  motorizadoId: string;
  score: number;
  open: boolean;
  onClose: () => void;
}

type WalletTab = "resumen" | "movimientos" | "cuenta";

interface BalanceData {
  balance_disponible: number;
  fondo_garantia: number;
  total_ganado: number;
  total_retirado: number;
  total_entregas: number;
}

const TABS: { id: WalletTab; label: string; icon: typeof Receipt }[] = [
  { id: "resumen", label: "Resumen", icon: TrendingUp },
  { id: "movimientos", label: "Movimientos", icon: Receipt },
  { id: "cuenta", label: "Mi cuenta", icon: CreditCard },
];

const MotorizadoWalletSheet = ({
  motorizadoId,
  score,
  open,
  onClose,
}: MotorizadoWalletSheetProps) => {
  const [activeTab, setActiveTab] = useState<WalletTab>("resumen");
  const [balance, setBalance] = useState<BalanceData | null>(null);
  const [loadingBalance, setLoadingBalance] = useState(true);
  const [primaryPaymentMethodId, setPrimaryPaymentMethodId] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    let active = true;
    const loadBalance = async () => {
      setLoadingBalance(true);
      const rpcFn = supabase.rpc as unknown as (
        fn: string,
        params: Record<string, unknown>,
      ) => Promise<{ data: BalanceData[] | null }>;
      const [balanceRes, methodRes] = await Promise.all([
        rpcFn("get_motorizado_wallet_balance", { p_motorizado_id: motorizadoId }),
        supabase
          .from("user_payment_methods")
          .select("id")
          .eq("user_id", motorizadoId)
          .eq("is_primary", true)
          .maybeSingle(),
      ]);
      if (!active) return;
      if (balanceRes.data && balanceRes.data.length > 0) {
        setBalance(balanceRes.data[0] as BalanceData);
      }
      if (methodRes.data) {
        setPrimaryPaymentMethodId(methodRes.data.id);
      }
      setLoadingBalance(false);
    };
    loadBalance();
    return () => {
      active = false;
    };
  }, [motorizadoId, open]);

  const handleRetirar = async () => {
    if (!balance || balance.balance_disponible <= 0) {
      toast.info("No tienes balance disponible para retirar");
      return;
    }
    if (!primaryPaymentMethodId) {
      toast.info("Primero registra tu cuenta bancaria");
      setActiveTab("cuenta");
      return;
    }

    const confirm = window.confirm(
      `¿Solicitar retiro de ${new Intl.NumberFormat("es-CO", {
        style: "currency",
        currency: "COP",
        maximumFractionDigits: 0,
      }).format(balance.balance_disponible)}? El admin procesará tu solicitud.`,
    );
    if (!confirm) return;

    const { error } = await supabase.from("withdrawal_requests").insert({
      user_id: motorizadoId,
      payment_method_id: primaryPaymentMethodId,
      amount: balance.balance_disponible,
      status: "Pending",
    });

    if (error) {
      console.error(error);
      toast.error("No se pudo crear la solicitud: " + error.message);
    } else {
      toast.success("Solicitud de retiro creada. El admin la revisará pronto.");
    }
  };

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm flex items-end sm:items-center justify-center"
      onClick={onClose}
    >
      <div
        className="w-full sm:max-w-md max-h-[92vh] bg-background rounded-t-3xl sm:rounded-3xl shadow-2xl flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="bg-card border-b border-border px-4 py-3 flex items-center justify-between flex-shrink-0">
          <div>
            <h2 className="text-base font-bold text-foreground">Mi Wallet</h2>
            <p className="text-xs text-muted-foreground">Balance, movimientos y cuenta</p>
          </div>
          <button
            onClick={onClose}
            className="h-8 w-8 rounded-full bg-muted hover:bg-muted/70 flex items-center justify-center text-foreground transition-colors"
            aria-label="Cerrar"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Tabs */}
        <div className="border-b border-border flex-shrink-0">
          <div className="flex">
            {TABS.map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={cn(
                    "flex-1 h-11 flex items-center justify-center gap-1.5 text-xs font-semibold transition-all relative",
                    isActive
                      ? "text-primary"
                      : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  <Icon className="h-3.5 w-3.5" strokeWidth={isActive ? 2.5 : 2} />
                  <span>{tab.label}</span>
                  {isActive && (
                    <span className="absolute bottom-0 left-1/2 -translate-x-1/2 h-0.5 w-12 bg-gold rounded-t-full" />
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4" style={{ paddingBottom: "max(1rem, env(safe-area-inset-bottom))" }}>
          {activeTab === "resumen" && (
            <div className="space-y-3">
              {!loadingBalance && balance && (
                <MotorizadoWalletWidget
                  score={score}
                  balanceDisponible={balance.balance_disponible}
                  fondoGarantia={balance.fondo_garantia}
                  codHoyUsado={0}
                  pedidosEntregadosMes={balance.total_entregas}
                  onRetirar={handleRetirar}
                  onVerDetalle={() => setActiveTab("movimientos")}
                />
              )}
              {loadingBalance && (
                <div className="bg-card border border-border rounded-2xl p-6 animate-pulse">
                  <div className="h-3 bg-muted rounded w-24 mb-2" />
                  <div className="h-8 bg-muted rounded w-32 mb-4" />
                  <div className="grid grid-cols-2 gap-2">
                    <div className="h-16 bg-muted rounded" />
                    <div className="h-16 bg-muted rounded" />
                  </div>
                </div>
              )}
            </div>
          )}

          {activeTab === "movimientos" && (
            <MotorizadoMovementsList motorizadoId={motorizadoId} />
          )}

          {activeTab === "cuenta" && (
            <MotorizadoBankAccountForm motorizadoId={motorizadoId} />
          )}
        </div>
      </div>
    </div>
  );
};

export default MotorizadoWalletSheet;
