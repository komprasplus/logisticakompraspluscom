import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { Copy, Key, RefreshCw, CheckCircle, XCircle, Settings, History } from "lucide-react";
import { format } from "date-fns";
import { es } from "date-fns/locale";

// ─── Tipos ────────────────────────────────────────────────────────────────────

interface ApiCredential {
  id: string;
  label: string | null;
  api_key_prefix: string;
  is_active: boolean;
  last_used_at: string | null;
  created_at: string;
  client_user_id: string;
}

interface ApiLog {
  id: string;
  platform: string;
  action: string;
  response_status: number | null;
  response_message: string | null;
  success: boolean;
  created_at: string;
  credential_id: string | null;
}

interface StateMapping {
  id: string;
  internal_state: string;
  platform: string;
  external_state: string;
  external_code: string | null;
  is_active: boolean;
}

// ─── Constantes ───────────────────────────────────────────────────────────────

/*
  FIX CRÍTICO DE SEGURIDAD: La URL del webhook exponía el ID del proyecto
  Supabase (`hhjygradtikonvfzarrn`) directamente en el bundle JS.
  Debe vivir en una variable de entorno para no ser indexada por bots.

  En tu .env:  VITE_WEBHOOK_URL=https://...supabase.co/functions/v1/universal-webhook
*/
const WEBHOOK_URL = import.meta.env.VITE_WEBHOOK_URL as string;

/** Plataformas disponibles — una sola fuente de verdad para el Select y los badges */
const PLATFORMS: { value: string; label: string }[] = [
  { value: "dropi", label: "Dropi" },
  { value: "mastershop", label: "Mastershop" },
  { value: "shopify", label: "Shopify" },
  { value: "woocommerce", label: "WooCommerce" },
];

/** Obtiene la fecha de hoy en Colombia (evita bug de UTC) */
const getTodayColombia = (): string => new Date().toLocaleDateString("en-CA", { timeZone: "America/Bogota" });

/**
 * Formatea una fecha ISO con timezone Colombia.
 * FIX: `format` de date-fns sin timezone mostraba hora UTC en vez de Bogotá.
 */
const formatDateCO = (iso: string, fmt: string): string =>
  format(new Date(new Date(iso).toLocaleString("en-US", { timeZone: "America/Bogota" })), fmt, { locale: es });

// ─── Sub-componentes (fuera del padre — tipos estables, sin remount) ──────────

/** Badge de plataforma con colores consistentes */
const PlatformBadge = ({ platform }: { platform: string }) => {
  const variants: Record<string, "default" | "secondary" | "outline"> = {
    dropi: "default",
    mastershop: "secondary",
    shopify: "default",
    woocommerce: "secondary",
  };
  return <Badge variant={variants[platform] ?? "outline"}>{platform}</Badge>;
};

// ─── Fila de mapeo con estado local (evita update por cada keystroke) ─────────

/*
  FIX CRÍTICO DE UX: En el código original, `updateStateMapping` se llamaba
  en el `onChange` de cada Input — es decir, una llamada a Supabase por cada
  letra que el usuario escribía. Con 10 letras = 10 queries.
  
  Solución: este sub-componente mantiene el valor en estado local y solo
  dispara el update al perder el foco (`onBlur`) o al presionar Enter.
*/
const MappingRow = ({
  mapping,
  onUpdate,
  onToggle,
}: {
  mapping: StateMapping;
  onUpdate: (id: string, field: string, value: string) => Promise<void>;
  onToggle: (id: string, checked: boolean) => Promise<void>;
}) => {
  const [externalState, setExternalState] = useState(mapping.external_state);
  const [externalCode, setExternalCode] = useState(mapping.external_code ?? "");

  const handleBlur = useCallback(
    (field: "external_state" | "external_code", value: string) => {
      const original = field === "external_state" ? mapping.external_state : (mapping.external_code ?? "");
      // Solo actualizar si el valor cambió
      if (value !== original) {
        onUpdate(mapping.id, field, value);
      }
    },
    [mapping, onUpdate],
  );

  return (
    <TableRow>
      <TableCell className="font-medium">{mapping.internal_state}</TableCell>
      <TableCell>
        <Input
          value={externalState}
          onChange={(e) => setExternalState(e.target.value)}
          onBlur={(e) => handleBlur("external_state", e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleBlur("external_state", externalState)}
          className="max-w-[200px]"
        />
      </TableCell>
      <TableCell>
        <Input
          value={externalCode}
          onChange={(e) => setExternalCode(e.target.value)}
          onBlur={(e) => handleBlur("external_code", e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleBlur("external_code", externalCode)}
          className="max-w-[100px]"
          placeholder="Código"
        />
      </TableCell>
      <TableCell>
        <Switch checked={mapping.is_active} onCheckedChange={(checked) => onToggle(mapping.id, checked)} />
      </TableCell>
    </TableRow>
  );
};

// ─── Componente principal ─────────────────────────────────────────────────────

export default function IntegrationsPanel() {
  const [credentials, setCredentials] = useState<ApiCredential[]>([]);
  const [logs, setLogs] = useState<ApiLog[]>([]);
  const [stateMappings, setStateMappings] = useState<StateMapping[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedPlatform, setSelectedPlatform] = useState("dropi");
  const { profile } = useAuth();
  const orgId = profile?.organizacion_id;

  // FIX: ref de cancelación para evitar setState sobre componente desmontado
  const cancelRef = useRef(false);

  // ── Fetch ──────────────────────────────────────────────────────────────────

  /*
    FIX: fetchData en useCallback para incluirla en dependencias de useEffect
    sin generar loop infinito.
    FIX: errores individuales logueados por query para saber exactamente
    cuál falló, en lugar de un catch genérico que oculta el origen.
  */
  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [credRes, logRes, mappingRes] = await Promise.all([
        supabase
          .from("api_credentials")
          .select("id, label, api_key_prefix, is_active, last_used_at, created_at, client_user_id")
          .order("created_at", { ascending: false }),
        supabase
          .from("api_logs")
          .select("id, platform, action, response_status, response_message, success, created_at, credential_id")
          .order("created_at", { ascending: false })
          .limit(100),
        supabase
          .from("state_mappings")
          .select("id, internal_state, platform, external_state, external_code, is_active")
          .order("platform", { ascending: true })
          .order("internal_state", { ascending: true }),
      ]);

      if (cancelRef.current) return;

      if (credRes.error) console.error("credentials error:", credRes.error);
      if (logRes.error) console.error("api_logs error:", logRes.error);
      if (mappingRes.error) console.error("state_mappings error:", mappingRes.error);

      if (credRes.data) setCredentials(credRes.data as ApiCredential[]);
      if (logRes.data) setLogs(logRes.data);
      if (mappingRes.data) setStateMappings(mappingRes.data);

      // Error toast solo si TODAS fallaron
      if (credRes.error && logRes.error && mappingRes.error) {
        toast.error("Error al cargar datos de integraciones");
      }
    } catch (error) {
      if (cancelRef.current) return;
      console.error("Error fetching integrations data:", error);
      toast.error("Error al cargar datos de integraciones");
    } finally {
      if (!cancelRef.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    cancelRef.current = false;
    fetchData();
    return () => {
      cancelRef.current = true;
    };
  }, [fetchData]);

  // ── Estadísticas de logs ───────────────────────────────────────────────────

  /*
    FIX: era un useEffect que llamaba a setState → render extra innecesario.
    Con useMemo se calcula en el mismo ciclo de render cuando `logs` cambia.
    FIX: timezone Colombia en vez de UTC.
  */
  const logStats = useMemo(() => {
    const today = getTodayColombia();
    const todayLogs = logs.filter((l) => l.created_at.startsWith(today));
    return {
      total: todayLogs.length,
      success: todayLogs.filter((l) => l.success).length,
      failed: todayLogs.filter((l) => !l.success).length,
    };
  }, [logs]);

  // ── Filtrado de mapeos ─────────────────────────────────────────────────────

  // FIX: memoizado — antes se recalculaba en cada render
  const filteredMappings = useMemo(
    () => stateMappings.filter((m) => m.platform === selectedPlatform),
    [stateMappings, selectedPlatform],
  );

  // ── Acciones ───────────────────────────────────────────────────────────────

  /*
    FIX: update optimista — actualizamos el estado local inmediatamente
    sin esperar el refetch completo. Si falla, revertimos.
    Antes se hacía fetchData() completo tras cada toggle (3 queries de nuevo).
  */
  const toggleCredentialStatus = useCallback(async (id: string, isActive: boolean) => {
    // Optimista
    setCredentials((prev) => prev.map((c) => (c.id === id ? { ...c, is_active: !isActive } : c)));

    const { error } = await supabase.from("api_credentials").update({ is_active: !isActive }).eq("id", id);

    if (error) {
      // Revertir
      setCredentials((prev) => prev.map((c) => (c.id === id ? { ...c, is_active: isActive } : c)));
      toast.error("Error al actualizar estado");
    } else {
      toast.success(isActive ? "API Key desactivada" : "API Key activada");
    }
  }, []);

  /*
    FIX: recibe `value: string | boolean` correctamente tipado.
    FIX: update optimista en lugar de refetch completo.
    FIX: el Switch de is_active ahora envía boolean real, no el string "true"/"false".
  */
  const updateStateMapping = useCallback(
    async (id: string, field: string, value: string | boolean) => {
      // Optimista
      setStateMappings((prev) => prev.map((m) => (m.id === id ? { ...m, [field]: value } : m)));

      const { error } = await supabase
        .from("state_mappings")
        .update({ [field]: value })
        .eq("id", id);

      if (error) {
        // No es fácil revertir el campo exacto sin el valor anterior,
        // así que hacemos refetch como fallback en caso de error
        toast.error("Error al actualizar mapeo — recargando datos");
        fetchData();
      } else {
        toast.success("Mapeo actualizado");
      }
    },
    [fetchData],
  );

  const handleMappingToggle = useCallback(
    (id: string, checked: boolean) => updateStateMapping(id, "is_active", checked),
    [updateStateMapping],
  );

  const copyWebhookUrl = useCallback(() => {
    if (!WEBHOOK_URL) {
      toast.error("VITE_WEBHOOK_URL no está configurado en .env");
      return;
    }
    navigator.clipboard.writeText(WEBHOOK_URL);
    toast.success("URL del webhook copiada");
  }, []);

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6">
      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">API Keys Activas</p>
                <p className="text-2xl font-bold">{credentials.filter((c) => c.is_active).length}</p>
              </div>
              <Key className="h-8 w-8 text-primary" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Pedidos Hoy</p>
                <p className="text-2xl font-bold">{logStats.total}</p>
              </div>
              <History className="h-8 w-8 text-primary" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Exitosos</p>
                <p className="text-2xl font-bold text-primary">{logStats.success}</p>
              </div>
              <CheckCircle className="h-8 w-8 text-primary" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Fallidos</p>
                <p className="text-2xl font-bold text-destructive">{logStats.failed}</p>
              </div>
              <XCircle className="h-8 w-8 text-destructive" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="credentials" className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="credentials">API Keys</TabsTrigger>
          <TabsTrigger value="mappings">Mapeo de Estados</TabsTrigger>
          <TabsTrigger value="logs">Logs de Actividad</TabsTrigger>
        </TabsList>

        {/* ── Tab: Credentials ── */}
        <TabsContent value="credentials" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Key className="h-5 w-5" />
                Webhook Universal
              </CardTitle>
              <CardDescription>
                Endpoint único para recibir pedidos de Dropi, Mastershop y otras plataformas
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-2 p-3 bg-muted rounded-lg">
                <code className="flex-1 text-sm break-all">
                  {WEBHOOK_URL || "Configura VITE_WEBHOOK_URL en tu archivo .env"}
                </code>
                <Button size="sm" variant="outline" onClick={copyWebhookUrl} disabled={!WEBHOOK_URL}>
                  <Copy className="h-4 w-4" />
                </Button>
              </div>
              <p className="text-sm text-muted-foreground mt-2">
                Usa el header <code className="bg-muted px-1 rounded">x-api-key</code> para autenticar
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>API Keys de Clientes</CardTitle>
              <CardDescription>Gestiona las credenciales de acceso de cada tienda</CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Etiqueta</TableHead>
                    <TableHead>Key Prefix</TableHead>
                    <TableHead>Último Uso</TableHead>
                    <TableHead>Estado</TableHead>
                    <TableHead>Activar</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {credentials.map((cred) => (
                    <TableRow key={cred.id}>
                      <TableCell className="font-medium">{cred.label ?? "Sin etiqueta"}</TableCell>
                      <TableCell>
                        <code className="bg-muted px-2 py-1 rounded text-xs">{cred.api_key_prefix}...</code>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {cred.last_used_at ? formatDateCO(cred.last_used_at, "dd/MM HH:mm") : "Nunca"}
                      </TableCell>
                      <TableCell>
                        <Badge variant={cred.is_active ? "default" : "secondary"}>
                          {cred.is_active ? "Activa" : "Inactiva"}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Switch
                          checked={cred.is_active}
                          onCheckedChange={() => toggleCredentialStatus(cred.id, cred.is_active)}
                        />
                      </TableCell>
                    </TableRow>
                  ))}
                  {credentials.length === 0 && !loading && (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                        No hay API Keys registradas
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── Tab: Mappings ── */}
        <TabsContent value="mappings" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <Settings className="h-5 w-5" />
                    Mapeo de Estados
                  </CardTitle>
                  <CardDescription>Configura cómo se traducen los estados internos a cada plataforma</CardDescription>
                </div>
                <Select value={selectedPlatform} onValueChange={setSelectedPlatform}>
                  <SelectTrigger className="w-40">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {PLATFORMS.map((p) => (
                      <SelectItem key={p.value} value={p.value}>
                        {p.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Estado Interno</TableHead>
                    <TableHead>Estado Externo</TableHead>
                    <TableHead>Código</TableHead>
                    <TableHead>Activo</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredMappings.map((mapping) => (
                    <MappingRow
                      key={mapping.id}
                      mapping={mapping}
                      onUpdate={updateStateMapping}
                      onToggle={handleMappingToggle}
                    />
                  ))}
                  {filteredMappings.length === 0 && !loading && (
                    <TableRow>
                      <TableCell colSpan={4} className="text-center text-muted-foreground py-8">
                        No hay mapeos para {selectedPlatform}
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── Tab: Logs ── */}
        <TabsContent value="logs" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <History className="h-5 w-5" />
                    Logs de API
                  </CardTitle>
                  <CardDescription>Historial de solicitudes recibidas por el webhook</CardDescription>
                </div>
                <Button variant="outline" size="sm" onClick={fetchData} disabled={loading}>
                  <RefreshCw className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`} />
                  Actualizar
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Fecha</TableHead>
                    <TableHead>Plataforma</TableHead>
                    <TableHead>Acción</TableHead>
                    <TableHead>Estado</TableHead>
                    <TableHead>Mensaje</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {logs.map((log) => (
                    <TableRow key={log.id}>
                      <TableCell className="text-sm">
                        {/* FIX: timezone Colombia */}
                        {formatDateCO(log.created_at, "dd/MM HH:mm:ss")}
                      </TableCell>
                      <TableCell>
                        <PlatformBadge platform={log.platform} />
                      </TableCell>
                      <TableCell className="text-sm">{log.action}</TableCell>
                      <TableCell>
                        <Badge variant={log.success ? "default" : "destructive"}>{log.response_status ?? "—"}</Badge>
                      </TableCell>
                      <TableCell
                        className="text-sm text-muted-foreground max-w-[200px] truncate"
                        title={log.response_message ?? undefined}
                      >
                        {log.response_message ?? "—"}
                      </TableCell>
                    </TableRow>
                  ))}
                  {logs.length === 0 && !loading && (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                        No hay logs registrados
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
