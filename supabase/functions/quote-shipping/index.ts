// Edge Function: quote-shipping
// Cotiza el flete sin crear pedido. Requiere x-api-key.
// Body: { municipio: string, peso?: number, valor_producto?: number }
// Response: { valor_flete, indicador_trayecto, tiempo_estimado_dias, currency, breakdown }

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-api-key",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

// Tarifa base por municipio (debe quedar sincronizada con receive-order).
// TODO: migrar a tabla tariff_zones cuando se priorice Fase 2.
const TARIFAS: Record<string, { valor: number; trayecto: "Local" | "Nacional"; dias: number }> = {
  "Bogotá":   { valor: 12000, trayecto: "Local",    dias: 1 },
  "Soacha":   { valor: 15000, trayecto: "Local",    dias: 1 },
  "Sibaté":   { valor: 15000, trayecto: "Local",    dias: 1 },
  "Chía":     { valor: 18000, trayecto: "Nacional", dias: 2 },
  "Cota":     { valor: 18000, trayecto: "Nacional", dias: 2 },
  "Funza":    { valor: 18000, trayecto: "Nacional", dias: 2 },
  "Mosquera": { valor: 18000, trayecto: "Nacional", dias: 2 },
  "Madrid":   { valor: 18000, trayecto: "Nacional", dias: 2 },
};

const TARIFA_NACIONAL_DEFAULT = { valor: 15000, trayecto: "Nacional" as const, dias: 3 };

async function hashApiKey(key: string): Promise<string> {
  const data = new TextEncoder().encode(key);
  const hash = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(hash)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const apiKey = req.headers.get("x-api-key");
    if (!apiKey) {
      return new Response(
        JSON.stringify({ error: "API key required", code: "MISSING_API_KEY" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const keyHash = await hashApiKey(apiKey);
    const { data: cred } = await supabase
      .from("api_credentials")
      .select("id, is_active")
      .eq("api_key_hash", keyHash)
      .maybeSingle();

    if (!cred || !cred.is_active) {
      return new Response(
        JSON.stringify({ error: "Invalid or inactive API key", code: "INVALID_API_KEY" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const body = await req.json();
    const municipio = String(body?.municipio || "").trim();
    const peso = Number(body?.peso) || null;
    const valorProducto = Number(body?.valor_producto) || null;

    if (!municipio) {
      return new Response(
        JSON.stringify({ error: "municipio is required", code: "MISSING_MUNICIPIO" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Buscar por municipio exacto, sino fallback a nacional default
    const tarifa = TARIFAS[municipio] || TARIFA_NACIONAL_DEFAULT;

    // Adicional por peso (>2kg = +$2000 por kg adicional)
    let pesoAdicional = 0;
    if (peso && peso > 2) {
      pesoAdicional = Math.ceil(peso - 2) * 2000;
    }

    // Adicional por seguro si valor_producto > $500.000 (1% del exceso)
    let seguroAdicional = 0;
    if (valorProducto && valorProducto > 500000) {
      seguroAdicional = Math.round((valorProducto - 500000) * 0.01);
    }

    const valorFlete = tarifa.valor + pesoAdicional + seguroAdicional;

    return new Response(
      JSON.stringify({
        ok: true,
        municipio,
        valor_flete: valorFlete,
        indicador_trayecto: tarifa.trayecto,
        tiempo_estimado_dias: tarifa.dias,
        currency: "COP",
        breakdown: {
          tarifa_base: tarifa.valor,
          peso_adicional: pesoAdicional,
          seguro_adicional: seguroAdicional,
        },
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    console.error("quote-shipping error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "unknown" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
