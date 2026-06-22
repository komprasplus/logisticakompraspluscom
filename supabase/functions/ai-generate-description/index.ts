// Edge Function: ai-generate-description
// Genera una descripción markdown atractiva para un producto del catálogo.
// Usa Claude (haiku-4-5) con visión para incorporar detalles de las fotos.
// Requiere el secret ANTHROPIC_API_KEY en Supabase.

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

interface Body {
  product_name: string;
  category?: string | null;
  subcategory?: string | null;
  image_urls?: string[];
  brand?: string | null;
  store_name?: string | null;
  /** Pistas opcionales del proveedor: especificaciones técnicas, tono, etc. */
  hints?: string | null;
}

const SYSTEM = `Eres un copywriter experto en e-commerce LATAM, especializado en convertir productos en descripciones que venden. Escribes en español neutro/colombiano, claro, sin tecnicismos innecesarios, con tono cálido y profesional.

Devuelve la descripción en Markdown limpio (sin tags HTML). Estructura obligatoria:

## ¿Qué es?
Un párrafo corto (2-3 frases) que enganche y deje claro qué es el producto y para quién.

## Características principales
Lista con viñetas (4-6 puntos), cada uno con un **bold** breve seguido de una explicación corta.

## Ideal para
Lista con viñetas (3-4 puntos) de casos de uso concretos o perfiles de cliente.

## Detalles
2-3 líneas con tono cercano sobre material, calidad, garantía implícita.

NO uses emojis. NO repitas el nombre del producto en mayúsculas. NO inventes características que no puedas inferir razonablemente del nombre, la categoría y las imágenes. Sé honesto si no tienes información: usa lenguaje genérico pero realista en vez de inventar.`;

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
    if (!body.product_name?.trim()) {
      return new Response(
        JSON.stringify({ error: "product_name es obligatorio" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Construir el mensaje del usuario
    const contextLines: string[] = [
      `Producto: ${body.product_name.trim()}`,
    ];
    if (body.brand) contextLines.push(`Marca: ${body.brand}`);
    if (body.category) contextLines.push(`Categoría: ${body.category}`);
    if (body.subcategory) contextLines.push(`Subcategoría: ${body.subcategory}`);
    if (body.store_name) contextLines.push(`Tienda: ${body.store_name}`);
    if (body.hints) contextLines.push(`Pistas del vendedor: ${body.hints}`);

    const validImages = (body.image_urls ?? []).filter(Boolean).slice(0, 4);

    const userContent: Array<Record<string, unknown>> = [];
    for (const url of validImages) {
      userContent.push({
        type: "image",
        source: { type: "url", url },
      });
    }
    userContent.push({
      type: "text",
      text:
        contextLines.join("\n") +
        "\n\nGenera la descripción Markdown siguiendo la estructura del system prompt. Devuelve SOLO el markdown, sin preámbulo ni cierre.",
    });

    const resp = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: "claude-haiku-4-5",
        max_tokens: 1500,
        system: SYSTEM,
        messages: [{ role: "user", content: userContent }],
      }),
    });

    if (!resp.ok) {
      const errText = await resp.text();
      console.error("Anthropic API error:", resp.status, errText);
      return new Response(
        JSON.stringify({ error: `Anthropic API: ${resp.status}` }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const payload = await resp.json();
    const markdown = (payload?.content ?? [])
      .filter((b: any) => b.type === "text")
      .map((b: any) => b.text)
      .join("\n")
      .trim();

    if (!markdown) {
      return new Response(
        JSON.stringify({ error: "Respuesta vacía del modelo" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    return new Response(
      JSON.stringify({ ok: true, markdown }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    console.error("ai-generate-description error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "unknown" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
