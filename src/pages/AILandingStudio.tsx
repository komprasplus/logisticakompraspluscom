import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { Sparkles, ArrowLeft, Loader2, Check, Brain, PenTool, ImageIcon, LayoutTemplate } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import LandingPreview, { LandingPreviewData } from "@/components/ai-landing/LandingPreview";
import { formatCOP } from "@/lib/tarifas";

interface ProductInfo {
  id: string;
  product_name: string;
  description?: string | null;
  suggested_price?: number | null;
  cost_price?: number | null;
  category?: string | null;
  image_url?: string | null;
}

const STEPS = [
  { id: 1, label: "Analizando psicología del producto", icon: Brain },
  { id: 2, label: "Redactando copys persuasivos", icon: PenTool },
  { id: 3, label: "Generando fondos hiperrealistas", icon: ImageIcon },
  { id: 4, label: "Ensamblando Landing", icon: LayoutTemplate },
];

// Mock data — replaced by real Edge Function output in Phase 2
const buildMockLanding = (p: ProductInfo): LandingPreviewData => ({
  headline: `Transforma tu día con ${p.product_name}`,
  subheadline:
    "El secreto que miles de colombianos ya descubrieron. Resultados visibles desde la primera semana.",
  bullet_points: [
    "Resultados comprobados en menos de 7 días",
    "Material premium, diseñado para durar años",
    "Envío contra entrega a toda Colombia 🇨🇴",
  ],
  call_to_action: "Lo Quiero Ya",
  hero_bg_url:
    "https://images.unsplash.com/photo-1542838132-92c53300491e?w=1600&q=80&auto=format&fit=crop",
  scene_bg_url:
    "https://images.unsplash.com/photo-1441986300917-64674bd600d8?w=1600&q=80&auto=format&fit=crop",
  product_image_url:
    p.image_url ||
    "https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=800&q=80&auto=format&fit=crop",
  price_label: p.suggested_price ? formatCOP(p.suggested_price) : undefined,
});

export default function AILandingStudio() {
  const { productId } = useParams<{ productId: string }>();
  const navigate = useNavigate();
  const [product, setProduct] = useState<ProductInfo | null>(null);
  const [loadingProduct, setLoadingProduct] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);
  const [landing, setLanding] = useState<LandingPreviewData | null>(null);

  useEffect(() => {
    const load = async () => {
      if (!productId) return;
      setLoadingProduct(true);
      const { data, error } = await supabase
        .from("marketplace_products")
        .select("id, product_name, description, suggested_price, cost_price, category, image_url")
        .eq("id", productId)
        .maybeSingle();
      if (error) {
        toast.error("No se pudo cargar el producto");
      } else if (data) {
        setProduct(data as ProductInfo);
      }
      setLoadingProduct(false);
    };
    load();
  }, [productId]);

  const handleGenerate = async () => {
    if (!product) return;
    setGenerating(true);
    setLanding(null);
    setCurrentStep(0);

    // Simulated stepper while we wire the real edge function
    for (let i = 0; i < STEPS.length; i++) {
      setCurrentStep(i + 1);
      await new Promise((r) => setTimeout(r, 1100));
    }

    setLanding(buildMockLanding(product));
    setGenerating(false);
    toast.success("✨ Landing dopamínica lista (vista previa)");
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/30">
      {/* Header */}
      <header className="sticky top-0 z-30 border-b border-border bg-background/80 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
          <button
            onClick={() => navigate(-1)}
            className="flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" /> Volver
          </button>
          <div className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            <span className="font-black tracking-tight">AI Landing Studio</span>
            <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-bold uppercase text-primary">
              Beta
            </span>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-6 py-10">
        {/* Product card */}
        <section className="grid grid-cols-1 gap-8 md:grid-cols-[320px_1fr]">
          <div className="rounded-[20px] border border-border bg-card p-6 shadow-lg">
            {loadingProduct ? (
              <Skeleton className="h-64 w-full rounded-2xl" />
            ) : product ? (
              <>
                <div className="mb-4 aspect-square w-full overflow-hidden rounded-2xl bg-muted">
                  {product.image_url ? (
                    <img
                      src={product.image_url}
                      alt={product.product_name}
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <div className="flex h-full items-center justify-center text-muted-foreground">
                      Sin imagen
                    </div>
                  )}
                </div>
                <h2 className="text-lg font-bold">{product.product_name}</h2>
                {product.category && (
                  <p className="mt-1 text-xs uppercase tracking-wider text-muted-foreground">
                    {product.category}
                  </p>
                )}
                {product.description && (
                  <p className="mt-3 line-clamp-3 text-sm text-muted-foreground">
                    {product.description}
                  </p>
                )}
                {product.suggested_price != null && (
                  <div className="mt-4 flex items-baseline gap-2">
                    <span className="text-2xl font-black text-primary">
                      {formatCOP(product.suggested_price)}
                    </span>
                    <span className="text-xs text-muted-foreground">sugerido</span>
                  </div>
                )}
              </>
            ) : (
              <p className="text-sm text-muted-foreground">Producto no encontrado.</p>
            )}
          </div>

          {/* Magic action panel */}
          <div className="relative overflow-hidden rounded-[20px] border border-primary/30 bg-gradient-to-br from-primary/5 via-background to-background p-8 shadow-lg">
            <div className="absolute -right-20 -top-20 h-64 w-64 rounded-full bg-primary/20 blur-3xl" />
            <div className="absolute -bottom-20 -left-20 h-64 w-64 rounded-full bg-fuchsia-500/20 blur-3xl" />

            <div className="relative">
              <h1 className="text-3xl font-black tracking-tight md:text-4xl">
                Crea una landing que <span className="text-primary">vende sola</span>.
              </h1>
              <p className="mt-3 max-w-xl text-muted-foreground">
                Nuestro motor Ecom-Magic orquesta IA de texto y de imagen para ensamblar una landing
                de alta conversión a partir de tu producto. Un clic. Listo para vender.
              </p>

              <button
                onClick={handleGenerate}
                disabled={generating || !product}
                className="group relative mt-8 inline-flex items-center gap-3 overflow-hidden rounded-full bg-gradient-to-r from-primary via-fuchsia-500 to-primary bg-[length:200%_100%] px-10 py-5 text-lg font-black uppercase tracking-wider text-primary-foreground shadow-[0_10px_40px_-10px_hsl(var(--primary)/0.6)] transition-all hover:scale-[1.02] hover:bg-[position:100%_0] disabled:cursor-not-allowed disabled:opacity-60"
              >
                {generating ? (
                  <Loader2 className="h-6 w-6 animate-spin" />
                ) : (
                  <Sparkles className="h-6 w-6 drop-shadow" />
                )}
                <span>{generating ? "Generando…" : "Generar Landing Dopamínica"}</span>
                <span className="pointer-events-none absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/30 to-transparent transition-transform duration-700 group-hover:translate-x-full" />
              </button>

              {/* Stepper */}
              <AnimatePresence>
                {generating && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    exit={{ opacity: 0, height: 0 }}
                    className="mt-8 space-y-3"
                  >
                    {STEPS.map((s, i) => {
                      const done = currentStep > s.id;
                      const active = currentStep === s.id;
                      const Icon = s.icon;
                      return (
                        <motion.div
                          key={s.id}
                          initial={{ opacity: 0, x: -20 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: i * 0.08 }}
                          className={`flex items-center gap-3 rounded-xl border p-3 transition-colors ${
                            done
                              ? "border-emerald-500/40 bg-emerald-500/5"
                              : active
                              ? "border-primary/50 bg-primary/5"
                              : "border-border bg-muted/30"
                          }`}
                        >
                          <div
                            className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${
                              done
                                ? "bg-emerald-500 text-white"
                                : active
                                ? "bg-primary text-primary-foreground"
                                : "bg-muted text-muted-foreground"
                            }`}
                          >
                            {done ? (
                              <Check className="h-4 w-4" />
                            ) : active ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <Icon className="h-4 w-4" />
                            )}
                          </div>
                          <span
                            className={`text-sm font-semibold ${
                              done || active ? "text-foreground" : "text-muted-foreground"
                            }`}
                          >
                            {s.id}. {s.label}…
                          </span>
                        </motion.div>
                      );
                    })}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
        </section>

        {/* Preview */}
        <section className="mt-12">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="text-xl font-bold">Vista previa de la landing</h3>
            {landing && (
              <Button variant="outline" size="sm" onClick={handleGenerate}>
                <Sparkles className="mr-2 h-4 w-4" /> Regenerar
              </Button>
            )}
          </div>

          {landing ? (
            <LandingPreview data={landing} />
          ) : product ? (
            // Show static mock so the user can approve the design before APIs are wired
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">
                Diseño base con datos de ejemplo (aprueba este look antes de conectar OpenAI/Gemini + Fal.ai).
              </p>
              <LandingPreview data={buildMockLanding(product)} />
            </div>
          ) : (
            <Skeleton className="h-[600px] w-full rounded-[24px]" />
          )}
        </section>
      </main>
    </div>
  );
}
