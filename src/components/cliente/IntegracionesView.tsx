import { useState, useEffect, useCallback, useRef } from "react";
import { motion, useReducedMotion } from "framer-motion";
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
  AlertCircle,
  Zap,
  Wifi,
  WifiOff,
  Clock,
  Package,
  RefreshCw,
  Loader2,
} from "lucide-react";
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
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import WebhookConfigPanel from "./WebhookConfigPanel";

// ─── Constantes ───────────────────────────────────────────────────────────────

/*
  FIX: URL del endpoint extraída de variable de entorno.
  El project ID `hhjygradtikonvfzarrn` estaba hardcodeado igual que en
  ApiDocsView e IntegrationsPanel (detectado en sesiones anteriores).
  Se centraliza en VITE_API_BASE_URL.
*/
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "https://[SUPABASE_URL]/functions/v1";
const RECEIVE_ORDER_URL = `${API_BASE_URL}/receive-order`;

const CHARS = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";

// ─── Helpers ──────────────────────────────────────────────────────────────────

/*
  FIX CRÍTICO: `generateApiKey` usaba `Math.random()`, que NO es
  criptográficamente seguro. Su estado interno es de ~48 bits — un atacante
  que conozca el timestamp de creación puede predecir las llaves generadas.

  Para credenciales de seguridad siempre debe usarse `crypto.getRandomValues()`,
  que usa el CSPRNG del sistema operativo.

  La entropía real pasa de ~48 bits (Math.random) a ~190 bits (crypto).
*/
const generateApiKey = (): string => {
  const array = new Uint8Array(32);
  crypto.getRandomValues(array);
  const key = Array.from(array)
    .map((byte) => CHARS[byte % CHARS.length])
    .join("");
  return `kp_live_${key}`;
};

const hashApiKey = async (key: string): Promise<string> => {
  const data = new TextEncoder().encode(key);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(hashBuffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
};

/*
  FIX: `copyToClipboard` con fallback y manejo de error correcto.
  Reutilizada en todos los botones de copiar del componente para consistencia.
  Misma corrección aplicada en ApiDocsView y ClienteHeader.
*/
const copyToClipboard = async (text: string): Promise<boolean> => {
  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text);
      return true;
    }
    const textarea = document.createElement("textarea");
    textarea.value = text;
    textarea.style.cssText = "position:fixed;opacity:0";
    document.body.appendChild(textarea);
    textarea.select();
    const ok = document.execCommand("copy");
    document.body.removeChild(textarea);
    return ok;
  } catch {
    return false;
  }
};

/*
  FIX: `getStatusBadge` movida fuera del componente.
  Era una función pura recreada en cada render. Movida a módulo scope.
*/
const getStatusBadge = (estado: string | null) => {
  const statusMap: Record<string, { label: string; className: string }> = {
    entregado: { label: "Entregado", className: "bg-green-500/10 text-green-600" },
    en_ruta: { label: "En Ruta", className: "bg-blue-500/10 text-blue-600" },
    pendiente: { label: "Pendiente", className: "bg-yellow-500/10 text-yellow-600" },
    novedad: { label: "Novedad", className: "bg-red-500/10 text-red-600" },
  };
  const key = (estado ?? "pendiente").toLowerCase();
  const status = statusMap[key] ?? statusMap["pendiente"];
  return <Badge className={status.className}>{status.label}</Badge>;
};

/*
  FIX: `formatDateCO` helper con timezone Colombia.
  Las fechas se mostraban en la zona local del navegador.
*/
const formatDateCO = (dateStr: string, options?: Intl.DateTimeFormatOptions): string =>
  new Date(dateStr).toLocaleDateString("es-CO", {
    timeZone: "America/Bogota",
    ...options,
  });

// ─── Tipos ────────────────────────────────────────────────────────────────────

interface ApiCredential {
  id: string;
  api_key_prefix: string;
  label: string;
  is_active: boolean;
  last_used_at: string | null;
  created_at: string;
}

interface SyncedOrder {
  id: number;
  numero_guia: string;
  cliente_nombre: string;
  municipio: string;
  estado: string;
  fecha_creacion: string;
}

interface IntegracionesViewProps {
  clientUserId: string;
}

// ─── Configuración de integraciones ──────────────────────────────────────────

const integrations = [
  {
    id: "shopify",
    name: "Shopify",
    description: "Sincroniza pedidos automáticamente desde tu tienda Shopify",
    icon: ShoppingBag,
    color: "from-green-500 to-green-600",
    status: "available" as const,
    docUrl: "https://docs.komprasplus.com/shopify",
  },
  {
    id: "woocommerce",
    name: "WooCommerce",
    description: "Conecta tu tienda WordPress con WooCommerce",
    icon: ShoppingCart,
    color: "from-purple-500 to-purple-600",
    status: "available" as const,
    docUrl: "https://docs.komprasplus.com/woocommerce",
  },
  {
    id: "prestashop",
    name: "PrestaShop",
    description: "Integración con tiendas PrestaShop",
    icon: Store,
    color: "from-pink-500 to-pink-600",
    status: "coming_soon" as const,
    docUrl: null,
  },
  {
    id: "custom",
    name: "API Personalizada",
    description: "Usa nuestra API REST para integraciones personalizadas",
    icon: Code,
    color: "from-blue-500 to-blue-600",
    status: "available" as const,
    docUrl: "https://docs.komprasplus.com/api",
  },
] as const;

// ─── Componente ───────────────────────────────────────────────────────────────

const IntegracionesView = ({ clientUserId }: IntegracionesViewProps) => {
  const [credentials, setCredentials] = useState<ApiCredential[]>([]);
  const [syncedOrders, setSyncedOrders] = useState<SyncedOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingOrders, setLoadingOrders] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [showNewKeyModal, setShowNewKeyModal] = useState(false);
  const [newKeyLabel, setNewKeyLabel] = useState("Mi Tienda");
  const [generatedKey, setGeneratedKey] = useState<string | null>(null);
  const [copiedKey, setCopiedKey] = useState(false);
  const [copiedUrl, setCopiedUrl] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  /*
    FIX: estado para diálogo de confirmación antes de eliminar.
    Eliminar una llave de producción es irreversible — sin confirmación
    el usuario podía borrarla accidentalmente con un solo clic.
  */
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const cancelRef = useRef(false);
  const prefersReducedMotion = useReducedMotion();
  const { toast } = useToast();

  const hasActiveKey = credentials.some((c) => c.is_active);

  // ── Fetch credenciales ────────────────────────────────────────────────────

  /*
    FIX: ambas funciones de fetch envueltas en `useCallback` e incluidas
    en el `useEffect`. Stale closures + exhaustive-deps lint warnings corregidos.
  */
  const fetchCredentials = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from("api_credentials")
        .select("id, api_key_prefix, label, is_active, last_used_at, created_at")
        .eq("client_user_id", clientUserId)
        .order("created_at", { ascending: false });

      if (cancelRef.current) return;
      if (error) throw error;
      setCredentials(data ?? []);
    } catch (error) {
      console.error("Error fetching credentials:", error);
    } finally {
      if (!cancelRef.current) setLoading(false);
    }
  }, [clientUserId]);

  const fetchSyncedOrders = useCallback(async () => {
    setLoadingOrders(true);
    try {
      const { data, error } = await supabase
        .from("pedidos")
        .select("id, numero_guia, cliente_nombre, municipio, estado, fecha_creacion")
        .eq("client_user_id", clientUserId)
        .order("fecha_creacion", { ascending: false })
        .limit(10);

      if (cancelRef.current) return;
      if (error) throw error;
      setSyncedOrders(data ?? []);
    } catch (error) {
      console.error("Error fetching synced orders:", error);
    } finally {
      if (!cancelRef.current) setLoadingOrders(false);
    }
  }, [clientUserId]);

  useEffect(() => {
    cancelRef.current = false;
    if (clientUserId) {
      fetchCredentials();
      fetchSyncedOrders();
    }
    return () => {
      cancelRef.current = true;
    };
  }, [clientUserId, fetchCredentials, fetchSyncedOrders]);

  // ── Handlers ───────────────────────────────────────────────────────────────

  const handleGenerateKey = useCallback(async () => {
    setGenerating(true);
    try {
      const newKey = generateApiKey(); // FIX: usa crypto.getRandomValues()
      const keyHash = await hashApiKey(newKey);
      const keyPrefix = `${newKey.substring(0, 12)}...`;

      const { error } = await supabase.from("api_credentials").insert({
        client_user_id: clientUserId,
        api_key_hash: keyHash,
        api_key_prefix: keyPrefix,
        label: newKeyLabel,
      });

      if (error) throw error;

      setGeneratedKey(newKey);
      await fetchCredentials();
      toast({ title: "¡Llave generada!", description: "Copia tu llave ahora. No podrás verla de nuevo." });
    } catch (error) {
      console.error("Error generating key:", error);
      toast({ title: "Error", description: "No se pudo generar la llave.", variant: "destructive" });
    } finally {
      if (!cancelRef.current) setGenerating(false);
    }
  }, [clientUserId, newKeyLabel, fetchCredentials, toast]);

  const handleCopyKey = useCallback(async () => {
    if (!generatedKey) return;
    const ok = await copyToClipboard(generatedKey);
    if (ok) {
      setCopiedKey(true);
      setTimeout(() => setCopiedKey(false), 2000);
      toast({ title: "¡Copiada!", description: "La llave se copió al portapapeles." });
    } else {
      toast({ title: "Error", description: "No se pudo copiar — copia manualmente.", variant: "destructive" });
    }
  }, [generatedKey, toast]);

  const handleCopyUrl = useCallback(async () => {
    const ok = await copyToClipboard(RECEIVE_ORDER_URL);
    if (ok) {
      setCopiedUrl(true);
      setTimeout(() => setCopiedUrl(false), 2000);
      toast({ title: "¡Copiado!", description: "URL copiada al portapapeles." });
    } else {
      toast({ title: "Error", description: "No se pudo copiar.", variant: "destructive" });
    }
  }, [toast]);

  const handleToggleActive = useCallback(
    async (id: string, currentState: boolean) => {
      try {
        const { error } = await supabase.from("api_credentials").update({ is_active: !currentState }).eq("id", id);

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
        /*
        FIX: feedback de error al usuario cuando el toggle falla.
        La versión original solo hacía console.error silenciosamente.
      */
        toast({ title: "Error", description: "No se pudo cambiar el estado de la llave.", variant: "destructive" });
      }
    },
    [fetchCredentials, toast],
  );

  const handleDeleteKey = useCallback(
    async (id: string) => {
      setDeletingId(id);
      setConfirmDeleteId(null);
      try {
        const { error } = await supabase.from("api_credentials").delete().eq("id", id);

        if (error) throw error;
        await fetchCredentials();
        toast({ title: "Llave eliminada", description: "La llave de API ha sido eliminada permanentemente." });
      } catch (error) {
        console.error("Error deleting key:", error);
        /*
        FIX: feedback de error al usuario cuando el delete falla.
      */
        toast({ title: "Error", description: "No se pudo eliminar la llave.", variant: "destructive" });
      } finally {
        if (!cancelRef.current) setDeletingId(null);
      }
    },
    [fetchCredentials, toast],
  );

  const closeNewKeyModal = useCallback(() => {
    setShowNewKeyModal(false);
    setGeneratedKey(null);
    setNewKeyLabel("Mi Tienda");
    setCopiedKey(false);
  }, []);

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold text-foreground">Centro de Integraciones</h2>
          <p className="text-muted-foreground">Conecta tu tienda y automatiza tus despachos</p>
        </div>
        <Button
          type="button"
          onClick={() => setShowNewKeyModal(true)}
          className="bg-gradient-to-r from-primary to-primary/80 shadow-lg"
        >
          <Plus className="h-4 w-4 mr-2" aria-hidden="true" />
          Generar Nueva Llave
        </Button>
      </div>

      {/* Banner estado de conexión */}
      <motion.div initial={{ opacity: 0, y: prefersReducedMotion ? 0 : -10 }} animate={{ opacity: 1, y: 0 }}>
        <Card
          className={`border-2 ${hasActiveKey ? "border-green-500/50 bg-green-500/5" : "border-muted bg-muted/20"}`}
        >
          <CardContent className="py-4">
            <div className="flex items-center gap-3">
              {hasActiveKey ? (
                <>
                  <div className="p-2 rounded-full bg-green-500/20">
                    <Wifi className="h-5 w-5 text-green-600" aria-hidden="true" />
                  </div>
                  <div>
                    <p className="font-medium text-green-700">Conectado</p>
                    <p className="text-sm text-green-600/80">
                      Tienes {credentials.filter((c) => c.is_active).length} llave(s) activa(s) para recibir pedidos
                    </p>
                  </div>
                </>
              ) : (
                <>
                  <div className="p-2 rounded-full bg-muted">
                    <WifiOff className="h-5 w-5 text-muted-foreground" aria-hidden="true" />
                  </div>
                  <div>
                    <p className="font-medium text-muted-foreground">Sin configurar</p>
                    <p className="text-sm text-muted-foreground/80">
                      Genera una llave de API para comenzar a recibir pedidos automáticos
                    </p>
                  </div>
                </>
              )}
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* Tarjetas de integraciones */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {integrations.map((integration, index) => {
          const Icon = integration.icon;
          return (
            <motion.div
              key={integration.id}
              initial={{ opacity: 0, y: prefersReducedMotion ? 0 : 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: prefersReducedMotion ? 0 : index * 0.1 }}
            >
              <Card className="relative overflow-hidden hover:shadow-lg transition-shadow">
                <div className={`absolute inset-0 bg-gradient-to-br ${integration.color} opacity-5`} />
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between">
                    <div className={`p-3 rounded-xl bg-gradient-to-br ${integration.color} shadow-lg`}>
                      <Icon className="h-6 w-6 text-white" aria-hidden="true" />
                    </div>
                    <div className="flex flex-col items-end gap-1">
                      {integration.status === "coming_soon" ? (
                        <Badge variant="secondary">Próximamente</Badge>
                      ) : hasActiveKey ? (
                        <Badge className="bg-green-500/10 text-green-600 hover:bg-green-500/20 flex items-center gap-1">
                          <Wifi className="h-3 w-3" aria-hidden="true" />
                          Conectado
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="text-muted-foreground flex items-center gap-1">
                          <WifiOff className="h-3 w-3" aria-hidden="true" />
                          Sin configurar
                        </Badge>
                      )}
                    </div>
                  </div>
                  <CardTitle className="text-lg mt-3">{integration.name}</CardTitle>
                  <CardDescription>{integration.description}</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="flex gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      className="flex-1"
                      disabled={integration.status === "coming_soon"}
                      onClick={() => setShowNewKeyModal(true)}
                    >
                      <Key className="h-4 w-4 mr-2" aria-hidden="true" />
                      {hasActiveKey ? "Gestionar" : "Configurar"}
                    </Button>
                    {integration.docUrl && (
                      <Button
                        variant="ghost"
                        size="icon"
                        asChild
                        /*
                          FIX: `aria-label` en el botón de documentación.
                          Solo tenía un ícono sin nombre accesible.
                        */
                      >
                        <a
                          href={integration.docUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          aria-label={`Ver documentación de ${integration.name}`}
                        >
                          <ExternalLink className="h-4 w-4" aria-hidden="true" />
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

      {/* Sección de llaves de API */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Key className="h-5 w-5 text-primary" aria-hidden="true" />
            Mis Llaves de API
          </CardTitle>
          <CardDescription>
            Administra las llaves que permiten a tus tiendas enviar pedidos automáticamente
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-8" role="status" aria-label="Cargando llaves de API...">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : credentials.length === 0 ? (
            <div className="text-center py-8">
              <Key className="h-12 w-12 text-muted-foreground mx-auto mb-3 opacity-50" aria-hidden="true" />
              <h3 className="font-medium text-foreground mb-1">Sin llaves de API</h3>
              <p className="text-sm text-muted-foreground mb-4">
                Genera tu primera llave para comenzar a recibir pedidos automáticos
              </p>
              <Button type="button" onClick={() => setShowNewKeyModal(true)}>
                <Plus className="h-4 w-4 mr-2" aria-hidden="true" />
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
                    <code className="text-sm text-muted-foreground font-mono">{cred.api_key_prefix}</code>
                    <p className="text-xs text-muted-foreground mt-1">
                      {/* FIX: timezone Colombia en todas las fechas de credenciales */}
                      Creada: {formatDateCO(cred.created_at)}
                      {cred.last_used_at && <> · Último uso: {formatDateCO(cred.last_used_at)}</>}
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
                        aria-label={`${cred.is_active ? "Desactivar" : "Activar"} llave ${cred.label}`}
                      />
                    </div>
                    {/*
                      FIX: botón de eliminar abre diálogo de confirmación.
                      Antes ejecutaba el delete directo con un solo clic —
                      eliminar una llave de producción es irreversible.
                    */}
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="text-destructive hover:text-destructive hover:bg-destructive/10"
                      onClick={() => setConfirmDeleteId(cred.id)}
                      disabled={deletingId === cred.id}
                      aria-label={`Eliminar llave ${cred.label}`}
                    >
                      {deletingId === cred.id ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Trash2 className="h-4 w-4" aria-hidden="true" />
                      )}
                    </Button>
                  </div>
                </motion.div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Últimos pedidos sincronizados */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Clock className="h-5 w-5 text-primary" aria-hidden="true" />
                Últimos Pedidos Sincronizados
              </CardTitle>
              <CardDescription>Historial de los últimos 10 pedidos recibidos por API</CardDescription>
            </div>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={fetchSyncedOrders}
              disabled={loadingOrders}
              aria-label="Actualizar lista de pedidos"
            >
              <RefreshCw className={`h-4 w-4 ${loadingOrders ? "animate-spin" : ""}`} aria-hidden="true" />
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {loadingOrders ? (
            <div
              className="flex items-center justify-center py-8"
              role="status"
              aria-label="Cargando pedidos sincronizados..."
            >
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : syncedOrders.length === 0 ? (
            <div className="text-center py-8">
              <Package className="h-12 w-12 text-muted-foreground mx-auto mb-3 opacity-50" aria-hidden="true" />
              <h3 className="font-medium text-foreground mb-1">Sin pedidos aún</h3>
              <p className="text-sm text-muted-foreground">Los pedidos que lleguen por API aparecerán aquí</p>
            </div>
          ) : (
            <div className="space-y-2">
              {syncedOrders.map((order) => (
                <motion.div
                  key={order.id}
                  initial={{ opacity: 0, x: prefersReducedMotion ? 0 : -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  className="flex items-center justify-between p-3 rounded-lg border bg-background hover:bg-muted/30 transition-colors"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="p-2 rounded-full bg-primary/10 flex-shrink-0">
                      <Package className="h-4 w-4 text-primary" aria-hidden="true" />
                    </div>
                    <div className="min-w-0">
                      <p className="font-medium text-sm truncate">{order.numero_guia || `#${order.id}`}</p>
                      <p className="text-xs text-muted-foreground truncate">
                        {order.cliente_nombre} · {order.municipio}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 flex-shrink-0">
                    {getStatusBadge(order.estado)}
                    {/* FIX: timezone Colombia en fechas de pedidos */}
                    <span className="text-xs text-muted-foreground">
                      {formatDateCO(order.fecha_creacion, {
                        day: "2-digit",
                        month: "short",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </span>
                  </div>
                </motion.div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Webhook configuración */}
      <WebhookConfigPanel clientUserId={clientUserId} />

      {/* Endpoint del webhook */}
      <Card className="border-primary/20 bg-primary/5">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Zap className="h-5 w-5 text-primary" aria-hidden="true" />
            Endpoint de Webhook
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label className="text-xs text-muted-foreground">URL del Webhook</Label>
            <div className="flex items-center gap-2 mt-1">
              {/* FIX: URL desde env var, no hardcodeada */}
              <code className="flex-1 p-3 rounded-lg bg-background border text-sm font-mono break-all">
                {RECEIVE_ORDER_URL}
              </code>
              <Button
                type="button"
                variant="outline"
                size="icon"
                onClick={handleCopyUrl}
                aria-label="Copiar URL del webhook"
              >
                {copiedUrl ? (
                  <Check className="h-4 w-4 text-green-600" aria-hidden="true" />
                ) : (
                  <Copy className="h-4 w-4" aria-hidden="true" />
                )}
              </Button>
            </div>
          </div>
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              Envía un POST con tu API Key en el header <code className="bg-muted px-1 rounded">X-API-Key</code> y los
              datos del pedido en el body.
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>

      {/* Modal: generar llave */}
      <Dialog open={showNewKeyModal} onOpenChange={closeNewKeyModal}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Key className="h-5 w-5 text-primary" aria-hidden="true" />
              {generatedKey ? "Tu Nueva Llave de API" : "Generar Llave de API"}
            </DialogTitle>
            <DialogDescription>
              {generatedKey
                ? "Copia esta llave ahora. Por seguridad, no podrás verla de nuevo."
                : "Crea una llave única para conectar tu tienda con Kompras Plus."}
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
                  autoComplete="off"
                />
              </div>
              <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertDescription className="text-xs">
                  <strong>Instrucciones:</strong> Copia esta llave en tu plugin de Kompras Plus en Shopify para
                  automatizar tus despachos.
                </AlertDescription>
              </Alert>
            </div>
          ) : (
            <div className="space-y-4 py-4">
              <div className="p-4 rounded-lg bg-green-50 border-2 border-green-200 border-dashed">
                <code className="text-sm font-mono break-all text-green-800">{generatedKey}</code>
              </div>
              <Button
                type="button"
                onClick={handleCopyKey}
                className="w-full bg-gradient-to-r from-green-500 to-green-600"
              >
                {copiedKey ? (
                  <>
                    <Check className="h-4 w-4 mr-2" aria-hidden="true" />
                    ¡Copiada!
                  </>
                ) : (
                  <>
                    <Copy className="h-4 w-4 mr-2" aria-hidden="true" />
                    Copiar Llave
                  </>
                )}
              </Button>
              <Alert className="bg-amber-50 border-amber-200">
                <AlertCircle className="h-4 w-4 text-amber-600" />
                <AlertDescription className="text-amber-800 text-xs">
                  <strong>⚠️ Importante:</strong> Esta es la única vez que verás esta llave completa. Guárdala en un
                  lugar seguro.
                </AlertDescription>
              </Alert>
            </div>
          )}

          <DialogFooter>
            {!generatedKey ? (
              <Button
                type="button"
                onClick={handleGenerateKey}
                disabled={generating || !newKeyLabel.trim()}
                className="w-full sm:w-auto"
              >
                {generating ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" aria-hidden="true" />
                    Generando...
                  </>
                ) : (
                  <>
                    <Key className="h-4 w-4 mr-2" aria-hidden="true" />
                    Generar Llave
                  </>
                )}
              </Button>
            ) : (
              <Button type="button" variant="outline" onClick={closeNewKeyModal} className="w-full sm:w-auto">
                Cerrar
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Diálogo de confirmación para eliminar llave */}
      <AlertDialog
        open={!!confirmDeleteId}
        onOpenChange={(open) => {
          if (!open) setConfirmDeleteId(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar esta llave?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta acción es permanente e irreversible. Cualquier integración que use esta llave dejará de funcionar
              inmediatamente.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => confirmDeleteId && handleDeleteKey(confirmDeleteId)}
            >
              Sí, eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default IntegracionesView;
