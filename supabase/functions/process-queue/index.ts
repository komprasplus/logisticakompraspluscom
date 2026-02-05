 import { createClient } from "https://esm.sh/@supabase/supabase-js@2?target=deno";
 
 const corsHeaders = {
   "Access-Control-Allow-Origin": "*",
   "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
 };
 
 // Tariff configuration (same as receive-order)
 const TARIFAS: Record<string, number> = {
   "Bogotá": 12000,
   "Soacha": 15000,
   "Sibaté": 15000,
   "Chía": 18000,
   "Cota": 18000,
   "Funza": 18000,
   "Mosquera": 18000,
   "Madrid": 18000
 };
 
 interface QueueItem {
   id: string;
   payload: {
     cliente_nombre: string;
     client_phone: string;
     direccion_entrega: string;
     municipio: string;
     barrio?: string;
     producto_nombre: string;
     valor_producto: number;
     valor_recaudar?: number;
     metodo_pago?: string;
     observaciones?: string;
     latitud?: number;
     longitud?: number;
     fecha_entrega?: string;
     client_user_id: string;
     api_credential_id: string;
     api_label?: string;
     indicador_trayecto?: string;
   };
   source: string;
   status: string;
   attempts: number;
   max_attempts: number;
   priority: number;
 }
 
 function generateGuiaNumber(): string {
   const timestamp = Date.now().toString(36).toUpperCase();
   const random = Math.random().toString(36).substring(2, 6).toUpperCase();
   return `KP${timestamp}${random}`;
 }
 
 async function processQueueItem(
   // deno-lint-ignore no-explicit-any
   supabase: any,
   item: QueueItem
 ): Promise<{ success: boolean; orderId?: number; error?: string }> {
   const payload = item.payload;
   
   try {
     // Fetch the store's fulfillment rate
     const { data: storeProfile } = await supabase
       .from("profiles")
       .select("fulfillment_rate")
       .eq("user_id", payload.client_user_id)
       .maybeSingle();
 
     const fulfillmentCost = storeProfile?.fulfillment_rate ?? 1900;
     const valorFlete = TARIFAS[payload.municipio] || 15000;
     const valorProducto = Number(payload.valor_producto) || 0;
     const valorRecaudar = payload.metodo_pago === "anticipado" 
       ? 0 
       : (payload.valor_recaudar ?? valorProducto);
     const utilidad = valorProducto - valorFlete;
 
     const numeroGuia = generateGuiaNumber();
     
     // Get max ID
     const { data: maxIdResult } = await supabase
       .from("pedidos")
       .select("id")
       .order("id", { ascending: false })
       .limit(1)
       .maybeSingle();
     
     const newId = (maxIdResult?.id || 0) + 1;
 
     // Create the order with SLA fields
     const { data: newOrder, error: insertError } = await supabase
       .from("pedidos")
       .insert({
         id: newId,
         client_user_id: payload.client_user_id,
         cliente_nombre: payload.cliente_nombre,
         client_phone: payload.client_phone,
         direccion_entrega: payload.direccion_entrega,
         municipio: payload.municipio,
         barrio: payload.barrio || null,
         zona: payload.municipio,
         producto_nombre: payload.producto_nombre,
         valor_producto: valorProducto,
         valor_flete: valorFlete,
         valor_recaudar: valorRecaudar,
         utilidad: utilidad,
         metodo_pago: payload.metodo_pago || "contra_entrega",
         observaciones: payload.observaciones || `Pedido vía API: ${payload.api_label || "Dropi"}`,
         latitud: payload.latitud || null,
         longitud: payload.longitud || null,
         fecha_entrega: payload.fecha_entrega || new Date().toISOString().split("T")[0],
         estado: "pendiente",
         numero_guia: numeroGuia,
         intentos_entrega: 0,
         costo_devolucion: 0,
         devolucion_cobrada: false,
         guia_impresa: false,
         fulfillment_cost: fulfillmentCost,
         indicador_trayecto: payload.indicador_trayecto || "Local",
         dropi_sync_status: "synced",
       })
       .select("id")
       .single();
 
     if (insertError || !newOrder) {
       throw new Error(insertError?.message || "Failed to create order");
     }
 
     // Update API credential last_used_at
     if (payload.api_credential_id) {
       await supabase
         .from("api_credentials")
         .update({ last_used_at: new Date().toISOString() })
         .eq("id", payload.api_credential_id);
     }
 
     return { success: true, orderId: newOrder.id };
   } catch (error) {
     return { success: false, error: error instanceof Error ? error.message : "Unknown error" };
   }
 }
 
 Deno.serve(async (req) => {
   if (req.method === "OPTIONS") {
     return new Response(null, { headers: corsHeaders });
   }
 
   try {
     const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
     const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
     const supabase = createClient(supabaseUrl, supabaseServiceKey);
 
     // Parse batch size from request (default 10)
     let batchSize = 10;
     try {
       const body = await req.json();
       batchSize = body.batchSize || 10;
     } catch {
       // Use default if no body
     }
 
     console.log(`[Queue] Processing up to ${batchSize} items...`);
 
     // Fetch pending items ordered by priority and created_at
     const { data: queueItems, error: fetchError } = await supabase
       .from("api_queue")
       .select("*")
       .eq("status", "pending")
       .order("priority", { ascending: false })
       .order("created_at", { ascending: true })
       .limit(batchSize);
 
     if (fetchError) {
       console.error("[Queue] Fetch error:", fetchError);
       return new Response(
         JSON.stringify({ error: "Failed to fetch queue items" }),
         { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
       );
     }
 
     if (!queueItems || queueItems.length === 0) {
       console.log("[Queue] No pending items");
       return new Response(
         JSON.stringify({ processed: 0, message: "No pending items" }),
         { headers: { ...corsHeaders, "Content-Type": "application/json" } }
       );
     }
 
     console.log(`[Queue] Found ${queueItems.length} items to process`);
 
     const results = {
       processed: 0,
       successful: 0,
       failed: 0,
       orders: [] as number[],
     };
 
     for (const item of queueItems as QueueItem[]) {
       // Mark as processing
       await supabase
         .from("api_queue")
         .update({ status: "processing", attempts: item.attempts + 1 })
         .eq("id", item.id);
 
       const result = await processQueueItem(supabase, item);
       results.processed++;
 
       if (result.success && result.orderId) {
         results.successful++;
         results.orders.push(result.orderId);
         
         // Mark as completed
         await supabase
           .from("api_queue")
           .update({ status: "completed", processed_at: new Date().toISOString() })
           .eq("id", item.id);
         
         console.log(`[Queue] Order ${result.orderId} created successfully`);
       } else {
         results.failed++;
         
         // Check if max attempts reached
         const newStatus = item.attempts + 1 >= item.max_attempts ? "failed" : "pending";
         
         await supabase
           .from("api_queue")
           .update({ status: newStatus, error_message: result.error, processed_at: newStatus === "failed" ? new Date().toISOString() : null })
           .eq("id", item.id);
         
         console.error(`[Queue] Item ${item.id} failed: ${result.error}`);
       }
     }
 
     console.log(`[Queue] Completed: ${results.successful}/${results.processed}`);
 
     return new Response(
       JSON.stringify(results),
       { headers: { ...corsHeaders, "Content-Type": "application/json" } }
     );
 
   } catch (error) {
     console.error("[Queue] Unexpected error:", error);
     return new Response(
       JSON.stringify({ error: "Internal server error" }),
       { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
     );
   }
 });