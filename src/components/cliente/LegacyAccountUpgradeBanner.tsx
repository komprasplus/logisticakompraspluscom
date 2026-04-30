import { useState } from "react";
import { Sparkles, Truck, Package, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { isLegacyAccount } from "@/lib/accountType";
import { toast } from "sonner";

const DISMISS_KEY = "legacy-account-banner-dismissed";

/**
 * Optional one-time prompt shown to legacy "cliente" / "tienda" users
 * (those with no `tipo_cuenta` set yet) inviting them to confirm whether
 * they operate as Dropshipper or Proveedor. Non-blocking and dismissable.
 */
const LegacyAccountUpgradeBanner = () => {
  const { role, profile, user, refreshProfile } = useAuth();
  const dismissed = typeof window !== "undefined" && localStorage.getItem(DISMISS_KEY) === "1";
  const [hidden, setHidden] = useState(dismissed);
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  // Only show when the user is legacy AND hasn't dismissed
  if (!profile || hidden) return null;
  if (!isLegacyAccount(role, profile.tipo_cuenta)) return null;

  const dismiss = () => {
    try {
      localStorage.setItem(DISMISS_KEY, "1");
    } catch {
      /* ignore */
    }
    setHidden(true);
  };

  const choose = async (tipo: "dropshipper" | "proveedor") => {
    if (!user?.id) return;
    setSaving(true);
    try {
      const { error } = await supabase
        .from("profiles")
        .update({ tipo_cuenta: tipo })
        .eq("user_id", user.id);
      if (error) throw error;
      toast.success(`Perfil actualizado: ${tipo === "dropshipper" ? "Dropshipper" : "Proveedor"}`);
      await refreshProfile();
      setOpen(false);
      dismiss();
    } catch (err: any) {
      toast.error("No se pudo actualizar: " + (err?.message || "Error"));
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <div className="rounded-2xl border border-primary/30 bg-gradient-to-r from-primary/10 to-primary/5 p-4 flex items-center gap-3 shadow-sm">
        <div className="w-10 h-10 rounded-xl bg-primary/15 flex items-center justify-center shrink-0">
          <Sparkles className="h-5 w-5 text-primary" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-foreground">Actualiza tu perfil</p>
          <p className="text-xs text-muted-foreground">
            Cuéntanos cómo operas para personalizar tu experiencia. Esto no afecta tu acceso actual.
          </p>
        </div>
        <Button size="sm" onClick={() => setOpen(true)}>
          Elegir tipo
        </Button>
        <Button
          size="icon"
          variant="ghost"
          onClick={dismiss}
          aria-label="Cerrar"
          className="shrink-0"
        >
          <X className="h-4 w-4" />
        </Button>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>¿Cómo opera tu negocio?</DialogTitle>
            <DialogDescription>
              Esto solo actualiza tu perfil; mantienes tu acceso y todos tus datos.
            </DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-2">
            <button
              type="button"
              disabled={saving}
              onClick={() => choose("dropshipper")}
              className="rounded-2xl border border-border hover:border-primary p-4 text-left transition-all disabled:opacity-50"
            >
              <Truck className="h-6 w-6 text-primary mb-2" />
              <p className="font-semibold text-sm">Dropshipper</p>
              <p className="text-xs text-muted-foreground">Revendo productos y gestiono envíos.</p>
            </button>
            <button
              type="button"
              disabled={saving}
              onClick={() => choose("proveedor")}
              className="rounded-2xl border border-border hover:border-primary p-4 text-left transition-all disabled:opacity-50"
            >
              <Package className="h-6 w-6 text-primary mb-2" />
              <p className="font-semibold text-sm">Proveedor</p>
              <p className="text-xs text-muted-foreground">Publico catálogo para que otros distribuyan.</p>
            </button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default LegacyAccountUpgradeBanner;
