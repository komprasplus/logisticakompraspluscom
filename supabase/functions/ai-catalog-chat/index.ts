// Edge Function: ai-catalog-chat
// Asistente IA conversacional para el catálogo público (anon).

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

interface Body {
  slug: string;
  lista_slug?: string | null;
  codigo_acceso?: string | null;
  messages: ChatMessage[];
}

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;

const fetchCatalog = async (slug: string, listaSlug?: string | null, codigo?: string | null) => {
  const resp = await fetch(SUPABASE_URL + "/rest/v1/rpc/get_catalog_for_ai", {
    method: "POST",
    headers: {
      "apikey": SUPABASE_ANON_KEY,
      "authorization": "Bearer " + SUPABASE_ANON_KEY,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      p_slug: slug,
      p_lista_slug: listaSlug ?? null,
      p_codigo_acceso: codigo ?? null,
      p_limit: 200,
    }),
  });
  if (!resp.ok) throw new Error("get_catalog_for_ai: " + resp.status);
  return await resp.json();
};

const buildSystemPrompt = (catalog: any) => {
  const provider = catalog.provider ?? {};
  const products = (catalog.products ?? []) as any[];

  const productLines = products
    .map((p) => {
      const priceTxt = p.price ? "$" + Number(p.price).toLocaleString("es-CO") : "sin precio público";
      const catTxt = p.category ? " · " + p.category + (p.subcategory ? "/" + p.subcategory : "") : "";
      return "- [" + p.short_id + "] " + p.name + " — " + priceTxt + " · stock " + p.stock + catTxt;
    })
    .join("\n");

  const storeName = provider.store_name ?? "esta tienda";

  return [
    'Eres el asistente IA de la tienda "' + storeName + '" — vendes 24/7 a clientes que llegan a su catálogo público.',
    "",
    "Tu estilo: cálido, profesional, conciso (3-5 frases por respuesta salvo que pidan detalle). Español neutro/colombiano. Sin emojis salvo que el usuario los use primero.",
    "",
    "Tu misión:",
    "1. Ayudar a encontrar productos del catálogo según lo que el cliente describa.",
    "2. Responder dudas sobre precio, stock, características aparentes.",
    "3. Sugerir 1-3 productos concretos cuando tenga sentido.",
    "4. Si no hay el producto exacto, sugerir lo más parecido del catálogo. Nunca inventes productos que no estén en la lista.",
    "5. Si el cliente quiere hacer pedido: dile que use el botón '+ Agregar al carrito' en cada producto, y que al final podrá hacer checkout integrado con datos de envío.",
    "",
    "REGLAS CLAVE:",
    "- NUNCA inventes productos, precios, stock o tallas que no estén abajo.",
    "- Cuando sugieras productos específicos, usa SIEMPRE el formato '[REF: XXXXXX]' con el short_id (6 caracteres). El frontend lo convertirá en una card clicable. Ejemplo: 'Te recomiendo [REF: A3F2B1] que es perfecto para eso.'",
    "- Si el cliente pregunta por algo fuera del catálogo (envíos, garantías, formas de pago no listadas), dile que contacte directamente al asesor por WhatsApp.",
    "- No reveles datos internos del catálogo (organización, IDs UUID, etc.).",
    "",
    "CATÁLOGO ACTUAL DE " + String(storeName).toUpperCase() + ":",
    productLines || "(catálogo vacío)",
  ].join("\n");
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const apiKey = Deno.env.get("ANTHROPIC_API_KEY");
    if (!apiKey) {
      return new Response(
        JSON.stringify({ error: "ANTHROPIC_API_KEY no configurado en Supabase secrets" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const body = (await req.json()) as Body;
    if (!body.slug || !body.messages?.length) {
      return new Response(
        JSON.stringify({ error: "slug y messages son obligatorios" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const catalog = await fetchCatalog(body.slug, body.lista_slug, body.codigo_acceso);
    if (!catalog?.found) {
      return new Response(
        JSON.stringify({ error: "Catálogo no encontrado o requiere código de acceso" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const system = buildSystemPrompt(catalog);

    const trimmed = body.messages.slice(-12).map((m) => ({
      role: m.role,
      content: String(m.content ?? "").slice(0, 2000),
    }));

    const resp = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: "claude-haiku-4-5",
        max_tokens: 800,
        system,
        messages: trimmed,
      }),
    });

    if (!resp.ok) {
      const errText = await resp.text();
      console.error("Anthropic API error:", resp.status, errText);
      return new Response(
        JSON.stringify({ error: "Anthropic API: " + resp.status }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const payload = await resp.json();
    const text = (payload?.content ?? [])
      .filter((b: any) => b.type === "text")
      .map((b: any) => b.text)
      .join("\n")
      .trim();

    const refs = Array.from(text.matchAll(/\[REF:\s*([A-Z0-9]{6})\]/g)).map((m) => m[1]);
    const refMap = new Map<string, any>();
    for (const p of catalog.products ?? []) {
      refMap.set(String(p.short_id).toUpperCase(), p);
    }
    const suggestedProducts = refs
      .map((r) => refMap.get(r))
      .filter(Boolean)
      .map((p) => ({
        id: p.id,
        short_id: p.short_id,
        name: p.name,
        price: p.price,
        image_url: p.image_url,
        stock: p.stock,
      }));

    return new Response(
      JSON.stringify({ ok: true, text, suggested_products: suggestedProducts }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    console.error("ai-catalog-chat error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "unknown" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
