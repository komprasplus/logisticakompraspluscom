import { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Megaphone, Loader2, Save, ExternalLink, AlertTriangle, Check } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface TrackingConfig {
  meta: string;
  tiktok: string;
  ga4: string;
}

const QK = ["marketing-config"] as const;

const useMarketingConfig = () => {
  return useQuery({
    queryKey: QK,
    queryFn: async (): Promise<TrackingConfig> => {
      const { data: userData } = await supabase.auth.getUser();
      const userId = userData.user?.id;
      if (!userId) return { meta: "", tiktok: "", ga4: "" };
      const { data, error } = await (supabase as any)
        .from("profiles")
        .select("catalog_meta_pixel_id, catalog_tiktok_pixel_id, catalog_ga4_id")
        .eq("user_id", userId)
        .single();
      if (error) throw error;
      return {
        meta: data?.catalog_meta_pixel_id ?? "",
        tiktok: data?.catalog_tiktok_pixel_id ?? "",
        ga4: data?.catalog_ga4_id ?? "",
      };
    },
    staleTime: 60 * 1000,
  });
};

const MarketingConfigView = () => {
  const { data, isLoading } = useMarketingConfig();
  const qc = useQueryClient();

  const [meta, setMeta] = useState("");
  const [tiktok, setTiktok] = useState("");
  const [ga4, setGa4] = useState("");

  useEffect(() => {
    if (data) {
      setMeta(data.meta);
      setTiktok(data.tiktok);
      setGa4(data.ga4);
    }
  }, [data]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      const { data: userData } = await supabase.auth.getUser();
      const userId = userData.user?.id;
      if (!userId) throw new Error("No autenticado");
      const { error } = await (supabase as any)
        .from("profiles")
        .update({
          catalog_meta_pixel_id: meta.trim() || null,
          catalog_tiktok_pixel_id: tiktok.trim() || null,
          catalog_ga4_id: ga4.trim() || null,
        })
        .eq("user_id", userId);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: QK });
      toast.success("Configuración de marketing guardada");
    },
    onError: (e: any) => toast.error(e?.message || "No se pudo guardar"),
  });

  const validMeta = !meta || /^\d{15,16}$/.test(meta.trim());
  const validTiktok = !tiktok || /^[A-Z0-9]{20}$/.test(tiktok.trim());
  const validGa4 = !ga4 || /^G-[A-Z0-9]+$/.test(ga4.trim());

  if (isLoading) {
    return (
      <div className="flex justify-center py-10">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="text-2xl font-black tracking-tight flex items-center gap-2">
          <Megaphone className="h-6 w-6 text-primary" />
          Marketing y tracking
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Conecta tu catálogo público con Meta (Facebook + Instagram), TikTok y Google Analytics 4
          para medir tráfico y conversiones, y pautar campañas con datos reales.
        </p>
      </div>

      <div className="rounded-xl border border-border bg-card p-5 space-y-5">
        {/* Meta Pixel */}
        <div>
          <div className="flex items-center justify-between gap-2 mb-1">
            <Label htmlFor="meta-pixel" className="text-sm font-semibold">
              Meta Pixel ID (Facebook + Instagram)
            </Label>
            <a
              href="https://business.facebook.com/events_manager2/list/pixel"
              target="_blank"
              rel="noopener noreferrer"
              className="text-[11px] text-primary hover:underline flex items-center gap-0.5"
            >
              Obtenerlo <ExternalLink className="h-3 w-3" />
            </a>
          </div>
          <Input
            id="meta-pixel"
            value={meta}
            onChange={(e) => setMeta(e.target.value.replace(/\D/g, ""))}
            placeholder="1234567890123456"
            className="font-mono"
            maxLength={16}
          />
          <p
            className={`text-[10px] mt-1 flex items-center gap-1 ${
              !meta ? "text-muted-foreground" : validMeta ? "text-emerald-600" : "text-amber-600"
            }`}
          >
            {meta ? (
              validMeta ? (
                <>
                  <Check className="h-3 w-3" /> Formato válido
                </>
              ) : (
                <>
                  <AlertTriangle className="h-3 w-3" /> Debe ser un número de 15 o 16 dígitos
                </>
              )
            ) : (
              "15-16 dígitos. Eventos: PageView, ViewContent, AddToCart, InitiateCheckout, Purchase."
            )}
          </p>
        </div>

        {/* TikTok Pixel */}
        <div>
          <div className="flex items-center justify-between gap-2 mb-1">
            <Label htmlFor="tiktok-pixel" className="text-sm font-semibold">
              TikTok Pixel ID
            </Label>
            <a
              href="https://ads.tiktok.com/i18n/events_manager/"
              target="_blank"
              rel="noopener noreferrer"
              className="text-[11px] text-primary hover:underline flex items-center gap-0.5"
            >
              Obtenerlo <ExternalLink className="h-3 w-3" />
            </a>
          </div>
          <Input
            id="tiktok-pixel"
            value={tiktok}
            onChange={(e) => setTiktok(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ""))}
            placeholder="C8AB1ABCDEFGHIJKLMNO"
            className="font-mono"
            maxLength={20}
          />
          <p
            className={`text-[10px] mt-1 flex items-center gap-1 ${
              !tiktok ? "text-muted-foreground" : validTiktok ? "text-emerald-600" : "text-amber-600"
            }`}
          >
            {tiktok ? (
              validTiktok ? (
                <>
                  <Check className="h-3 w-3" /> Formato válido
                </>
              ) : (
                <>
                  <AlertTriangle className="h-3 w-3" /> Debe ser 20 caracteres alfanuméricos
                </>
              )
            ) : (
              "20 caracteres. Eventos: ViewContent, AddToCart, InitiateCheckout, PlaceAnOrder."
            )}
          </p>
        </div>

        {/* GA4 */}
        <div>
          <div className="flex items-center justify-between gap-2 mb-1">
            <Label htmlFor="ga4" className="text-sm font-semibold">
              Google Analytics 4 (Measurement ID)
            </Label>
            <a
              href="https://analytics.google.com/analytics/web/"
              target="_blank"
              rel="noopener noreferrer"
              className="text-[11px] text-primary hover:underline flex items-center gap-0.5"
            >
              Obtenerlo <ExternalLink className="h-3 w-3" />
            </a>
          </div>
          <Input
            id="ga4"
            value={ga4}
            onChange={(e) => setGa4(e.target.value.toUpperCase().replace(/[^G0-9-]/g, ""))}
            placeholder="G-XXXXXXXXXX"
            className="font-mono"
            maxLength={20}
          />
          <p
            className={`text-[10px] mt-1 flex items-center gap-1 ${
              !ga4 ? "text-muted-foreground" : validGa4 ? "text-emerald-600" : "text-amber-600"
            }`}
          >
            {ga4 ? (
              validGa4 ? (
                <>
                  <Check className="h-3 w-3" /> Formato válido
                </>
              ) : (
                <>
                  <AlertTriangle className="h-3 w-3" /> Debe empezar con "G-"
                </>
              )
            ) : (
              "Formato G-XXXXXXXXXX. Eventos: page_view, view_item, add_to_cart, begin_checkout, purchase."
            )}
          </p>
        </div>

        <div className="pt-2 flex items-center justify-end gap-2">
          <Button
            onClick={() => saveMutation.mutate()}
            disabled={saveMutation.isPending || (!validMeta || !validTiktok || !validGa4)}
            className="gap-1.5"
          >
            {saveMutation.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Save className="h-4 w-4" />
            )}
            Guardar cambios
          </Button>
        </div>
      </div>

      <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-xs text-amber-900 flex gap-3">
        <AlertTriangle className="h-4 w-4 flex-shrink-0 mt-0.5" />
        <p>
          Los pixeles se cargan únicamente en el catálogo público de tus visitantes — no en tu
          dashboard ni en sesiones autenticadas. Respeta la normativa local de cookies (CCPA / GDPR / Habeas Data).
        </p>
      </div>
    </div>
  );
};

export default MarketingConfigView;
