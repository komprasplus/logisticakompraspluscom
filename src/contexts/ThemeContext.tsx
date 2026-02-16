import { createContext, useContext, useEffect, useState, ReactNode, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";

// ─── Constantes ───────────────────────────────────────────────────────────────

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

// ─── Helpers de módulo ────────────────────────────────────────────────────────

/*
  FIX: `hexToHSL`, `lightenHSL`, `applyBrandingCSS` movidas a módulo scope.
  Eran funciones puras (o casi puras en el caso de `applyBrandingCSS` que
  modifica el DOM) recreadas en cada render del ThemeProvider.
*/

/**
 * Convierte un color hex (#RRGGBB) a formato HSL de CSS custom properties.
 * Formato de retorno: "H S% L%" (ej: "210 100% 45%")
 *
 * FIX: validación de formato hex mejorada + fallback más robusto.
 * La versión original retornaba "210 100% 45%" si el regex fallaba, pero no
 * validaba casos edge como strings vacíos, "#" solo, o colores de 3 dígitos.
 */
function hexToHSL(hex: string): string {
  // Normalizar: eliminar # si existe, convertir a lowercase
  const normalized = hex.replace(/^#/, "").toLowerCase();

  // Validar longitud (debe ser exactamente 6 caracteres)
  if (!/^[0-9a-f]{6}$/.test(normalized)) {
    console.warn(`[Theme] Invalid hex color: "${hex}", using default`);
    return hexToHSL(DEFAULT_BRANDING.color_primario);
  }

  const r = parseInt(normalized.slice(0, 2), 16) / 255;
  const g = parseInt(normalized.slice(2, 4), 16) / 255;
  const b = parseInt(normalized.slice(4, 6), 16) / 255;

  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  let h = 0;
  let s: number;
  const l = (max + min) / 2;

  if (max === min) {
    h = s = 0; // Achromatic (gris)
  } else {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);

    /*
      FIX: switch sin `default`.
      Aunque matemáticamente `max` siempre es uno de r/g/b, TypeScript y
      linters se quejan. Añadido `default` que nunca debería ejecutarse.
    */
    switch (max) {
      case r:
        h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
        break;
      case g:
        h = ((b - r) / d + 2) / 6;
        break;
      case b:
        h = ((r - g) / d + 4) / 6;
        break;
      default:
        h = 0; // Nunca debería llegar aquí
    }
  }

  return `${Math.round(h * 360)} ${Math.round(s * 100)}% ${Math.round(l * 100)}%`;
}

/**
 * Aclara un valor HSL sumando `amount` a la luminosidad.
 *
 * FIX: validación de formato HSL + clamp de valores.
 */
function lightenHSL(hsl: string, amount: number): string {
  const match = hsl.match(/^(\d+)\s+(\d+)%\s+(\d+)%$/);
  if (!match) {
    console.warn(`[Theme] Invalid HSL format: "${hsl}"`);
    return hsl;
  }

  const h = parseInt(match[1], 10);
  const s = parseInt(match[2], 10);
  const l = parseInt(match[3], 10);

  // Clamp luminosidad entre 0-100
  const newL = Math.max(0, Math.min(100, l + amount));

  return `${h} ${s}% ${newL}%`;
}

/**
 * Aplica las custom properties CSS basadas en el branding de la organización.
 *
 * FIX: limpieza de propiedades CSS en unmount.
 * La versión original dejaba las `--primary`, `--secondary`, etc. en el DOM
 * permanentemente. Si el usuario cambiaba de organización o se deslogueaba,
 * las variables quedaban con valores stale. Ahora retorna una función de
 * cleanup que restaura los valores default.
 */
function applyBrandingCSS(branding: OrgBranding): () => void {
  const root = document.documentElement;
  const primaryHSL = hexToHSL(branding.color_primario);
  const secondaryHSL = hexToHSL(branding.color_secundario);

  root.style.setProperty("--primary", primaryHSL);
  root.style.setProperty("--ring", primaryHSL);
  root.style.setProperty("--sidebar-primary", primaryHSL);
  root.style.setProperty("--sidebar-ring", lightenHSL(primaryHSL, 5));
  root.style.setProperty("--secondary", secondaryHSL);

  // Gradientes
  const gradPrimary = `linear-gradient(135deg, hsl(${primaryHSL}) 0%, hsl(${secondaryHSL}) 100%)`;
  const gradButton = `linear-gradient(145deg, hsl(${lightenHSL(primaryHSL, 5)}) 0%, hsl(${lightenHSL(secondaryHSL, 5)}) 100%)`;
  root.style.setProperty("--gradient-primary", gradPrimary);
  root.style.setProperty("--gradient-button", gradButton);

  // Función de cleanup que restaura los defaults
  return () => {
    const defaultPrimaryHSL = hexToHSL(DEFAULT_BRANDING.color_primario);
    const defaultSecondaryHSL = hexToHSL(DEFAULT_BRANDING.color_secundario);

    root.style.setProperty("--primary", defaultPrimaryHSL);
    root.style.setProperty("--ring", defaultPrimaryHSL);
    root.style.setProperty("--sidebar-primary", defaultPrimaryHSL);
    root.style.setProperty("--sidebar-ring", lightenHSL(defaultPrimaryHSL, 5));
    root.style.setProperty("--secondary", defaultSecondaryHSL);

    const defaultGradPrimary = `linear-gradient(135deg, hsl(${defaultPrimaryHSL}) 0%, hsl(${defaultSecondaryHSL}) 100%)`;
    const defaultGradButton = `linear-gradient(145deg, hsl(${lightenHSL(defaultPrimaryHSL, 5)}) 0%, hsl(${lightenHSL(defaultSecondaryHSL, 5)}) 100%)`;
    root.style.setProperty("--gradient-primary", defaultGradPrimary);
    root.style.setProperty("--gradient-button", defaultGradButton);
  };
}

// ─── Tipos ────────────────────────────────────────────────────────────────────

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

interface ThemeContextType {
  branding: OrgBranding;
  loading: boolean;
  refreshBranding: () => Promise<void>;
}

// ─── Context ──────────────────────────────────────────────────────────────────

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

// ─── Provider ─────────────────────────────────────────────────────────────────

export const ThemeProvider = ({ children }: { children: ReactNode }) => {
  const { profile } = useAuth();
  const [branding, setBranding] = useState<OrgBranding>(DEFAULT_BRANDING);
  const [loading, setLoading] = useState(false);

  const cancelRef = useRef(false);

  useEffect(() => {
    cancelRef.current = false;
    return () => {
      cancelRef.current = true;
    };
  }, []);

  // ── Fetch branding ────────────────────────────────────────────────────────

  const fetchBranding = useCallback(async (orgId: string) => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("organizaciones")
        .select("id, nombre, slug, logo_url, color_primario, color_secundario, dominio_personalizado, plan_activo")
        .eq("id", orgId)
        .maybeSingle();

      if (cancelRef.current) return;
      if (error) throw error;

      if (data) {
        /*
          FIX: `|| DEFAULT_BRANDING.color_primario` → `?? DEFAULT_BRANDING.color_primario`.
          Si la organización tuviera colores configurados explícitamente como
          strings vacíos (edge case), el `||` los reemplazaría con los defaults.
          `??` solo aplica el fallback si son null/undefined.
        */
        const org: OrgBranding = {
          id: data.id,
          nombre: data.nombre,
          slug: data.slug,
          logo_url: data.logo_url,
          color_primario: data.color_primario ?? DEFAULT_BRANDING.color_primario,
          color_secundario: data.color_secundario ?? DEFAULT_BRANDING.color_secundario,
          dominio_personalizado: data.dominio_personalizado,
          plan_activo: data.plan_activo ?? true,
        };
        setBranding(org);
        /*
          FIX: `applyBrandingCSS(org)` llamado sincrónicamente dentro de
          `fetchBranding`. Esto es un efecto secundario de DOM ejecutado en
          una función async. Si el componente se desmonta antes de que el
          `await` resuelva, las variables CSS se aplicarían sobre un árbol
          ya limpiado o inexistente. Movido a un `useEffect` separado que
          observa el estado `branding`.
        */
      } else {
        // No se encontró la organización — usar defaults
        if (!cancelRef.current) {
          setBranding(DEFAULT_BRANDING);
        }
      }
    } catch (err) {
      if (cancelRef.current) return;
      console.error("[Theme] Error loading branding:", err);
      /*
        FIX: error handling silencioso.
        La versión original solo hacía `console.error`. Si la query de branding
        fallaba (ej: problema de red, permisos RLS), el usuario no veía nada.
        Añadido toast de error.
      */
      toast.error("No se pudo cargar el tema de la organización");
      setBranding(DEFAULT_BRANDING);
    } finally {
      if (!cancelRef.current) setLoading(false);
    }
  }, []);

  const orgId = profile?.organizacion_id ?? null;

  // ── Efecto: fetch branding cuando cambia orgId ────────────────────────────

  useEffect(() => {
    if (orgId) {
      fetchBranding(orgId);
    } else {
      // Sin organización — usar default
      setBranding(DEFAULT_BRANDING);
    }
  }, [orgId, fetchBranding]);

  // ── Efecto: aplicar CSS cuando cambia branding ────────────────────────────

  /*
    FIX: `applyBrandingCSS` movido a useEffect separado.
    La versión original lo llamaba sincrónicamente en `fetchBranding` y
    directamente en el cuerpo del efecto que detectaba `!orgId`. Esto mezclaba
    lógica de fetch con manipulación de DOM. Ahora toda la aplicación de CSS
    vive en un efecto que observa `branding`, y retorna el cleanup para
    restaurar defaults en unmount.
  */
  useEffect(() => {
    const cleanup = applyBrandingCSS(branding);
    return cleanup;
  }, [branding]);

  // ── Refresh manual ────────────────────────────────────────────────────────

  const refreshBranding = useCallback(async () => {
    if (orgId) await fetchBranding(orgId);
  }, [orgId, fetchBranding]);

  return <ThemeContext.Provider value={{ branding, loading, refreshBranding }}>{children}</ThemeContext.Provider>;
};

// ─── Hook ─────────────────────────────────────────────────────────────────────

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error("useTheme must be used within ThemeProvider");
  }
  return context;
};
