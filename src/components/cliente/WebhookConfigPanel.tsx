import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { toast } from "sonner";
import { Webhook, Plus, Trash2, AlertCircle, CheckCircle, XCircle, Copy, Eye, EyeOff } from "lucide-react";

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

export default function WebhookConfigPanel({ clientUserId }: WebhookConfigPanelProps) {
  const [endpoints, setEndpoints] = useState<WebhookEndpoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [newUrl, setNewUrl] = useState("");
  const [newLabel, setNewLabel] = useState("Mi Webhook");
  const [newSecret, setNewSecret] = useState("");
  const [showSecret, setShowSecret] = useState(false);
  const [saving, setSaving] = useState(false);

  const fetchEndpoints = async () => {
    try {
      const { data, error } = await supabase
        .from("webhook_endpoints")
        .select("*")
        .eq("client_user_id", clientUserId)
        .order("created_at", { ascending: false });

      if (error) throw error;
      setEndpoints((data || []) as WebhookEndpoint[]);
    } catch (error) {
      console.error("Error fetching webhooks:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (clientUserId) fetchEndpoints();
  }, [clientUserId]);

  const handleAdd = async () => {
    if (!newUrl.trim()) return;
    // Basic URL validation
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

    setSaving(true);
    try {
      const { error } = await supabase.from("webhook_endpoints").insert({
        client_user_id: clientUserId,
        url: newUrl.trim(),
        label: newLabel.trim() || "Mi Webhook",
        secret: newSecret.trim() || null,
        events: ["status_change"],
      });

      if (error) throw error;
      toast.success("Webhook configurado exitosamente");
      setShowAddModal(false);
      setNewUrl("");
      setNewLabel("Mi Webhook");
      setNewSecret("");
      fetchEndpoints();
    } catch (error) {
      console.error("Error adding webhook:", error);
      toast.error("Error al guardar el webhook");
    } finally {
      setSaving(false);
    }
  };

  const handleToggle = async (id: string, isActive: boolean) => {
    const { error } = await supabase
      .from("webhook_endpoints")
      .update({ is_active: !isActive })
      .eq("id", id);

    if (error) {
      toast.error("Error al actualizar");
    } else {
      toast.success(isActive ? "Webhook desactivado" : "Webhook activado");
      fetchEndpoints();
    }
  };

  const handleDelete = async (id: string) => {
    const { error } = await supabase.from("webhook_endpoints").delete().eq("id", id);
    if (error) {
      toast.error("Error al eliminar");
    } else {
      toast.success("Webhook eliminado");
      fetchEndpoints();
    }
  };

  const generateSecret = () => {
    const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
    let secret = "whsec_";
    for (let i = 0; i < 32; i++) {
      secret += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    setNewSecret(secret);
  };

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Webhook className="h-5 w-5 text-primary" />
                Webhooks de Salida
              </CardTitle>
              <CardDescription>
                Recibe notificaciones automáticas cuando el estado de tus guías cambie
              </CardDescription>
            </div>
            <Button size="sm" onClick={() => setShowAddModal(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Agregar
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
            </div>
          ) : endpoints.length === 0 ? (
            <div className="text-center py-8">
              <Webhook className="h-12 w-12 text-muted-foreground mx-auto mb-3 opacity-50" />
              <h3 className="font-medium text-foreground mb-1">Sin webhooks configurados</h3>
              <p className="text-sm text-muted-foreground mb-4">
                Configura un webhook para recibir avisos automáticos en tu sistema
              </p>
              <Button variant="outline" onClick={() => setShowAddModal(true)}>
                <Plus className="h-4 w-4 mr-2" />
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
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-medium text-foreground">{ep.label}</span>
                      {ep.is_active ? (
                        <Badge className="bg-green-500/10 text-green-600">Activo</Badge>
                      ) : (
                        <Badge variant="secondary">Inactivo</Badge>
                      )}
                      {ep.failure_count >= 10 && (
                        <Badge variant="destructive">Circuit Breaker</Badge>
                      )}
                    </div>
                    <code className="text-xs text-muted-foreground font-mono block truncate">
                      {ep.url}
                    </code>
                    <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                      {ep.last_triggered_at && (
                        <span className="flex items-center gap-1">
                          {ep.last_status_code && ep.last_status_code >= 200 && ep.last_status_code < 300 ? (
                            <CheckCircle className="h-3 w-3 text-green-500" />
                          ) : (
                            <XCircle className="h-3 w-3 text-destructive" />
                          )}
                          Último: {new Date(ep.last_triggered_at).toLocaleDateString("es-CO", {
                            day: "2-digit",
                            month: "short",
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                          {ep.last_status_code ? ` (${ep.last_status_code})` : ""}
                        </span>
                      )}
                      {ep.failure_count > 0 && (
                        <span className="text-destructive">{ep.failure_count} fallos</span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Switch
                      checked={ep.is_active}
                      onCheckedChange={() => handleToggle(ep.id, ep.is_active)}
                    />
                    <Button
                      variant="ghost"
                      size="icon"
                      className="text-destructive hover:text-destructive hover:bg-destructive/10"
                      onClick={() => handleDelete(ep.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Add Webhook Modal */}
      <Dialog open={showAddModal} onOpenChange={setShowAddModal}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Webhook className="h-5 w-5 text-primary" />
              Nuevo Webhook
            </DialogTitle>
            <DialogDescription>
              Cada vez que una guía cambie de estado, enviaremos un POST a tu URL con los datos actualizados.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div>
              <Label>Nombre</Label>
              <Input
                value={newLabel}
                onChange={(e) => setNewLabel(e.target.value)}
                placeholder="Ej: Mi Tienda Shopify"
                className="mt-1"
              />
            </div>

            <div>
              <Label>URL del Webhook (HTTPS)</Label>
              <Input
                value={newUrl}
                onChange={(e) => setNewUrl(e.target.value)}
                placeholder="https://mi-tienda.com/webhook/plus-envios"
                className="mt-1"
                type="url"
              />
            </div>

            <div>
              <div className="flex items-center justify-between">
                <Label>Secret (opcional, para firma HMAC)</Label>
                <Button variant="ghost" size="sm" onClick={generateSecret} type="button">
                  Generar
                </Button>
              </div>
              <div className="relative mt-1">
                <Input
                  value={newSecret}
                  onChange={(e) => setNewSecret(e.target.value)}
                  placeholder="whsec_..."
                  type={showSecret ? "text" : "password"}
                />
                <Button
                  variant="ghost"
                  size="icon"
                  className="absolute right-0 top-0"
                  onClick={() => setShowSecret(!showSecret)}
                  type="button"
                >
                  {showSecret ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </Button>
              </div>
            </div>

            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription className="text-xs">
                Si configuras un secret, cada notificación incluirá el header{" "}
                <code className="bg-muted px-1 rounded">X-Webhook-Signature</code> con una firma HMAC-SHA256
                para que puedas verificar la autenticidad.
              </AlertDescription>
            </Alert>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddModal(false)}>
              Cancelar
            </Button>
            <Button onClick={handleAdd} disabled={saving || !newUrl.trim()}>
              {saving ? "Guardando..." : "Guardar Webhook"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
