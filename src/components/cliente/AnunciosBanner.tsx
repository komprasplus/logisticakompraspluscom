import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Carousel, CarouselContent, CarouselItem, type CarouselApi } from "@/components/ui/carousel";
import Autoplay from "embla-carousel-autoplay";
import { Megaphone, Map, Newspaper, ArrowRight } from "lucide-react";
import { motion } from "framer-motion";

interface Anuncio {
  id: string;
  titulo: string;
  contenido: string | null;
  tipo: "banner" | "noticia" | "mapa_cobertura";
  imagen_url: string | null;
  link_url: string | null;
}

const tipoMeta = {
  banner: { icon: Megaphone, label: "Anuncio", gradient: "from-primary/90 to-primary" },
  noticia: { icon: Newspaper, label: "Noticia", gradient: "from-amber-500 to-orange-500" },
  mapa_cobertura: { icon: Map, label: "Cobertura", gradient: "from-emerald-500 to-teal-500" },
} as const;

const AnunciosBanner = () => {
  const [anuncios, setAnuncios] = useState<Anuncio[]>([]);
  const [loading, setLoading] = useState(true);
  const [api, setApi] = useState<CarouselApi>();
  const [current, setCurrent] = useState(0);

  useEffect(() => {
    let mounted = true;
    (async () => {
      const { data } = await supabase
        .from("anuncios_plataforma")
        .select("id,titulo,contenido,tipo,imagen_url,link_url")
        .eq("activo", true)
        .order("orden", { ascending: true })
        .order("created_at", { ascending: false })
        .limit(10);
      if (mounted) {
        setAnuncios((data ?? []) as Anuncio[]);
        setLoading(false);
      }
    })();
    return () => { mounted = false; };
  }, []);

  useEffect(() => {
    if (!api) return;
    setCurrent(api.selectedScrollSnap());
    const handler = () => setCurrent(api.selectedScrollSnap());
    api.on("select", handler);
    return () => { api.off("select", handler); };
  }, [api]);

  if (loading) {
    return <div className="h-44 rounded-3xl bg-muted/50 animate-pulse" aria-hidden="true" />;
  }

  if (anuncios.length === 0) return null;

  return (
    <motion.section
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      aria-label="Tablero de novedades"
      className="space-y-2"
    >
      <Carousel
        setApi={setApi}
        opts={{ loop: true, align: "start" }}
        plugins={[Autoplay({ delay: 6000, stopOnInteraction: true })]}
        className="w-full"
      >
        <CarouselContent>
          {anuncios.map((a) => {
            const meta = tipoMeta[a.tipo];
            const Icon = meta.icon;
            const Inner = (
              <div className={`relative overflow-hidden rounded-3xl bg-gradient-to-r ${meta.gradient} text-white shadow-lg min-h-[180px] md:min-h-[200px]`}>
                {/* background image / animation */}
                {a.imagen_url && (
                  <img
                    src={a.imagen_url}
                    alt=""
                    className="absolute inset-0 h-full w-full object-cover opacity-30"
                    aria-hidden="true"
                  />
                )}
                {/* decorative blobs */}
                <div className="absolute -right-10 -top-10 h-44 w-44 rounded-full bg-white/10" />
                <div className="absolute -right-4 -bottom-12 h-52 w-52 rounded-full bg-white/5" />

                <div className="relative z-10 flex flex-col md:flex-row items-start md:items-center gap-4 p-6 md:p-8">
                  <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-white/20 backdrop-blur-sm shadow-inner shrink-0">
                    <Icon className="h-7 w-7" aria-hidden="true" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium uppercase tracking-wider text-white/80 mb-1">
                      {meta.label}
                    </p>
                    <h3 className="text-xl md:text-2xl font-extrabold leading-tight">{a.titulo}</h3>
                    {a.contenido && (
                      <p className="text-sm text-white/90 mt-1 line-clamp-2 max-w-2xl">{a.contenido}</p>
                    )}
                  </div>
                  {a.link_url && (
                    <ArrowRight className="hidden md:block h-6 w-6 shrink-0 group-hover:translate-x-1 transition-transform" aria-hidden="true" />
                  )}
                </div>
              </div>
            );

            return (
              <CarouselItem key={a.id}>
                {a.link_url ? (
                  <a href={a.link_url} target="_blank" rel="noopener noreferrer" className="group block">
                    {Inner}
                  </a>
                ) : (
                  Inner
                )}
              </CarouselItem>
            );
          })}
        </CarouselContent>
      </Carousel>

      {/* Dots */}
      {anuncios.length > 1 && (
        <div className="flex items-center justify-center gap-1.5">
          {anuncios.map((_, i) => (
            <button
              key={i}
              type="button"
              aria-label={`Ir al anuncio ${i + 1}`}
              onClick={() => api?.scrollTo(i)}
              className={`h-1.5 rounded-full transition-all ${i === current ? "w-6 bg-primary" : "w-1.5 bg-muted-foreground/30"}`}
            />
          ))}
        </div>
      )}
    </motion.section>
  );
};

export default AnunciosBanner;
