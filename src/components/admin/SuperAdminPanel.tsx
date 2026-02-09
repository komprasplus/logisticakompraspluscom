import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { Plus, Palette, Globe, Loader2, Pencil, Upload, Building2 } from "lucide-react";

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

const emptyForm = {
  nombre: "",
  slug: "",
  color_primario: "#6366f1",
  color_secundario: "#8b5cf6",
  dominio_personalizado: "",
};

const SuperAdminPanel = () => {
  const { toast } = useToast();
  const [orgs, setOrgs] = useState<Organizacion[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [editOrg, setEditOrg] = useState<Organizacion | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [logoFile, setLogoFile] = useState<File | null>(null);

  const fetchOrgs = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("organizaciones")
      .select("*")
      .order("created_at", { ascending: true });
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      setOrgs((data || []) as Organizacion[]);
    }
    setLoading(false);
  };

  useEffect(() => { fetchOrgs(); }, []);

  const uploadLogo = async (orgId: string, file: File): Promise<string | null> => {
    const ext = file.name.split(".").pop();
    const path = `${orgId}/logo.${ext}`;
    const { error } = await supabase.storage.from("logos_tiendas").upload(path, file, { upsert: true });
    if (error) {
      toast({ title: "Error subiendo logo", description: error.message, variant: "destructive" });
      return null;
    }
    const { data: urlData } = supabase.storage.from("logos_tiendas").getPublicUrl(path);
    return urlData.publicUrl;
  };

  const handleCreate = async () => {
    if (!form.nombre || !form.slug) {
      toast({ title: "Campos requeridos", description: "Nombre y slug son obligatorios", variant: "destructive" });
      return;
    }
    setSaving(true);
    const slug = form.slug.toLowerCase().replace(/\s+/g, "-");
    const { data, error } = await supabase.from("organizaciones").insert({
      nombre: form.nombre,
      slug,
      color_primario: form.color_primario,
      color_secundario: form.color_secundario,
      dominio_personalizado: form.dominio_personalizado || null,
    }).select().single();

    if (error) {
      toast({ title: "Error al crear", description: error.message, variant: "destructive" });
    } else {
      if (logoFile && data) {
        const logoUrl = await uploadLogo(data.id, logoFile);
        if (logoUrl) {
          await supabase.from("organizaciones").update({ logo_url: logoUrl }).eq("id", data.id);
        }
      }
      toast({ title: "✅ Organización creada" });
      setForm(emptyForm);
      setLogoFile(null);
      setCreateOpen(false);
      fetchOrgs();
    }
    setSaving(false);
  };

  const handleEdit = async () => {
    if (!editOrg) return;
    setSaving(true);

    let logoUrl = editOrg.logo_url;
    if (logoFile) {
      const uploaded = await uploadLogo(editOrg.id, logoFile);
      if (uploaded) logoUrl = uploaded;
    }

    const { error } = await supabase.from("organizaciones").update({
      nombre: form.nombre,
      color_primario: form.color_primario,
      color_secundario: form.color_secundario,
      dominio_personalizado: form.dominio_personalizado || null,
      logo_url: logoUrl,
    }).eq("id", editOrg.id);

    if (error) {
      toast({ title: "Error al actualizar", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "✅ Organización actualizada" });
      setEditOrg(null);
      setLogoFile(null);
      fetchOrgs();
    }
    setSaving(false);
  };

  const openEdit = (org: Organizacion) => {
    setEditOrg(org);
    setForm({
      nombre: org.nombre,
      slug: org.slug,
      color_primario: org.color_primario || "#6366f1",
      color_secundario: org.color_secundario || "#8b5cf6",
      dominio_personalizado: org.dominio_personalizado || "",
    });
    setLogoFile(null);
  };

  const OrgForm = ({ onSubmit, submitLabel }: { onSubmit: () => void; submitLabel: string }) => (
    <div className="space-y-4">
      <div>
        <Label>Nombre</Label>
        <Input value={form.nombre} onChange={e => setForm(p => ({ ...p, nombre: e.target.value }))} placeholder="Mi Empresa Logística" />
      </div>
      {!editOrg && (
        <div>
          <Label>Slug (URL)</Label>
          <Input value={form.slug} onChange={e => setForm(p => ({ ...p, slug: e.target.value }))} placeholder="mi-empresa" />
        </div>
      )}
      <div>
        <Label className="flex items-center gap-2"><Upload className="h-3 w-3" /> Logo corporativo</Label>
        <Input type="file" accept="image/*" onChange={e => setLogoFile(e.target.files?.[0] || null)} />
        {editOrg?.logo_url && !logoFile && (
          <img src={editOrg.logo_url} alt="Logo actual" className="mt-2 h-12 object-contain rounded" />
        )}
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
        <Label className="flex items-center gap-2"><Globe className="h-3 w-3" /> Dominio personalizado</Label>
        <Input value={form.dominio_personalizado} onChange={e => setForm(p => ({ ...p, dominio_personalizado: e.target.value }))} placeholder="logistica.miempresa.com" />
      </div>
      <Button onClick={onSubmit} disabled={saving} className="w-full">
        {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Plus className="h-4 w-4 mr-2" />}
        {submitLabel}
      </Button>
    </div>
  );

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <Building2 className="h-6 w-6 text-primary" />
          <h2 className="text-xl font-bold text-foreground">Gestión de Organizaciones</h2>
        </div>
        <Dialog open={createOpen} onOpenChange={(v) => { setCreateOpen(v); if (v) { setForm(emptyForm); setLogoFile(null); } }}>
          <DialogTrigger asChild>
            <Button><Plus className="h-4 w-4 mr-2" /> Nueva Organización</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Crear Organización</DialogTitle></DialogHeader>
            <OrgForm onSubmit={handleCreate} submitLabel="Crear Organización" />
          </DialogContent>
        </Dialog>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <Card><CardContent className="pt-6"><p className="text-sm text-muted-foreground">Total</p><p className="text-3xl font-bold">{orgs.length}</p></CardContent></Card>
        <Card><CardContent className="pt-6"><p className="text-sm text-muted-foreground">Activas</p><p className="text-3xl font-bold text-secondary">{orgs.filter(o => o.plan_activo).length}</p></CardContent></Card>
        <Card><CardContent className="pt-6"><p className="text-sm text-muted-foreground">Con dominio propio</p><p className="text-3xl font-bold text-primary">{orgs.filter(o => o.dominio_personalizado).length}</p></CardContent></Card>
      </div>

      {/* Org Grid */}
      {loading ? (
        <div className="flex justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {orgs.map(org => (
            <Card key={org.id} className="overflow-hidden group">
              <div className="h-2" style={{ background: `linear-gradient(135deg, ${org.color_primario}, ${org.color_secundario})` }} />
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    {org.logo_url && <img src={org.logo_url} alt="" className="h-8 w-8 object-contain rounded" />}
                    <CardTitle className="text-base">{org.nombre}</CardTitle>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`text-xs px-2 py-1 rounded-full ${org.plan_activo ? 'bg-secondary/20 text-secondary' : 'bg-destructive/20 text-destructive'}`}>
                      {org.plan_activo ? "Activa" : "Inactiva"}
                    </span>
                    <Button size="icon" variant="ghost" className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity" onClick={() => openEdit(org)}>
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-2">
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
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Edit Dialog */}
      <Dialog open={!!editOrg} onOpenChange={(v) => { if (!v) setEditOrg(null); }}>
        <DialogContent>
          <DialogHeader><DialogTitle>Editar: {editOrg?.nombre}</DialogTitle></DialogHeader>
          <OrgForm onSubmit={handleEdit} submitLabel="Guardar Cambios" />
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default SuperAdminPanel;
