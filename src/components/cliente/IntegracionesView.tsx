import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { 
  ShoppingBag, 
  ShoppingCart, 
  Store, 
  Code, 
  Key, 
  Copy, 
  Check, 
  Plus, 
  Trash2, 
  ExternalLink,
  Eye,
  EyeOff,
  AlertCircle,
  Zap
} from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface ApiCredential {
  id: string;
  api_key_prefix: string;
  label: string;
  is_active: boolean;
  last_used_at: string | null;
  created_at: string;
}

interface IntegracionesViewProps {
  clientUserId: string;
}

const integrations = [
  {
    id: "shopify",
    name: "Shopify",
    description: "Sincroniza pedidos automáticamente desde tu tienda Shopify",
    icon: ShoppingBag,
    color: "from-green-500 to-green-600",
    status: "available",
    docUrl: "https://docs.komprasplus.com/shopify"
  },
  {
    id: "woocommerce",
    name: "WooCommerce",
    description: "Conecta tu tienda WordPress con WooCommerce",
    icon: ShoppingCart,
    color: "from-purple-500 to-purple-600",
    status: "available",
    docUrl: "https://docs.komprasplus.com/woocommerce"
  },
  {
    id: "prestashop",
    name: "PrestaShop",
    description: "Integración con tiendas PrestaShop",
    icon: Store,
    color: "from-pink-500 to-pink-600",
    status: "coming_soon",
    docUrl: null
  },
  {
    id: "custom",
    name: "API Personalizada",
    description: "Usa nuestra API REST para integraciones personalizadas",
    icon: Code,
    color: "from-blue-500 to-blue-600",
    status: "available",
    docUrl: "https://docs.komprasplus.com/api"
  }
];

const IntegracionesView = ({ clientUserId }: IntegracionesViewProps) => {
  const [credentials, setCredentials] = useState<ApiCredential[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [showNewKeyModal, setShowNewKeyModal] = useState(false);
  const [newKeyLabel, setNewKeyLabel] = useState("Mi Tienda");
  const [generatedKey, setGeneratedKey] = useState<string | null>(null);
  const [copiedKey, setCopiedKey] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const { toast } = useToast();

  const fetchCredentials = async () => {
    try {
      const { data, error } = await supabase
        .from("api_credentials")
        .select("id, api_key_prefix, label, is_active, last_used_at, created_at")
        .eq("client_user_id", clientUserId)
        .order("created_at", { ascending: false });

      if (error) throw error;
      setCredentials(data || []);
    } catch (error) {
      console.error("Error fetching credentials:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (clientUserId) {
      fetchCredentials();
    }
  }, [clientUserId]);

  const generateApiKey = (): string => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let key = 'kp_live_';
    for (let i = 0; i < 32; i++) {
      key += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return key;
  };

  const hashApiKey = async (key: string): Promise<string> => {
    const encoder = new TextEncoder();
    const data = encoder.encode(key);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  };

  const handleGenerateKey = async () => {
    setGenerating(true);
    try {
      const newKey = generateApiKey();
      const keyHash = await hashApiKey(newKey);
      const keyPrefix = newKey.substring(0, 12) + "...";

      const { error } = await supabase
        .from("api_credentials")
        .insert({
          client_user_id: clientUserId,
          api_key_hash: keyHash,
          api_key_prefix: keyPrefix,
          label: newKeyLabel
        });

      if (error) throw error;

      setGeneratedKey(newKey);
      await fetchCredentials();
      toast({
        title: "¡Llave generada!",
        description: "Copia tu llave ahora. No podrás verla de nuevo.",
      });
    } catch (error) {
      console.error("Error generating key:", error);
      toast({
        title: "Error",
        description: "No se pudo generar la llave. Intenta de nuevo.",
        variant: "destructive"
      });
    } finally {
      setGenerating(false);
    }
  };

  const handleCopyKey = async () => {
    if (generatedKey) {
      await navigator.clipboard.writeText(generatedKey);
      setCopiedKey(true);
      setTimeout(() => setCopiedKey(false), 2000);
      toast({
        title: "¡Copiada!",
        description: "La llave se copió al portapapeles.",
      });
    }
  };

  const handleToggleActive = async (id: string, currentState: boolean) => {
    try {
      const { error } = await supabase
        .from("api_credentials")
        .update({ is_active: !currentState })
        .eq("id", id);

      if (error) throw error;
      await fetchCredentials();
      toast({
        title: currentState ? "Llave desactivada" : "Llave activada",
        description: currentState 
          ? "La llave ya no puede recibir pedidos." 
          : "La llave está lista para recibir pedidos.",
      });
    } catch (error) {
      console.error("Error toggling key:", error);
    }
  };

  const handleDeleteKey = async (id: string) => {
    setDeletingId(id);
    try {
      const { error } = await supabase
        .from("api_credentials")
        .delete()
        .eq("id", id);

      if (error) throw error;
      await fetchCredentials();
      toast({
        title: "Llave eliminada",
        description: "La llave de API ha sido eliminada permanentemente.",
      });
    } catch (error) {
      console.error("Error deleting key:", error);
    } finally {
      setDeletingId(null);
    }
  };

  const closeNewKeyModal = () => {
    setShowNewKeyModal(false);
    setGeneratedKey(null);
    setNewKeyLabel("Mi Tienda");
    setCopiedKey(false);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold text-foreground">Centro de Integraciones</h2>
          <p className="text-muted-foreground">Conecta tu tienda y automatiza tus despachos</p>
        </div>
        <Button 
          onClick={() => setShowNewKeyModal(true)}
          className="bg-gradient-to-r from-primary to-primary/80 shadow-lg"
        >
          <Plus className="h-4 w-4 mr-2" />
          Generar Nueva Llave
        </Button>
      </div>

      {/* Integration Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {integrations.map((integration, index) => {
          const Icon = integration.icon;
          return (
            <motion.div
              key={integration.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.1 }}
            >
              <Card className="relative overflow-hidden hover:shadow-lg transition-shadow">
                <div className={`absolute inset-0 bg-gradient-to-br ${integration.color} opacity-5`} />
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between">
                    <div className={`p-3 rounded-xl bg-gradient-to-br ${integration.color} shadow-lg`}>
                      <Icon className="h-6 w-6 text-white" />
                    </div>
                    {integration.status === "coming_soon" ? (
                      <Badge variant="secondary">Próximamente</Badge>
                    ) : (
                      <Badge className="bg-green-500/10 text-green-600 hover:bg-green-500/20">
                        Disponible
                      </Badge>
                    )}
                  </div>
                  <CardTitle className="text-lg mt-3">{integration.name}</CardTitle>
                  <CardDescription>{integration.description}</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="flex gap-2">
                    <Button 
                      variant="outline" 
                      className="flex-1"
                      disabled={integration.status === "coming_soon"}
                      onClick={() => setShowNewKeyModal(true)}
                    >
                      <Key className="h-4 w-4 mr-2" />
                      Configurar
                    </Button>
                    {integration.docUrl && (
                      <Button variant="ghost" size="icon" asChild>
                        <a href={integration.docUrl} target="_blank" rel="noopener noreferrer">
                          <ExternalLink className="h-4 w-4" />
                        </a>
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          );
        })}
      </div>

      {/* API Keys Section */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Key className="h-5 w-5 text-primary" />
            Mis Llaves de API
          </CardTitle>
          <CardDescription>
            Administra las llaves que permiten a tus tiendas enviar pedidos automáticamente
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
            </div>
          ) : credentials.length === 0 ? (
            <div className="text-center py-8">
              <Key className="h-12 w-12 text-muted-foreground mx-auto mb-3 opacity-50" />
              <h3 className="font-medium text-foreground mb-1">Sin llaves de API</h3>
              <p className="text-sm text-muted-foreground mb-4">
                Genera tu primera llave para comenzar a recibir pedidos automáticos
              </p>
              <Button onClick={() => setShowNewKeyModal(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Generar Primera Llave
              </Button>
            </div>
          ) : (
            <div className="space-y-3">
              {credentials.map((cred) => (
                <motion.div
                  key={cred.id}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="flex flex-col sm:flex-row sm:items-center justify-between p-4 rounded-lg border bg-muted/30 gap-4"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-medium text-foreground">{cred.label}</span>
                      {cred.is_active ? (
                        <Badge className="bg-green-500/10 text-green-600">Activa</Badge>
                      ) : (
                        <Badge variant="secondary">Inactiva</Badge>
                      )}
                    </div>
                    <code className="text-sm text-muted-foreground font-mono">
                      {cred.api_key_prefix}
                    </code>
                    <p className="text-xs text-muted-foreground mt-1">
                      Creada: {new Date(cred.created_at).toLocaleDateString("es-CO")}
                      {cred.last_used_at && (
                        <> · Último uso: {new Date(cred.last_used_at).toLocaleDateString("es-CO")}</>
                      )}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="flex items-center gap-2">
                      <Label htmlFor={`active-${cred.id}`} className="text-xs text-muted-foreground">
                        {cred.is_active ? "Activa" : "Inactiva"}
                      </Label>
                      <Switch
                        id={`active-${cred.id}`}
                        checked={cred.is_active}
                        onCheckedChange={() => handleToggleActive(cred.id, cred.is_active)}
                      />
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="text-destructive hover:text-destructive hover:bg-destructive/10"
                      onClick={() => handleDeleteKey(cred.id)}
                      disabled={deletingId === cred.id}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </motion.div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Webhook Info */}
      <Card className="border-primary/20 bg-primary/5">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Zap className="h-5 w-5 text-primary" />
            Endpoint de Webhook
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label className="text-xs text-muted-foreground">URL del Webhook</Label>
            <div className="flex items-center gap-2 mt-1">
              <code className="flex-1 p-3 rounded-lg bg-background border text-sm font-mono break-all">
                https://hhjygradtikonvfzarrn.supabase.co/functions/v1/receive-order
              </code>
              <Button
                variant="outline"
                size="icon"
                onClick={() => {
                  navigator.clipboard.writeText("https://hhjygradtikonvfzarrn.supabase.co/functions/v1/receive-order");
                  toast({ title: "¡Copiado!", description: "URL copiada al portapapeles" });
                }}
              >
                <Copy className="h-4 w-4" />
              </Button>
            </div>
          </div>
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              Envía un POST con tu API Key en el header <code className="bg-muted px-1 rounded">X-API-Key</code> 
              y los datos del pedido en el body.
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>

      {/* Generate Key Modal */}
      <Dialog open={showNewKeyModal} onOpenChange={closeNewKeyModal}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Key className="h-5 w-5 text-primary" />
              {generatedKey ? "Tu Nueva Llave de API" : "Generar Llave de API"}
            </DialogTitle>
            <DialogDescription>
              {generatedKey 
                ? "Copia esta llave ahora. Por seguridad, no podrás verla de nuevo."
                : "Crea una llave única para conectar tu tienda con Kompras Plus."
              }
            </DialogDescription>
          </DialogHeader>

          {!generatedKey ? (
            <div className="space-y-4 py-4">
              <div>
                <Label htmlFor="keyLabel">Nombre de la llave</Label>
                <Input
                  id="keyLabel"
                  value={newKeyLabel}
                  onChange={(e) => setNewKeyLabel(e.target.value)}
                  placeholder="Ej: Mi Tienda Shopify"
                  className="mt-1"
                />
              </div>
              <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertDescription className="text-xs">
                  <strong>Instrucciones:</strong> Copia esta llave en tu plugin de Kompras Plus 
                  en Shopify para automatizar tus despachos desde la Carrera 20.
                </AlertDescription>
              </Alert>
            </div>
          ) : (
            <div className="space-y-4 py-4">
              <div className="relative">
                <div className="p-4 rounded-lg bg-green-50 border-2 border-green-200 border-dashed">
                  <code className="text-sm font-mono break-all text-green-800">
                    {generatedKey}
                  </code>
                </div>
              </div>
              <Button
                onClick={handleCopyKey}
                className="w-full bg-gradient-to-r from-green-500 to-green-600"
              >
                {copiedKey ? (
                  <>
                    <Check className="h-4 w-4 mr-2" />
                    ¡Copiada!
                  </>
                ) : (
                  <>
                    <Copy className="h-4 w-4 mr-2" />
                    Copiar Llave
                  </>
                )}
              </Button>
              <Alert className="bg-amber-50 border-amber-200">
                <AlertCircle className="h-4 w-4 text-amber-600" />
                <AlertDescription className="text-amber-800 text-xs">
                  <strong>⚠️ Importante:</strong> Esta es la única vez que verás esta llave completa. 
                  Guárdala en un lugar seguro.
                </AlertDescription>
              </Alert>
            </div>
          )}

          <DialogFooter>
            {!generatedKey ? (
              <Button 
                onClick={handleGenerateKey} 
                disabled={generating || !newKeyLabel.trim()}
                className="w-full sm:w-auto"
              >
                {generating ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2" />
                    Generando...
                  </>
                ) : (
                  <>
                    <Key className="h-4 w-4 mr-2" />
                    Generar Llave
                  </>
                )}
              </Button>
            ) : (
              <Button variant="outline" onClick={closeNewKeyModal} className="w-full sm:w-auto">
                Cerrar
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default IntegracionesView;
