// Dropium outbound sync — pushes orders to Dropium (Jamv Drive)
// Auth model: signed with x-logi-fleet-authorization (TOKEN) + x-logi-fleet-sign (SHA256 + Base64)
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const DROPIUM_BASE_URL = "https://api.dropium.softgenio.es";
const DROPIUM_BUSINESS_ID = 1; // Same Day

async function generateSignature(body: unknown, secret: string): Promise<string> {
  const jsonStr = JSON.stringify(body);
  const data = new TextEncoder().encode(jsonStr + secret);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  // Base64
  const bytes = new Uint8Array(hashBuffer);
  let binary = "";
  for (let i = 0; i < bytes.byteLength; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary);
}

function splitName(fullName: string | null | undefined): { first: string; last: string } {
  const parts = (fullName || "").trim().split(/\s+/);
  if (parts.length === 0 || !parts[0]) return { first: "Cliente", last: "" };
  if (parts.length === 1) return { first: parts[0], last: "" };
  return { first: parts[0], last: parts.slice(1).join(" ") };
}

function buildDropiumPayload(pedido: any, sender: { name: string; phone: string }) {
  const recipient = splitName(pedido.cliente_nombre);
  // Reference + referenceSecondary so the webhook can map back to our pedido by id
  return {
    autogenerateReference: false,
    reference: pedido.numero_guia || `PE-${pedido.id}`,
    referenceSecondary: String(pedido.id),
    businessId: DROPIUM_BUSINESS_ID,
    sender: {
      name: sender.name || "Plus Envíos",
      phone: sender.phone || "+573000000000",
    },
    recipient: {
      name: pedido.cliente_nombre || "Cliente",
      firstName: recipient.first,
      lastName: recipient.last,
      phone: pedido.client_phone || "+573000000000",
    },
    address: {
      street: pedido.direccion_entrega || "Sin dirección",
      city: pedido.municipio || "Bogotá",
      neighborhood: pedido.barrio || undefined,
      country: "CO",
      postalCode: "110111",
      latitude: pedido.latitud ?? undefined,
      longitude: pedido.longitud ?? undefined,
    },
    package: {
      description: pedido.producto_nombre || "Paquete",
      quantity: pedido.quantity || 1,
      declaredValue: Number(pedido.valor_producto || 0),
    },
    cod: {
      enabled: !!pedido.valor_recaudar && pedido.metodo_pago !== "Anticipado",
      amount: Number(pedido.valor_recaudar || 0),
      currency: "COP",
    },
    notes: pedido.observaciones || undefined,
    custom: {
      pedido_id: pedido.id,
      organizacion_id: pedido.organizacion_id,
      tipo_servicio: pedido.tipo_servicio,
    },
  };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const TOKEN = Deno.env.get("DROPIUM_TOKEN");
  const SECRET = Deno.env.get("DROPIUM_SECRET");
  if (!TOKEN || !SECRET) {
    return new Response(
      JSON.stringify({ error: "Dropium credentials not configured" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  let body: { pedido_id?: number };
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  if (!body.pedido_id) {
    return new Response(JSON.stringify({ error: "pedido_id is required" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // Fetch pedido + sender (organizacion)
  const { data: pedido, error: pedidoErr } = await supabase
    .from("pedidos")
    .select("*")
    .eq("id", body.pedido_id)
    .maybeSingle();

  if (pedidoErr || !pedido) {
    return new Response(
      JSON.stringify({ error: "Pedido no encontrado", detail: pedidoErr?.message }),
      { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }

  // Get sender info from the organizacion
  const { data: org } = await supabase
    .from("organizaciones")
    .select("nombre")
    .eq("id", pedido.organizacion_id)
    .maybeSingle();

  const sender = {
    name: org?.nombre || "Plus Envíos",
    phone: "+573000000000",
  };

  const payload = buildDropiumPayload(pedido, sender);

  let signature: string;
  try {
    signature = await generateSignature(payload, SECRET);
  } catch (e) {
    return new Response(
      JSON.stringify({ error: "Signature generation failed", detail: String(e) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }

  const url = `${DROPIUM_BASE_URL}/integrations/v2/orders?includeLabels=true`;
  let httpStatus = 0;
  let responseJson: any = null;
  let success = false;
  let errorMessage: string | null = null;

  try {
    const resp = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-logi-fleet-authorization": TOKEN,
        "x-logi-fleet-sign": signature,
      },
      body: JSON.stringify(payload),
    });
    httpStatus = resp.status;
    const text = await resp.text();
    try {
      responseJson = text ? JSON.parse(text) : null;
    } catch {
      responseJson = { raw: text };
    }
    success = resp.ok;
    if (!resp.ok) errorMessage = `HTTP ${resp.status}: ${text.slice(0, 500)}`;
  } catch (e) {
    errorMessage = `Network error: ${String(e)}`;
  }

  // Audit log
  await supabase.from("dropium_sync_logs").insert({
    pedido_id: pedido.id,
    numero_guia: pedido.numero_guia,
    action: "push_create",
    request_payload: payload,
    response_payload: responseJson,
    http_status: httpStatus,
    success,
    error_message: errorMessage,
    organizacion_id: pedido.organizacion_id,
  });

  // On success, mark pedido as synced and store dropium_guia_id if returned
  if (success) {
    const dropiumRef = responseJson?.reference || responseJson?.id;
    await supabase
      .from("pedidos")
      .update({
        integration_partner: "dropium",
        dropi_sync_status: "synced",
        dropi_guia_id: dropiumRef ? String(dropiumRef) : pedido.dropi_guia_id,
        fecha_actualizacion: new Date().toISOString(),
      })
      .eq("id", pedido.id);
  } else {
    await supabase
      .from("pedidos")
      .update({ dropi_sync_status: "error" })
      .eq("id", pedido.id);
  }

  return new Response(
    JSON.stringify({
      success,
      http_status: httpStatus,
      error: errorMessage,
      dropium_response: responseJson,
    }),
    {
      status: success ? 200 : 502,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    },
  );
});
