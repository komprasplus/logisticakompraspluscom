import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-api-key",
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
    // Validate API Key
    const apiKey = req.headers.get("x-api-key");
    if (!apiKey) {
      console.error("Missing API key");
      return new Response(
        JSON.stringify({ error: "API key is required", code: "MISSING_API_KEY" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Create Supabase client with service role for admin operations
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Hash the provided API key and look it up
    const keyHash = await hashApiKey(apiKey);
    console.log("Looking up API key with hash prefix:", keyHash.substring(0, 10) + "...");

    const { data: credential, error: credError } = await supabase
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

    if (!credential) {
      console.error("Invalid API key - no matching credential found");
      return new Response(
        JSON.stringify({ error: "Invalid API key", code: "INVALID_API_KEY" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!credential.is_active) {
      console.error("API key is inactive:", credential.id);
      return new Response(
        JSON.stringify({ error: "API key is inactive", code: "INACTIVE_API_KEY" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
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

    // Create the order
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
        guia_impresa: false
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
