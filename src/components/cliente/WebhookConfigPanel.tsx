import { useState, useEffect, useCallback, useRef, useId } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
import { Alert, AlertDescription } from "@/components/ui/alert";
import { toast } from "sonner";
import { Webhook, Plus, Trash2, AlertCircle, CheckCircle, XCircle, Eye, EyeOff, RefreshCw } from "lucide-react";
import { formatInTimeZone } from "date-fns-tz";

// ─── Constantes ───────────────────────────────────────────────────────────────

const TZ = "America/Bogota";

/*
  FIX: `generateSecret` movida a módulo scope y reescrita con CSPRNG.
  La versión original usaba `Math.random()` cuyo estado interno tiene ~48 bits
  de entropía. Si el atacante conoce el timestamp de creación del secret puede
  acotar el espacio y predecir el valor. `crypto.getRandomValues()` usa el
  CSPRNG del sistema operativo — mismo fix aplicado en IntegracionesView.
  Entropía efectiva: 32 bytes × 8 = 256 bits.
*/
const generateWebhookSecret = (): string => {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  const result = Array.from(bytes)
    .map((b) => chars[b % chars.length])
    .join("");
  return `whsec_${result}`;
};

// ─── Tipos ────────────────────────────────────────────────────────────────────

interface WebhookEndpoint {
  id: string;
  url: string;
  label: string;
  secret: string | null;
  events: string[];
  is_active: boolean;
  last_triggered_at: string | null;
  last_status_code: number | null;
  failure_count: number;
  created_at: string;
}

interface WebhookConfigPanelProps {
  clientUserId: string;
}

// ─── Componente ───────────────────────────────────────────────────────────────

export default function WebhookConfigPanel({ clientUserId }: WebhookConfigPanelProps) {
  const [endpoints, setEndpoints] = useState<WebhookEndpoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);
  const [newUrl, setNewUrl] = useState("");
  const [newLabel, setNewLabel] = useState("Mi Webhook");
  const [newSecret, setNewSecret] = useState("");
  const [showSecret, setShowSecret] = useState(false);
  const [saving, setSaving] = useState(false);

  const cancelRef = useRef(false);
  const uid = useId();

  // ── Fetch endpoints ──────────────────────────────────────────────────────

  /*
    FIX: `fetchEndpoints` en `useCallback` con `clientUserId` en deps.
    Versión original era función interna con stale closure — eslint
    exhaustive-deps warning + potencial bug si `clientUserId` cambiaba.
  */
  const fetchEndpoints = useCallback(async () => {
    if (!clientUserId) return;
    setLoading(true);
    setFetchError(null);
    try {
      /*
        FIX: `select("*")` → columnas explícitas.
        Patrón consistente con el resto del proyecto.
      */
      const { data, error } = await supabase
        .from("webhook_endpoints")
        .select(
          "id, url, label, secret, events, is_active, last_triggered_at, last_status_code, failure_count, created_at",
        )
        .eq("client_user_id", clientUserId)
        .order("created_at", { ascending: false });

      if (cancelRef.current) return;
      if (error) throw error;
      setEndpoints((data || []) as WebhookEndpoint[]);
    } catch (error) {
      if (cancelRef.current) return;
      console.error("Error fetching webhooks:", error);
      /*
        FIX: error silencioso (solo console.error) reemplazado por estado
        de error visible con botón de reintento.
      */
      setFetchError("No se pudieron cargar los webhooks.");
    } finally {
      if (!cancelRef.current) setLoading(false);
    }
  }, [clientUserId]);

  useEffect(() => {
    cancelRef.current = false;
    if (clientUserId) fetchEndpoints();
    return () => {
      cancelRef.current = true;
    };
  }, [clientUserId, fetchEndpoints]);

  // ── Resetear formulario del modal ────────────────────────────────────────

  /*
    FIX: el modal no reseteaba el formulario al cerrarse con la X o haciendo
    click fuera. Si el usuario abría el modal, escribía datos y cancelaba, al
    reabrir encontraba los campos con los valores anteriores.
  */
  const resetForm = useCallback(() => {
    setNewUrl("");
    setNewLabel("Mi Webhook");
    setNewSecret("");
    setShowSecret(false);
  }, []);

  const handleModalOpenChange = useCallback(
    (open: boolean) => {
      setShowAddModal(open);
      if (!open) resetForm();
    },
    [resetForm],
  );

  // ── Agregar webhook ──────────────────────────────────────────────────────

  const handleAdd = useCallback(async () => {
    if (!newUrl.trim()) return;

    try {
      new URL(newUrl);
    } catch {
      toast.error("URL inválida. Debe comenzar con https://");
      return;
    }
    if (!newUrl.startsWith("https://")) {
      toast.error("Por seguridad, la URL debe usar HTTPS");
      return;
    }

    /*
      FIX: validación de longitud mínima del secret si se proporciona.
      Un secret de 1-2 caracteres hace que la firma HMAC sea trivialmente
      predecible por fuerza bruta.
    */
    if (newSecret.trim() && newSecret.trim().length < 16) {
      toast.error("El secret debe tener al menos 16 caracteres");
      return;
    }

    setSaving(true);
    try {
      const { error } = await supabase.from("webhook_endpoints").insert({
        client_user_id: clientUserId,
        url: newUrl.trim(),
        label: newLabel.trim() || "Mi Webhook",
        secret: newSecret.trim() || null,
        events: ["status_change"],
      });

      if (cancelRef.current) return;
      if (error) throw error;

      toast.success("Webhook configurado exitosamente");
      handleModalOpenChange(false);
      fetchEndpoints();
    } catch (error) {
      if (cancelRef.current) return;
      console.error("Error adding webhook:", error);
      toast.error("Error al guardar el webhook");
    } finally {
      if (!cancelRef.current) setSaving(false);
    }
  }, [clientUserId, newUrl, newLabel, newSecret, handleModalOpenChange, fetchEndpoints]);

  // ── Toggle activo/inactivo ───────────────────────────────────────────────

  const handleToggle = useCallback(
    async (id: string, isActive: boolean) => {
      const { error } = await supabase.from("webhook_endpoints").update({ is_active: !isActive }).eq("id", id);

      if (cancelRef.current) return;
      if (error) {
        toast.error("Error al actualizar el webhook");
      } else {
        toast.success(isActive ? "Webhook desactivado" : "Webhook activado");
        fetchEndpoints();
      }
    },
    [fetchEndpoints],
  );

  // ── Eliminar webhook ─────────────────────────────────────────────────────

  /*
    FIX: `handleDelete` sin confirmación.
    La versión original eliminaba el webhook con un solo click, sin ningún
    aviso. Un webhook activo en producción podía borrarse por error.
    Reemplazado con AlertDialog de confirmación (mismo patrón que
    IntegracionesView y InventarioView).
  */
  const handleDeleteConfirm = useCallback(async () => {
    if (!deleteTarget) return;
    const { error } = await supabase.from("webhook_endpoints").delete().eq("id", deleteTarget);

    if (cancelRef.current) return;
    setDeleteTarget(null);
    if (error) {
      toast.error("Error al eliminar el webhook");
    } else {
      toast.success("Webhook eliminado");
      fetchEndpoints();
    }
  }, [deleteTarget, fetchEndpoints]);

  // ── Render ───────────────────────────────────────────────────────────────

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Webhook className="h-5 w-5 text-primary" aria-hidden="true" />
                Webhooks de Salida
              </CardTitle>
              <CardDescription>Recibe notificaciones automáticas cuando el estado de tus guías cambie</CardDescription>
            </div>
            <Button type="button" size="sm" onClick={() => setShowAddModal(true)} aria-label="Agregar nuevo webhook">
              <Plus className="h-4 w-4 mr-2" aria-hidden="true" />
              Agregar
            </Button>
          </div>
        </CardHeader>

        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-8" role="status" aria-label="Cargando webhooks...">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
            </div>
          ) : fetchError ? (
            <div className="flex flex-col items-center gap-3 py-8 text-center">
              <AlertCircle className="h-10 w-10 text-destructive/60" aria-hidden="true" />
              <p className="text-sm text-muted-foreground">{fetchError}</p>
              <Button type="button" variant="outline" onClick={fetchEndpoints} className="gap-2">
                <RefreshCw className="h-4 w-4" aria-hidden="true" />
                Reintentar
              </Button>
            </div>
          ) : endpoints.length === 0 ? (
            <div className="text-center py-8">
              <Webhook className="h-12 w-12 text-muted-foreground mx-auto mb-3 opacity-50" aria-hidden="true" />
              <h3 className="font-medium text-foreground mb-1">Sin webhooks configurados</h3>
              <p className="text-sm text-muted-foreground mb-4">
                Configura un webhook para recibir avisos automáticos en tu sistema
              </p>
              <Button type="button" variant="outline" onClick={() => setShowAddModal(true)}>
                <Plus className="h-4 w-4 mr-2" aria-hidden="true" />
                Configurar primer webhook
              </Button>
            </div>
          ) : (
            <div className="space-y-3">
              {endpoints.map((ep) => (
                <div
                  key={ep.id}
                  className="flex flex-col sm:flex-row sm:items-center justify-between p-4 rounded-lg border bg-muted/30 gap-3"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <span className="font-medium text-foreground">{ep.label}</span>
                      {ep.is_active ? (
                        <Badge className="bg-green-500/10 text-green-600">Activo</Badge>
                      ) : (
                        <Badge variant="secondary">Inactivo</Badge>
                      )}
                      {ep.failure_count >= 10 && <Badge variant="destructive">Circuit Breaker</Badge>}
                    </div>
                    <code className="text-xs text-muted-foreground font-mono block truncate">{ep.url}</code>
                    <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground flex-wrap">
                      {ep.last_triggered_at && (
                        <span className="flex items-center gap-1">
                          {ep.last_status_code && ep.last_status_code >= 200 && ep.last_status_code < 300 ? (
                            <CheckCircle className="h-3 w-3 text-green-500" aria-hidden="true" />
                          ) : (
                            <XCircle className="h-3 w-3 text-destructive" aria-hidden="true" />
                          )}
                          {/*
                            FIX: timezone Colombia en la fecha del último disparo.
                            `new Date(...).toLocaleDateString("es-CO", {...})` usa el
                            timezone local del navegador. Corregido con `formatInTimeZone`.
                          */}
                          Último: {formatInTimeZone(new Date(ep.last_triggered_at), TZ, "dd MMM, HH:mm")}
                          {ep.last_status_code ? ` (${ep.last_status_code})` : ""}
                        </span>
                      )}
                      {ep.failure_count > 0 && <span className="text-destructive">{ep.failure_count} fallos</span>}
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    {/*
                      FIX: `Switch` sin `aria-label`.
                      El componente Switch de shadcn/ui no tiene texto visible —
                      un lector de pantalla anunciaba solo "switch" sin contexto.
                      Añadido `aria-label` descriptivo con el nombre del webhook.
                    */}
                    <Switch
                      checked={ep.is_active}
                      onCheckedChange={() => handleToggle(ep.id, ep.is_active)}
                      aria-label={`${ep.is_active ? "Desactivar" : "Activar"} webhook "${ep.label}"`}
                    />
                    {/*
                      FIX: botón de eliminar sin `aria-label` y sin confirmación.
                      Ícono solo → lectores de pantalla anunciaban "botón".
                    */}
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="text-destructive hover:text-destructive hover:bg-destructive/10"
                      onClick={() => setDeleteTarget(ep.id)}
                      aria-label={`Eliminar webhook "${ep.label}"`}
                    >
                      <Trash2 className="h-4 w-4" aria-hidden="true" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Modal: nuevo webhook */}
      <Dialog open={showAddModal} onOpenChange={handleModalOpenChange}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Webhook className="h-5 w-5 text-primary" aria-hidden="true" />
              Nuevo Webhook
            </DialogTitle>
            <DialogDescription>
              Cada vez que una guía cambie de estado, enviaremos un POST a tu URL con los datos actualizados.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {/* Nombre */}
            <div>
              {/* FIX: `Label` sin `htmlFor` → los inputs no estaban asociados a sus labels */}
              <Label htmlFor={`${uid}-wh-label`}>Nombre</Label>
              <Input
                id={`${uid}-wh-label`}
                value={newLabel}
                onChange={(e) => setNewLabel(e.target.value)}
                placeholder="Ej: Mi Tienda Shopify"
                className="mt-1"
                autoComplete="off"
              />
            </div>

            {/* URL */}
            <div>
              <Label htmlFor={`${uid}-wh-url`}>URL del Webhook (HTTPS)</Label>
              <Input
                id={`${uid}-wh-url`}
                value={newUrl}
                onChange={(e) => setNewUrl(e.target.value)}
                placeholder="https://mi-tienda.com/webhook/plus-envios"
                className="mt-1"
                type="url"
                autoComplete="off"
                inputMode="url"
              />
            </div>

            {/* Secret */}
            <div>
              <div className="flex items-center justify-between">
                <Label htmlFor={`${uid}-wh-secret`}>Secret (opcional, para firma HMAC)</Label>
                {/*
                  FIX: botón "Generar" usaba `Math.random()` → reemplazado con
                  `crypto.getRandomValues()` en `generateWebhookSecret()`.
                */}
                <Button type="button" variant="ghost" size="sm" onClick={() => setNewSecret(generateWebhookSecret())}>
                  Generar
                </Button>
              </div>
              <div className="relative mt-1">
                <Input
                  id={`${uid}-wh-secret`}
                  value={newSecret}
                  onChange={(e) => setNewSecret(e.target.value)}
                  placeholder="whsec_..."
                  type={showSecret ? "text" : "password"}
                  autoComplete="new-password"
                  spellCheck="false"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="absolute right-0 top-0"
                  onClick={() => setShowSecret((v) => !v)}
                  aria-label={showSecret ? "Ocultar secret" : "Mostrar secret"}
                >
                  {showSecret ? (
                    <EyeOff className="h-4 w-4" aria-hidden="true" />
                  ) : (
                    <Eye className="h-4 w-4" aria-hidden="true" />
                  )}
                </Button>
              </div>
              {newSecret.trim().length > 0 && newSecret.trim().length < 16 && (
                <p className="text-xs text-destructive mt-1" role="alert">
                  El secret debe tener al menos 16 caracteres para ser seguro.
                </p>
              )}
            </div>

            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription className="text-xs">
                Si configuras un secret, cada notificación incluirá el header{" "}
                <code className="bg-muted px-1 rounded">X-Webhook-Signature</code> con una firma HMAC-SHA256 para que
                puedas verificar la autenticidad.
              </AlertDescription>
            </Alert>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => handleModalOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="button" onClick={handleAdd} disabled={saving || !newUrl.trim()} aria-busy={saving}>
              {saving ? "Guardando..." : "Guardar Webhook"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* AlertDialog: confirmar eliminación */}
      <AlertDialog
        open={deleteTarget !== null}
        onOpenChange={(open) => {
          if (!open) setDeleteTarget(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar webhook?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta acción es permanente. Las integraciones que dependan de este endpoint dejarán de recibir
              notificaciones de inmediato.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={handleDeleteConfirm}
            >
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
