import { useState, useEffect, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { Plus, Palette, Globe, Loader2, Pencil, Upload, Building2, AlertCircle } from "lucide-react";

// ─── Tipos ────────────────────────────────────────────────────────────────────

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

interface OrgFormValues {
  nombre: string;
  slug: string;
  color_primario: string;
  color_secundario: string;
  dominio_personalizado: string;
}

// ─── Constantes ───────────────────────────────────────────────────────────────

const EMPTY_FORM: OrgFormValues = {
  nombre: "",
  slug: "",
  color_primario: "#6366f1",
  color_secundario: "#8b5cf6",
  dominio_personalizado: "",
};

const MAX_LOGO_SIZE_BYTES = 5 * 1024 * 1024; // 5 MB
const ALLOWED_IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "image/svg+xml"]);

/**
 * Normaliza un slug: minúsculas, espacios → guiones, solo alfanumérico y guiones.
 */
const slugify = (value: string): string =>
  value
    .toLowerCase()
    .trim()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9-]/g, "");

// ─── Sub-componente OrgForm ───────────────────────────────────────────────────

/*
  FIX CRÍTICO: `OrgForm` estaba definido DENTRO de `SuperAdminPanel`.
  Esto hace que React lo trate como un tipo de componente nuevo en cada render
  del padre → cada vez que `saving` o `form` cambiaban, el formulario se
  desmontaba y remontaba completamente, perdiendo el foco del Input activo
  y re-renderizando todo el árbol innecesariamente.
  Movido fuera del padre como componente estable.
*/
interface OrgFormProps {
  form: OrgFormValues;
  onFormChange: (updates: Partial<OrgFormValues>) => void;
  logoFile: File | null;
  onLogoChange: (file: File | null) => void;
  editOrg: Organizacion | null;
  saving: boolean;
  onSubmit: () => void;
  submitLabel: string;
}

const OrgForm = ({
  form,
  onFormChange,
  logoFile,
  onLogoChange,
  editOrg,
  saving,
  onSubmit,
  submitLabel,
}: OrgFormProps) => {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleLogoChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;

      // FIX: validación de tipo MIME y tamaño en JS
      // (el atributo `accept` es bypasseable por el usuario)
      if (!ALLOWED_IMAGE_TYPES.has(file.type)) {
        alert("Solo se permiten imágenes (JPG, PNG, WebP, SVG)");
        if (fileInputRef.current) fileInputRef.current.value = "";
        return;
      }
      if (file.size > MAX_LOGO_SIZE_BYTES) {
        alert("El logo no puede superar 5 MB");
        if (fileInputRef.current) fileInputRef.current.value = "";
        return;
      }
      onLogoChange(file);
    },
    [onLogoChange],
  );

  return (
    <div className="space-y-4">
      {/* Nombre */}
      <div>
        <Label htmlFor="org-nombre">Nombre</Label>
        <Input
          id="org-nombre"
          value={form.nombre}
          onChange={(e) => onFormChange({ nombre: e.target.value })}
          placeholder="Mi Empresa Logística"
          autoComplete="off"
        />
      </div>

      {/* Slug — solo al crear */}
      {!editOrg && (
        <div>
          <Label htmlFor="org-slug">Slug (URL)</Label>
          <Input
            id="org-slug"
            value={form.slug}
            onChange={(e) =>
              /*
                FIX: slug se normaliza en tiempo real al escribir
                para que el usuario vea exactamente lo que se guardará.
                Antes la normalización solo ocurría al guardar.
              */
              onFormChange({ slug: slugify(e.target.value) })
            }
            placeholder="mi-empresa"
          />
          {form.slug && (
            <p className="text-xs text-muted-foreground mt-1">
              URL: <code className="bg-muted px-1 rounded">/{form.slug}</code>
            </p>
          )}
        </div>
      )}

      {/* Logo */}
      <div>
        <Label className="flex items-center gap-2">
          <Upload className="h-3 w-3" />
          Logo corporativo
        </Label>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          onChange={handleLogoChange}
          className="w-full text-sm file:mr-3 file:py-1 file:px-3 file:rounded file:border-0 file:text-sm file:bg-muted file:text-foreground cursor-pointer"
        />
        {/* Mostrar logo actual si está editando y aún no eligió uno nuevo */}
        {editOrg?.logo_url && !logoFile && (
          <img
            src={editOrg.logo_url}
            alt={`Logo actual de ${editOrg.nombre}`}
            className="mt-2 h-12 object-contain rounded border border-border"
          />
        )}
        {/* Preview del logo nuevo seleccionado */}
        {logoFile && (
          <div className="mt-2 flex items-center gap-2">
            <img
              src={URL.createObjectURL(logoFile)}
              alt="Preview nuevo logo"
              className="h-12 object-contain rounded border border-border"
            />
            <button
              type="button"
              className="text-xs text-muted-foreground hover:text-destructive"
              onClick={() => {
                onLogoChange(null);
                if (fileInputRef.current) fileInputRef.current.value = "";
              }}
            >
              Quitar
            </button>
          </div>
        )}
      </div>

      {/* Colores */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label className="flex items-center gap-2">
            <Palette className="h-3 w-3" />
            Color Primario
          </Label>
          <div className="flex gap-2 items-center">
            <input
              type="color"
              value={form.color_primario}
              onChange={(e) => onFormChange({ color_primario: e.target.value })}
              className="w-10 h-10 rounded-lg border-0 cursor-pointer"
              aria-label="Selector color primario"
            />
            <Input
              value={form.color_primario}
              onChange={(e) => onFormChange({ color_primario: e.target.value })}
              className="flex-1 font-mono text-sm"
              maxLength={7}
              placeholder="#6366f1"
            />
          </div>
        </div>
        <div>
          <Label className="flex items-center gap-2">
            <Palette className="h-3 w-3" />
            Color Secundario
          </Label>
          <div className="flex gap-2 items-center">
            <input
              type="color"
              value={form.color_secundario}
              onChange={(e) => onFormChange({ color_secundario: e.target.value })}
              className="w-10 h-10 rounded-lg border-0 cursor-pointer"
              aria-label="Selector color secundario"
            />
            <Input
              value={form.color_secundario}
              onChange={(e) => onFormChange({ color_secundario: e.target.value })}
              className="flex-1 font-mono text-sm"
              maxLength={7}
              placeholder="#8b5cf6"
            />
          </div>
        </div>
      </div>

      {/* Dominio personalizado */}
      <div>
        <Label className="flex items-center gap-2">
          <Globe className="h-3 w-3" />
          Dominio personalizado
        </Label>
        <Input
          value={form.dominio_personalizado}
          onChange={(e) => onFormChange({ dominio_personalizado: e.target.value })}
          placeholder="logistica.miempresa.com"
        />
      </div>

      <Button
        onClick={onSubmit}
        disabled={saving || !form.nombre.trim() || (!editOrg && !form.slug.trim())}
        className="w-full disabled:opacity-50"
      >
        {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Plus className="h-4 w-4 mr-2" />}
        {submitLabel}
      </Button>
    </div>
  );
};

// ─── Componente principal ─────────────────────────────────────────────────────

const SuperAdminPanel = () => {
  const { toast } = useToast();
  const [orgs, setOrgs] = useState<Organizacion[]>([]);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState(false);
  const [saving, setSaving] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [editOrg, setEditOrg] = useState<Organizacion | null>(null);
  const [form, setForm] = useState<OrgFormValues>(EMPTY_FORM);
  const [logoFile, setLogoFile] = useState<File | null>(null);

  const cancelRef = useRef(false);

  // ── Helpers de formulario ──────────────────────────────────────────────────

  const updateForm = useCallback((updates: Partial<OrgFormValues>) => {
    setForm((prev) => ({ ...prev, ...updates }));
  }, []);

  // ── Fetch ──────────────────────────────────────────────────────────────────

  /*
    FIX: fetchOrgs en useCallback para incluirla en dependencias del useEffect
    y para poder llamarla desde botón "Reintentar" sin recrearla.
  */
  const fetchOrgs = useCallback(async () => {
    setLoading(true);
    setFetchError(false);
    const { data, error } = await supabase
      .from("organizaciones")
      .select(
        "id, nombre, slug, logo_url, color_primario, color_secundario, dominio_personalizado, plan_activo, created_at",
      )
      .order("created_at", { ascending: true });

    if (cancelRef.current) return;

    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
      setFetchError(true);
    } else {
      setOrgs((data ?? []) as Organizacion[]);
    }
    setLoading(false);
  }, [toast]);

  useEffect(() => {
    cancelRef.current = false;
    fetchOrgs();
    return () => {
      cancelRef.current = true;
    };
  }, [fetchOrgs]);

  // ── Upload de logo ─────────────────────────────────────────────────────────

  const uploadLogo = useCallback(
    async (orgId: string, file: File): Promise<string | null> => {
      const ext = file.name.split(".").pop() ?? "jpg";
      const path = `${orgId}/logo.${ext}`;
      const { error } = await supabase.storage.from("logos_tiendas").upload(path, file, {
        upsert: true,
        contentType: file.type, // FIX: siempre incluir contentType
      });

      if (error) {
        toast({ title: "Error subiendo logo", description: error.message, variant: "destructive" });
        return null;
      }
      const { data: urlData } = supabase.storage.from("logos_tiendas").getPublicUrl(path);
      return urlData.publicUrl;
    },
    [toast],
  );

  // ── Crear organización ─────────────────────────────────────────────────────

  const handleCreate = useCallback(async () => {
    const nombre = form.nombre.trim();
    const slug = slugify(form.slug);

    if (!nombre || !slug) {
      toast({
        title: "Campos requeridos",
        description: "Nombre y slug son obligatorios",
        variant: "destructive",
      });
      return;
    }

    setSaving(true);
    try {
      const { data, error } = await supabase
        .from("organizaciones")
        .insert({
          nombre,
          slug,
          color_primario: form.color_primario,
          color_secundario: form.color_secundario,
          dominio_personalizado: form.dominio_personalizado.trim() || null,
        })
        .select("id")
        .single();

      if (error) {
        /*
          FIX: mensaje de error específico para slug duplicado.
          Antes mostraba el mensaje crudo de Postgres en inglés.
        */
        if (error.code === "23505") {
          toast({
            title: "Slug ya existe",
            description: `El slug "${slug}" ya está en uso. Elige uno diferente.`,
            variant: "destructive",
          });
        } else {
          toast({ title: "Error al crear", description: error.message, variant: "destructive" });
        }
        return;
      }

      if (logoFile && data) {
        const logoUrl = await uploadLogo(data.id, logoFile);
        if (logoUrl) {
          await supabase.from("organizaciones").update({ logo_url: logoUrl }).eq("id", data.id);
        }
      }

      toast({ title: "✅ Organización creada", description: `"${nombre}" fue registrada correctamente` });
      setForm(EMPTY_FORM);
      setLogoFile(null);
      setCreateOpen(false);
      fetchOrgs();
    } finally {
      if (!cancelRef.current) setSaving(false);
    }
  }, [form, logoFile, toast, uploadLogo, fetchOrgs]);

  // ── Editar organización ────────────────────────────────────────────────────

  const handleEdit = useCallback(async () => {
    if (!editOrg) return;
    setSaving(true);

    try {
      let logoUrl = editOrg.logo_url;
      if (logoFile) {
        const uploaded = await uploadLogo(editOrg.id, logoFile);
        if (uploaded) logoUrl = uploaded;
      }

      const { error } = await supabase
        .from("organizaciones")
        .update({
          nombre: form.nombre.trim(),
          color_primario: form.color_primario,
          color_secundario: form.color_secundario,
          dominio_personalizado: form.dominio_personalizado.trim() || null,
          logo_url: logoUrl,
        })
        .eq("id", editOrg.id);

      if (error) {
        toast({ title: "Error al actualizar", description: error.message, variant: "destructive" });
        return;
      }

      toast({ title: "✅ Organización actualizada" });
      setEditOrg(null);
      setLogoFile(null);
      fetchOrgs();
    } finally {
      if (!cancelRef.current) setSaving(false);
    }
  }, [editOrg, form, logoFile, toast, uploadLogo, fetchOrgs]);

  // ── Abrir edición ──────────────────────────────────────────────────────────

  const openEdit = useCallback((org: Organizacion) => {
    setEditOrg(org);
    setForm({
      nombre: org.nombre,
      slug: org.slug,
      color_primario: org.color_primario || "#6366f1",
      color_secundario: org.color_secundario || "#8b5cf6",
      dominio_personalizado: org.dominio_personalizado ?? "",
    });
    setLogoFile(null);
  }, []);

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <Building2 className="h-6 w-6 text-primary" />
          <h2 className="text-xl font-bold text-foreground">Gestión de Organizaciones</h2>
        </div>

        <Dialog
          open={createOpen}
          onOpenChange={(v) => {
            setCreateOpen(v);
            if (v) {
              setForm(EMPTY_FORM);
              setLogoFile(null);
            }
          }}
        >
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              Nueva Organización
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Crear Organización</DialogTitle>
            </DialogHeader>
            <OrgForm
              form={form}
              onFormChange={updateForm}
              logoFile={logoFile}
              onLogoChange={setLogoFile}
              editOrg={null}
              saving={saving}
              onSubmit={handleCreate}
              submitLabel="Crear Organización"
            />
          </DialogContent>
        </Dialog>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground">Total</p>
            <p className="text-3xl font-bold">{orgs.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground">Activas</p>
            <p className="text-3xl font-bold text-secondary">{orgs.filter((o) => o.plan_activo).length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground">Con dominio propio</p>
            <p className="text-3xl font-bold text-primary">{orgs.filter((o) => o.dominio_personalizado).length}</p>
          </CardContent>
        </Card>
      </div>

      {/* Grid de organizaciones */}
      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : fetchError ? (
        // FIX: estado de error explícito con retry
        <div className="flex flex-col items-center justify-center py-16 gap-4 text-center">
          <AlertCircle className="h-10 w-10 text-destructive" />
          <p className="font-medium">Error al cargar las organizaciones</p>
          <Button variant="outline" onClick={fetchOrgs}>
            Reintentar
          </Button>
        </div>
      ) : orgs.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 gap-3 text-center text-muted-foreground">
          <Building2 className="h-12 w-12 opacity-30" />
          <p>No hay organizaciones registradas</p>
          <p className="text-sm">Crea la primera con el botón "Nueva Organización"</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {orgs.map((org) => (
            <Card key={org.id} className="overflow-hidden group">
              {/* Banda de color */}
              <div
                className="h-2"
                style={{
                  background: `linear-gradient(135deg, ${org.color_primario}, ${org.color_secundario})`,
                }}
              />
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 min-w-0">
                    {org.logo_url && (
                      <img
                        src={org.logo_url}
                        alt={`Logo de ${org.nombre}`}
                        className="h-8 w-8 object-contain rounded flex-shrink-0"
                      />
                    )}
                    {/* FIX: truncate para nombres largos */}
                    <CardTitle className="text-base truncate">{org.nombre}</CardTitle>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <span
                      className={`text-xs px-2 py-1 rounded-full ${
                        org.plan_activo ? "bg-secondary/20 text-secondary" : "bg-destructive/20 text-destructive"
                      }`}
                    >
                      {org.plan_activo ? "Activa" : "Inactiva"}
                    </span>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity"
                      onClick={() => openEdit(org)}
                      aria-label={`Editar ${org.nombre}`}
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-2">
                <p className="text-xs text-muted-foreground font-mono">/{org.slug}</p>
                <div className="flex items-center gap-2">
                  <div
                    className="w-5 h-5 rounded-full border"
                    style={{ backgroundColor: org.color_primario }}
                    title={org.color_primario}
                  />
                  <div
                    className="w-5 h-5 rounded-full border"
                    style={{ backgroundColor: org.color_secundario }}
                    title={org.color_secundario}
                  />
                  {org.dominio_personalizado && (
                    <span className="text-xs text-muted-foreground ml-auto flex items-center gap-1 truncate max-w-[130px]">
                      <Globe className="h-3 w-3 flex-shrink-0" />
                      {org.dominio_personalizado}
                    </span>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Dialog de edición */}
      <Dialog
        open={!!editOrg}
        onOpenChange={(v) => {
          if (!v) {
            setEditOrg(null);
            setLogoFile(null);
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Editar: {editOrg?.nombre}</DialogTitle>
          </DialogHeader>
          <OrgForm
            form={form}
            onFormChange={updateForm}
            logoFile={logoFile}
            onLogoChange={setLogoFile}
            editOrg={editOrg}
            saving={saving}
            onSubmit={handleEdit}
            submitLabel="Guardar Cambios"
          />
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default SuperAdminPanel;
