import { useState } from "react";
import { Send, Loader2, CheckCircle2, AlertCircle, Eye, EyeOff } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";
import TransactionPinSetup from "./TransactionPinSetup";

const P2PTransferWidget = () => {
  const { user, profile } = useAuth();
  const queryClient = useQueryClient();

  const [receiverEmail, setReceiverEmail] = useState("");
  const [amount, setAmount] = useState("");
  const [pin, setPin] = useState("");
  const [showPin, setShowPin] = useState(false);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState<{ name: string; amount: number } | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Check if user has PIN configured
  const hasPin = !!(profile as any)?.transaction_pin;

  const handleTransfer = async () => {
    setError(null);
    setSuccess(null);

    if (!receiverEmail.trim()) {
      setError("Ingresa el correo de la tienda destino");
      return;
    }
    if (!amount || Number(amount) <= 0) {
      setError("Ingresa un monto válido");
      return;
    }
    if (Number(amount) < 1000) {
      setError("El monto mínimo es $1,000");
      return;
    }
    if (pin.length !== 4) {
      setError("El PIN debe ser de 4 dígitos");
      return;
    }

    setLoading(true);
    try {
      // Hash PIN with SHA-256 before sending
      const encoder = new TextEncoder();
      const data = encoder.encode(pin);
      const hashBuffer = await crypto.subtle.digest("SHA-256", data);
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      const hashHex = hashArray.map(b => b.toString(16).padStart(2, "0")).join("");

      const { data: result, error: rpcError } = await supabase.rpc(
        "transfer_store_balance" as any,
        {
          p_sender_id: user!.id,
          p_receiver_email: receiverEmail.trim().toLowerCase(),
          p_transfer_amount: Number(amount),
          p_provided_pin: hashHex,
        }
      );

      if (rpcError) throw rpcError;

      const res = result as any;
      setSuccess({ name: res.receiver_name, amount: res.amount });
      setReceiverEmail("");
      setAmount("");
      setPin("");

      // Invalidate wallet queries
      queryClient.invalidateQueries({ queryKey: ["billetera"] });

      toast.success(`Transferencia exitosa a ${res.receiver_name}`);
    } catch (err: any) {
      const msg = err.message || "Error desconocido";
      setError(msg);
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  // If no PIN, show setup first
  if (!hasPin) {
    return <TransactionPinSetup onSuccess={() => queryClient.invalidateQueries()} />;
  }

  return (
    <Card className="border-primary/20 bg-card">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-lg">
          <Send className="h-5 w-5 text-primary" />
          Transferir Saldo
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <AnimatePresence mode="wait">
          {success ? (
            <motion.div
              key="success"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0 }}
              className="flex flex-col items-center gap-3 py-6"
            >
              <CheckCircle2 className="h-12 w-12 text-green-500" />
              <p className="text-center font-semibold text-foreground">
                ¡Transferencia exitosa!
              </p>
              <p className="text-sm text-muted-foreground text-center">
                Se enviaron <span className="font-bold text-foreground">
                  ${success.amount.toLocaleString("es-CO")}
                </span> a <span className="font-bold text-foreground">{success.name}</span>
              </p>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setSuccess(null)}
                className="mt-2"
              >
                Nueva transferencia
              </Button>
            </motion.div>
          ) : (
            <motion.div
              key="form"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="space-y-4"
            >
              <div className="space-y-2">
                <Label htmlFor="receiver-email">Correo de la tienda destino</Label>
                <Input
                  id="receiver-email"
                  type="email"
                  placeholder="tienda@ejemplo.com"
                  value={receiverEmail}
                  onChange={(e) => setReceiverEmail(e.target.value)}
                  disabled={loading}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="transfer-amount">Monto a transferir</Label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">$</span>
                  <Input
                    id="transfer-amount"
                    type="number"
                    placeholder="10,000"
                    min={1000}
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    disabled={loading}
                    className="pl-7"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="transfer-pin">PIN de seguridad</Label>
                <div className="relative">
                  <Input
                    id="transfer-pin"
                    type={showPin ? "text" : "password"}
                    placeholder="••••"
                    maxLength={4}
                    value={pin}
                    onChange={(e) => setPin(e.target.value.replace(/\D/g, "").slice(0, 4))}
                    disabled={loading}
                    className="pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPin(!showPin)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    {showPin ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              {error && (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}

              <Button
                onClick={handleTransfer}
                disabled={loading || !receiverEmail || !amount || pin.length !== 4}
                className="w-full"
              >
                {loading ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Procesando...
                  </>
                ) : (
                  <>
                    <Send className="h-4 w-4" />
                    Transferir Saldo
                  </>
                )}
              </Button>

              <p className="text-xs text-muted-foreground text-center">
                Solo puedes transferir a tiendas de tu misma organización. Monto mínimo: $1,000
              </p>
            </motion.div>
          )}
        </AnimatePresence>
      </CardContent>
    </Card>
  );
};

export default P2PTransferWidget;
