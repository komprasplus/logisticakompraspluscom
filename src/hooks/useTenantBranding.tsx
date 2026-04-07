import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface TenantBranding {
  id: string;
  nombre: string;
  slug: string;
  logo_url: string | null;
  color_primario: string | null;
  color_secundario: string | null;
  dominio_personalizado: string | null;
}

const DEFAULT_BRANDING: TenantBranding = {
  id: "a0000000-0000-0000-0000-000000000001",
  nombre: "Plus Envíos",
  slug: "kompras-plus",
  logo_url: null,
  color_primario: "#00D1FF",
  color_secundario: "#0099CC",
  dominio_personalizado: null,
};

export function useTenantBranding(tenantSlug?: string) {
  const [branding, setBranding] = useState<TenantBranding>(DEFAULT_BRANDING);
  const [loading, setLoading] = useState(true);
  const [isWhiteLabel, setIsWhiteLabel] = useState(false);

  useEffect(() => {
    const detectAndFetch = async () => {
      setLoading(true);

      // 1. Determine slug: from param, hostname, or default
      let slug = tenantSlug;

      if (!slug) {
        const hostname = window.location.hostname;
        // Check if it's a custom domain (not localhost, not lovable preview)
        if (
          hostname !== "localhost" &&
          !hostname.includes("lovable.app") &&
          !hostname.includes("127.0.0.1")
        ) {
          // Try to find org by custom domain
          const { data } = await supabase
            .from("organizaciones")
            .select("id, nombre, slug, logo_url, color_primario, color_secundario, dominio_personalizado")
            .eq("dominio_personalizado", hostname)
            .maybeSingle();

          if (data) {
            setBranding(data);
            setIsWhiteLabel(true);
            setLoading(false);
            return;
          }
        }
      }

      // 2. If slug provided, fetch by slug
      if (slug) {
        const { data } = await supabase
          .from("organizaciones")
          .select("id, nombre, slug, logo_url, color_primario, color_secundario, dominio_personalizado")
          .eq("slug", slug)
          .maybeSingle();

        if (data) {
          setBranding(data);
          setIsWhiteLabel(true);
          setLoading(false);
          return;
        }
      }

      // 3. Default branding
      setBranding(DEFAULT_BRANDING);
      setIsWhiteLabel(false);
      setLoading(false);
    };

    detectAndFetch();
  }, [tenantSlug]);

  return { branding, loading, isWhiteLabel };
}
