import { Sparkles, ShieldCheck, Truck, Star } from "lucide-react";

export interface LandingPreviewData {
  headline: string;
  subheadline: string;
  bullet_points: string[];
  call_to_action: string;
  hero_bg_url: string;
  scene_bg_url?: string;
  product_image_url: string;
  price_label?: string;
}

/**
 * LandingPreview — Ensamblaje "Magic" estilo dopamínico.
 * Renderiza HTML/CSS puro sobre fondos generados por IA (mock por ahora).
 * El producto flota con drop-shadow para integrarse en la escena.
 */
export default function LandingPreview({ data }: { data: LandingPreviewData }) {
  return (
    <div className="w-full overflow-hidden rounded-[24px] border border-border bg-background shadow-2xl">
      {/* ─────────────── HERO ─────────────── */}
      <section
        className="relative isolate min-h-[640px] w-full overflow-hidden"
        style={{
          backgroundImage: `url(${data.hero_bg_url})`,
          backgroundSize: "cover",
          backgroundPosition: "center",
        }}
      >
        {/* Dark gradient overlay */}
        <div className="absolute inset-0 bg-gradient-to-br from-black/85 via-black/55 to-black/30" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_70%_50%,transparent_0%,rgba(0,0,0,0.6)_70%)]" />

        {/* Content grid */}
        <div className="relative z-10 grid grid-cols-1 gap-8 px-10 py-16 md:grid-cols-2 md:px-16 md:py-20">
          {/* Left: copy */}
          <div className="flex flex-col justify-center">
            <span className="mb-4 inline-flex w-fit items-center gap-2 rounded-full border border-red-500/40 bg-red-500/10 px-3 py-1 text-xs font-bold uppercase tracking-widest text-red-300 backdrop-blur-sm">
              <Sparkles className="h-3 w-3" /> Edición Limitada
            </span>

            <h1 className="font-black italic leading-[0.95] text-white drop-shadow-[0_4px_16px_rgba(0,0,0,0.8)]">
              <span className="block text-5xl md:text-6xl">{data.headline.split(" ").slice(0, -2).join(" ")}</span>
              <span className="block bg-gradient-to-r from-red-500 via-red-400 to-orange-400 bg-clip-text text-5xl text-transparent md:text-7xl">
                {data.headline.split(" ").slice(-2).join(" ")}
              </span>
            </h1>

            <p className="mt-6 max-w-md text-lg font-medium italic text-white/90 drop-shadow-md md:text-xl">
              {data.subheadline}
            </p>

            <ul className="mt-6 space-y-2">
              {data.bullet_points.slice(0, 3).map((b, i) => (
                <li key={i} className="flex items-center gap-2 text-white/90">
                  <span className="flex h-5 w-5 items-center justify-center rounded-full bg-blue-500 text-[10px] font-black text-white">
                    ✓
                  </span>
                  <span className="text-sm font-medium">{b}</span>
                </li>
              ))}
            </ul>

            <div className="mt-8 flex flex-wrap items-center gap-4">
              <button className="group relative overflow-hidden rounded-full bg-gradient-to-r from-red-600 to-orange-500 px-8 py-4 text-base font-black uppercase tracking-wider text-white shadow-[0_8px_30px_rgba(239,68,68,0.5)] transition-transform hover:scale-105">
                <span className="relative z-10">{data.call_to_action}</span>
                <span className="absolute inset-0 -translate-x-full bg-white/20 transition-transform group-hover:translate-x-0" />
              </button>
              {data.price_label && (
                <div className="text-white">
                  <div className="text-xs uppercase opacity-70">Hoy</div>
                  <div className="text-2xl font-black">{data.price_label}</div>
                </div>
              )}
            </div>
          </div>

          {/* Right: floating product */}
          <div className="relative flex items-center justify-center">
            <div className="absolute h-72 w-72 rounded-full bg-blue-500/30 blur-3xl" />
            <img
              src={data.product_image_url}
              alt="Producto"
              className="relative z-10 max-h-[440px] w-auto object-contain"
              style={{
                filter: "drop-shadow(0 20px 40px rgba(0,0,0,0.6)) drop-shadow(0 0 30px rgba(59,130,246,0.4))",
              }}
            />
          </div>
        </div>
      </section>

      {/* ─────────────── TRUST BAR ─────────────── */}
      <section className="grid grid-cols-3 gap-2 bg-foreground px-6 py-5 text-background">
        {[
          { icon: Truck, label: "Envío contra entrega" },
          { icon: ShieldCheck, label: "Garantía 30 días" },
          { icon: Star, label: "+10.000 clientes felices" },
        ].map(({ icon: Icon, label }, i) => (
          <div key={i} className="flex items-center justify-center gap-2 text-center">
            <Icon className="h-5 w-5 shrink-0" />
            <span className="text-xs font-bold uppercase tracking-wider md:text-sm">{label}</span>
          </div>
        ))}
      </section>

      {/* ─────────────── SCENE / BENEFITS ─────────────── */}
      <section
        className="relative min-h-[420px] px-10 py-16 md:px-16"
        style={
          data.scene_bg_url
            ? {
                backgroundImage: `url(${data.scene_bg_url})`,
                backgroundSize: "cover",
                backgroundPosition: "center",
              }
            : { backgroundColor: "hsl(var(--muted))" }
        }
      >
        <div className="absolute inset-0 bg-gradient-to-t from-background via-background/85 to-background/40" />
        <div className="relative z-10 mx-auto max-w-4xl text-center">
          <h2 className="text-4xl font-black italic text-foreground md:text-5xl">
            ¿Por qué <span className="text-red-500">todos lo aman?</span>
          </h2>
          <div className="mt-10 grid grid-cols-1 gap-4 md:grid-cols-3">
            {data.bullet_points.map((b, i) => (
              <div
                key={i}
                className="rounded-2xl border border-border bg-card/80 p-6 backdrop-blur-md transition-transform hover:-translate-y-1"
              >
                <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-red-500 to-orange-500 text-white">
                  <Sparkles className="h-5 w-5" />
                </div>
                <p className="text-sm font-semibold text-foreground">{b}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─────────────── FINAL CTA ─────────────── */}
      <section className="bg-gradient-to-br from-red-600 via-red-500 to-orange-500 px-10 py-16 text-center text-white">
        <h2 className="mx-auto max-w-2xl text-3xl font-black italic md:text-4xl">
          No esperes más. Pide el tuyo HOY contra entrega.
        </h2>
        <button className="mt-8 rounded-full bg-white px-10 py-4 text-lg font-black uppercase tracking-wider text-red-600 shadow-2xl transition-transform hover:scale-105">
          {data.call_to_action} →
        </button>
      </section>
    </div>
  );
}
