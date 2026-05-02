import { useCallback, useEffect, useState } from "react";
import {
  DollarSign,
  Info,
  Loader2,
  Save,
  ExternalLink,
  Copy,
  Check,
  Eye,
  EyeOff,
  Sparkles,
  LayoutGrid,
  Crown,
  ShoppingBag,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Card } from "@/components/ui/card";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { cn } from "@/lib/utils";

type Template = "minimal" | "professional" | "premium";

interface CatalogConfig {
  catalog_template: Template;
  catalog_color_primary: string;
  catalog_color_secondary: string;
  catalog_description: string | null;
  catalog_public_enabled: boolean;
  catalog_slug: string | null;
  mostrar_precios_catalogo: boolean;
  phone: string | null;
  store_name: string | null;
  logo_url: string | null;
}

const TEMPLATES: {
  key: Template;
  label: string;
  description: string;
  icon: typeof ShoppingBag;
  preview: string;
}[] = [
  {
    key: "minimal",
    label: "Minimalista",
    description: "Blanco, limpio, listado simple. Ideal para catálogos densos.",
    icon: LayoutGrid,
    preview: "bg-white border-gray-200",
  },
  {
    key: "professional",
    label: "Profesional",
    description: "Grid estructurado, bordes definidos, estilo corporativo.",
    icon: ShoppingBag,
    preview: "bg-slate-50 border-slate-300",
  },
  {
    key: "premium",
    label: "Premium",
    description: "Tarjetas con sombras amplias, diseño envolvente y moderno.",
    icon: Crown,
    preview: "bg-gradient-to-br from-fuchsia-50 to-purple-100 border-fuchsia-200",
  },
];

const CatalogoConfigView = () => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [copied, setCopied] = useState(false);
  const [config, setConfig] = useState<CatalogConfig>({
    catalog_template: "minimal",
    catalog_color_primary: "#00D1FF",
    catalog_color_secondary: "#0099CC",
    catalog_description: null,
    catalog_public_enabled: false,
    catalog_slug: null,
    mostrar_precios_catalogo: true,
    phone: null,
    store_name: null,
    logo_url: null,
  });

  const publicUrl =
    typeof window !== "undefined" && config.catalog_slug
      ? `${window.location.origin}/${config.catalog_slug}/catalogo`
      : typeof window !== "undefined" && user?.id
      ? `${window.location.origin}/catalogo/${user.id}`
      : "";

  const fetchConfig = useCallback(async () => {
    if (!user?.id) return;
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("profiles")
        .select(
          "catalog_template, catalog_color_primary, catalog_color_secondary, catalog_description, catalog_public_enabled, catalog_slug, mostrar_precios_catalogo, phone, store_name, logo_url",
        )
        .eq("user_id", user.id)
        .single();

      if (error) throw error;
      if (data) {
        const d = data as typeof data & {
          catalog_slug?: string | null;
          mostrar_precios_catalogo?: boolean | null;
        };
        setConfig({
          catalog_template: (data.catalog_template as Template) ?? "minimal",
          catalog_color_primary: data.catalog_color_primary ?? "#00D1FF",
          catalog_color_secondary: data.catalog_color_secondary ?? "#0099CC",
          catalog_description: data.catalog_description,
          catalog_public_enabled: data.catalog_public_enabled ?? false,
          catalog_slug: d.catalog_slug ?? null,
          mostrar_precios_catalogo: d.mostrar_precios_catalogo ?? true,
          phone: data.phone,
          store_name: data.store_name,
          logo_url: data.logo_url,
        });
      }
    } catch (err) {
      console.error("Error fetching catalog config:", err);
      toast.error("No se pudo cargar la configuración del catálogo");
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  useEffect(() => {
    void fetchConfig();
  }, [fetchConfig]);

  const handleSave = async () => {
    if (!user?.id) return;
    setSaving(true);
    try {
      const { error } = await supabase
        .from("profiles")
        .update({
          catalog_template: config.catalog_template,
          catalog_color_primary: config.catalog_color_primary,
          catalog_color_secondary: config.catalog_color_secondary,
          catalog_description: config.catalog_description?.trim() || null,
          catalog_public_enabled: config.catalog_public_enabled,
          mostrar_precios_catalogo: config.mostrar_precios_catalogo,
        } as never)
        .eq("user_id", user.id);

      if (error) throw error;
      toast.success("Configuración del catálogo guardada");
    } catch (err) {
      console.error(err);
      toast.error("Error al guardar la configuración");
    } finally {
      setSaving(false);
    }
  };

  const handleCopy = async () => {
    if (!publicUrl) return;
    try {
      await navigator.clipboard.writeText(publicUrl);
      setCopied(true);
      toast.success("Link copiado al portapapeles");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("No se pudo copiar el link");
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const phoneOk = !!config.phone?.trim();

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div>
        <h2 className="text-2xl font-bold text-foreground flex items-center gap-2">
          <Sparkles className="h-6 w-6 text-primary" />
          Mi Catálogo Público
        </h2>
        <p className="text-sm text-muted-foreground mt-1">
          Genera un link único para compartir tus productos con dropshippers y revendedores. Estilo QuickSell.
        </p>
      </div>

      {/* ── Activación + URL pública ─────────────────────────── */}
      <Card className="p-6 space-y-4 rounded-[20px] border border-border/60 shadow-sm">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1">
            <Label className="text-base font-bold text-foreground flex items-center gap-2">
              {config.catalog_public_enabled ? (
                <Eye className="h-5 w-5 text-emerald-600" />
              ) : (
                <EyeOff className="h-5 w-5 text-muted-foreground" />
              )}
              Catálogo público {config.catalog_public_enabled ? "activado" : "desactivado"}
            </Label>
            <p className="text-xs text-muted-foreground mt-1">
              Cuando está activado, cualquier persona con el link verá tus productos marcados como{" "}
              <strong>"Públicos"</strong> en tu inventario.
            </p>
          </div>
          <Switch
            checked={config.catalog_public_enabled}
            onCheckedChange={(v) =>
              setConfig((c) => ({ ...c, catalog_public_enabled: v }))
            }
          />
        </div>

        {config.catalog_public_enabled && (
          <div className="space-y-2 pt-2 border-t border-border/40">
            <Label className="text-xs uppercase font-bold text-muted-foreground tracking-wider">
              Tu link público
            </Label>
            <div className="flex gap-2">
              <Input
                readOnly
                value={publicUrl}
                className="font-mono text-xs bg-muted/30"
              />
              <Button variant="outline" size="icon" onClick={handleCopy} title="Copiar link">
                {copied ? (
                  <Check className="h-4 w-4 text-emerald-600" />
                ) : (
                  <Copy className="h-4 w-4" />
                )}
              </Button>
              <Button variant="outline" size="icon" asChild title="Abrir catálogo">
                <a href={publicUrl} target="_blank" rel="noopener noreferrer">
                  <ExternalLink className="h-4 w-4" />
                </a>
              </Button>
            </div>
            {config.catalog_slug ? (
              <p className="text-[11px] text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg p-2">
                ✨ URL amigable activa: <strong className="font-mono">{config.catalog_slug}</strong>.
                Se actualiza automáticamente cuando cambies el nombre de tu tienda.
              </p>
            ) : (
              <p className="text-[11px] text-muted-foreground">
                Tu link amigable se generará la próxima vez que actualices tu tienda.
              </p>
            )}
            {!phoneOk && (
              <p className="text-xs text-amber-600 bg-amber-50 border border-amber-200 rounded-lg p-2">
                ⚠️ Configura tu teléfono en "Mi Tienda" para que el botón de WhatsApp funcione.
              </p>
            )}
          </div>
        )}
      </Card>

      {/* ── Branding ────────────────────────────────────────── */}
      <Card className="p-6 space-y-4 rounded-[20px] border border-border/60 shadow-sm">
        <h3 className="font-bold text-foreground">Branding del catálogo</h3>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="color-primary" className="text-sm font-semibold">
              Color primario
            </Label>
            <div className="flex gap-2">
              <Input
                id="color-primary"
                type="color"
                value={config.catalog_color_primary}
                onChange={(e) =>
                  setConfig((c) => ({ ...c, catalog_color_primary: e.target.value }))
                }
                className="w-16 h-10 p-1 cursor-pointer"
              />
              <Input
                value={config.catalog_color_primary}
                onChange={(e) =>
                  setConfig((c) => ({ ...c, catalog_color_primary: e.target.value }))
                }
                className="font-mono"
                placeholder="#00D1FF"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="color-secondary" className="text-sm font-semibold">
              Color secundario
            </Label>
            <div className="flex gap-2">
              <Input
                id="color-secondary"
                type="color"
                value={config.catalog_color_secondary}
                onChange={(e) =>
                  setConfig((c) => ({ ...c, catalog_color_secondary: e.target.value }))
                }
                className="w-16 h-10 p-1 cursor-pointer"
              />
              <Input
                value={config.catalog_color_secondary}
                onChange={(e) =>
                  setConfig((c) => ({ ...c, catalog_color_secondary: e.target.value }))
                }
                className="font-mono"
                placeholder="#0099CC"
              />
            </div>
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="description" className="text-sm font-semibold">
            Descripción de tu tienda{" "}
            <span className="text-xs text-muted-foreground font-normal">
              (aparece bajo el logo)
            </span>
          </Label>
          <Textarea
            id="description"
            value={config.catalog_description ?? ""}
            onChange={(e) =>
              setConfig((c) => ({ ...c, catalog_description: e.target.value }))
            }
            placeholder="Ej: Distribuidor mayorista de tecnología — Despachos a toda Colombia"
            maxLength={200}
            rows={2}
          />
          <p className="text-[10px] text-muted-foreground">
            {(config.catalog_description ?? "").length}/200 caracteres
          </p>
        </div>

        <p className="text-xs text-muted-foreground bg-muted/40 rounded-lg p-3">
          💡 Para cambiar tu logo, ve a la sección <strong>"Mi Tienda"</strong>.
        </p>
      </Card>

      {/* ── Plantilla ───────────────────────────────────────── */}
      <Card className="p-6 space-y-4 rounded-[20px] border border-border/60 shadow-sm">
        <h3 className="font-bold text-foreground">Elige una plantilla</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {TEMPLATES.map((t) => {
            const Icon = t.icon;
            const active = config.catalog_template === t.key;
            return (
              <button
                key={t.key}
                onClick={() =>
                  setConfig((c) => ({ ...c, catalog_template: t.key }))
                }
                className={cn(
                  "p-4 rounded-2xl border-2 text-left transition-all",
                  active
                    ? "border-primary ring-2 ring-primary/20 bg-primary/5"
                    : "border-border hover:border-muted-foreground/40",
                )}
              >
                <div
                  className={cn(
                    "h-20 rounded-lg border-2 mb-3 flex items-center justify-center",
                    t.preview,
                  )}
                >
                  <Icon className="h-8 w-8 text-foreground/60" />
                </div>
                <p className="font-bold text-sm text-foreground">{t.label}</p>
                <p className="text-[11px] text-muted-foreground mt-1 leading-snug">
                  {t.description}
                </p>
                {active && (
                  <div className="mt-2 flex items-center gap-1 text-xs text-primary font-semibold">
                    <Check className="h-3 w-3" /> Seleccionada
                  </div>
                )}
              </button>
            );
          })}
        </div>
      </Card>

      {/* ── Save ────────────────────────────────────────────── */}
      <div className="flex justify-end sticky bottom-4 z-10">
        <Button
          size="lg"
          onClick={handleSave}
          disabled={saving}
          className="gap-2 shadow-lg"
        >
          {saving ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Save className="h-4 w-4" />
          )}
          Guardar configuración
        </Button>
      </div>
    </div>
  );
};

export default CatalogoConfigView;
