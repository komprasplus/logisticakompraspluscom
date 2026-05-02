import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
   "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-api-key, x-queue-mode, x-shopify-shop-domain, x-shopify-topic, x-shopify-hmac-sha256",
};

interface OrderPayload {
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
}

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
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Create Supabase client with service role for admin operations
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // ── Auth path 1: Shopify webhook (resolved via connected_stores) ──
    const shopDomain = req.headers.get("x-shopify-shop-domain");
    let credential: { id: string | null; client_user_id: string; is_active: boolean; label: string } | null = null;
    let isShopifyWebhook = false;

    if (shopDomain) {
      const normalized = shopDomain.toLowerCase().replace(/^https?:\/\//, "").replace(/\/+$/, "");
      const { data: resolved, error: resolveError } = await supabase.rpc("resolve_store_owner", {
        p_shop_domain: normalized,
      });
      if (resolveError) {
        console.error("resolve_store_owner error:", resolveError);
      }
      if (resolved && (resolved as Record<string, unknown>).found) {
        const r = resolved as Record<string, unknown>;
        credential = {
          id: null,
          client_user_id: r.user_id as string,
          is_active: true,
          label: (r.nombre_tienda as string) || "Shopify Store",
        };
        isShopifyWebhook = true;
        console.log("Shopify webhook resolved to user:", credential.client_user_id, "store:", r.nombre_tienda);
      } else {
        return new Response(
          JSON.stringify({ error: `Shopify store not connected: ${normalized}`, code: "STORE_NOT_LINKED" }),
          { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    // ── Auth path 2: API Key (unchanged) ──
    if (!credential) {
      const apiKey = req.headers.get("x-api-key");
      if (!apiKey) {
        console.error("Missing API key");
        return new Response(
          JSON.stringify({ error: "API key is required", code: "MISSING_API_KEY" }),
          { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const keyHash = await hashApiKey(apiKey);
      console.log("Looking up API key with hash prefix:", keyHash.substring(0, 10) + "...");

      const { data: credData, error: credError } = await supabase
        .from("api_credentials")
        .select("id, client_user_id, is_active, label")
        .eq("api_key_hash", keyHash)
        .maybeSingle();

      if (credError) {
        console.error("Error looking up credential:", credError);
        return new Response(
          JSON.stringify({ error: "Database error", code: "DB_ERROR" }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      if (!credData) {
        return new Response(
          JSON.stringify({ error: "Invalid API key", code: "INVALID_API_KEY" }),
          { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      if (!credData.is_active) {
        return new Response(
          JSON.stringify({ error: "API key is inactive", code: "INACTIVE_API_KEY" }),
          { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      credential = credData;
    }

    // --- Rate Limiting: 60 requests per minute per credential (skip for Shopify webhooks) ---
    if (credential.id) {
      const now = new Date();
      const windowStart = new Date(now.getFullYear(), now.getMonth(), now.getDate(), now.getHours(), now.getMinutes()).toISOString();

      const { data: rateData } = await supabase
        .from("api_rate_limits")
        .select("request_count")
        .eq("credential_id", credential.id)
        .eq("window_start", windowStart)
        .maybeSingle();

      const currentCount = rateData?.request_count || 0;
      if (currentCount >= 60) {
        console.warn("Rate limit exceeded for credential:", credential.id);
        return new Response(
          JSON.stringify({
            error: "Rate limit exceeded. Max 60 requests per minute.",
            code: "RATE_LIMIT",
            retry_after_seconds: 60 - now.getSeconds()
          }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      if (rateData) {
        await supabase
          .from("api_rate_limits")
          .update({ request_count: currentCount + 1 })
          .eq("credential_id", credential.id)
          .eq("window_start", windowStart);
      } else {
        await supabase
          .from("api_rate_limits")
          .insert({ credential_id: credential.id, window_start: windowStart, request_count: 1 });
      }
    }

    // Parse and validate order payload
    let orderPayload: OrderPayload;
    try {
      orderPayload = await req.json();
    } catch {
      return new Response(
        JSON.stringify({ error: "Invalid JSON body", code: "INVALID_JSON" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Validate required fields
    const requiredFields = ["cliente_nombre", "client_phone", "direccion_entrega", "municipio", "producto_nombre", "valor_producto"];
    const missingFields = requiredFields.filter((field) => !orderPayload[field as keyof OrderPayload]);
    
    if (missingFields.length > 0) {
      return new Response(
        JSON.stringify({ 
          error: `Missing required fields: ${missingFields.join(", ")}`, 
          code: "MISSING_FIELDS",
          missing: missingFields
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

     // Check if queue mode is requested (for high volume)
     const queueMode = req.headers.get("x-queue-mode") === "true";
 
     if (queueMode) {
       // Add to queue instead of processing directly (for high volume API calls)
       const { data: queueItem, error: queueError } = await supabase
         .from("api_queue")
         .insert({
           payload: {
             ...orderPayload,
             client_user_id: credential.client_user_id,
             api_credential_id: credential.id,
             api_label: credential.label,
           },
           source: "dropi",
           status: "pending",
           priority: 5,
         })
         .select("id")
         .single();
 
       if (queueError) {
         console.error("Error adding to queue:", queueError);
         return new Response(
           JSON.stringify({ error: "Failed to queue order", code: "QUEUE_ERROR" }),
           { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
         );
       }
 
       return new Response(
         JSON.stringify({
           success: true,
           queued: true,
           queue_id: queueItem.id,
           message: "Pedido añadido a la cola de procesamiento"
         }),
         { status: 202, headers: { ...corsHeaders, "Content-Type": "application/json" } }
       );
     }
 
    // Fetch the store's fulfillment rate from profile (admin-controlled)
    const { data: storeProfile, error: profileError } = await supabase
      .from("profiles")
      .select("fulfillment_rate")
      .eq("user_id", credential.client_user_id)
      .maybeSingle();

    if (profileError) {
      console.error("Error fetching store profile:", profileError);
    }

    // Use admin-configured fulfillment rate, default to 1900 if not set
    const fulfillmentCost = storeProfile?.fulfillment_rate ?? 1900;

    // Calculate freight based on municipality
    const valorFlete = TARIFAS[orderPayload.municipio] || 15000;
    const valorProducto = Number(orderPayload.valor_producto) || 0;
    const valorRecaudar = orderPayload.metodo_pago === "anticipado" 
      ? 0 
      : (orderPayload.valor_recaudar ?? valorProducto);
    const utilidad = valorProducto - valorFlete;

    // Generate guide number and get next ID
    const numeroGuia = generateGuiaNumber();
    
    // Get max ID for new order
    const { data: maxIdResult } = await supabase
      .from("pedidos")
      .select("id")
      .order("id", { ascending: false })
      .limit(1)
      .maybeSingle();
    
    const newId = (maxIdResult?.id || 0) + 1;

    // Create the order with admin-controlled fulfillment cost
    const { data: newOrder, error: insertError } = await supabase
      .from("pedidos")
      .insert({
        id: newId,
        client_user_id: credential.client_user_id,
        cliente_nombre: orderPayload.cliente_nombre,
        client_phone: orderPayload.client_phone,
        direccion_entrega: orderPayload.direccion_entrega,
        municipio: orderPayload.municipio,
        barrio: orderPayload.barrio || null,
        zona: orderPayload.municipio,
        producto_nombre: orderPayload.producto_nombre,
        valor_producto: valorProducto,
        valor_flete: valorFlete,
        valor_recaudar: valorRecaudar,
        utilidad: utilidad,
        metodo_pago: orderPayload.metodo_pago || "contra_entrega",
        observaciones: orderPayload.observaciones || `Pedido vía API: ${credential.label}`,
        latitud: orderPayload.latitud || null,
        longitud: orderPayload.longitud || null,
        fecha_entrega: orderPayload.fecha_entrega || new Date().toISOString().split("T")[0],
        estado: "pendiente",
        numero_guia: numeroGuia,
        intentos_entrega: 0,
        costo_devolucion: 0,
        devolucion_cobrada: false,
        guia_impresa: false,
        fulfillment_cost: fulfillmentCost, // Admin-controlled rate from store profile
         indicador_trayecto: orderPayload.indicador_trayecto || "Local",
         dropi_sync_status: "synced",
      })
      .select()
      .single();

    if (insertError) {
      console.error("Error creating order:", insertError);
      return new Response(
        JSON.stringify({ error: "Failed to create order", code: "INSERT_ERROR", details: insertError.message }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Update last_used_at for the API credential
    await supabase
      .from("api_credentials")
      .update({ last_used_at: new Date().toISOString() })
      .eq("id", credential.id);

    console.log("Order created successfully:", newOrder.id, numeroGuia);

    return new Response(
      JSON.stringify({
        success: true,
        order: {
          id: newOrder.id,
          numero_guia: newOrder.numero_guia,
          estado: newOrder.estado,
          valor_flete: valorFlete,
          valor_recaudar: valorRecaudar,
          fecha_entrega: newOrder.fecha_entrega,
          tracking_url: `https://logisticakompraspluscom.lovable.app/rastreo/${newOrder.numero_guia}`
        },
        message: "Pedido creado exitosamente"
      }),
      { status: 201, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("Unexpected error:", error);
    return new Response(
      JSON.stringify({ error: "Internal server error", code: "INTERNAL_ERROR" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
