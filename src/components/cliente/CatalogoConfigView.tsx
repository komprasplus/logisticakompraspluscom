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
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from "@/components/ui/tooltip";
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
  // ── Branding pro ──
  catalog_hero_image_url: string | null;
  catalog_hero_title: string | null;
  catalog_hero_subtitle: string | null;
  catalog_instagram: string | null;
  catalog_facebook: string | null;
  catalog_tiktok: string | null;
  catalog_website: string | null;
  catalog_whatsapp: string | null;
  catalog_grid_columns: number;
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
    catalog_hero_image_url: null,
    catalog_hero_title: null,
    catalog_hero_subtitle: null,
    catalog_instagram: null,
    catalog_facebook: null,
    catalog_tiktok: null,
    catalog_website: null,
    catalog_whatsapp: null,
    catalog_grid_columns: 4,
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
      const { data, error } = await (supabase as any)
        .from("profiles")
        .select(
          "catalog_template, catalog_color_primary, catalog_color_secondary, catalog_description, catalog_public_enabled, catalog_slug, mostrar_precios_catalogo, phone, store_name, logo_url, catalog_hero_image_url, catalog_hero_title, catalog_hero_subtitle, catalog_instagram, catalog_facebook, catalog_tiktok, catalog_website, catalog_whatsapp, catalog_grid_columns",
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
          catalog_hero_image_url: (d as any).catalog_hero_image_url ?? null,
          catalog_hero_title: (d as any).catalog_hero_title ?? null,
          catalog_hero_subtitle: (d as any).catalog_hero_subtitle ?? null,
          catalog_instagram: (d as any).catalog_instagram ?? null,
          catalog_facebook: (d as any).catalog_facebook ?? null,
          catalog_tiktok: (d as any).catalog_tiktok ?? null,
          catalog_website: (d as any).catalog_website ?? null,
          catalog_whatsapp: (d as any).catalog_whatsapp ?? null,
          catalog_grid_columns: (d as any).catalog_grid_columns ?? 4,
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
      const { error } = await (supabase as any)
        .from("profiles")
        .update({
          catalog_template: config.catalog_template,
          catalog_color_primary: config.catalog_color_primary,
          catalog_color_secondary: config.catalog_color_secondary,
          catalog_description: config.catalog_description?.trim() || null,
          catalog_public_enabled: config.catalog_public_enabled,
          mostrar_precios_catalogo: config.mostrar_precios_catalogo,
          catalog_hero_image_url: config.catalog_hero_image_url?.trim() || null,
          catalog_hero_title: config.catalog_hero_title?.trim() || null,
          catalog_hero_subtitle: config.catalog_hero_subtitle?.trim() || null,
          catalog_instagram: config.catalog_instagram?.trim() || null,
          catalog_facebook: config.catalog_facebook?.trim() || null,
          catalog_tiktok: config.catalog_tiktok?.trim() || null,
          catalog_website: config.catalog_website?.trim() || null,
          catalog_whatsapp: config.catalog_whatsapp?.trim() || null,
          catalog_grid_columns: config.catalog_grid_columns,
        })
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

      {/* ── Toggle: Visibilidad de precios B2B / B2C ──────── */}
      <Card className="p-6 rounded-[20px] border border-border/60 shadow-sm">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1">
            <Label className="text-base font-bold text-foreground flex items-center gap-2">
              <DollarSign className="h-5 w-5 text-emerald-600" />
              Mostrar precios en mi catálogo público
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button type="button" className="text-muted-foreground hover:text-foreground">
                      <Info className="h-4 w-4" />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent side="top" className="max-w-xs">
                    Apágalo si quieres enviar este catálogo a clientes finales sin revelar tus costos.
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </Label>
            <p className="text-xs text-muted-foreground mt-1">
              {config.mostrar_precios_catalogo
                ? "Modo B2B: tus dropshippers verán los precios mayoristas."
                : "Modo B2C: el catálogo se compartirá sin precios; los clientes deberán cotizar por WhatsApp."}
            </p>
          </div>
          <Switch
            checked={config.mostrar_precios_catalogo}
            onCheckedChange={(v) =>
              setConfig((c) => ({ ...c, mostrar_precios_catalogo: v }))
            }
          />
        </div>
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

      {/* ── Hero Banner ───────────────────────────────────── */}
      <Card className="p-4 sm:p-6">
        <div className="mb-4">
          <h3 className="text-base font-bold text-foreground flex items-center gap-2">
            🖼️ Banner Principal (Hero)
          </h3>
          <p className="text-xs text-muted-foreground mt-1">
            Imagen grande en la parte superior de tu catálogo. Recomendado 1600×640px.
          </p>
        </div>
        <div className="space-y-3">
          <div>
            <label className="text-xs font-semibold text-muted-foreground mb-1 block">URL de la imagen</label>
            <Input
              value={config.catalog_hero_image_url ?? ""}
              onChange={(e) => setConfig((c) => ({ ...c, catalog_hero_image_url: e.target.value }))}
              placeholder="https://images.unsplash.com/..."
            />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-semibold text-muted-foreground mb-1 block">Título sobre el banner (opc.)</label>
              <Input
                value={config.catalog_hero_title ?? ""}
                onChange={(e) => setConfig((c) => ({ ...c, catalog_hero_title: e.target.value }))}
                placeholder="Tu mayorista de confianza"
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-muted-foreground mb-1 block">Subtítulo (opc.)</label>
              <Input
                value={config.catalog_hero_subtitle ?? ""}
                onChange={(e) => setConfig((c) => ({ ...c, catalog_hero_subtitle: e.target.value }))}
                placeholder="Envíos a toda Colombia · Pago contra entrega"
              />
            </div>
          </div>
          {config.catalog_hero_image_url && (
            <div className="rounded-lg overflow-hidden border border-border aspect-[5/2] bg-slate-100 relative">
              <img src={config.catalog_hero_image_url} alt="Preview" className="absolute inset-0 w-full h-full object-cover" />
              {(config.catalog_hero_title || config.catalog_hero_subtitle) && (
                <>
                  <div className="absolute inset-0 bg-gradient-to-t from-black/70 to-transparent" />
                  <div className="absolute inset-x-0 bottom-0 p-4 text-white">
                    {config.catalog_hero_title && <h4 className="font-black text-xl">{config.catalog_hero_title}</h4>}
                    {config.catalog_hero_subtitle && <p className="text-sm">{config.catalog_hero_subtitle}</p>}
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      </Card>

      {/* ── Redes sociales ────────────────────────────────── */}
      <Card className="p-4 sm:p-6">
        <div className="mb-4">
          <h3 className="text-base font-bold text-foreground flex items-center gap-2">
            🌐 Redes sociales y contacto
          </h3>
          <p className="text-xs text-muted-foreground mt-1">
            Aparecen como iconos en el footer de tu catálogo público.
          </p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="text-xs font-semibold text-muted-foreground mb-1 block">Instagram (usuario o URL)</label>
            <Input
              value={config.catalog_instagram ?? ""}
              onChange={(e) => setConfig((c) => ({ ...c, catalog_instagram: e.target.value }))}
              placeholder="@mitienda"
            />
          </div>
          <div>
            <label className="text-xs font-semibold text-muted-foreground mb-1 block">Facebook (usuario o URL)</label>
            <Input
              value={config.catalog_facebook ?? ""}
              onChange={(e) => setConfig((c) => ({ ...c, catalog_facebook: e.target.value }))}
              placeholder="mitiendafb"
            />
          </div>
          <div>
            <label className="text-xs font-semibold text-muted-foreground mb-1 block">TikTok (usuario o URL)</label>
            <Input
              value={config.catalog_tiktok ?? ""}
              onChange={(e) => setConfig((c) => ({ ...c, catalog_tiktok: e.target.value }))}
              placeholder="@mitienda"
            />
          </div>
          <div>
            <label className="text-xs font-semibold text-muted-foreground mb-1 block">Sitio web (URL)</label>
            <Input
              value={config.catalog_website ?? ""}
              onChange={(e) => setConfig((c) => ({ ...c, catalog_website: e.target.value }))}
              placeholder="https://mitienda.com"
            />
          </div>
          <div className="sm:col-span-2">
            <label className="text-xs font-semibold text-muted-foreground mb-1 block">WhatsApp (número con código país)</label>
            <Input
              value={config.catalog_whatsapp ?? ""}
              onChange={(e) => setConfig((c) => ({ ...c, catalog_whatsapp: e.target.value }))}
              placeholder="573001234567"
              inputMode="tel"
            />
          </div>
        </div>
      </Card>

      {/* ── Layout (columnas del grid) ────────────────────── */}
      <Card className="p-4 sm:p-6">
        <div className="mb-4">
          <h3 className="text-base font-bold text-foreground flex items-center gap-2">
            📐 Layout del catálogo
          </h3>
          <p className="text-xs text-muted-foreground mt-1">
            Cuántas columnas de productos mostrar en pantalla grande (móvil siempre es 2).
          </p>
        </div>
        <div className="grid grid-cols-3 gap-3">
          {[2, 3, 4].map((cols) => {
            const active = config.catalog_grid_columns === cols;
            return (
              <button
                key={cols}
                type="button"
                onClick={() => setConfig((c) => ({ ...c, catalog_grid_columns: cols }))}
                className={cn(
                  "p-4 rounded-xl border-2 text-center transition-all",
                  active ? "border-primary bg-primary/5" : "border-border hover:border-primary/30",
                )}
              >
                <div className={cn(
                  "grid gap-1 mb-2 mx-auto",
                  cols === 2 && "grid-cols-2 max-w-[60px]",
                  cols === 3 && "grid-cols-3 max-w-[80px]",
                  cols === 4 && "grid-cols-4 max-w-[100px]",
                )}>
                  {Array.from({ length: cols * 2 }).map((_, i) => (
                    <div key={i} className="aspect-square rounded bg-muted-foreground/30" />
                  ))}
                </div>
                <p className="text-sm font-bold text-foreground">{cols} columnas</p>
                {active && (
                  <p className="text-[10px] text-primary font-semibold mt-1 flex items-center justify-center gap-1">
                    <Check className="h-3 w-3" /> Activa
                  </p>
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
