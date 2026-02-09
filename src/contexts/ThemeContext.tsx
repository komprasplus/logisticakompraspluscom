import { createContext, useContext, useEffect, useState, ReactNode, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

interface OrgBranding {
  id: string;
  nombre: string;
  slug: string;
  logo_url: string | null;
  color_primario: string;
  color_secundario: string;
  dominio_personalizado: string | null;
  plan_activo: boolean;
}

const DEFAULT_BRANDING: OrgBranding = {
  id: "a0000000-0000-0000-0000-000000000001",
  nombre: "Kompras Plus",
  slug: "kompras-plus",
  logo_url: "/logo-kompras-plus.png",
  color_primario: "#00D1FF",
  color_secundario: "#0099CC",
  dominio_personalizado: null,
  plan_activo: true,
};

interface ThemeContextType {
  branding: OrgBranding;
  loading: boolean;
  refreshBranding: () => Promise<void>;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

/** Convert hex color to HSL string (e.g. "210 100% 45%") */
function hexToHSL(hex: string): string {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  if (!result) return "210 100% 45%";

  let r = parseInt(result[1], 16) / 255;
  let g = parseInt(result[2], 16) / 255;
  let b = parseInt(result[3], 16) / 255;

  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  let h = 0, s: number;
  const l = (max + min) / 2;

  if (max === min) {
    h = s = 0;
  } else {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r: h = ((g - b) / d + (g < b ? 6 : 0)) / 6; break;
      case g: h = ((b - r) / d + 2) / 6; break;
      case b: h = ((r - g) / d + 4) / 6; break;
    }
  }

  return `${Math.round(h * 360)} ${Math.round(s * 100)}% ${Math.round(l * 100)}%`;
}

/** Lighten an HSL value string */
function lightenHSL(hsl: string, amount: number): string {
  const parts = hsl.match(/(\d+)\s+(\d+)%\s+(\d+)%/);
  if (!parts) return hsl;
  const newL = Math.min(100, parseInt(parts[3]) + amount);
  return `${parts[1]} ${parts[2]}% ${newL}%`;
}

function applyBrandingCSS(branding: OrgBranding) {
  const root = document.documentElement;
  const primaryHSL = hexToHSL(branding.color_primario);
  const secondaryHSL = hexToHSL(branding.color_secundario);

  root.style.setProperty("--primary", primaryHSL);
  root.style.setProperty("--ring", primaryHSL);
  root.style.setProperty("--sidebar-primary", primaryHSL);
  root.style.setProperty("--sidebar-ring", lightenHSL(primaryHSL, 5));
  root.style.setProperty("--secondary", secondaryHSL);

  // Gradients
  const gradPrimary = `linear-gradient(135deg, hsl(${primaryHSL}) 0%, hsl(${secondaryHSL}) 100%)`;
  const gradButton = `linear-gradient(145deg, hsl(${lightenHSL(primaryHSL, 5)}) 0%, hsl(${lightenHSL(secondaryHSL, 5)}) 100%)`;
  root.style.setProperty("--gradient-primary", gradPrimary);
  root.style.setProperty("--gradient-button", gradButton);
}

export const ThemeProvider = ({ children }: { children: ReactNode }) => {
  const { profile } = useAuth();
  const [branding, setBranding] = useState<OrgBranding>(DEFAULT_BRANDING);
  const [loading, setLoading] = useState(false);

  const fetchBranding = useCallback(async (orgId: string) => {
    setLoading(true);
    try {
      const { data } = await supabase
        .from("organizaciones")
        .select("id, nombre, slug, logo_url, color_primario, color_secundario, dominio_personalizado, plan_activo")
        .eq("id", orgId)
        .maybeSingle();

      if (data) {
        const org: OrgBranding = {
          id: data.id,
          nombre: data.nombre,
          slug: data.slug,
          logo_url: data.logo_url,
          color_primario: data.color_primario || DEFAULT_BRANDING.color_primario,
          color_secundario: data.color_secundario || DEFAULT_BRANDING.color_secundario,
          dominio_personalizado: data.dominio_personalizado,
          plan_activo: data.plan_activo ?? true,
        };
        setBranding(org);
        applyBrandingCSS(org);
      }
    } catch (err) {
      console.error("[Theme] Error loading branding:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const orgId = (profile as any)?.organizacion_id;
    if (orgId) {
      fetchBranding(orgId);
    } else {
      // Reset to default
      applyBrandingCSS(DEFAULT_BRANDING);
    }
  }, [(profile as any)?.organizacion_id]);

  const refreshBranding = useCallback(async () => {
    const orgId = (profile as any)?.organizacion_id;
    if (orgId) await fetchBranding(orgId);
  }, [(profile as any)?.organizacion_id, fetchBranding]);

  return (
    <ThemeContext.Provider value={{ branding, loading, refreshBranding }}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (!context) throw new Error("useTheme must be used within ThemeProvider");
  return context;
};
