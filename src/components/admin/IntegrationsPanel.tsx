 import { useState, useEffect } from "react";
 import { supabase } from "@/integrations/supabase/client";
 import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
 import { Button } from "@/components/ui/button";
 import { Input } from "@/components/ui/input";
 import { Label } from "@/components/ui/label";
 import { Badge } from "@/components/ui/badge";
 import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
 import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
 import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
 import { Switch } from "@/components/ui/switch";
 import { toast } from "sonner";
 import { Copy, Key, Plus, Trash2, RefreshCw, CheckCircle, XCircle, Settings, History } from "lucide-react";
 import { format } from "date-fns";
 import { es } from "date-fns/locale";
 
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
 
 export default function IntegrationsPanel() {
   const [credentials, setCredentials] = useState<ApiCredential[]>([]);
   const [logs, setLogs] = useState<ApiLog[]>([]);
   const [stateMappings, setStateMappings] = useState<StateMapping[]>([]);
   const [loading, setLoading] = useState(true);
   const [selectedPlatform, setSelectedPlatform] = useState<string>("dropi");
   const [logStats, setLogStats] = useState({ total: 0, success: 0, failed: 0 });
 
   useEffect(() => {
     fetchData();
   }, []);
 
   useEffect(() => {
     calculateLogStats();
   }, [logs]);
 
   const fetchData = async () => {
     setLoading(true);
     try {
       const [credRes, logRes, mappingRes] = await Promise.all([
         supabase
           .from("api_credentials")
          .select("*")
           .order("created_at", { ascending: false }),
         supabase
           .from("api_logs")
           .select("*")
           .order("created_at", { ascending: false })
           .limit(100),
         supabase
           .from("state_mappings")
           .select("*")
           .order("platform", { ascending: true })
           .order("internal_state", { ascending: true }),
       ]);
 
       if (credRes.data) setCredentials(credRes.data as ApiCredential[]);
       if (logRes.data) setLogs(logRes.data);
       if (mappingRes.data) setStateMappings(mappingRes.data);
     } catch (error) {
       console.error("Error fetching data:", error);
       toast.error("Error al cargar datos de integraciones");
     } finally {
       setLoading(false);
     }
   };
 
   const calculateLogStats = () => {
     const today = new Date().toISOString().split("T")[0];
     const todayLogs = logs.filter(l => l.created_at.startsWith(today));
     setLogStats({
       total: todayLogs.length,
       success: todayLogs.filter(l => l.success).length,
       failed: todayLogs.filter(l => !l.success).length,
     });
   };
 
   const toggleCredentialStatus = async (id: string, isActive: boolean) => {
     const { error } = await supabase
       .from("api_credentials")
       .update({ is_active: !isActive })
       .eq("id", id);
 
     if (error) {
       toast.error("Error al actualizar estado");
     } else {
       toast.success(isActive ? "API Key desactivada" : "API Key activada");
       fetchData();
     }
   };
 
   const updateStateMapping = async (id: string, field: string, value: string) => {
     const { error } = await supabase
       .from("state_mappings")
       .update({ [field]: value })
       .eq("id", id);
 
     if (error) {
       toast.error("Error al actualizar mapeo");
     } else {
       toast.success("Mapeo actualizado");
       fetchData();
     }
   };
 
   const copyWebhookUrl = () => {
     const url = "https://hhjygradtikonvfzarrn.supabase.co/functions/v1/universal-webhook";
     navigator.clipboard.writeText(url);
     toast.success("URL del webhook copiada");
   };
 
   const filteredMappings = stateMappings.filter(m => m.platform === selectedPlatform);
 
   const getPlatformBadge = (platform: string) => {
    const variants: Record<string, "default" | "secondary" | "outline"> = {
      dropi: "default",
      mastershop: "secondary",
      shopify: "default",
      woocommerce: "secondary",
     };
    return <Badge variant={variants[platform] || "outline"}>{platform}</Badge>;
   };
 
   return (
     <div className="space-y-6">
       {/* Stats Cards */}
       <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
         <Card>
           <CardContent className="pt-6">
             <div className="flex items-center justify-between">
               <div>
                 <p className="text-sm text-muted-foreground">API Keys Activas</p>
                 <p className="text-2xl font-bold">{credentials.filter(c => c.is_active).length}</p>
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
 
       <Tabs defaultValue="credentials" className="w-full">
         <TabsList className="grid w-full grid-cols-3">
           <TabsTrigger value="credentials">API Keys</TabsTrigger>
           <TabsTrigger value="mappings">Mapeo de Estados</TabsTrigger>
           <TabsTrigger value="logs">Logs de Actividad</TabsTrigger>
         </TabsList>
 
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
                 <code className="flex-1 text-sm">
                   https://hhjygradtikonvfzarrn.supabase.co/functions/v1/universal-webhook
                 </code>
                 <Button size="sm" variant="outline" onClick={copyWebhookUrl}>
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
                     <TableHead>Acciones</TableHead>
                   </TableRow>
                 </TableHeader>
                 <TableBody>
                   {credentials.map((cred) => (
                     <TableRow key={cred.id}>
                       <TableCell className="font-medium">
                        {cred.label || "Sin etiqueta"}
                       </TableCell>
                       <TableCell>
                         <code className="bg-muted px-2 py-1 rounded text-xs">{cred.api_key_prefix}...</code>
                       </TableCell>
                       <TableCell className="text-sm text-muted-foreground">
                         {cred.last_used_at 
                           ? format(new Date(cred.last_used_at), "dd/MM HH:mm", { locale: es })
                           : "Nunca"}
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
                   {credentials.length === 0 && (
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
 
         <TabsContent value="mappings" className="space-y-4">
           <Card>
             <CardHeader>
               <div className="flex items-center justify-between">
                 <div>
                   <CardTitle className="flex items-center gap-2">
                     <Settings className="h-5 w-5" />
                     Mapeo de Estados
                   </CardTitle>
                   <CardDescription>
                     Configura cómo se traducen los estados internos a cada plataforma
                   </CardDescription>
                 </div>
                 <Select value={selectedPlatform} onValueChange={setSelectedPlatform}>
                   <SelectTrigger className="w-40">
                     <SelectValue />
                   </SelectTrigger>
                   <SelectContent>
                     <SelectItem value="dropi">Dropi</SelectItem>
                     <SelectItem value="mastershop">Mastershop</SelectItem>
                     <SelectItem value="shopify">Shopify</SelectItem>
                     <SelectItem value="woocommerce">WooCommerce</SelectItem>
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
                     <TableRow key={mapping.id}>
                       <TableCell className="font-medium">{mapping.internal_state}</TableCell>
                       <TableCell>
                         <Input
                           value={mapping.external_state}
                           onChange={(e) => updateStateMapping(mapping.id, "external_state", e.target.value)}
                           className="max-w-[200px]"
                         />
                       </TableCell>
                       <TableCell>
                         <Input
                           value={mapping.external_code || ""}
                           onChange={(e) => updateStateMapping(mapping.id, "external_code", e.target.value)}
                           className="max-w-[100px]"
                           placeholder="Código"
                         />
                       </TableCell>
                       <TableCell>
                         <Switch
                           checked={mapping.is_active}
                           onCheckedChange={(checked) => 
                             updateStateMapping(mapping.id, "is_active", String(checked))
                           }
                         />
                       </TableCell>
                     </TableRow>
                   ))}
                   {filteredMappings.length === 0 && (
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
 
         <TabsContent value="logs" className="space-y-4">
           <Card>
             <CardHeader>
               <div className="flex items-center justify-between">
                 <div>
                   <CardTitle className="flex items-center gap-2">
                     <History className="h-5 w-5" />
                     Logs de API
                   </CardTitle>
                   <CardDescription>
                     Historial de solicitudes recibidas por el webhook
                   </CardDescription>
                 </div>
                 <Button variant="outline" size="sm" onClick={fetchData}>
                   <RefreshCw className="h-4 w-4 mr-2" />
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
                         {format(new Date(log.created_at), "dd/MM HH:mm:ss", { locale: es })}
                       </TableCell>
                       <TableCell>{getPlatformBadge(log.platform)}</TableCell>
                       <TableCell className="text-sm">{log.action}</TableCell>
                       <TableCell>
                         {log.success ? (
                          <Badge variant="default">
                             {log.response_status}
                           </Badge>
                         ) : (
                           <Badge variant="destructive">
                             {log.response_status}
                           </Badge>
                         )}
                       </TableCell>
                       <TableCell className="text-sm text-muted-foreground max-w-[200px] truncate">
                         {log.response_message}
                       </TableCell>
                     </TableRow>
                   ))}
                   {logs.length === 0 && (
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