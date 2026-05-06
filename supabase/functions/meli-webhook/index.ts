// Mercado Libre Webhook receiver — logs payload and ACKs 200 immediately.
// IMPORTANT: ML expects a fast 200 OK; processing should be deferred.
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const url = new URL(req.url);
    const query = Object.fromEntries(url.searchParams.entries());
    let body: unknown = null;
    try {
      body = await req.json();
    } catch {
      try { body = await req.text(); } catch { body = null; }
    }
    console.log("[meli-webhook] incoming notification", {
      method: req.method,
      query,
      body,
      headers: {
        "user-agent": req.headers.get("user-agent"),
        "content-type": req.headers.get("content-type"),
      },
    });
  } catch (e) {
    console.error("[meli-webhook] log error:", e);
  }

  // Always ACK 200 OK so Mercado Libre stops retrying
  return new Response(null, { status: 200, headers: corsHeaders });
});
