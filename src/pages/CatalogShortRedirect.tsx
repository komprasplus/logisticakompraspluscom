import { useEffect, useState } from "react";
import { Link, Navigate, useParams } from "react-router-dom";
import { Loader2, Package } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";

/**
 * Ruta corta: /{tienda-slug} → redirige a /{tienda-slug}/catalogo
 *
 * Verifica que el slug exista como tienda activa antes de redirigir.
 * Si no existe, muestra una pantalla 404 amigable (no rompe el SPA).
 */
const CatalogShortRedirect = () => {
  const { slug } = useParams<{ slug: string }>();
  const [status, setStatus] = useState<"checking" | "valid" | "invalid">("checking");

  useEffect(() => {
    let cancelled = false;
    if (!slug) {
      setStatus("invalid");
      return;
    }

    (async () => {
      try {
        const { data, error } = await (supabase as any)
          .from("profiles")
          .select("catalog_slug")
          .eq("catalog_slug", slug)
          .eq("tipo_cuenta", "proveedor")
          .eq("status", "activo")
          .eq("catalog_public_enabled", true)
          .maybeSingle();
        if (cancelled) return;
        if (data && !error) {
          setStatus("valid");
        } else {
          setStatus("invalid");
        }
      } catch {
        if (!cancelled) setStatus("invalid");
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [slug]);

  if (status === "checking") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (status === "valid" && slug) {
    return <Navigate to={`/${slug}/catalogo`} replace />;
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50 p-6 text-center">
      <Package className="h-16 w-16 text-slate-300 mb-4" />
      <h1 className="text-xl font-bold text-slate-700 mb-2">Página no encontrada</h1>
      <p className="text-sm text-slate-500 max-w-md mb-4">
        El enlace que intentas abrir no corresponde a ningún catálogo o tienda activa.
      </p>
      <Button asChild>
        <Link to="/">Volver al inicio</Link>
      </Button>
    </div>
  );
};

export default CatalogShortRedirect;
