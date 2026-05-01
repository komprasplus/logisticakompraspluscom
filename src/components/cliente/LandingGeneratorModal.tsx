import { useRef, useState } from "react";
import { toPng } from "html-to-image";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Sparkles,
  Download,
  Truck,
  ShieldCheck,
  Star,
  Heart,
  Zap,
  Check,
  X,
  Loader2,
  Quote,
  HelpCircle,
  ArrowRight,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { formatCOP } from "@/lib/tarifas";

// ────────────────────────────────────────────────────────────
// Types
// ────────────────────────────────────────────────────────────
export interface LandingProduct {
  id: string;
  product_name: string;
  description?: string | null;
  suggested_price?: number | null;
  cost_price?: number | null;
  category?: string | null;
  image_url?: string | null;
}

type SectionKey = "hero" | "benefits" | "testimonials" | "faq" | "beforeAfter";

interface LandingContent {
  hero?: {
    headline: string;
    subheadline: string;
    cta: string;
    badge: string;
  };
  benefits?: Array<{
    icon: "truck" | "shield" | "star" | "heart" | "zap" | "check";
    title: string;
    description: string;
  }>;
  testimonials?: Array<{
    name: string;
    city: string;
    rating: number;
    comment: string;
  }>;
  faq?: Array<{ question: string; answer: string }>;
  beforeAfter?: {
    beforeTitle: string;
    beforePoints: string[];
    afterTitle: string;
    afterPoints: string[];
  };
}

const SECTION_OPTIONS: { key: SectionKey; label: string; emoji: string }[] = [
  { key: "hero", label: "Hero (Oferta Principal)", emoji: "🎯" },
  { key: "benefits", label: "Beneficios", emoji: "✅" },
  { key: "testimonials", label: "Testimonios", emoji: "💬" },
  { key: "faq", label: "Preguntas Frecuentes", emoji: "❓" },
  { key: "beforeAfter", label: "Antes / Después", emoji: "🔄" },
];

const LOADING_PHRASES = [
  "Analizando producto...",
  "Investigando mercado colombiano...",
  "Escribiendo copy persuasivo...",
  "Diseñando banners de alta conversión...",
  "Generando testimonios realistas...",
  "Optimizando para WhatsApp y redes...",
];

const ICON_MAP = {
  truck: Truck,
  shield: ShieldCheck,
  star: Star,
  heart: Heart,
  zap: Zap,
  check: Check,
} as const;

// ────────────────────────────────────────────────────────────
// Component
// ────────────────────────────────────────────────────────────
interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  product: LandingProduct | null;
}

export const LandingGeneratorModal = ({ open, onOpenChange, product }: Props) => {
  const [step, setStep] = useState<"select" | "loading" | "preview">("select");
  const [selected, setSelected] = useState<Record<SectionKey, boolean>>({
    hero: true,
    benefits: true,
    testimonials: true,
    faq: true,
    beforeAfter: true,
  });
  const [loadingPhraseIdx, setLoadingPhraseIdx] = useState(0);
  const [content, setContent] = useState<LandingContent | null>(null);
  const [downloadingKey, setDownloadingKey] = useState<string | null>(null);

  const sectionRefs = useRef<Record<string, HTMLDivElement | null>>({});

  const reset = () => {
    setStep("select");
    setContent(null);
    setLoadingPhraseIdx(0);
  };

  const handleClose = (next: boolean) => {
    if (!next) reset();
    onOpenChange(next);
  };

  const toggle = (key: SectionKey) =>
    setSelected((s) => ({ ...s, [key]: !s[key] }));

  const handleGenerate = async () => {
    if (!product) return;
    const sections = (Object.keys(selected) as SectionKey[]).filter((k) => selected[k]);
    if (sections.length === 0) {
      toast.error("Selecciona al menos una sección");
      return;
    }

    setStep("loading");
    setLoadingPhraseIdx(0);

    // Rotate loading phrases every 1.6s
    const phraseInterval = setInterval(() => {
      setLoadingPhraseIdx((i) => (i + 1) % LOADING_PHRASES.length);
    }, 1600);

    try {
      const { data, error } = await supabase.functions.invoke("generate-landing-ai", {
        body: {
          product: {
            name: product.product_name,
            description: product.description,
            suggested_price: product.suggested_price,
            cost_price: product.cost_price,
            category: product.category,
          },
          sections,
        },
      });

      clearInterval(phraseInterval);

      if (error) {
        // Detect rate-limit / payment errors
        const msg = (error as { message?: string })?.message ?? "";
        if (msg.includes("429")) {
          toast.error("Límite de solicitudes. Espera unos segundos.");
        } else if (msg.includes("402")) {
          toast.error("Créditos de IA agotados. Recarga en Workspace > Usage.");
        } else {
          toast.error("Error generando contenido: " + msg);
        }
        setStep("select");
        return;
      }

      if (!data?.success || !data?.content) {
        toast.error(data?.error || "La IA no devolvió contenido");
        setStep("select");
        return;
      }

      setContent(data.content as LandingContent);
      setStep("preview");
      toast.success("✨ Banners generados con éxito");
    } catch (e) {
      clearInterval(phraseInterval);
      console.error(e);
      toast.error("Error de red al contactar la IA");
      setStep("select");
    }
  };

  const handleDownloadSection = async (key: string) => {
    const node = sectionRefs.current[key];
    if (!node) {
      toast.error("No se pudo encontrar el banner");
      return;
    }
    setDownloadingKey(key);
    try {
      const dataUrl = await toPng(node, {
        cacheBust: true,
        pixelRatio: 2,
        backgroundColor: "#ffffff",
        // Skip CORS-failing images by inlining nothing — fallback handled by template
      });
      const link = document.createElement("a");
      const safeName = (product?.product_name ?? "producto")
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .slice(0, 40);
      link.download = `${safeName}-${key}.png`;
      link.href = dataUrl;
      link.click();
      toast.success("Banner descargado");
    } catch (e) {
      console.error(e);
      toast.error("No se pudo generar la imagen. Intenta de nuevo.");
    } finally {
      setDownloadingKey(null);
    }
  };

  const setRef = (key: string) => (el: HTMLDivElement | null) => {
    sectionRefs.current[key] = el;
  };

  if (!product) return null;

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-6xl w-[96vw] h-[92vh] p-0 gap-0 flex flex-col overflow-hidden">
        <DialogHeader className="p-5 border-b border-border/60 bg-gradient-to-r from-purple-50 via-fuchsia-50 to-pink-50 dark:from-purple-950/40 dark:via-fuchsia-950/30 dark:to-pink-950/30">
          <DialogTitle className="flex items-center gap-2 text-xl">
            <Sparkles className="h-5 w-5 text-fuchsia-600" />
            Generador de Landing con IA
            <Badge variant="secondary" className="ml-2 text-[10px]">
              {product.product_name}
            </Badge>
          </DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto">
          {/* ── STEP 1: SELECTION ───────────────────────────── */}
          {step === "select" && (
            <div className="p-6 sm:p-8 max-w-2xl mx-auto space-y-6">
              <div>
                <h3 className="text-lg font-bold text-foreground mb-1">
                  ¿Qué secciones quieres generar?
                </h3>
                <p className="text-sm text-muted-foreground">
                  Selecciona los bloques que necesitas para tu landing page o tienda.
                </p>
              </div>

              <div className="grid gap-3">
                {SECTION_OPTIONS.map((opt) => (
                  <label
                    key={opt.key}
                    className={cn(
                      "flex items-center gap-3 p-4 rounded-xl border-2 cursor-pointer transition-all",
                      selected[opt.key]
                        ? "border-fuchsia-500 bg-fuchsia-50 dark:bg-fuchsia-950/20"
                        : "border-border hover:border-muted-foreground/30",
                    )}
                  >
                    <Checkbox
                      checked={selected[opt.key]}
                      onCheckedChange={() => toggle(opt.key)}
                    />
                    <span className="text-2xl">{opt.emoji}</span>
                    <span className="font-semibold text-foreground flex-1">{opt.label}</span>
                  </label>
                ))}
              </div>

              <Button
                size="lg"
                className="w-full bg-gradient-to-r from-purple-600 via-fuchsia-600 to-pink-600 hover:from-purple-700 hover:via-fuchsia-700 hover:to-pink-700 text-white font-bold gap-2"
                onClick={handleGenerate}
              >
                <Sparkles className="h-5 w-5" />
                Generar Banners
              </Button>
            </div>
          )}

          {/* ── STEP 2: LOADING ─────────────────────────────── */}
          {step === "loading" && (
            <div className="flex flex-col items-center justify-center min-h-[60vh] p-8 gap-6">
              <div className="relative">
                <div className="absolute inset-0 bg-gradient-to-r from-purple-500 to-pink-500 blur-2xl opacity-50 animate-pulse" />
                <div className="relative h-24 w-24 rounded-full bg-gradient-to-br from-purple-600 to-pink-600 flex items-center justify-center">
                  <Sparkles className="h-12 w-12 text-white animate-pulse" />
                </div>
              </div>

              <div className="text-center space-y-2 max-w-md">
                <p className="text-lg font-bold text-foreground transition-opacity">
                  {LOADING_PHRASES[loadingPhraseIdx]}
                </p>
                <p className="text-sm text-muted-foreground">
                  La IA está creando contenido único para tu producto...
                </p>
              </div>

              <div className="w-full max-w-md space-y-3">
                <Skeleton className="h-4 w-3/4 mx-auto" />
                <Skeleton className="h-4 w-1/2 mx-auto" />
                <Skeleton className="h-4 w-2/3 mx-auto" />
              </div>
            </div>
          )}

          {/* ── STEP 3: PREVIEW ─────────────────────────────── */}
          {step === "preview" && content && (
            <div className="p-4 sm:p-6 space-y-8 max-w-4xl mx-auto">
              <div className="flex items-center justify-between gap-2 sticky top-0 bg-background/95 backdrop-blur z-10 py-2 -mx-2 px-2 border-b border-border/60">
                <p className="text-sm font-medium text-foreground">
                  ✨ Banners listos. Descarga cada sección como imagen PNG.
                </p>
                <Button variant="ghost" size="sm" onClick={reset}>
                  Generar otros
                </Button>
              </div>

              {content.hero && (
                <SectionWrapper
                  title="Hero"
                  onDownload={() => handleDownloadSection("hero")}
                  downloading={downloadingKey === "hero"}
                >
                  <div ref={setRef("hero")}>
                    <HeroTemplate product={product} hero={content.hero} />
                  </div>
                </SectionWrapper>
              )}

              {content.benefits && (
                <SectionWrapper
                  title="Beneficios"
                  onDownload={() => handleDownloadSection("benefits")}
                  downloading={downloadingKey === "benefits"}
                >
                  <div ref={setRef("benefits")}>
                    <BenefitsTemplate benefits={content.benefits} />
                  </div>
                </SectionWrapper>
              )}

              {content.beforeAfter && (
                <SectionWrapper
                  title="Antes / Después"
                  onDownload={() => handleDownloadSection("beforeAfter")}
                  downloading={downloadingKey === "beforeAfter"}
                >
                  <div ref={setRef("beforeAfter")}>
                    <BeforeAfterTemplate data={content.beforeAfter} />
                  </div>
                </SectionWrapper>
              )}

              {content.testimonials && (
                <SectionWrapper
                  title="Testimonios"
                  onDownload={() => handleDownloadSection("testimonials")}
                  downloading={downloadingKey === "testimonials"}
                >
                  <div ref={setRef("testimonials")}>
                    <TestimonialsTemplate testimonials={content.testimonials} />
                  </div>
                </SectionWrapper>
              )}

              {content.faq && (
                <SectionWrapper
                  title="Preguntas Frecuentes"
                  onDownload={() => handleDownloadSection("faq")}
                  downloading={downloadingKey === "faq"}
                >
                  <div ref={setRef("faq")}>
                    <FAQTemplate faq={content.faq} productName={product.product_name} />
                  </div>
                </SectionWrapper>
              )}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

// ────────────────────────────────────────────────────────────
// Section Wrapper
// ────────────────────────────────────────────────────────────
const SectionWrapper = ({
  title,
  onDownload,
  downloading,
  children,
}: {
  title: string;
  onDownload: () => void;
  downloading: boolean;
  children: React.ReactNode;
}) => (
  <div className="space-y-3">
    <div className="flex items-center justify-between">
      <h4 className="text-sm font-bold uppercase tracking-wider text-muted-foreground">
        {title}
      </h4>
      <Button
        size="sm"
        variant="outline"
        className="gap-1.5"
        onClick={onDownload}
        disabled={downloading}
      >
        {downloading ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
        ) : (
          <Download className="h-3.5 w-3.5" />
        )}
        Descargar Sección
      </Button>
    </div>
    <div className="rounded-2xl overflow-hidden shadow-xl border border-border/60 bg-white">
      {children}
    </div>
  </div>
);

// ════════════════════════════════════════════════════════════
// TEMPLATES (use inline-friendly Tailwind, no external assets)
// ════════════════════════════════════════════════════════════

const HeroTemplate = ({
  product,
  hero,
}: {
  product: LandingProduct;
  hero: NonNullable<LandingContent["hero"]>;
}) => (
  <div
    style={{ width: "1200px", maxWidth: "100%" }}
    className="relative bg-gradient-to-br from-orange-500 via-red-500 to-pink-600 p-10 sm:p-16 text-white overflow-hidden"
  >
    <div className="absolute -top-20 -right-20 w-80 h-80 bg-yellow-300/30 rounded-full blur-3xl" />
    <div className="absolute -bottom-20 -left-20 w-80 h-80 bg-pink-300/30 rounded-full blur-3xl" />

    <div className="relative grid grid-cols-2 gap-8 items-center">
      <div className="space-y-5">
        <div className="inline-block px-4 py-1.5 rounded-full bg-yellow-400 text-black font-extrabold text-xs uppercase tracking-wider shadow-lg">
          {hero.badge}
        </div>
        <h1 className="text-4xl sm:text-5xl font-extrabold leading-tight drop-shadow-md">
          {hero.headline}
        </h1>
        <p className="text-lg opacity-95 leading-relaxed">{hero.subheadline}</p>

        {product.suggested_price && (
          <div className="flex items-end gap-3 pt-2">
            <span className="text-5xl font-black drop-shadow-md">
              {formatCOP(product.suggested_price)}
            </span>
            <span className="text-xl line-through opacity-70 pb-2">
              {formatCOP(Math.round(product.suggested_price * 1.4))}
            </span>
          </div>
        )}

        <div className="inline-flex items-center gap-2 px-7 py-4 rounded-2xl bg-white text-orange-600 font-extrabold text-lg shadow-2xl">
          {hero.cta} <ArrowRight className="h-5 w-5" />
        </div>

        <div className="flex items-center gap-4 pt-2 text-sm opacity-95">
          <div className="flex items-center gap-1">
            <Truck className="h-4 w-4" /> Envío contra entrega
          </div>
          <div className="flex items-center gap-1">
            <ShieldCheck className="h-4 w-4" /> Garantía verificada
          </div>
        </div>
      </div>

      <div className="relative">
        <div className="absolute inset-0 bg-white/20 rounded-3xl blur-2xl" />
        {product.image_url ? (
          <img
            src={product.image_url}
            alt={product.product_name}
            crossOrigin="anonymous"
            className="relative w-full aspect-square object-cover rounded-3xl shadow-2xl ring-4 ring-white/40"
          />
        ) : (
          <div className="relative w-full aspect-square rounded-3xl bg-white/20 ring-4 ring-white/40" />
        )}
      </div>
    </div>
  </div>
);

const BenefitsTemplate = ({
  benefits,
}: {
  benefits: NonNullable<LandingContent["benefits"]>;
}) => (
  <div
    style={{ width: "1200px", maxWidth: "100%" }}
    className="bg-gradient-to-br from-slate-50 to-slate-100 p-10 sm:p-14"
  >
    <div className="text-center mb-10">
      <h2 className="text-3xl sm:text-4xl font-extrabold text-slate-900 mb-2">
        ¿Por qué elegirlo?
      </h2>
      <div className="h-1 w-20 bg-gradient-to-r from-orange-500 to-pink-600 rounded-full mx-auto" />
    </div>

    <div className="grid grid-cols-2 gap-5">
      {benefits.map((b, i) => {
        const Icon = ICON_MAP[b.icon] ?? Check;
        return (
          <div
            key={i}
            className="bg-white p-6 rounded-2xl shadow-md border border-slate-200 flex items-start gap-4 hover:shadow-lg transition-shadow"
          >
            <div className="flex-shrink-0 h-14 w-14 rounded-2xl bg-gradient-to-br from-orange-500 to-pink-600 flex items-center justify-center shadow-lg">
              <Icon className="h-7 w-7 text-white" />
            </div>
            <div>
              <h3 className="font-bold text-slate-900 text-lg mb-1">{b.title}</h3>
              <p className="text-slate-600 text-sm leading-relaxed">{b.description}</p>
            </div>
          </div>
        );
      })}
    </div>
  </div>
);

const TestimonialsTemplate = ({
  testimonials,
}: {
  testimonials: NonNullable<LandingContent["testimonials"]>;
}) => (
  <div
    style={{ width: "1200px", maxWidth: "100%" }}
    className="bg-gradient-to-br from-purple-50 to-indigo-100 p-10 sm:p-14"
  >
    <div className="text-center mb-10">
      <h2 className="text-3xl sm:text-4xl font-extrabold text-slate-900 mb-2">
        Clientes felices en Colombia
      </h2>
      <div className="flex items-center justify-center gap-1">
        {[1, 2, 3, 4, 5].map((i) => (
          <Star key={i} className="h-5 w-5 fill-yellow-400 text-yellow-400" />
        ))}
        <span className="ml-2 text-slate-700 font-semibold">+1.500 ventas</span>
      </div>
    </div>

    <div className="grid grid-cols-3 gap-5">
      {testimonials.map((t, i) => (
        <div
          key={i}
          className="bg-white p-6 rounded-2xl shadow-md border border-slate-200 relative"
        >
          <Quote className="absolute -top-3 -left-3 h-8 w-8 text-purple-500 bg-white rounded-full p-1.5 shadow" />
          <div className="flex gap-0.5 mb-3">
            {Array.from({ length: t.rating }).map((_, j) => (
              <Star key={j} className="h-4 w-4 fill-yellow-400 text-yellow-400" />
            ))}
          </div>
          <p className="text-slate-700 text-sm leading-relaxed mb-4 italic">
            "{t.comment}"
          </p>
          <div className="flex items-center gap-3 pt-3 border-t border-slate-100">
            <div className="h-10 w-10 rounded-full bg-gradient-to-br from-purple-400 to-pink-400 flex items-center justify-center text-white font-bold">
              {t.name[0]}
            </div>
            <div>
              <p className="font-bold text-slate-900 text-sm">{t.name}</p>
              <p className="text-xs text-slate-500">{t.city}</p>
            </div>
          </div>
        </div>
      ))}
    </div>
  </div>
);

const FAQTemplate = ({
  faq,
  productName,
}: {
  faq: NonNullable<LandingContent["faq"]>;
  productName: string;
}) => (
  <div
    style={{ width: "1200px", maxWidth: "100%" }}
    className="bg-white p-10 sm:p-14"
  >
    <div className="text-center mb-10">
      <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-blue-100 text-blue-700 font-semibold text-xs mb-3">
        <HelpCircle className="h-4 w-4" /> RESOLVEMOS TUS DUDAS
      </div>
      <h2 className="text-3xl sm:text-4xl font-extrabold text-slate-900">
        Preguntas frecuentes sobre {productName}
      </h2>
    </div>

    <div className="space-y-3 max-w-3xl mx-auto">
      {faq.map((f, i) => (
        <div
          key={i}
          className="bg-gradient-to-br from-slate-50 to-white p-5 rounded-xl border border-slate-200 shadow-sm"
        >
          <p className="font-bold text-slate-900 text-base mb-2 flex items-start gap-2">
            <span className="flex-shrink-0 h-6 w-6 rounded-full bg-blue-600 text-white flex items-center justify-center text-xs font-black">
              ?
            </span>
            {f.question}
          </p>
          <p className="text-slate-600 text-sm leading-relaxed pl-8">{f.answer}</p>
        </div>
      ))}
    </div>
  </div>
);

const BeforeAfterTemplate = ({
  data,
}: {
  data: NonNullable<LandingContent["beforeAfter"]>;
}) => (
  <div
    style={{ width: "1200px", maxWidth: "100%" }}
    className="bg-gradient-to-br from-slate-900 to-slate-800 p-10 sm:p-14 text-white"
  >
    <div className="text-center mb-10">
      <h2 className="text-3xl sm:text-4xl font-extrabold mb-2">La transformación</h2>
      <p className="text-slate-300">Mira el cambio que vas a notar</p>
    </div>

    <div className="grid grid-cols-2 gap-6 items-stretch">
      <div className="bg-red-950/40 border-2 border-red-500/40 p-6 rounded-2xl">
        <div className="flex items-center gap-2 mb-4">
          <div className="h-10 w-10 rounded-full bg-red-500 flex items-center justify-center">
            <X className="h-6 w-6 text-white" />
          </div>
          <h3 className="text-xl font-bold text-red-300">{data.beforeTitle}</h3>
        </div>
        <ul className="space-y-2.5">
          {data.beforePoints.map((p, i) => (
            <li key={i} className="flex items-start gap-2 text-slate-200 text-sm">
              <X className="h-4 w-4 text-red-400 mt-0.5 flex-shrink-0" />
              <span>{p}</span>
            </li>
          ))}
        </ul>
      </div>

      <div className="bg-emerald-950/40 border-2 border-emerald-400/50 p-6 rounded-2xl ring-2 ring-emerald-400/20">
        <div className="flex items-center gap-2 mb-4">
          <div className="h-10 w-10 rounded-full bg-emerald-500 flex items-center justify-center">
            <Check className="h-6 w-6 text-white" />
          </div>
          <h3 className="text-xl font-bold text-emerald-300">{data.afterTitle}</h3>
        </div>
        <ul className="space-y-2.5">
          {data.afterPoints.map((p, i) => (
            <li key={i} className="flex items-start gap-2 text-slate-100 text-sm">
              <Check className="h-4 w-4 text-emerald-400 mt-0.5 flex-shrink-0" />
              <span>{p}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  </div>
);

export default LandingGeneratorModal;
