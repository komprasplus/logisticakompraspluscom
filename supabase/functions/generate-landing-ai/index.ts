// Edge Function: generate-landing-ai
// Generates landing-page sections (hero, benefits, faq, testimonials, beforeAfter)
// for a given product via Lovable AI Gateway with structured tool-calling output.

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

type Section =
  | "hero"
  | "benefits"
  | "testimonials"
  | "faq"
  | "beforeAfter";

interface Body {
  product: {
    name: string;
    description?: string | null;
    suggested_price?: number | null;
    cost_price?: number | null;
    category?: string | null;
  };
  sections: Section[];
}

const SCHEMA = {
  name: "generate_landing_sections",
  description: "Return persuasive landing-page section content in Spanish (Colombia) for a dropshipping product.",
  parameters: {
    type: "object",
    properties: {
      hero: {
        type: "object",
        properties: {
          headline: { type: "string", description: "Titular impactante (máx 70 chars)" },
          subheadline: { type: "string", description: "Subtítulo persuasivo (máx 130 chars)" },
          cta: { type: "string", description: "Texto del botón CTA (máx 25 chars)" },
          badge: { type: "string", description: "Etiqueta superior tipo 'OFERTA EXCLUSIVA' (máx 25 chars)" },
        },
        required: ["headline", "subheadline", "cta", "badge"],
        additionalProperties: false,
      },
      benefits: {
        type: "array",
        items: {
          type: "object",
          properties: {
            icon: { type: "string", enum: ["truck", "shield", "star", "heart", "zap", "check"] },
            title: { type: "string", description: "Título corto (máx 30 chars)" },
            description: { type: "string", description: "Descripción (máx 110 chars)" },
          },
          required: ["icon", "title", "description"],
          additionalProperties: false,
        },
        minItems: 4,
        maxItems: 4,
      },
      testimonials: {
        type: "array",
        items: {
          type: "object",
          properties: {
            name: { type: "string" },
            city: { type: "string", description: "Ciudad colombiana" },
            rating: { type: "number", minimum: 4, maximum: 5 },
            comment: { type: "string", description: "Testimonio realista (80-160 chars)" },
          },
          required: ["name", "city", "rating", "comment"],
          additionalProperties: false,
        },
        minItems: 3,
        maxItems: 3,
      },
      faq: {
        type: "array",
        items: {
          type: "object",
          properties: {
            question: { type: "string" },
            answer: { type: "string" },
          },
          required: ["question", "answer"],
          additionalProperties: false,
        },
        minItems: 4,
        maxItems: 5,
      },
      beforeAfter: {
        type: "object",
        properties: {
          beforeTitle: { type: "string", description: "Estado problema" },
          beforePoints: {
            type: "array",
            items: { type: "string" },
            minItems: 3,
            maxItems: 3,
          },
          afterTitle: { type: "string", description: "Estado solución" },
          afterPoints: {
            type: "array",
            items: { type: "string" },
            minItems: 3,
            maxItems: 3,
          },
        },
        required: ["beforeTitle", "beforePoints", "afterTitle", "afterPoints"],
        additionalProperties: false,
      },
    },
    additionalProperties: false,
  },
} as const;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      return new Response(
        JSON.stringify({ error: "LOVABLE_API_KEY no configurada" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const body = (await req.json()) as Body;
    const { product, sections } = body;

    if (!product?.name || !Array.isArray(sections) || sections.length === 0) {
      return new Response(
        JSON.stringify({ error: "Producto y secciones son requeridos" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const wanted = sections.join(", ");
    const systemPrompt = `Eres un copywriter experto en e-commerce y dropshipping para mercado colombiano. Generas copy persuasivo, emocional y orientado a conversión, en español neutro de Colombia. Usa un tono cercano, directo y confiable.`;

    const userPrompt = `Producto: "${product.name}"
Categoría: ${product.category || "General"}
Descripción: ${product.description || "Sin descripción"}
Precio venta sugerido: $${product.suggested_price?.toLocaleString("es-CO") || "N/A"} COP

Genera las siguientes secciones para una landing page de alta conversión: ${wanted}.

Reglas:
- Usa el nombre real del producto en el hero.
- En testimonios usa nombres y ciudades colombianas reales (Bogotá, Medellín, Cali, Barranquilla, Bucaramanga, Pereira).
- En FAQ resuelve dudas reales sobre envío contra entrega, garantía, devoluciones, tiempos en Colombia.
- En beneficios usa iconos del enum disponible (truck, shield, star, heart, zap, check).
- En "Antes/Después" describe el problema y la transformación que ofrece el producto.
- Solo retorna las secciones solicitadas.`;

    const response = await fetch(
      "https://ai.gateway.lovable.dev/v1/chat/completions",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-3-flash-preview",
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: userPrompt },
          ],
          tools: [{ type: "function", function: SCHEMA }],
          tool_choice: { type: "function", function: { name: SCHEMA.name } },
        }),
      },
    );

    if (response.status === 429) {
      return new Response(
        JSON.stringify({ error: "Límite de solicitudes alcanzado, intenta en unos segundos." }),
        { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }
    if (response.status === 402) {
      return new Response(
        JSON.stringify({ error: "Créditos de IA agotados. Recarga en Settings > Workspace > Usage." }),
        { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }
    if (!response.ok) {
      const t = await response.text();
      console.error("AI gateway error:", response.status, t);
      return new Response(
        JSON.stringify({ error: "Fallo en el motor de IA" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const data = await response.json();
    const toolCall = data?.choices?.[0]?.message?.tool_calls?.[0];
    if (!toolCall) {
      console.error("No tool_call in AI response:", JSON.stringify(data).slice(0, 500));
      return new Response(
        JSON.stringify({ error: "La IA no retornó datos estructurados" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    let parsed: Record<string, unknown> = {};
    try {
      parsed = JSON.parse(toolCall.function.arguments);
    } catch (e) {
      console.error("Parse error:", e);
      return new Response(
        JSON.stringify({ error: "Respuesta de IA inválida" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    return new Response(JSON.stringify({ success: true, content: parsed }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (e) {
    console.error("generate-landing-ai error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Error desconocido" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
