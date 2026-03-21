import { useState } from "react";
import { Shield, Loader2, Eye, EyeOff, CheckCircle2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";

interface TransactionPinSetupProps {
  onSuccess?: () => void;
}

const TransactionPinSetup = ({ onSuccess }: TransactionPinSetupProps) => {
  const { user, refreshProfile } = useAuth();
  const [pin, setPin] = useState("");
  const [confirmPin, setConfirmPin] = useState("");
  const [showPin, setShowPin] = useState(false);
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSetPin = async () => {
    setError(null);

    if (pin.length !== 4) {
      setError("El PIN debe ser de exactamente 4 dígitos");
      return;
    }
    if (pin !== confirmPin) {
      setError("Los PINs no coinciden");
      return;
    }

    setLoading(true);
    try {
      // Hash PIN with SHA-256
      const encoder = new TextEncoder();
      const data = encoder.encode(pin);
      const hashBuffer = await crypto.subtle.digest("SHA-256", data);
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      const hashHex = hashArray.map(b => b.toString(16).padStart(2, "0")).join("");

      const { error: updateError } = await supabase
        .from("profiles")
        .update({ transaction_pin: hashHex } as any)
        .eq("user_id", user!.id);

      if (updateError) throw updateError;

      await refreshProfile();
      setDone(true);
      toast.success("PIN de seguridad configurado correctamente");
      onSuccess?.();
    } catch (err: any) {
      setError(err.message || "Error al guardar el PIN");
    } finally {
      setLoading(false);
    }
  };

  if (done) {
    return (
      <Card className="border-green-500/30 bg-card">
        <CardContent className="flex flex-col items-center gap-3 py-8">
          <CheckCircle2 className="h-12 w-12 text-green-500" />
          <p className="font-semibold text-foreground">PIN configurado</p>
          <p className="text-sm text-muted-foreground">Ya puedes realizar transferencias P2P</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-amber-500/30 bg-card">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-lg">
          <Shield className="h-5 w-5 text-amber-500" />
          Configurar PIN de Seguridad
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground">
          Para realizar transferencias P2P debes crear un PIN de 4 dígitos. Este PIN será solicitado en cada transferencia.
        </p>

        <div className="space-y-2">
          <Label htmlFor="new-pin">Nuevo PIN (4 dígitos)</Label>
          <div className="relative">
            <Input
              id="new-pin"
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

        <div className="space-y-2">
          <Label htmlFor="confirm-pin">Confirmar PIN</Label>
          <Input
            id="confirm-pin"
            type={showPin ? "text" : "password"}
            placeholder="••••"
            maxLength={4}
            value={confirmPin}
            onChange={(e) => setConfirmPin(e.target.value.replace(/\D/g, "").slice(0, 4))}
            disabled={loading}
          />
        </div>

        {error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <Button
          onClick={handleSetPin}
          disabled={loading || pin.length !== 4 || confirmPin.length !== 4}
          className="w-full"
        >
          {loading ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Guardando...
            </>
          ) : (
            <>
              <Shield className="h-4 w-4" />
              Guardar PIN
            </>
          )}
        </Button>
      </CardContent>
    </Card>
  );
};

export default TransactionPinSetup;
