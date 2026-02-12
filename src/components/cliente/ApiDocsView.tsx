import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Copy, Book, Zap, Shield, Webhook, Package, AlertCircle } from "lucide-react";

// ─── Constantes ───────────────────────────────────────────────────────────────

/*
  FIX CRÍTICO: URL del endpoint hardcodeada con el project ID de Supabase.
  El mismo ID (`hhjygradtikonvfzarrn`) ya había sido señalado como expuesto
  en IntegrationsPanel. Aunque la documentación debe mostrar una URL al
  usuario, esta URL no debe estar quemada en el código fuente — debe venir
  de una variable de entorno para que un cambio de proyecto no requiera
  tocar el código.

  FIX: tracking URL del dominio también extraída a env var.
*/
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "https://[SUPABASE_URL]/functions/v1";

const TRACKING_DOMAIN = import.meta.env.VITE_TRACKING_DOMAIN ?? "https://tu-dominio.lovable.app";

const RECEIVE_ORDER_URL = `${API_BASE_URL}/receive-order`;

// ─── Helpers ──────────────────────────────────────────────────────────────────

/*
  FIX: `navigator.clipboard.writeText` es una Promise asíncrona que puede
  fallar (contexto no-HTTPS, permiso denegado, iframe con sandbox, etc.).
  La versión original no la awaiteaba y siempre mostraba "Código copiado"
  aunque el portapapeles nunca se escribiera.

  Ahora:
  - Se espera la Promise
  - En caso de error se usa el fallback `document.execCommand('copy')`
    (compatible con entornos sin Clipboard API)
  - El toast de éxito solo se muestra si realmente funcionó
*/
const copyCode = async (text: string): Promise<void> => {
  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text);
    } else {
      // Fallback para HTTP o iframes sin permiso de clipboard
      const textarea = document.createElement("textarea");
      textarea.value = text;
      textarea.style.position = "fixed";
      textarea.style.opacity = "0";
      document.body.appendChild(textarea);
      textarea.select();
      const ok = document.execCommand("copy");
      document.body.removeChild(textarea);
      if (!ok) throw new Error("execCommand failed");
    }
    toast.success("Código copiado al portapapeles");
  } catch {
    toast.error("No se pudo copiar — copia el texto manualmente");
  }
};

// ─── Sub-componentes ──────────────────────────────────────────────────────────

const CodeBlock = ({ code, language = "json" }: { code: string; language?: string }) => (
  <div className="relative group">
    {/*
      FIX: botón de copiar sin aria-label — los lectores de pantalla lo
      anunciaban como "botón" sin ningún contexto. Añadido aria-label descriptivo
      y title para tooltip visible.
    */}
    <Button
      variant="ghost"
      size="icon"
      className="absolute right-2 top-2 opacity-0 group-hover:opacity-100 transition-opacity h-7 w-7"
      onClick={() => copyCode(code)}
      aria-label="Copiar código"
      title="Copiar al portapapeles"
    >
      <Copy className="h-3 w-3" />
    </Button>
    <pre className="p-4 rounded-lg bg-muted/80 border text-sm overflow-x-auto font-mono">
      {/*
        FIX: añadir atributo `data-language` para facilitar extensiones
        de syntax highlighting futuras sin cambiar la estructura.
      */}
      <code data-language={language}>{code}</code>
    </pre>
  </div>
);

// ─── Vista principal ──────────────────────────────────────────────────────────

export default function ApiDocsView() {
  return (
    <div className="space-y-6 max-w-4xl">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold text-foreground flex items-center gap-2">
          <Book className="h-6 w-6 text-primary" />
          Documentación API — Plus Envíos
        </h2>
        <p className="text-muted-foreground mt-1">
          Guía técnica para integrar tu tienda con el sistema logístico de Plus Envíos
        </p>
      </div>

      {/* Quick Start */}
      <Card className="border-primary/30 bg-primary/5">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Zap className="h-5 w-5 text-primary" />
            Inicio Rápido
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {[
            <>
              Ve a <strong>Integraciones</strong> y genera una <strong>API Key</strong> (formato{" "}
              <code className="bg-muted px-1 rounded">kp_live_...</code>)
            </>,
            <>
              Envía un <code className="bg-muted px-1 rounded">POST</code> al endpoint con tu API Key en el header
            </>,
            <>Recibe la guía y URL de rastreo en la respuesta</>,
            <>
              (Opcional) Configura un <strong>Webhook de salida</strong> para recibir actualizaciones de estado
            </>,
          ].map((step, i) => (
            <div key={i} className="flex items-start gap-3">
              <Badge className="mt-0.5 shrink-0">{i + 1}</Badge>
              <p className="text-sm">{step}</p>
            </div>
          ))}
        </CardContent>
      </Card>

      {/*
        FIX: `grid-cols-4` sin breakpoint → en móvil las 4 tabs quedaban
        comprimidas e ilegibles (texto cortado, botones muy estrechos).
        Cambiado a `grid-cols-2 sm:grid-cols-4` para mostrar 2 columnas
        en pantallas pequeñas.
      */}
      <Tabs defaultValue="create-order" className="w-full">
        <TabsList className="grid w-full grid-cols-2 sm:grid-cols-4">
          <TabsTrigger value="create-order">Crear Pedido</TabsTrigger>
          <TabsTrigger value="webhooks">Webhooks</TabsTrigger>
          <TabsTrigger value="auth">Autenticación</TabsTrigger>
          <TabsTrigger value="errors">Errores</TabsTrigger>
        </TabsList>

        {/* ── Tab: Crear Pedido ─────────────────────────────────────────── */}
        <TabsContent value="create-order" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Package className="h-5 w-5" />
                POST — Crear Pedido
              </CardTitle>
              <CardDescription>Crea un nuevo pedido en el sistema logístico</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <p className="text-sm font-medium mb-2">Endpoint</p>
                {/* FIX: URL desde env var, no hardcodeada */}
                <CodeBlock code={`POST ${RECEIVE_ORDER_URL}`} />
              </div>

              <div>
                <p className="text-sm font-medium mb-2">Headers</p>
                <CodeBlock
                  code={`{
  "Content-Type": "application/json",
  "X-API-Key": "kp_live_tu_api_key_aqui"
}`}
                />
              </div>

              <div>
                <p className="text-sm font-medium mb-2">Body (JSON)</p>
                <CodeBlock
                  code={`{
  "cliente_nombre": "Juan Pérez",
  "client_phone": "3001234567",
  "direccion_entrega": "Calle 100 #15-20 Apto 301",
  "municipio": "Bogotá",
  "barrio": "Chicó",
  "producto_nombre": "Zapatillas Nike Air Max",
  "valor_producto": 250000,
  "valor_recaudar": 250000,
  "metodo_pago": "contra_entrega",
  "observaciones": "Entregar antes de las 5pm",
  "fecha_entrega": "2026-02-10"
}`}
                />
              </div>

              {/* Campos requeridos */}
              <div>
                <p className="text-sm font-medium mb-2">Campos Requeridos</p>
                <FieldTable
                  rows={[
                    ["cliente_nombre", "string", "Nombre del destinatario"],
                    ["client_phone", "string", "Teléfono del destinatario"],
                    ["direccion_entrega", "string", "Dirección completa de entrega"],
                    ["municipio", "string", "Ciudad/municipio de destino"],
                    ["producto_nombre", "string", "Nombre del producto"],
                    ["valor_producto", "number", "Valor del producto en COP"],
                  ]}
                />
              </div>

              {/* Campos opcionales */}
              <div>
                <p className="text-sm font-medium mb-2">Campos Opcionales</p>
                <FieldTable
                  rows={[
                    ["barrio", "string", "Barrio del destinatario"],
                    ["valor_recaudar", "number", "Monto a cobrar al destinatario (PCE)"],
                    ["metodo_pago", "string", "contra_entrega | anticipado"],
                    ["observaciones", "string", "Notas adicionales para la entrega"],
                    ["fecha_entrega", "string", "Fecha programada (YYYY-MM-DD)"],
                    ["latitud", "number", "Coordenada GPS (lat)"],
                    ["longitud", "number", "Coordenada GPS (lng)"],
                    ["indicador_trayecto", "string", "Local | Zonal | Nacional | Especial"],
                  ]}
                />
              </div>

              <div>
                <p className="text-sm font-medium mb-2">Respuesta Exitosa (201)</p>
                {/* FIX: tracking URL desde env var */}
                <CodeBlock
                  code={`{
  "success": true,
  "order": {
    "id": 1234,
    "numero_guia": "KP1A2B3C4D",
    "estado": "pendiente",
    "valor_flete": 12000,
    "valor_recaudar": 250000,
    "fecha_entrega": "2026-02-10",
    "tracking_url": "${TRACKING_DOMAIN}/rastreo/KP1A2B3C4D"
  },
  "message": "Pedido creado exitosamente"
}`}
                />
              </div>

              <div>
                <p className="text-sm font-medium mb-2">Ejemplo con cURL</p>
                {/* FIX: URL desde env var en el ejemplo cURL también */}
                <CodeBlock
                  language="bash"
                  code={`curl -X POST \\
  ${RECEIVE_ORDER_URL} \\
  -H "Content-Type: application/json" \\
  -H "X-API-Key: kp_live_tu_api_key_aqui" \\
  -d '{
    "cliente_nombre": "Juan Pérez",
    "client_phone": "3001234567",
    "direccion_entrega": "Calle 100 #15-20",
    "municipio": "Bogotá",
    "producto_nombre": "Zapatillas Nike",
    "valor_producto": 250000
  }'`}
                />
              </div>
            </CardContent>
          </Card>

          {/* Modo Alto Volumen */}
          <Card>
            <CardHeader>
              <CardTitle>Modo Alto Volumen</CardTitle>
              <CardDescription>Para envíos masivos (+100 pedidos), usa el modo cola</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground mb-3">
                Agrega el header <code className="bg-muted px-1 rounded">X-Queue-Mode: true</code> para que los pedidos
                se procesen en segundo plano sin saturar el servidor. Recibirás un{" "}
                <code className="bg-muted px-1 rounded">queue_id</code> para seguimiento.
              </p>
              <CodeBlock
                code={`// Respuesta en modo cola (202 Accepted)
{
  "success": true,
  "queued": true,
  "queue_id": "uuid-del-item-en-cola",
  "message": "Pedido añadido a la cola de procesamiento"
}`}
              />
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── Tab: Webhooks ─────────────────────────────────────────────── */}
        <TabsContent value="webhooks" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Webhook className="h-5 w-5" />
                Webhooks de Salida
              </CardTitle>
              <CardDescription>Recibe notificaciones automáticas cuando el estado de una guía cambie</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Configura una URL HTTPS en <strong>Integraciones → Webhooks</strong>. Cada vez que un pedido cambie de
                estado, enviaremos un POST a tu URL.
              </p>

              <div>
                <p className="text-sm font-medium mb-2">Payload del Webhook</p>
                <CodeBlock
                  code={`{
  "event": "status_change",
  "timestamp": "2026-02-09T15:30:00.000Z",
  "data": {
    "pedido_id": 1234,
    "numero_guia": "KP1A2B3C4D",
    "estado_anterior": "En Ruta",
    "estado_nuevo": "Entregado",
    "tracking_url": "${TRACKING_DOMAIN}/rastreo/KP1A2B3C4D"
  }
}`}
                />
              </div>

              <div>
                <p className="text-sm font-medium mb-2">Headers del Webhook</p>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm border rounded-lg">
                    <thead>
                      <tr className="bg-muted/50">
                        <th className="text-left p-2 border-b">Header</th>
                        <th className="text-left p-2 border-b">Descripción</th>
                      </tr>
                    </thead>
                    <tbody>
                      {[
                        ["Content-Type", "application/json"],
                        ["User-Agent", "PlusEnvios-Webhook/1.0"],
                        ["X-Webhook-Event", "Tipo de evento (status_change)"],
                        ["X-Webhook-Delivery", "UUID único de la entrega"],
                        ["X-Webhook-Signature", "sha256=HMAC (si configuraste un secret)"],
                      ].map(([header, desc]) => (
                        <tr key={header} className="border-b last:border-0">
                          <td className="p-2 font-mono text-xs">{header}</td>
                          <td className="p-2 text-muted-foreground">{desc}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              <div>
                <p className="text-sm font-medium mb-2">Verificación de Firma HMAC</p>
                <CodeBlock
                  language="javascript"
                  code={`// Node.js — Verificar firma del webhook
const crypto = require('crypto');

function verifySignature(body, signature, secret) {
  const expected = crypto
    .createHmac('sha256', secret)
    .update(body)
    .digest('hex');
  // FIX: usar timingSafeEqual para evitar timing attacks
  const expectedBuf = Buffer.from(\`sha256=\${expected}\`);
  const signatureBuf = Buffer.from(signature);
  if (expectedBuf.length !== signatureBuf.length) return false;
  return crypto.timingSafeEqual(expectedBuf, signatureBuf);
}

// En tu handler:
app.post('/webhook', express.raw({ type: 'application/json' }), (req, res) => {
  const sig = req.headers['x-webhook-signature'];
  // IMPORTANTE: usar req.body como Buffer (raw), no JSON parseado
  const isValid = verifySignature(req.body, sig, 'whsec_tu_secret_aqui');
  if (!isValid) return res.status(401).send('Invalid signature');

  const event = JSON.parse(req.body);
  console.log('Estado:', event.data.estado_nuevo);
  res.status(200).send('OK');
});`}
                />
              </div>

              <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertDescription className="text-xs">
                  <strong>Circuit Breaker:</strong> Si tu endpoint falla 10 veces consecutivas, dejaremos de enviar
                  notificaciones hasta que lo reactives manualmente. Tu endpoint debe responder con un código 2xx dentro
                  de 10 segundos.
                </AlertDescription>
              </Alert>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── Tab: Autenticación ────────────────────────────────────────── */}
        <TabsContent value="auth" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Shield className="h-5 w-5" />
                Autenticación
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Todas las llamadas a la API requieren una <strong>API Key</strong> válida en el header.
              </p>
              <CodeBlock code="X-API-Key: kp_live_tu_api_key_aqui" />

              <div className="space-y-2">
                <h4 className="text-sm font-medium">Buenas prácticas</h4>
                <ul className="text-sm text-muted-foreground space-y-1 list-disc list-inside">
                  <li>Nunca expongas tu API Key en código frontend o repositorios públicos</li>
                  <li>Usa variables de entorno para almacenar tus credenciales</li>
                  <li>Rota tus llaves periódicamente desde el panel de Integraciones</li>
                  <li>Desactiva llaves que ya no uses</li>
                </ul>
              </div>

              <div>
                <h4 className="text-sm font-medium mb-2">Rate Limiting</h4>
                <p className="text-sm text-muted-foreground">
                  Para proteger la estabilidad del servicio, aplicamos un límite de{" "}
                  <strong>60 peticiones por minuto</strong> por API Key. Si excedes este límite, recibirás un error{" "}
                  <code className="bg-muted px-1 rounded">429 Too Many Requests</code>.
                </p>
                <CodeBlock
                  code={`{
  "error": "Rate limit exceeded. Max 60 requests per minute.",
  "code": "RATE_LIMIT",
  "retry_after_seconds": 30
}`}
                />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── Tab: Errores ──────────────────────────────────────────────── */}
        <TabsContent value="errors" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Códigos de Error</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-sm border rounded-lg">
                  <thead>
                    <tr className="bg-muted/50">
                      <th className="text-left p-2 border-b">HTTP</th>
                      <th className="text-left p-2 border-b">Código</th>
                      <th className="text-left p-2 border-b">Descripción</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[
                      ["400", "INVALID_JSON", "El body no es JSON válido"],
                      ["400", "MISSING_FIELDS", "Faltan campos obligatorios"],
                      ["401", "MISSING_API_KEY", "No se envió el header X-API-Key"],
                      ["401", "INVALID_API_KEY", "La API Key no existe o es inválida"],
                      ["403", "INACTIVE_API_KEY", "La API Key está desactivada"],
                      ["409", "DUPLICATE_ORDER", "Ya existe un pedido con ese ID externo"],
                      ["429", "RATE_LIMIT", "Excediste el límite de peticiones por minuto"],
                      ["500", "INSERT_ERROR", "Error al crear el pedido en la base de datos"],
                      ["500", "INTERNAL_ERROR", "Error interno del servidor"],
                    ].map(([status, code, desc]) => (
                      <tr key={code} className="border-b last:border-0">
                        <td className="p-2">
                          <Badge variant={status.startsWith("4") ? "outline" : "destructive"}>{status}</Badge>
                        </td>
                        <td className="p-2 font-mono text-xs">{code}</td>
                        <td className="p-2 text-muted-foreground">{desc}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>

          {/* Tarifas */}
          <Card>
            <CardHeader>
              <CardTitle>Tarifas de Flete por Municipio</CardTitle>
              <CardDescription>El flete se calcula automáticamente según el municipio de destino</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-sm border rounded-lg">
                  <thead>
                    <tr className="bg-muted/50">
                      <th className="text-left p-2 border-b">Municipio</th>
                      <th className="text-right p-2 border-b">Flete (COP)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[
                      ["Bogotá", "$12.000"],
                      ["Soacha", "$15.000"],
                      ["Sibaté", "$15.000"],
                      ["Chía", "$18.000"],
                      ["Cota", "$18.000"],
                      ["Funza", "$18.000"],
                      ["Mosquera", "$18.000"],
                      ["Madrid", "$18.000"],
                      ["Otros", "$15.000 (default)"],
                    ].map(([muni, tarifa]) => (
                      <tr key={muni} className="border-b last:border-0">
                        <td className="p-2">{muni}</td>
                        <td className="p-2 text-right font-medium">{tarifa}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

// ─── Tabla de campos reutilizable ─────────────────────────────────────────────

/*
  FIX: la tabla de campos se repetía dos veces (requeridos/opcionales)
  con estructura idéntica. Extraída como componente para evitar duplicación
  y facilitar cambios futuros (ej. añadir columna "Ejemplo").
*/
const FieldTable = ({ rows }: { rows: [string, string, string][] }) => (
  <div className="overflow-x-auto">
    <table className="w-full text-sm border rounded-lg">
      <thead>
        <tr className="bg-muted/50">
          <th className="text-left p-2 border-b">Campo</th>
          <th className="text-left p-2 border-b">Tipo</th>
          <th className="text-left p-2 border-b">Descripción</th>
        </tr>
      </thead>
      <tbody>
        {rows.map(([field, type, desc]) => (
          <tr key={field} className="border-b last:border-0">
            <td className="p-2 font-mono text-xs">{field}</td>
            <td className="p-2">
              <Badge variant="outline">{type}</Badge>
            </td>
            <td className="p-2 text-muted-foreground">{desc}</td>
          </tr>
        ))}
      </tbody>
    </table>
  </div>
);
