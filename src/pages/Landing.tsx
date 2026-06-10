import { motion, type Variants } from "framer-motion";
import { Link } from "react-router-dom";
import {
  Rocket,
  Clock,
  PackageX,
  Snowflake,
  Zap,
  Warehouse,
  Wallet,
  MapPin,
  ArrowRight,
  Sparkles,
} from "lucide-react";

const fadeUp: Variants = {
  hidden: { opacity: 0, y: 24 },
  show: { opacity: 1, y: 0, transition: { duration: 0.6, ease: [0.16, 1, 0.3, 1] } },
};

const stagger: Variants = {
  show: { transition: { staggerChildren: 0.12 } },
};

const Section = ({ children, className = "" }: { children: React.ReactNode; className?: string }) => (
  <motion.section
    initial="hidden"
    whileInView="show"
    viewport={{ once: true, amount: 0.2 }}
    variants={stagger}
    className={`relative w-full px-4 sm:px-6 py-16 sm:py-24 md:py-32 ${className}`}
  >
    {children}
  </motion.section>
);

const GlassCard = ({ children, className = "" }: { children: React.ReactNode; className?: string }) => (
  <div
    className={`rounded-2xl border border-white/10 bg-white/5 backdrop-blur-lg p-6 shadow-[0_8px_32px_rgba(0,0,0,0.4)] ${className}`}
  >
    {children}
  </div>
);

const Landing = () => {
  const integrations = ["Shopify", "Dropi", "WooCommerce", "Meta Ads", "TikTok Ads", "Google Sheets", "Zapier"];
  const marqueeItems = [...integrations, ...integrations];

  return (
    <div className="min-h-screen bg-zinc-950 text-white overflow-x-hidden font-sans antialiased">
      {/* NAV */}
      <nav className="fixed top-0 inset-x-0 z-50 backdrop-blur-xl bg-zinc-950/60 border-b border-white/5">
        <div className="max-w-7xl mx-auto flex items-center justify-between px-6 py-4">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-purple-500 to-cyan-400 flex items-center justify-center shadow-[0_0_20px_rgba(168,85,247,0.5)]">
              <Rocket className="w-4 h-4 text-white" />
            </div>
            <span className="font-bold text-lg tracking-tight">
              Plus<span className="text-cyan-400"> Envíos</span>
            </span>
          </div>
          <div className="flex items-center gap-2 sm:gap-3">
            <Link
              to="/auth"
              className="inline-flex text-xs sm:text-sm text-zinc-300 hover:text-white px-2 sm:px-4 py-2 transition"
            >
              Iniciar sesión
            </Link>
            <Link
              to="/registro"
              className="inline-flex items-center gap-1.5 text-xs sm:text-sm font-medium px-3 sm:px-4 py-2 rounded-full bg-white text-zinc-950 hover:bg-zinc-100 transition"
            >
              Empezar <ArrowRight className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
            </Link>
          </div>
        </div>
      </nav>

      {/* HERO */}
      <Section className="pt-28 sm:pt-40 md:pt-48">
        {/* Glow background */}
        <div className="absolute inset-0 -z-10 overflow-hidden">
          <div className="absolute top-20 left-1/2 -translate-x-1/2 w-[800px] h-[800px] rounded-full bg-purple-600/20 blur-[150px]" />
          <div className="absolute top-40 left-1/4 w-[500px] h-[500px] rounded-full bg-cyan-500/20 blur-[150px]" />
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,transparent_0%,rgb(9,9,11)_70%)]" />
        </div>

        <div className="max-w-6xl mx-auto text-center">
          <motion.div variants={fadeUp}>
            <span className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-white/10 bg-white/5 backdrop-blur-md text-xs font-medium text-zinc-300">
              <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
              🚀 La revolución del Dropshipping B2B
            </span>
          </motion.div>

          <motion.h1
            variants={fadeUp}
            className="mt-6 sm:mt-8 text-4xl sm:text-5xl md:text-7xl lg:text-8xl font-black tracking-tighter leading-[1] sm:leading-[0.95]"
          >
            Escala tu E-commerce <br />
            <span className="bg-gradient-to-r from-purple-400 via-cyan-300 to-purple-400 bg-clip-text text-transparent">
              sin tocar una sola caja.
            </span>
          </motion.h1>

          <motion.p
            variants={fadeUp}
            className="mt-6 sm:mt-8 text-base sm:text-lg md:text-xl text-zinc-400 max-w-2xl mx-auto leading-relaxed px-2"
          >
            El único ecosistema logístico en Colombia que integra proveeduría VIP, sincronización automática
            con tu tienda y recaudo contra entrega ultrarrápido.
          </motion.p>

          <motion.div variants={fadeUp} className="mt-8 sm:mt-10 flex flex-col sm:flex-row gap-3 sm:gap-4 justify-center items-center px-4">
            <Link
              to="/registro"
              className="group relative inline-flex items-center justify-center gap-2 w-full sm:w-auto px-6 sm:px-8 py-3.5 sm:py-4 rounded-full bg-gradient-to-r from-purple-600 to-cyan-500 font-semibold text-white shadow-[0_0_40px_rgba(168,85,247,0.5)] hover:shadow-[0_0_60px_rgba(34,211,238,0.7)] transition-all duration-300 animate-pulse-glow-cta"
            >
              <span className="absolute inset-0 rounded-full bg-gradient-to-r from-purple-600 to-cyan-500 blur-xl opacity-50 group-hover:opacity-80 transition" />
              <span className="relative flex items-center gap-2">
                Crear mi cuenta gratis
                <ArrowRight className="w-4 h-4" />
              </span>
            </Link>
            <a
              href="#solucion"
              className="w-full sm:w-auto text-center px-6 sm:px-8 py-3.5 sm:py-4 rounded-full border border-white/10 bg-white/5 backdrop-blur-md text-white hover:bg-white/10 transition"
            >
              Ver cómo funciona
            </a>
          </motion.div>

          {/* Mockup */}
          <motion.div variants={fadeUp} className="mt-12 sm:mt-20 perspective-[2000px]">
            <div
              className="mx-auto max-w-5xl rounded-2xl border border-white/10 bg-gradient-to-br from-zinc-900 to-zinc-950 backdrop-blur-xl shadow-[0_30px_100px_-20px_rgba(168,85,247,0.5)] p-3 sm:p-6 transition-transform duration-700 sm:[transform:rotateX(15deg)_rotateY(-5deg)]"
            >
              <div className="flex items-center gap-1.5 mb-3 sm:mb-4">
                <div className="w-2 h-2 sm:w-2.5 sm:h-2.5 rounded-full bg-red-500/80" />
                <div className="w-2 h-2 sm:w-2.5 sm:h-2.5 rounded-full bg-yellow-500/80" />
                <div className="w-2 h-2 sm:w-2.5 sm:h-2.5 rounded-full bg-green-500/80" />
              </div>
              <div className="grid grid-cols-3 gap-2 sm:gap-4">
                {[
                  { label: "Pedidos hoy", value: "1,284", glow: "purple" },
                  { label: "Recaudo COD", value: "$48.2M", glow: "cyan" },
                  { label: "Tasa entrega", value: "97.4%", glow: "purple" },
                ].map((kpi, i) => (
                  <div
                    key={i}
                    className="rounded-lg sm:rounded-xl border border-white/5 bg-white/5 p-2 sm:p-4 text-left"
                  >
                    <div className="text-[10px] sm:text-xs text-zinc-500 truncate">{kpi.label}</div>
                    <div className="text-base sm:text-2xl font-bold mt-0.5 sm:mt-1">{kpi.value}</div>
                    <div
                      className={`mt-2 sm:mt-3 h-8 sm:h-12 rounded-md bg-gradient-to-tr ${
                        kpi.glow === "purple"
                          ? "from-purple-600/40 to-purple-400/10"
                          : "from-cyan-500/40 to-cyan-300/10"
                      }`}
                    />
                  </div>
                ))}
              </div>
              <div className="mt-3 sm:mt-4 h-24 sm:h-40 rounded-lg sm:rounded-xl border border-white/5 bg-gradient-to-tr from-purple-600/20 via-transparent to-cyan-500/20 relative overflow-hidden">
                <svg viewBox="0 0 400 100" className="absolute inset-0 w-full h-full">
                  <defs>
                    <linearGradient id="lineGrad" x1="0" x2="1">
                      <stop offset="0%" stopColor="#a855f7" />
                      <stop offset="100%" stopColor="#22d3ee" />
                    </linearGradient>
                  </defs>
                  <path
                    d="M 0 80 L 60 65 L 120 70 L 180 50 L 240 40 L 300 25 L 360 15 L 400 10"
                    fill="none"
                    stroke="url(#lineGrad)"
                    strokeWidth="3"
                    strokeLinecap="round"
                  />
                </svg>
              </div>
            </div>
          </motion.div>
        </div>
      </Section>

      {/* AGITACIÓN */}
      <Section className="bg-black/40">
        <div className="max-w-6xl mx-auto">
          <motion.h2
            variants={fadeUp}
            className="text-3xl sm:text-4xl md:text-5xl font-bold text-center max-w-3xl mx-auto leading-tight px-2"
          >
            ¿Estás perdiendo dinero por culpa de una <span className="text-red-400">logística tradicional</span>?
          </motion.h2>

          <div className="mt-10 sm:mt-16 grid grid-cols-1 md:grid-cols-3 gap-4 sm:gap-6">
            {[
              {
                Icon: Clock,
                title: "Horas perdidas",
                text: "Pasando pedidos a Excel manualmente mientras tu competencia vende en automático.",
              },
              {
                Icon: PackageX,
                title: "Stock que se evapora",
                text: "Proveedores que se quedan sin inventario en plena campaña de Ads.",
              },
              {
                Icon: Snowflake,
                title: "Dinero congelado",
                text: "Transportadoras que tardan semanas en pagarte tu recaudo contra entrega.",
              },
            ].map(({ Icon, title, text }, i) => (
              <motion.div key={i} variants={fadeUp}>
                <GlassCard className="h-full hover:border-red-500/30 transition">
                  <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-red-500/30 to-orange-500/20 border border-red-500/20 flex items-center justify-center mb-5">
                    <Icon className="w-6 h-6 text-red-400" />
                  </div>
                  <h3 className="text-xl font-bold mb-2">{title}</h3>
                  <p className="text-zinc-400 leading-relaxed">{text}</p>
                </GlassCard>
              </motion.div>
            ))}
          </div>
        </div>
      </Section>

      {/* SOLUCIÓN */}
      <Section className="relative">
        <div id="solucion" className="absolute inset-0 -z-10 overflow-hidden">
          <div className="absolute top-1/2 left-1/4 w-[600px] h-[600px] rounded-full bg-purple-600/15 blur-[150px]" />
          <div className="absolute top-1/3 right-1/4 w-[500px] h-[500px] rounded-full bg-cyan-500/15 blur-[150px]" />
        </div>

        <div className="max-w-6xl mx-auto">
          <motion.div variants={fadeUp} className="text-center max-w-3xl mx-auto">
            <span className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-white/10 bg-white/5 text-xs font-medium text-cyan-300">
              LA SOLUCIÓN
            </span>
            <h2 className="mt-4 sm:mt-6 text-3xl sm:text-4xl md:text-5xl font-bold leading-tight px-2">
              Presentamos Plus Envíos:{" "}
              <span className="bg-gradient-to-r from-purple-400 to-cyan-300 bg-clip-text text-transparent">
                Tu operación en piloto automático.
              </span>
            </h2>
          </motion.div>

          <div className="mt-10 sm:mt-16 grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
            {[
              {
                Icon: Zap,
                color: "cyan",
                title: "Sincronización Mágica",
                text: "Conecta tu Shopify o WooCommerce. Los pedidos entran solos, sin levantar un dedo.",
              },
              {
                Icon: Warehouse,
                color: "purple",
                title: "Mega Bodega Privada",
                text: "Vende nuestros productos VIP. Nosotros los empacamos y despachamos por ti.",
              },
              {
                Icon: Wallet,
                color: "cyan",
                title: "Flujo de Caja Inmediato",
                text: "Liquidación de COD a la velocidad de la luz para que reinviertas en tus Ads sin frenar.",
              },
              {
                Icon: MapPin,
                color: "purple",
                title: "Rastreo en Vivo",
                text: "Disminuye tus devoluciones. Tú y tu cliente sabrán dónde está el paquete cada segundo.",
              },
            ].map(({ Icon, color, title, text }, i) => (
              <motion.div key={i} variants={fadeUp}>
                <GlassCard className="h-full group hover:border-white/20 transition">
                  <div
                    className={`w-12 h-12 rounded-xl border flex items-center justify-center mb-5 ${
                      color === "cyan"
                        ? "bg-cyan-500/10 border-cyan-500/30 shadow-[0_0_30px_rgba(34,211,238,0.3)]"
                        : "bg-purple-500/10 border-purple-500/30 shadow-[0_0_30px_rgba(168,85,247,0.3)]"
                    }`}
                  >
                    <Icon className={`w-6 h-6 ${color === "cyan" ? "text-cyan-400" : "text-purple-400"}`} />
                  </div>
                  <h3 className="text-xl font-bold mb-2">{title}</h3>
                  <p className="text-zinc-400 leading-relaxed">{text}</p>
                </GlassCard>
              </motion.div>
            ))}
          </div>
        </div>
      </Section>

      {/* PRUEBA SOCIAL - MARQUEE */}
      <Section className="py-16 border-y border-white/5 bg-black/40">
        <div className="max-w-6xl mx-auto">
          <motion.p
            variants={fadeUp}
            className="text-center text-sm text-zinc-500 uppercase tracking-widest mb-10"
          >
            Integración nativa con las herramientas que ya amas
          </motion.p>
          <div className="relative overflow-hidden">
            <div className="absolute left-0 top-0 bottom-0 w-32 bg-gradient-to-r from-zinc-950 to-transparent z-10" />
            <div className="absolute right-0 top-0 bottom-0 w-32 bg-gradient-to-l from-zinc-950 to-transparent z-10" />
            <div className="flex gap-8 sm:gap-12 animate-marquee whitespace-nowrap">
              {marqueeItems.map((name, i) => (
                <div
                  key={i}
                  className="text-xl sm:text-2xl md:text-3xl font-bold text-zinc-600 hover:text-white transition shrink-0"
                >
                  {name}
                </div>
              ))}
            </div>
          </div>
        </div>
      </Section>

      {/* CIERRE CTA */}
      <Section>
        <div className="max-w-5xl mx-auto">
          <motion.div variants={fadeUp} className="relative">
            {/* Animated gradient border wrapper */}
            <div className="relative rounded-3xl p-[2px] bg-gradient-to-r from-purple-600 via-cyan-400 to-purple-600 bg-[length:200%_200%] animate-gradient-border">
              <div className="rounded-3xl bg-zinc-950 px-5 sm:px-8 py-10 sm:py-16 md:p-20 text-center relative overflow-hidden">
                <div className="absolute inset-0 -z-0">
                  <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[400px] rounded-full bg-purple-600/20 blur-[120px]" />
                  <div className="absolute bottom-0 right-1/2 translate-x-1/2 w-[600px] h-[400px] rounded-full bg-cyan-500/20 blur-[120px]" />
                </div>
                <div className="relative z-10">
                  <h2 className="text-3xl sm:text-4xl md:text-6xl font-black tracking-tight leading-tight">
                    Deja de operar. <br />
                    <span className="bg-gradient-to-r from-purple-400 to-cyan-300 bg-clip-text text-transparent">
                      Empieza a escalar.
                    </span>
                  </h2>
                  <p className="mt-4 sm:mt-6 text-base sm:text-lg text-zinc-400 max-w-2xl mx-auto">
                    Únete a los dropshippers de alto rendimiento que ya están dominando el mercado con Plus Envíos.
                  </p>
                  <Link
                    to="/registro"
                    className="mt-8 sm:mt-10 inline-flex items-center justify-center gap-2 sm:gap-3 w-full sm:w-auto px-6 sm:px-10 py-4 sm:py-5 rounded-full bg-gradient-to-r from-purple-600 to-cyan-500 font-bold text-base sm:text-lg text-white shadow-[0_0_60px_rgba(168,85,247,0.6)] hover:scale-105 transition-transform"
                  >
                    Ingresar al Ecosistema Ahora
                    <ArrowRight className="w-4 h-4 sm:w-5 sm:h-5" />
                  </Link>
                  <p className="mt-4 text-xs text-zinc-500">
                    ¿Ya tienes cuenta?{" "}
                    <Link to="/auth" className="text-cyan-400 hover:underline">
                      Inicia sesión
                    </Link>
                  </p>
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      </Section>

      {/* FOOTER */}
      <footer className="border-t border-white/5 py-10 px-6 text-center text-sm text-zinc-600">
        © {new Date().getFullYear()} Plus Envíos · Logística inteligente para e-commerce
      </footer>
    </div>
  );
};

export default Landing;
