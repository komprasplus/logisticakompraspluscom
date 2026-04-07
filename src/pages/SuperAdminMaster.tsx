import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { useToast } from "@/hooks/use-toast";
import { Plus, Building2, Palette, Globe, Loader2, LogOut, DatabaseZap, Users, ImagePlus } from "lucide-react";
import BrandLogo from "@/components/BrandLogo";
import RecalcularBilleterasButton from "@/components/admin/RecalcularBilleterasButton";
import { Badge } from "@/components/ui/badge";

interface Organizacion {
  id: string;
  nombre: string;
  slug: string;
  logo_url: string | null;
  color_primario: string;
  color_secundario: string;
  dominio_personalizado: string | null;
  plan_activo: boolean;
  created_at: string;
}

const SuperAdminMaster = () => {
  const { signOut, role } = useAuth();
  const { toast } = useToast();
  const [orgs, setOrgs] = useState<Organizacion[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [usersSheetOpen, setUsersSheetOpen] = useState(false);
  const [selectedOrgForUsers, setSelectedOrgForUsers] = useState<Organizacion | null>(null);
  const [orgUsers, setOrgUsers] = useState<{full_name: string; email: string | null; role: string}[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [form, setForm] = useState({
    nombre: "",
    slug: "",
    color_primario: "#6366f1",
    color_secundario: "#8b5cf6",
    dominio_personalizado: "",
  });

  const handleLogoSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setLogoFile(file);
    setLogoPreview(URL.createObjectURL(file));
  };

  const uploadLogo = async (file: File): Promise<string | null> => {
    const ext = file.name.split(".").pop() || "png";
    const fileName = `${crypto.randomUUID()}.${ext}`;
    const { error } = await supabase.storage.from("org-logos").upload(fileName, file, { contentType: file.type });
    if (error) {
      toast({ title: "Error al subir logo", description: error.message, variant: "destructive" });
      return null;
    }
    const { data: urlData } = supabase.storage.from("org-logos").getPublicUrl(fileName);
    return urlData.publicUrl;
  };

  const fetchOrgs = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("organizaciones")
      .select("*")
      .order("created_at", { ascending: true });

    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      setOrgs(data || []);
    }
    setLoading(false);
  };

  const fetchOrgUsers = async (orgId: string) => {
    setLoadingUsers(true);
    setOrgUsers([]);
    const { data: profiles } = await supabase
      .from("profiles")
      .select("user_id, full_name, email")
      .eq("organizacion_id", orgId);

    const { data: roles } = await supabase
      .from("user_roles")
      .select("user_id, role")
      .eq("organizacion_id", orgId);

    const roleMap = new Map((roles || []).map(r => [r.user_id, r.role]));
    setOrgUsers(
      (profiles || []).map(p => ({
        full_name: p.full_name,
        email: p.email,
        role: roleMap.get(p.user_id) || "sin rol",
      }))
    );
    setLoadingUsers(false);
  };

  useEffect(() => {
    fetchOrgs();
  }, []);

  const handleCreate = async () => {
    if (!form.nombre || !form.slug) {
      toast({ title: "Campos requeridos", description: "Nombre y slug son obligatorios", variant: "destructive" });
      return;
    }

    setCreating(true);

    let logo_url: string | null = null;
    if (logoFile) {
      logo_url = await uploadLogo(logoFile);
      if (!logo_url) { setCreating(false); return; }
    }

    const { error } = await supabase.from("organizaciones").insert({
      nombre: form.nombre,
      slug: form.slug.toLowerCase().replace(/\s+/g, "-"),
      color_primario: form.color_primario,
      color_secundario: form.color_secundario,
      dominio_personalizado: form.dominio_personalizado || null,
      logo_url,
    });

    if (error) {
      toast({ title: "Error al crear", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "✅ Organización creada", description: `${form.nombre} lista para configurar.` });
      setForm({ nombre: "", slug: "", color_primario: "#6366f1", color_secundario: "#8b5cf6", dominio_personalizado: "" });
      setLogoFile(null);
      setLogoPreview(null);
      setDialogOpen(false);
      fetchOrgs();
    }
    setCreating(false);
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border bg-card/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="container mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Building2 className="h-6 w-6 text-primary" />
            <h1 className="text-xl font-bold text-foreground">Panel Súper Admin</h1>
          </div>
          <Button variant="ghost" size="sm" onClick={signOut}>
            <LogOut className="h-4 w-4 mr-2" />
            Salir
          </Button>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
          <Card className="neu-card">
            <CardContent className="pt-6">
              <p className="text-sm text-muted-foreground">Organizaciones</p>
              <p className="text-3xl font-bold text-foreground">{orgs.length}</p>
            </CardContent>
          </Card>
          <Card className="neu-card">
            <CardContent className="pt-6">
              <p className="text-sm text-muted-foreground">Activas</p>
              <p className="text-3xl font-bold text-secondary">{orgs.filter(o => o.plan_activo).length}</p>
            </CardContent>
          </Card>
          <Card className="neu-card">
            <CardContent className="pt-6">
              <p className="text-sm text-muted-foreground">Con dominio propio</p>
              <p className="text-3xl font-bold text-primary">{orgs.filter(o => o.dominio_personalizado).length}</p>
            </CardContent>
          </Card>
        </div>

        {/* Actions */}
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-lg font-semibold text-foreground">Organizaciones</h2>
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button className="neu-button text-primary-foreground">
                <Plus className="h-4 w-4 mr-2" /> Nueva Organización
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Crear Organización</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <Label>Nombre</Label>
                  <Input value={form.nombre} onChange={e => setForm(p => ({ ...p, nombre: e.target.value }))} placeholder="Mi Empresa Logística" />
                </div>
                <div>
                  <Label>Slug (URL)</Label>
                  <Input value={form.slug} onChange={e => setForm(p => ({ ...p, slug: e.target.value }))} placeholder="mi-empresa" />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label className="flex items-center gap-2"><Palette className="h-3 w-3" /> Color Primario</Label>
                    <div className="flex gap-2 items-center">
                      <input type="color" value={form.color_primario} onChange={e => setForm(p => ({ ...p, color_primario: e.target.value }))} className="w-10 h-10 rounded-lg border-0 cursor-pointer" />
                      <Input value={form.color_primario} onChange={e => setForm(p => ({ ...p, color_primario: e.target.value }))} className="flex-1" />
                    </div>
                  </div>
                  <div>
                    <Label>Color Secundario</Label>
                    <div className="flex gap-2 items-center">
                      <input type="color" value={form.color_secundario} onChange={e => setForm(p => ({ ...p, color_secundario: e.target.value }))} className="w-10 h-10 rounded-lg border-0 cursor-pointer" />
                      <Input value={form.color_secundario} onChange={e => setForm(p => ({ ...p, color_secundario: e.target.value }))} className="flex-1" />
                    </div>
                  </div>
                </div>
                <div>
                  <Label className="flex items-center gap-2"><ImagePlus className="h-3 w-3" /> Logo corporativo</Label>
                  <div className="flex items-center gap-3 mt-1">
                    {logoPreview && <img src={logoPreview} alt="Preview" className="h-10 w-10 rounded-lg object-contain border border-border" />}
                    <Input type="file" accept="image/*" onChange={handleLogoSelect} className="flex-1" />
                  </div>
                </div>
                <div>
                  <Label className="flex items-center gap-2"><Globe className="h-3 w-3" /> Dominio personalizado</Label>
                  <Input value={form.dominio_personalizado} onChange={e => setForm(p => ({ ...p, dominio_personalizado: e.target.value }))} placeholder="logistica.miempresa.com" />
                </div>
                <Button onClick={handleCreate} disabled={creating} className="w-full neu-button text-primary-foreground">
                  {creating ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Plus className="h-4 w-4 mr-2" />}
                  {creating ? "Guardando..." : "Crear Organización"}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        {/* Org List */}
        {loading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {orgs.map(org => (
              <Card key={org.id} className="neu-card overflow-hidden">
                <div className="h-2" style={{ background: `linear-gradient(135deg, ${org.color_primario}, ${org.color_secundario})` }} />
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      {org.logo_url ? (
                        <img src={org.logo_url} alt={org.nombre} className="h-8 w-8 rounded-lg object-contain" />
                      ) : (
                        <Building2 className="h-5 w-5 text-muted-foreground" />
                      )}
                      <CardTitle className="text-base">{org.nombre}</CardTitle>
                    </div>
                    <span className={`text-xs px-2 py-1 rounded-full ${org.plan_activo ? 'bg-secondary/20 text-secondary' : 'bg-destructive/20 text-destructive'}`}>
                      {org.plan_activo ? "Activa" : "Inactiva"}
                    </span>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  <p className="text-xs text-muted-foreground font-mono">/{org.slug}</p>
                  <div className="flex items-center gap-2">
                    <div className="w-5 h-5 rounded-full border" style={{ backgroundColor: org.color_primario }} />
                    <div className="w-5 h-5 rounded-full border" style={{ backgroundColor: org.color_secundario }} />
                    {org.dominio_personalizado && (
                      <span className="text-xs text-muted-foreground ml-auto flex items-center gap-1">
                        <Globe className="h-3 w-3" /> {org.dominio_personalizado}
                      </span>
                    )}
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full"
                    onClick={() => {
                      setSelectedOrgForUsers(org);
                      setUsersSheetOpen(true);
                      fetchOrgUsers(org.id);
                    }}
                  >
                    <Users className="h-4 w-4 mr-2" />
                    Ver Usuarios
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* ── Finanzas / Sincronización ──────────────────────────────────── */}
        <div className="mt-10">
          <h2 className="text-lg font-semibold text-foreground flex items-center gap-2 mb-4">
            <DatabaseZap className="h-5 w-5 text-primary" />
            Finanzas — Sincronización
          </h2>
          <div className="max-w-2xl">
            <RecalcularBilleterasButton />
          </div>
        </div>
      </main>

      {/* Sheet de usuarios por organización */}
      <Sheet open={usersSheetOpen} onOpenChange={setUsersSheetOpen}>
        <SheetContent side="right" className="w-full sm:max-w-2xl overflow-y-auto">
          <SheetHeader>
            <SheetTitle className="flex items-center gap-2">
              <Users className="h-5 w-5 text-primary" />
              Usuarios — {selectedOrgForUsers?.nombre}
            </SheetTitle>
          </SheetHeader>
          <div className="mt-4 space-y-2">
            {loadingUsers ? (
              <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
            ) : orgUsers.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">No hay usuarios en esta organización</p>
            ) : (
              orgUsers.map((u, i) => (
                <div key={i} className="flex items-center justify-between p-3 rounded-xl border border-border bg-card">
                  <div>
                    <p className="text-sm font-medium text-foreground">{u.full_name}</p>
                    <p className="text-xs text-muted-foreground">{u.email}</p>
                  </div>
                  <Badge variant="outline" className="text-xs">{u.role}</Badge>
                </div>
              ))
            )}
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
};

export default SuperAdminMaster;
