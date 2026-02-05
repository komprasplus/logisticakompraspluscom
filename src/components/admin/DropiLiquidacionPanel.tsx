 import { useState, useEffect } from "react";
 import { motion } from "framer-motion";
 import {
   DollarSign,
   TrendingUp,
   Package,
   AlertTriangle,
   CheckCircle2,
   Loader2,
   Download,
   RefreshCw,
   Clock,
   Truck,
 } from "lucide-react";
 import { supabase } from "@/integrations/supabase/client";
 import { toast } from "sonner";
 import { Button } from "@/components/ui/button";
 import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
 import {
   Table,
   TableBody,
   TableCell,
   TableHead,
   TableHeader,
   TableRow,
 } from "@/components/ui/table";
 import { usePagination } from "@/hooks/usePagination";
 import PaginationControls from "@/components/PaginationControls";
 import { format } from "date-fns";
 import { es } from "date-fns/locale";
 
 interface DropiIndicators {
   total_guias: number;
   guias_movilizadas: number;
   guias_entregadas: number;
   guias_devueltas: number;
   guias_con_novedad: number;
   novedades_automaticas: number;
   novedades_manuales: number;
   entregas_en_sla: number;
   primer_intento_exitoso: number;
   guias_con_recaudo: number;
   promedio_dias_transito: number | null;
   porcentaje_entregas: number | null;
   porcentaje_sla_cumplido: number | null;
 }
 
 interface LiquidacionDropi {
   id: number;
   numero_guia: string | null;
   estado: string | null;
   valor_recaudar: number;
   valor_flete: number;
   valor_producto: number;
   utilidad: number;
   sla_cumplido: boolean | null;
   dias_en_transito: number;
   fecha_cierre_logistico: string | null;
   cliente_nombre: string | null;
   municipio: string | null;
   store_name?: string | null;
 }
 
 const DropiLiquidacionPanel = () => {
   const [indicators, setIndicators] = useState<DropiIndicators | null>(null);
   const [pedidos, setPedidos] = useState<LiquidacionDropi[]>([]);
   const [loading, setLoading] = useState(true);
   const [refreshing, setRefreshing] = useState(false);
 
   const {
     paginatedItems,
     currentPage,
     totalPages,
     startIndex,
     endIndex,
     totalItems,
     itemsPerPage,
     goToPage,
     setItemsPerPage,
   } = usePagination({ items: pedidos, itemsPerPage: 15 });
 
   const fetchData = async () => {
     try {
       // Fetch Dropi indicators from view
       const { data: indicatorData, error: indicatorError } = await supabase
         .from("dropi_indicators")
         .select("*")
         .single();
 
       if (indicatorError) {
         console.error("Error fetching indicators:", indicatorError);
       } else {
         setIndicators(indicatorData);
       }
 
       // Fetch liquidation-ready orders (Entregado or Liquidado with recaudo)
       const { data: pedidosData, error: pedidosError } = await supabase
         .from("pedidos")
         .select(`
           id,
           numero_guia,
           estado,
           valor_recaudar,
           valor_flete,
           valor_producto,
           utilidad,
           sla_cumplido,
           dias_en_transito,
           fecha_cierre_logistico,
           cliente_nombre,
           municipio,
           client_user_id
         `)
         .in("estado", ["Entregado", "Liquidado"])
         .gt("valor_recaudar", 0)
         .order("fecha_cierre_logistico", { ascending: false })
         .limit(200);
 
       if (pedidosError) {
         console.error("Error fetching pedidos:", pedidosError);
       } else {
         setPedidos(pedidosData || []);
       }
     } catch (error) {
       console.error("Error:", error);
       toast.error("Error al cargar datos de liquidación");
     } finally {
       setLoading(false);
       setRefreshing(false);
     }
   };
 
   useEffect(() => {
     fetchData();
   }, []);
 
   const handleRefresh = () => {
     setRefreshing(true);
     fetchData();
   };
 
   // Calculate totals
   const totalRecaudo = pedidos.reduce((sum, p) => sum + (p.valor_recaudar || 0), 0);
   const totalFletes = pedidos.reduce((sum, p) => sum + (p.valor_flete || 0), 0);
   const saldoNeto = totalRecaudo - totalFletes;
 
   if (loading) {
     return (
       <div className="flex items-center justify-center py-12">
         <Loader2 className="h-8 w-8 animate-spin text-primary" />
       </div>
     );
   }
 
   return (
     <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
       {/* Header */}
       <div className="flex items-center justify-between">
         <div>
           <h2 className="text-xl font-bold text-foreground">Liquidación Dropi</h2>
           <p className="text-sm text-muted-foreground">
             Cruce de guías con recaudo vs fletes para reporte a Dropi
           </p>
         </div>
         <Button
           variant="outline"
           size="sm"
           onClick={handleRefresh}
           disabled={refreshing}
         >
           <RefreshCw className={`h-4 w-4 mr-2 ${refreshing ? "animate-spin" : ""}`} />
           Actualizar
         </Button>
       </div>
 
       {/* KPI Cards */}
       {indicators && (
         <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
           <Card className="bg-gradient-to-br from-blue-500 to-blue-600 text-white border-0">
             <CardHeader className="pb-2">
               <CardTitle className="text-sm font-medium flex items-center gap-2 opacity-90">
                 <Package className="h-4 w-4" />
                 Guías Movilizadas
               </CardTitle>
             </CardHeader>
             <CardContent>
               <p className="text-2xl font-bold">{indicators.guias_movilizadas}</p>
               <p className="text-xs opacity-75">
                 {indicators.porcentaje_entregas?.toFixed(1)}% entregadas
               </p>
             </CardContent>
           </Card>
 
           <Card className="bg-gradient-to-br from-green-500 to-green-600 text-white border-0">
             <CardHeader className="pb-2">
               <CardTitle className="text-sm font-medium flex items-center gap-2 opacity-90">
                 <CheckCircle2 className="h-4 w-4" />
                 Entregas en SLA
               </CardTitle>
             </CardHeader>
             <CardContent>
               <p className="text-2xl font-bold">{indicators.entregas_en_sla}</p>
               <p className="text-xs opacity-75">
                 {indicators.porcentaje_sla_cumplido?.toFixed(1)}% cumplimiento
               </p>
             </CardContent>
           </Card>
 
           <Card className="bg-gradient-to-br from-orange-500 to-orange-600 text-white border-0">
             <CardHeader className="pb-2">
               <CardTitle className="text-sm font-medium flex items-center gap-2 opacity-90">
                 <AlertTriangle className="h-4 w-4" />
                 Novedades
               </CardTitle>
             </CardHeader>
             <CardContent>
               <p className="text-2xl font-bold">{indicators.guias_con_novedad}</p>
               <p className="text-xs opacity-75">
                 {indicators.novedades_automaticas} auto / {indicators.novedades_manuales} manual
               </p>
             </CardContent>
           </Card>
 
           <Card className="bg-gradient-to-br from-purple-500 to-purple-600 text-white border-0">
             <CardHeader className="pb-2">
               <CardTitle className="text-sm font-medium flex items-center gap-2 opacity-90">
                 <Clock className="h-4 w-4" />
                 Días Promedio
               </CardTitle>
             </CardHeader>
             <CardContent>
               <p className="text-2xl font-bold">{indicators.promedio_dias_transito || "—"}</p>
               <p className="text-xs opacity-75">tiempo en tránsito</p>
             </CardContent>
           </Card>
         </div>
       )}
 
       {/* Financial Summary */}
       <div className="grid grid-cols-3 gap-4">
         <Card className="border-blue-200 bg-blue-50 dark:bg-blue-950/20">
           <CardContent className="pt-4">
             <div className="flex items-center gap-2 text-blue-600 dark:text-blue-400 mb-1">
               <DollarSign className="h-4 w-4" />
               <span className="text-sm font-medium">Total Recaudo</span>
             </div>
             <p className="text-2xl font-bold text-blue-700 dark:text-blue-300">
               ${totalRecaudo.toLocaleString("es-CO")}
             </p>
           </CardContent>
         </Card>
 
         <Card className="border-orange-200 bg-orange-50 dark:bg-orange-950/20">
           <CardContent className="pt-4">
             <div className="flex items-center gap-2 text-orange-600 dark:text-orange-400 mb-1">
               <Truck className="h-4 w-4" />
               <span className="text-sm font-medium">Total Fletes</span>
             </div>
             <p className="text-2xl font-bold text-orange-700 dark:text-orange-300">
               ${totalFletes.toLocaleString("es-CO")}
             </p>
           </CardContent>
         </Card>
 
         <Card className="border-green-200 bg-green-50 dark:bg-green-950/20">
           <CardContent className="pt-4">
             <div className="flex items-center gap-2 text-green-600 dark:text-green-400 mb-1">
               <TrendingUp className="h-4 w-4" />
               <span className="text-sm font-medium">Saldo Neto</span>
             </div>
             <p className="text-2xl font-bold text-green-700 dark:text-green-300">
               ${saldoNeto.toLocaleString("es-CO")}
             </p>
           </CardContent>
         </Card>
       </div>
 
       {/* Orders Table */}
       <Card>
         <CardHeader className="pb-2">
           <CardTitle className="text-lg flex items-center justify-between">
             <span>Guías con Recaudo ({totalItems})</span>
           </CardTitle>
         </CardHeader>
         <CardContent>
           {pedidos.length === 0 ? (
             <div className="text-center py-8 text-muted-foreground">
               <Package className="h-12 w-12 mx-auto mb-3 opacity-30" />
               <p>No hay guías con recaudo pendiente</p>
             </div>
           ) : (
             <>
               <div className="overflow-x-auto">
                 <Table>
                   <TableHeader>
                     <TableRow className="bg-muted/50">
                       <TableHead>Guía</TableHead>
                       <TableHead>Estado</TableHead>
                       <TableHead>Municipio</TableHead>
                       <TableHead className="text-right">Recaudo</TableHead>
                       <TableHead className="text-right">Flete</TableHead>
                       <TableHead className="text-right">Neto</TableHead>
                       <TableHead className="text-center">SLA</TableHead>
                       <TableHead className="text-center">Días</TableHead>
                     </TableRow>
                   </TableHeader>
                   <TableBody>
                     {paginatedItems.map((pedido) => (
                       <TableRow key={pedido.id} className="hover:bg-muted/30">
                         <TableCell className="font-mono text-sm">
                           {pedido.numero_guia || `#${pedido.id}`}
                         </TableCell>
                         <TableCell>
                           <span
                             className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${
                               pedido.estado === "Entregado"
                                 ? "bg-green-100 text-green-700"
                                 : "bg-teal-100 text-teal-700"
                             }`}
                           >
                             {pedido.estado}
                           </span>
                         </TableCell>
                         <TableCell className="text-sm">{pedido.municipio || "—"}</TableCell>
                         <TableCell className="text-right font-medium">
                           ${(pedido.valor_recaudar || 0).toLocaleString("es-CO")}
                         </TableCell>
                         <TableCell className="text-right text-orange-600">
                           ${(pedido.valor_flete || 0).toLocaleString("es-CO")}
                         </TableCell>
                         <TableCell className="text-right font-bold text-green-600">
                           ${((pedido.valor_recaudar || 0) - (pedido.valor_flete || 0)).toLocaleString("es-CO")}
                         </TableCell>
                         <TableCell className="text-center">
                           {pedido.sla_cumplido === true ? (
                             <CheckCircle2 className="h-4 w-4 text-green-500 mx-auto" />
                           ) : pedido.sla_cumplido === false ? (
                             <AlertTriangle className="h-4 w-4 text-orange-500 mx-auto" />
                           ) : (
                             <span className="text-muted-foreground">—</span>
                           )}
                         </TableCell>
                         <TableCell className="text-center">
                           {pedido.dias_en_transito || "—"}
                         </TableCell>
                       </TableRow>
                     ))}
                   </TableBody>
                 </Table>
               </div>
 
               {totalPages > 1 && (
                 <div className="mt-4">
                   <PaginationControls
                     currentPage={currentPage}
                     totalPages={totalPages}
                     startIndex={startIndex}
                     endIndex={endIndex}
                     totalItems={totalItems}
                     itemsPerPage={itemsPerPage}
                     onPageChange={goToPage}
                     onItemsPerPageChange={setItemsPerPage}
                   />
                 </div>
               )}
             </>
           )}
         </CardContent>
       </Card>
     </motion.div>
   );
 };
 
 export default DropiLiquidacionPanel;