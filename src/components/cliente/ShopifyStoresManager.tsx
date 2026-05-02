import { useState, useEffect, useCallback } from "react";
import { ShoppingBag, Plus, Trash2, Loader2, ArrowLeft, ExternalLink, AlertCircle } from "lucide-react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface ConnectedStore {
  id: string;
  nombre_tienda: string;
  url_tienda: string;
  estado: "Activo" | "Inactivo";
  last_sync_at: string | null;
  created_at: string;
}

interface ShopifyStoresManagerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  clientUserId: string;
}

type View = "list" | "new";

const normalizeShopUrl = (raw: string): string =>
  raw
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, "")
    .replace(/\/+$/, "");

const ShopifyStoresManager = ({ open, onOpenChange, clientUserId }: ShopifyStoresManagerProps) => {
  const { toast } = useToast();
  const [view, setView] = useState<View>("list");
  const [stores, setStores] = useState<ConnectedStore[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const [nombre, setNombre] = useState("");
  const [url, setUrl] = useState("");
  const [token, setToken] = useState("");

  const fetchStores = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("connected_stores")
      .select("id, nombre_tienda, url_tienda, estado, last_sync_at, created_at")
      .eq("user_id", clientUserId)
      .eq("plataforma", "shopify")
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Error fetching stores:", error);
      toast({ title: "Error", description: "No se pudieron cargar las tiendas.", variant: "destructive" });
    } else {
      setStores((data ?? []) as ConnectedStore[]);
    }
    setLoading(false);
  }, [clientUserId, toast]);

  useEffect(() => {
    if (open && clientUserId) {
      setView("list");
      fetchStores();
    }
  }, [open, clientUserId, fetchStores]);

  const resetForm = () => {
    setNombre("");
    setUrl("");
    setToken("");
  };

  const handleSave = async () => {
    if (!nombre.trim() || !url.trim() || !token.trim()) {
      toast({ title: "Campos requeridos", description: "Completa los 3 campos.", variant: "destructive" });
      return;
    }
    const normalized = normalizeShopUrl(url);
    if (!normalized.includes(".myshopify.com")) {
      toast({
        title: "URL inválida",
        description: "Debe terminar en .myshopify.com (ej: mitienda.myshopify.com)",
        variant: "destructive",
      });
      return;
    }

    setSaving(true);
    const { data: userData, error: userErr } = await supabase.auth.getUser();
    if (userErr || !userData.user) {
      setSaving(false);
      toast({ title: "Sesión expirada", description: "Inicia sesión de nuevo.", variant: "destructive" });
      return;
    }
    const { error } = await supabase.from("connected_stores").insert({
      user_id: userData.user.id,
      plataforma: "shopify",
      nombre_tienda: nombre.trim(),
      url_tienda: normalized,
      api_access_token: token.trim(),
      estado: "Activo",
    });
    setSaving(false);

    if (error) {
      const msg = error.message?.includes("connected_stores_url_unique")
        ? "Esta tienda ya está vinculada a una cuenta."
        : error.message || "No se pudo vincular la tienda.";
      toast({ title: "Error", description: msg, variant: "destructive" });
      return;
    }

    toast({ title: "¡Tienda vinculada!", description: `${nombre} está lista para recibir pedidos.` });
    resetForm();
    setView("list");
    fetchStores();
  };

  const handleToggle = async (id: string, currentEstado: "Activo" | "Inactivo") => {
    const next = currentEstado === "Activo" ? "Inactivo" : "Activo";
    setStores((prev) => prev.map((s) => (s.id === id ? { ...s, estado: next } : s)));
    const { error } = await supabase.from("connected_stores").update({ estado: next }).eq("id", id);
    if (error) {
      setStores((prev) => prev.map((s) => (s.id === id ? { ...s, estado: currentEstado } : s)));
      toast({ title: "Error", description: "No se pudo cambiar el estado.", variant: "destructive" });
    }
  };

  const handleDelete = async (id: string) => {
    setConfirmDeleteId(null);
    const { error } = await supabase.from("connected_stores").delete().eq("id", id);
    if (error) {
      toast({ title: "Error", description: "No se pudo eliminar.", variant: "destructive" });
    } else {
      toast({ title: "Tienda eliminada", description: "La conexión ha sido removida." });
      fetchStores();
    }
  };

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
          <SheetHeader className="space-y-2">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-xl bg-gradient-to-br from-green-500 to-green-600 shadow-lg">
                <ShoppingBag className="h-5 w-5 text-white" />
              </div>
              <div>
                <SheetTitle>Administrador de Tiendas Shopify</SheetTitle>
                <SheetDescription>
                  Conecta múltiples tiendas Shopify a tu cuenta Plus Envíos.
                </SheetDescription>
              </div>
            </div>
          </SheetHeader>

          <div className="mt-6">
            {view === "list" ? (
              <div className="space-y-4">
                <Button
                  type="button"
                  onClick={() => {
                    resetForm();
                    setView("new");
                  }}
                  className="w-full bg-gradient-to-r from-primary to-primary/80"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Vincular Nueva Tienda
                </Button>

                {loading ? (
                  <div className="flex justify-center py-8">
                    <Loader2 className="h-6 w-6 animate-spin text-primary" />
                  </div>
                ) : stores.length === 0 ? (
                  <div className="text-center py-8 border-2 border-dashed rounded-xl">
                    <ShoppingBag className="h-10 w-10 mx-auto text-muted-foreground/50 mb-2" />
                    <p className="text-sm text-muted-foreground">Aún no tienes tiendas conectadas.</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {stores.map((s) => (
                      <div key={s.id} className="p-4 rounded-xl border bg-muted/30 space-y-2">
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2 mb-1">
                              <span className="font-medium truncate">{s.nombre_tienda}</span>
                              <Badge
                                className={
                                  s.estado === "Activo"
                                    ? "bg-green-500/10 text-green-600"
                                    : "bg-muted text-muted-foreground"
                                }
                              >
                                {s.estado}
                              </Badge>
                            </div>
                            <a
                              href={`https://${s.url_tienda}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-xs text-muted-foreground font-mono inline-flex items-center gap-1 hover:text-primary"
                            >
                              {s.url_tienda}
                              <ExternalLink className="h-3 w-3" />
                            </a>
                          </div>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="text-destructive hover:bg-destructive/10"
                            onClick={() => setConfirmDeleteId(s.id)}
                            aria-label="Eliminar tienda"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                        <div className="flex items-center gap-2 pt-1">
                          <Switch
                            checked={s.estado === "Activo"}
                            onCheckedChange={() => handleToggle(s.id, s.estado)}
                          />
                          <Label className="text-xs text-muted-foreground">
                            {s.estado === "Activo" ? "Recibiendo pedidos" : "Pausada"}
                          </Label>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              <div className="space-y-4">
                <Button variant="ghost" size="sm" onClick={() => setView("list")} className="-ml-2">
                  <ArrowLeft className="h-4 w-4 mr-1" />
                  Volver
                </Button>

                <div className="space-y-3">
                  <div>
                    <Label htmlFor="store-name">Nombre identificador *</Label>
                    <Input
                      id="store-name"
                      value={nombre}
                      onChange={(e) => setNombre(e.target.value)}
                      placeholder="Ej: Mi Tienda Belleza"
                      className="mt-1"
                    />
                    <p className="text-xs text-muted-foreground mt-1">
                      Para que reconozcas esta tienda en tu panel.
                    </p>
                  </div>
                  <div>
                    <Label htmlFor="store-url">URL de la tienda Shopify *</Label>
                    <Input
                      id="store-url"
                      value={url}
                      onChange={(e) => setUrl(e.target.value)}
                      placeholder="mitienda.myshopify.com"
                      className="mt-1 font-mono"
                    />
                  </div>
                  <div>
                    <Label htmlFor="store-token">Admin API Access Token *</Label>
                    <Input
                      id="store-token"
                      type="password"
                      value={token}
                      onChange={(e) => setToken(e.target.value)}
                      placeholder="shpat_xxxxxxxxxxxxxxxxxxxx"
                      className="mt-1 font-mono"
                      autoComplete="off"
                    />
                  </div>
                </div>

                <Alert>
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription className="text-xs">
                    Genera un token desde tu Shopify Admin → Apps → Develop apps → Crear app privada → Admin API
                    access token.
                  </AlertDescription>
                </Alert>

                <Button
                  type="button"
                  onClick={handleSave}
                  disabled={saving}
                  className="w-full bg-gradient-to-r from-green-500 to-green-600"
                >
                  {saving ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" /> Vinculando...
                    </>
                  ) : (
                    <>
                      <Plus className="h-4 w-4 mr-2" /> Vincular Tienda
                    </>
                  )}
                </Button>
              </div>
            )}
          </div>
        </SheetContent>
      </Sheet>

      <AlertDialog
        open={!!confirmDeleteId}
        onOpenChange={(o) => !o && setConfirmDeleteId(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar esta tienda?</AlertDialogTitle>
            <AlertDialogDescription>
              Los pedidos futuros desde esta tienda dejarán de llegar a Plus Envíos. Los pedidos existentes no se
              ven afectados.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => confirmDeleteId && handleDelete(confirmDeleteId)}
            >
              Sí, eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};

export default ShopifyStoresManager;
