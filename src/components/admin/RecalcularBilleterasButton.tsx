import { useState, useRef } from "react";
import { Calculator, Loader2, Eye, Play, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
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
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { formatInTimeZone } from "date-fns-tz";

interface RecalcResult {
  pedidos_procesados: number;
  transacciones_creadas: number;
  skipped: number;
  errores: number;
  dry_run: boolean;
  timestamp: string;
}

const RATE_LIMIT_MS = 5 * 60 * 1000; // 5 minutos

const RecalcularBilleterasButton = () => {
  const [processing, setProcessing] = useState(false);
  const [lastRun, setLastRun] = useState<Date | null>(null);
  const [lastResult, setLastResult] = useState<RecalcResult | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [pendingDryRun, setPendingDryRun] = useState(false);
  const cancelRef = useRef(false);

  const canRun = !processing && (!lastRun || Date.now() - lastRun.getTime() > RATE_LIMIT_MS);

  const minutosRestantes = lastRun
    ? Math.ceil((RATE_LIMIT_MS - (Date.now() - lastRun.getTime())) / 60000)
    : 0;

  const handleConfirm = async () => {
    setConfirmOpen(false);
    setProcessing(true);
    cancelRef.current = false;

    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData?.session?.access_token;

      if (!token) {
        toast.error("Sesión expirada. Por favor vuelve a iniciar sesión.");
        return;
      }

      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const response = await fetch(
        `${supabaseUrl}/functions/v1/recalcular-billeteras`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ dry_run: pendingDryRun, desde_fecha: "2025-01-01" }),
        }
      );

      if (cancelRef.current) return;

      const result: RecalcResult = await response.json();

      if (!response.ok) {
        throw new Error((result as unknown as { error: string }).error ?? "Error desconocido");
      }

      setLastResult(result);
      setLastRun(new Date());

      if (pendingDryRun) {
        toast.info(
          `🔍 Simulación completada: ${result.transacciones_creadas} transacciones faltantes encontradas en ${result.pedidos_procesados} pedidos.`
        );
      } else {
        toast.success(
          `✅ Recalculación completada:\n• ${result.pedidos_procesados} pedidos analizados\n• ${result.transacciones_creadas} transacciones creadas\n• ${result.skipped} ya existían\n• ${result.errores} errores`
        );
      }
    } catch (err) {
      if (cancelRef.current) return;
      const msg = err instanceof Error ? err.message : "Error desconocido";
      toast.error(`Error al recalcular billeteras: ${msg}`);
      console.error("[RecalcularBilleteras]", err);
    } finally {
      if (!cancelRef.current) setProcessing(false);
    }
  };

  const openConfirm = (dryRun: boolean) => {
    setPendingDryRun(dryRun);
    setConfirmOpen(true);
  };

  return (
    <Card className="border-border">
      <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Calculator className="h-5 w-5 text-primary" />
          Sincronización de Billeteras
        </CardTitle>
        <p className="text-sm text-muted-foreground">
          Detecta y crea transacciones faltantes para pedidos entregados/liquidados que no tienen
          registro en la billetera. Opera de forma idempotente (no crea duplicados).
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Info box */}
        <div className="bg-muted/50 border border-border rounded-lg p-3 flex gap-2">
          <AlertTriangle className="h-4 w-4 text-muted-foreground flex-shrink-0 mt-0.5" />
          <div className="text-xs text-muted-foreground space-y-1">
            <p><strong>¿Cuándo usar esto?</strong> Solo si detectas que tiendas con entregas completadas muestran Balance = $0.</p>
            <p>Excluye pedidos con <code>metodo_pago = anticipado</code>. Procesa hasta 10,000 pedidos por ejecución.</p>
          </div>
        </div>

        {/* Action buttons */}
        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            size="sm"
            className="gap-2"
            onClick={() => openConfirm(true)}
            disabled={processing}
          >
            <Eye className="h-3.5 w-3.5" />
            Simular (Dry Run)
          </Button>

          <Button
            size="sm"
            variant="default"
            className="gap-2"
            onClick={() => openConfirm(false)}
            disabled={!canRun}
          >
            {processing ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Play className="h-3.5 w-3.5" />
            )}
            {processing ? "Procesando..." : "Recalcular Billeteras"}
          </Button>
        </div>

        {/* Rate limit notice */}
        {lastRun && !canRun && !processing && (
          <p className="text-xs text-muted-foreground">
            ⏳ Disponible en {minutosRestantes} minuto{minutosRestantes !== 1 ? "s" : ""}
          </p>
        )}

        {/* Last result */}
        {lastResult && (
          <div className="border rounded-lg p-3 space-y-2 bg-card">
            <div className="flex items-center gap-2">
              <p className="text-xs font-semibold text-foreground">Último resultado</p>
              {lastResult.dry_run && <Badge variant="outline" className="text-[10px]">Simulación</Badge>}
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              <div className="text-center">
                <p className="text-lg font-bold text-foreground">{lastResult.pedidos_procesados}</p>
                <p className="text-[10px] text-muted-foreground">Analizados</p>
              </div>
              <div className="text-center">
                <p className="text-lg font-bold text-secondary">{lastResult.transacciones_creadas}</p>
                <p className="text-[10px] text-muted-foreground">Creadas</p>
              </div>
              <div className="text-center">
                <p className="text-lg font-bold text-primary">{lastResult.skipped ?? 0}</p>
                <p className="text-[10px] text-muted-foreground">Ya existían</p>
              </div>
              <div className="text-center">
                <p className="text-lg font-bold text-destructive">{lastResult.errores}</p>
                <p className="text-[10px] text-muted-foreground">Errores</p>
              </div>
            </div>
            <p className="text-[10px] text-muted-foreground">
              {lastResult.timestamp} (Col)
            </p>
          </div>
        )}
      </CardContent>

      {/* Confirm dialog */}
      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {pendingDryRun ? "🔍 Simular recalculación" : "⚠️ Recalcular billeteras"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {pendingDryRun
                ? "Modo simulación: analizará los pedidos sin crear transacciones. Úsalo para verificar cuántos registros faltan antes de ejecutar."
                : "Esta operación insertará transacciones faltantes para todos los pedidos entregados/liquidados desde 2025-01-01. Es idempotente: no crea duplicados. Puede tardar varios minutos si hay muchos pedidos."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirm}
              className={pendingDryRun ? "" : "bg-primary hover:bg-primary/90 text-primary-foreground"}
            >
              {pendingDryRun ? "Simular" : "Confirmar y Ejecutar"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
};

export default RecalcularBilleterasButton;
