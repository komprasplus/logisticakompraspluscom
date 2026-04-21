import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Plus, Megaphone, Map, Newspaper, Image as ImageIcon, Trash2, Pencil, Loader2 } from "lucide-react";
import { toast } from "sonner";

interface Anuncio {
  id: string;
  titulo: string;
  contenido: string | null;
  tipo: "banner" | "noticia" | "mapa_cobertura";
  imagen_url: string | null;
  link_url: string | null;
  activo: boolean;
  orden: number;
  created_at: string;
}

const tipoConfig = {
  banner: { icon: Megaphone, label: "Banner", color: "bg-primary/15 text-primary" },
  noticia: { icon: Newspaper, label: "Noticia", color: "bg-amber-500/15 text-amber-600" },
  mapa_cobertura: { icon: Map, label: "Mapa Cobertura", color: "bg-emerald-500/15 text-emerald-600" },
} as const;

const AnunciosManager = () => {
  const [anuncios, setAnuncios] = useState<Anuncio[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Anuncio | null>(null);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);

  const [form, setForm] = useState({
    titulo: "",
    contenido: "",
    tipo: "banner" as Anuncio["tipo"],
    imagen_url: "",
    link_url: "",
    activo: true,
    orden: 0,
  });

  const fetchAnuncios = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("anuncios_plataforma")
      .select("*")
      .order("orden", { ascending: true })
      .order("created_at", { ascending: false });
    if (error) toast.error("Error al cargar anuncios");
    else setAnuncios((data ?? []) as Anuncio[]);
    setLoading(false);
  };

  useEffect(() => {
    fetchAnuncios();
  }, []);

  const resetForm = () => {
    setForm({ titulo: "", contenido: "", tipo: "banner", imagen_url: "", link_url: "", activo: true, orden: 0 });
    setEditing(null);
  };

  const openNew = () => {
    resetForm();
    setOpen(true);
  };

  const openEdit = (a: Anuncio) => {
    setEditing(a);
    setForm({
      titulo: a.titulo,
      contenido: a.contenido ?? "",
      tipo: a.tipo,
      imagen_url: a.imagen_url ?? "",
      link_url: a.link_url ?? "",
      activo: a.activo,
      orden: a.orden,
    });
    setOpen(true);
  };

  const handleUpload = async (file: File) => {
    setUploading(true);
    try {
      const ext = file.name.split(".").pop();
      const path = `${crypto.randomUUID()}.${ext}`;
      const { error } = await supabase.storage.from("anuncios-media").upload(path, file, { upsert: false });
      if (error) throw error;
      const { data } = supabase.storage.from("anuncios-media").getPublicUrl(path);
      setForm((f) => ({ ...f, imagen_url: data.publicUrl }));
      toast.success("Imagen subida");
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Error al subir";
      toast.error(msg);
    } finally {
      setUploading(false);
    }
  };

  const handleSave = async () => {
    if (!form.titulo.trim()) {
      toast.error("El título es obligatorio");
      return;
    }
    setSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const payload = {
        titulo: form.titulo.trim(),
        contenido: form.contenido.trim() || null,
        tipo: form.tipo,
        imagen_url: form.imagen_url.trim() || null,
        link_url: form.link_url.trim() || null,
        activo: form.activo,
        orden: form.orden,
      };
      if (editing) {
        const { error } = await supabase.from("anuncios_plataforma").update(payload).eq("id", editing.id);
        if (error) throw error;
        toast.success("Anuncio actualizado");
      } else {
        const { error } = await supabase.from("anuncios_plataforma").insert({ ...payload, created_by: user?.id ?? null });
        if (error) throw error;
        toast.success("Anuncio creado");
      }
      setOpen(false);
      resetForm();
      fetchAnuncios();
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Error al guardar";
      toast.error(msg);
    } finally {
      setSaving(false);
    }
  };

  const toggleActivo = async (a: Anuncio) => {
    const { error } = await supabase.from("anuncios_plataforma").update({ activo: !a.activo }).eq("id", a.id);
    if (error) {
      toast.error("Error al cambiar estado");
    } else {
      setAnuncios((prev) => prev.map((x) => (x.id === a.id ? { ...x, activo: !a.activo } : x)));
    }
  };

  const handleDelete = async (a: Anuncio) => {
    if (!confirm(`¿Eliminar el anuncio "${a.titulo}"?`)) return;
    const { error } = await supabase.from("anuncios_plataforma").delete().eq("id", a.id);
    if (error) toast.error("Error al eliminar");
    else {
      toast.success("Anuncio eliminado");
      setAnuncios((prev) => prev.filter((x) => x.id !== a.id));
    }
  };

  return (
    <div className="rounded-3xl border border-border bg-card shadow-sm overflow-hidden relative z-0 flex flex-col" style={{ minHeight: "420px", height: "calc(100vh - 220px)" }}>
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-border bg-gradient-to-r from-primary/5 to-transparent">
        <div className="flex items-center gap-2">
          <Megaphone className="h-5 w-5 text-primary" />
          <div>
            <h3 className="text-sm font-bold text-foreground">Tablero de Anuncios</h3>
            <p className="text-xs text-muted-foreground">Comunica novedades a todas las tiendas</p>
          </div>
        </div>
        <Button size="sm" onClick={openNew} className="gap-1">
          <Plus className="h-4 w-4" /> Nuevo Anuncio
        </Button>
      </div>

      {/* List */}
      <ScrollArea className="flex-1">
        {loading ? (
          <div className="flex items-center justify-center h-40">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
          </div>
        ) : anuncios.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-60 text-center px-6">
            <Megaphone className="h-12 w-12 text-muted-foreground/30 mb-3" />
            <p className="text-sm font-medium text-foreground">Aún no hay anuncios</p>
            <p className="text-xs text-muted-foreground mt-1">Crea el primero para comunicar novedades</p>
          </div>
        ) : (
          <div className="p-4 space-y-3">
            {anuncios.map((a) => {
              const cfg = tipoConfig[a.tipo];
              const Icon = cfg.icon;
              return (
                <div
                  key={a.id}
                  className={`relative rounded-2xl border bg-card p-4 transition-all ${a.activo ? "border-primary/30 shadow-sm" : "border-border opacity-60"}`}
                >
                  <div className="flex gap-3">
                    {a.imagen_url ? (
                      <img src={a.imagen_url} alt={a.titulo} className="h-20 w-20 rounded-xl object-cover bg-muted" />
                    ) : (
                      <div className={`h-20 w-20 rounded-xl flex items-center justify-center ${cfg.color}`}>
                        <Icon className="h-8 w-8" />
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <Badge variant="secondary" className={`gap-1 ${cfg.color}`}>
                          <Icon className="h-3 w-3" />
                          {cfg.label}
                        </Badge>
                        {!a.activo && <Badge variant="outline" className="text-xs">Inactivo</Badge>}
                      </div>
                      <p className="text-sm font-bold text-foreground truncate">{a.titulo}</p>
                      {a.contenido && <p className="text-xs text-muted-foreground line-clamp-2 mt-0.5">{a.contenido}</p>}
                    </div>
                    <div className="flex flex-col items-end gap-2">
                      <Switch checked={a.activo} onCheckedChange={() => toggleActivo(a)} />
                      <div className="flex gap-1">
                        <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => openEdit(a)}>
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive" onClick={() => handleDelete(a)}>
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </ScrollArea>

      {/* Modal */}
      <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) resetForm(); }}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing ? "Editar Anuncio" : "Nuevo Anuncio"}</DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div>
              <Label>Título *</Label>
              <Input value={form.titulo} onChange={(e) => setForm({ ...form, titulo: e.target.value })} placeholder="Ej: Nueva cobertura nacional" />
            </div>

            <div>
              <Label>Tipo</Label>
              <Select value={form.tipo} onValueChange={(v) => setForm({ ...form, tipo: v as Anuncio["tipo"] })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="banner">📣 Banner</SelectItem>
                  <SelectItem value="noticia">📰 Noticia</SelectItem>
                  <SelectItem value="mapa_cobertura">🗺️ Mapa de Cobertura</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>Contenido / Descripción</Label>
              <Textarea value={form.contenido} onChange={(e) => setForm({ ...form, contenido: e.target.value })} rows={3} placeholder="Mensaje breve para mostrar a las tiendas" />
            </div>

            <div>
              <Label>Imagen / Animación</Label>
              <div className="flex gap-2 items-center">
                <Input
                  type="file"
                  accept="image/*,image/gif"
                  onChange={(e) => { const f = e.target.files?.[0]; if (f) handleUpload(f); }}
                  disabled={uploading}
                />
                {uploading && <Loader2 className="h-4 w-4 animate-spin" />}
              </div>
              <Input
                className="mt-2"
                placeholder="…o pega una URL directa"
                value={form.imagen_url}
                onChange={(e) => setForm({ ...form, imagen_url: e.target.value })}
              />
              {form.imagen_url && (
                <img src={form.imagen_url} alt="preview" className="mt-2 h-32 w-full object-cover rounded-lg bg-muted" />
              )}
            </div>

            <div>
              <Label>Link al hacer click (opcional)</Label>
              <Input value={form.link_url} onChange={(e) => setForm({ ...form, link_url: e.target.value })} placeholder="https://…" />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Orden</Label>
                <Input type="number" value={form.orden} onChange={(e) => setForm({ ...form, orden: Number(e.target.value) })} />
              </div>
              <div className="flex items-end gap-2">
                <Switch checked={form.activo} onCheckedChange={(v) => setForm({ ...form, activo: v })} />
                <Label className="mb-2">Activo</Label>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              {editing ? "Guardar Cambios" : "Crear Anuncio"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AnunciosManager;
