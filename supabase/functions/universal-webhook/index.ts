 import { createClient } from "https://esm.sh/@supabase/supabase-js@2?target=deno";
 
 const corsHeaders = {
   "Access-Control-Allow-Origin": "*",
   "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-api-key, x-platform",
 };
 
 // Tariff configuration
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
 
 // Schema mapping for different platforms
 interface NormalizedOrder {
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
   indicador_trayecto?: string;
   external_guia_id?: string;
 }
 
 interface DropiPayload {
   nombre_cliente?: string;
   customer_name?: string;
   telefono?: string;
   phone?: string;
   direccion?: string;
   address?: string;
   ciudad?: string;
   city?: string;
   barrio?: string;
   neighborhood?: string;
   producto?: string;
   product?: string;
   sku?: string;
   valor?: number;
   price?: number;
   valor_recaudo?: number;
   cod_amount?: number;
   metodo_pago?: string;
   payment_method?: string;
   notas?: string;
   notes?: string;
   lat?: number;
   lng?: number;
   guia_id?: string;
   order_id?: string;
 }
 
 interface MastershopPayload {
   customerName?: string;
   customer?: { name?: string; phone?: string; address?: string };
   phone?: string;
   shippingAddress?: string;
   city?: string;
   district?: string;
   items?: Array<{ name?: string; sku?: string; price?: number; quantity?: number }>;
   productName?: string;
   totalAmount?: number;
   codAmount?: number;
   paymentType?: string;
   comments?: string;
   coordinates?: { lat?: number; lng?: number };
   orderId?: string;
   trackingNumber?: string;
 }
 
 function detectPlatform(payload: Record<string, unknown>): "dropi" | "mastershop" | "unknown" {
   // Dropi indicators
   if (payload.nombre_cliente || payload.valor_recaudo || payload.guia_id) {
     return "dropi";
   }
   // Mastershop indicators
   if (payload.customerName || payload.customer || payload.shippingAddress || payload.items) {
     return "mastershop";
   }
   // Check for common field names
   if (payload.customer_name || payload.cod_amount) {
     return "dropi";
   }
   if (payload.codAmount || payload.paymentType) {
     return "mastershop";
   }
   return "unknown";
 }
 
 function normalizeDropiPayload(payload: DropiPayload): NormalizedOrder {
   return {
     cliente_nombre: payload.nombre_cliente || payload.customer_name || "Sin nombre",
     client_phone: payload.telefono || payload.phone || "",
     direccion_entrega: payload.direccion || payload.address || "",
     municipio: payload.ciudad || payload.city || "Bogotá",
     barrio: payload.barrio || payload.neighborhood,
     producto_nombre: payload.producto || payload.product || payload.sku || "Producto",
     valor_producto: payload.valor || payload.price || 0,
     valor_recaudar: payload.valor_recaudo || payload.cod_amount,
     metodo_pago: payload.metodo_pago || payload.payment_method || "contra_entrega",
     observaciones: payload.notas || payload.notes,
     latitud: payload.lat,
     longitud: payload.lng,
     external_guia_id: payload.guia_id || payload.order_id,
   };
 }
 
 function normalizeMastershopPayload(payload: MastershopPayload): NormalizedOrder {
   const customerName = payload.customerName || payload.customer?.name || "Sin nombre";
   const phone = payload.phone || payload.customer?.phone || "";
   const address = payload.shippingAddress || payload.customer?.address || "";
   
   // Extract product info from items array or direct fields
   let productName = payload.productName || "Producto";
   let productValue = payload.totalAmount || 0;
   if (payload.items && payload.items.length > 0) {
     productName = payload.items.map(i => i.name || i.sku).join(", ");
     productValue = payload.items.reduce((sum, i) => sum + (i.price || 0) * (i.quantity || 1), 0);
   }
 
   return {
     cliente_nombre: customerName,
     client_phone: phone,
     direccion_entrega: address,
     municipio: payload.city || "Bogotá",
     barrio: payload.district,
     producto_nombre: productName,
     valor_producto: productValue,
     valor_recaudar: payload.codAmount,
     metodo_pago: payload.paymentType === "COD" ? "contra_entrega" : "anticipado",
     observaciones: payload.comments,
     latitud: payload.coordinates?.lat,
     longitud: payload.coordinates?.lng,
     external_guia_id: payload.orderId || payload.trackingNumber,
   };
 }
 
 async function hashApiKey(key: string): Promise<string> {
   const encoder = new TextEncoder();
   const data = encoder.encode(key);
   const hashBuffer = await crypto.subtle.digest("SHA-256", data);
   const hashArray = Array.from(new Uint8Array(hashBuffer));
   return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
 }
 
 function generateGuiaNumber(): string {
   const timestamp = Date.now().toString(36).toUpperCase();
   const random = Math.random().toString(36).substring(2, 6).toUpperCase();
   return `KP${timestamp}${random}`;
 }
 
 Deno.serve(async (req) => {
   if (req.method === "OPTIONS") {
     return new Response(null, { headers: corsHeaders });
   }
 
   const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
   const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
   const supabase = createClient(supabaseUrl, supabaseServiceKey);
 
   try {
     // Validate API Key
     const apiKey = req.headers.get("x-api-key");
     if (!apiKey) {
       console.error("[Webhook] Missing API key");
       return new Response(
         JSON.stringify({ error: "API key is required", code: "MISSING_API_KEY" }),
         { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
       );
     }
 
     // Verify API key
     const keyHash = await hashApiKey(apiKey);
     const { data: credential, error: credError } = await supabase
       .from("api_credentials")
       .select("id, client_user_id, is_active, label")
       .eq("api_key_hash", keyHash)
       .maybeSingle();
 
     if (credError || !credential) {
       console.error("[Webhook] Invalid API key");
       return new Response(
         JSON.stringify({ error: "Invalid API key", code: "INVALID_API_KEY" }),
         { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
       );
     }
 
     if (!credential.is_active) {
       return new Response(
         JSON.stringify({ error: "API key is inactive", code: "INACTIVE_API_KEY" }),
         { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
       );
     }
 
     // Parse payload
     let rawPayload: Record<string, unknown>;
     try {
       rawPayload = await req.json();
     } catch {
       return new Response(
         JSON.stringify({ error: "Invalid JSON body", code: "INVALID_JSON" }),
         { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
       );
     }
 
     // Detect platform from header or payload structure
     const headerPlatform = req.headers.get("x-platform")?.toLowerCase();
     const detectedPlatform = headerPlatform === "dropi" || headerPlatform === "mastershop" 
       ? headerPlatform 
       : detectPlatform(rawPayload);
 
     console.log(`[Webhook] Platform detected: ${detectedPlatform}`);
 
     // Normalize payload based on platform
     let normalizedOrder: NormalizedOrder;
     if (detectedPlatform === "dropi") {
       normalizedOrder = normalizeDropiPayload(rawPayload as DropiPayload);
     } else if (detectedPlatform === "mastershop") {
       normalizedOrder = normalizeMastershopPayload(rawPayload as MastershopPayload);
     } else {
       // Try to extract common fields for unknown platforms
       normalizedOrder = {
         cliente_nombre: String(rawPayload.cliente_nombre || rawPayload.customer_name || rawPayload.name || "Sin nombre"),
         client_phone: String(rawPayload.client_phone || rawPayload.phone || rawPayload.telefono || ""),
         direccion_entrega: String(rawPayload.direccion_entrega || rawPayload.address || rawPayload.direccion || ""),
         municipio: String(rawPayload.municipio || rawPayload.city || rawPayload.ciudad || "Bogotá"),
         producto_nombre: String(rawPayload.producto_nombre || rawPayload.product || rawPayload.producto || "Producto"),
         valor_producto: Number(rawPayload.valor_producto || rawPayload.price || rawPayload.valor || 0),
         valor_recaudar: rawPayload.valor_recaudar != null ? Number(rawPayload.valor_recaudar) : undefined,
         external_guia_id: rawPayload.guia_id ? String(rawPayload.guia_id) : undefined,
       };
     }
 
     // Validate required fields
     if (!normalizedOrder.cliente_nombre || !normalizedOrder.direccion_entrega || !normalizedOrder.municipio) {
       await supabase.from("api_logs").insert({
         credential_id: credential.id,
         platform: detectedPlatform,
         action: "create_order",
         request_payload: rawPayload,
         response_status: 400,
         response_message: "Missing required fields",
         success: false,
       });
 
       return new Response(
         JSON.stringify({ error: "Missing required fields: cliente_nombre, direccion_entrega, municipio", code: "MISSING_FIELDS" }),
         { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
       );
     }
 
     // Check for duplicate guia (Indicator #49)
     if (normalizedOrder.external_guia_id) {
       const { data: existingOrder } = await supabase
         .from("pedidos")
         .select("id, numero_guia")
         .eq("dropi_guia_id", normalizedOrder.external_guia_id)
         .maybeSingle();
 
       if (existingOrder) {
         console.log(`[Webhook] Duplicate guia detected: ${normalizedOrder.external_guia_id}`);
         
         await supabase.from("api_logs").insert({
           credential_id: credential.id,
           platform: detectedPlatform,
           action: "create_order",
           request_payload: rawPayload,
           response_status: 409,
           response_message: `Duplicate order: ${normalizedOrder.external_guia_id}`,
           success: false,
         });
 
         return new Response(
           JSON.stringify({ 
             error: "Order already exists", 
             code: "DUPLICATE_ORDER",
             existing_guia: existingOrder.numero_guia,
             existing_id: existingOrder.id
           }),
           { status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" } }
         );
       }
     }
 
     // Add to queue for background processing
     const { data: queueItem, error: queueError } = await supabase
       .from("api_queue")
       .insert({
         payload: {
           ...normalizedOrder,
           client_user_id: credential.client_user_id,
           api_credential_id: credential.id,
           api_label: credential.label,
           platform: detectedPlatform,
         },
         source: detectedPlatform,
         status: "pending",
         priority: 5,
       })
       .select("id")
       .single();
 
     if (queueError) {
       console.error("[Webhook] Queue error:", queueError);
       
       await supabase.from("api_logs").insert({
         credential_id: credential.id,
         platform: detectedPlatform,
         action: "create_order",
         request_payload: rawPayload,
         response_status: 500,
         response_message: "Failed to queue order",
         success: false,
       });
 
       return new Response(
         JSON.stringify({ error: "Failed to queue order", code: "QUEUE_ERROR" }),
         { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
       );
     }
 
     // Log successful queue
     await supabase.from("api_logs").insert({
       credential_id: credential.id,
       platform: detectedPlatform,
       action: "create_order",
       request_payload: rawPayload,
       response_status: 202,
       response_message: "Order queued successfully",
       success: true,
     });
 
     console.log(`[Webhook] Order queued: ${queueItem.id} from ${detectedPlatform}`);
 
     return new Response(
       JSON.stringify({
         success: true,
         queued: true,
         queue_id: queueItem.id,
         platform: detectedPlatform,
         message: "Pedido añadido a la cola de procesamiento"
       }),
       { status: 202, headers: { ...corsHeaders, "Content-Type": "application/json" } }
     );
 
   } catch (error) {
     console.error("[Webhook] Unexpected error:", error);
     return new Response(
       JSON.stringify({ error: "Internal server error", code: "INTERNAL_ERROR" }),
       { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
     );
   }
 });