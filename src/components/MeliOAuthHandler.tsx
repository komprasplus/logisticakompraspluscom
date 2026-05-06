import { useEffect, useRef, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

/**
 * Global handler: intercepts ?code=... (Mercado Libre OAuth redirect) on any
 * route, exchanges it via the meli-auth-callback Edge Function, cleans the
 * URL, and routes the user to the integrations view.
 */
const MeliOAuthHandler = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const ranRef = useRef(false);
  const [processing, setProcessing] = useState(false);

  useEffect(() => {
    if (ranRef.current) return;
    const params = new URLSearchParams(window.location.search);
    const code = params.get("code");
    const state = params.get("state");
    // Heuristic: ML sends both code+state. Shopify uses ?code= too but with shop= param.
    if (!code || !state || params.get("shop")) return;

    ranRef.current = true;
    setProcessing(true);

    // Clean URL immediately to avoid re-trigger on refresh
    const cleanPath = window.location.pathname;
    window.history.replaceState({}, document.title, cleanPath);

    (async () => {
      try {
        const { data, error } = await supabase.functions.invoke("meli-auth-callback", {
          body: { code, state },
        });
        if (error) throw error;
        if (!data?.success) throw new Error(data?.error || "Authorization failed");
        toast.success("¡Mercado Libre conectado con éxito!");
      } catch (e: any) {
        console.error("[MeliOAuthHandler] error:", e);
        toast.error("No se pudo conectar Mercado Libre: " + (e?.message || "error desconocido"));
      } finally {
        setProcessing(false);
        navigate("/cliente?view=integraciones", { replace: true });
      }
    })();
  }, [navigate, location]);

  if (!processing) return null;
  return (
    <div className="fixed inset-0 z-[100000] flex flex-col items-center justify-center bg-background/95 backdrop-blur">
      <Loader2 className="h-12 w-12 animate-spin text-primary mb-4" />
      <p className="text-lg font-medium">Autorizando Mercado Libre...</p>
    </div>
  );
};

export default MeliOAuthHandler;
