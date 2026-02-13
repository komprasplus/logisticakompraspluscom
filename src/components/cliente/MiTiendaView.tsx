import { useState, useRef, useEffect, useCallback, useId } from "react";
import { motion, useReducedMotion } from "framer-motion";
import {
  Store,
  Camera,
  Save,
  Loader2,
  Phone,
  Mail,
  FileText,
  CheckCircle,
  Upload,
  AlertCircle,
  RefreshCw,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

// ─── Tipos ────────────────────────────────────────────────────────────────────

interface StoreProfile {
  store_name: string;
  nit_rut: string | null;
  phone: string | null;
  email: string | null;
  logo_url: string | null;
}

// ─── Constantes ───────────────────────────────────────────────────────────────

const MAX_LOGO_SIZE_BYTES = 2 * 1024 * 1024; // 2 MB

/*
  FIX: allowlist explícita en lugar de `file.type.startsWith("image/")`.
  `image/svg+xml` es una imagen válida pero puede contener scripts XSS que
  el navegador ejecuta al renderizar con <img src="...">. Mismo fix aplicado
  en CreateProductModal, SuperAdminPanel y WarehouseInventoryPanel.
*/
const ALLOWED_LOGO_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

// ─── Componente ───────────────────────────────────────────────────────────────

const MiTiendaView = () => {
  const { user, refreshProfile } = useAuth();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [storeData, setStoreData] = useState<StoreProfile>({
    store_name: "",
    nit_rut: null,
    phone: null,
    email: null,
    logo_url: null,
  });

  /*
    FIX: preview local para mostrar la imagen seleccionada inmediatamente
    mientras se completa el upload al servidor, en lugar de mostrar nada
    hasta que llegue la URL del CDN. Requiere revocación de Object URL.
  */
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const cancelRef = useRef(false);
  const prefersReducedMotion = useReducedMotion();
  const uid = useId();

  // ── Fetch perfil ───────────────────────────────────────────────────────────

  /*
    FIX: `fetchStoreProfile` envuelta en `useCallback` e incluida en las
    dependencias del useEffect. La versión original era una función interna
    con stale closure y eslint exhaustive-deps warning.
  */
  const fetchStoreProfile = useCallback(async () => {
    if (!user?.id) return;

    setLoading(true);
    setFetchError(null);

    try {
      const { data, error } = await supabase
        .from("profiles")
        .select("store_name, nit_rut, phone, email, logo_url")
        .eq("user_id", user.id)
        .single();

      if (cancelRef.current) return;
      if (error) throw error;

      setStoreData({
        store_name: data?.store_name ?? "",
        nit_rut: data?.nit_rut ?? null,
        phone: data?.phone ?? null,
        email: data?.email ?? null,
        logo_url: data?.logo_url ?? null,
      });
    } catch (error) {
      if (cancelRef.current) return;
      console.error("Error fetching store profile:", error);
      /*
        FIX: error silencioso (solo `toast.error`) reemplazado por estado de
        error visible con botón de reintento. La versión original dejaba el
        formulario vacío sin forma de distinguir "sin datos" de "error de red".
      */
      setFetchError("No se pudo cargar la información de tu tienda.");
    } finally {
      if (!cancelRef.current) setLoading(false);
    }
  }, [user?.id]);

  useEffect(() => {
    cancelRef.current = false;
    if (user?.id) fetchStoreProfile();
    return () => {
      cancelRef.current = true;
    };
  }, [user?.id, fetchStoreProfile]);

  /*
    FIX: revocar Object URL al desmontar para liberar el Blob de memoria.
    Mismo patrón aplicado en CreateProductModal.
  */
  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Upload de logo ─────────────────────────────────────────────────────────

  const handleLogoUpload = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file || !user?.id) return;

      // FIX: allowlist en lugar de `file.type.startsWith("image/")`
      if (!ALLOWED_LOGO_TYPES.has(file.type)) {
        toast.error("Solo se permiten imágenes JPG, PNG o WebP");
        if (fileInputRef.current) fileInputRef.current.value = "";
        return;
      }

      if (file.size > MAX_LOGO_SIZE_BYTES) {
        toast.error("La imagen debe ser menor a 2 MB");
        if (fileInputRef.current) fileInputRef.current.value = "";
        return;
      }

      // FIX: preview local inmediato mientras sube
      const localPreview = URL.createObjectURL(file);
      setPreviewUrl((prev) => {
        if (prev) URL.revokeObjectURL(prev);
        return localPreview;
      });

      setUploading(true);
      try {
        /*
          FIX: `file.name.split(".").pop()` puede devolver `undefined` cuando
          el nombre no tiene extensión. Añadido fallback a "jpg".
        */
        const fileExt = file.name.split(".").pop() ?? "jpg";
        const fileName = `${user.id}/logo.${fileExt}`;

        /*
          FIX: eliminada la eliminación explícita del logo anterior antes del upload.
          La versión original extraía el path con `storeData.logo_url.split("/logos_tiendas/")[1]`
          — frágil: falla si el bucket cambia de nombre o si "logos_tiendas" aparece
          en otra parte de la URL. Con `upsert: true` Supabase sobreescribe el archivo
          existente automáticamente sin round-trip adicional.
        */
        const { error: uploadError } = await supabase.storage.from("logos_tiendas").upload(fileName, file, {
          upsert: true,
          contentType: file.type, // FIX: contentType explícito para que el CDN sirva el MIME correcto
        });

        if (uploadError) throw uploadError;

        const { data: urlData } = supabase.storage.from("logos_tiendas").getPublicUrl(fileName);

        const logoUrl = urlData.publicUrl;

        const { error: updateError } = await supabase
          .from("profiles")
          .update({ logo_url: logoUrl })
          .eq("user_id", user.id);

        if (updateError) throw updateError;

        if (cancelRef.current) return;

        // Revocar preview local y usar la URL del CDN
        setPreviewUrl((prev) => {
          if (prev) URL.revokeObjectURL(prev);
          return null;
        });
        setStoreData((prev) => ({ ...prev, logo_url: logoUrl }));
        toast.success("Logo actualizado exitosamente");
        await refreshProfile();
      } catch (error) {
        if (cancelRef.current) return;
        console.error("Error uploading logo:", error);
        // Descartar el preview para no mostrar imagen inconsistente con el servidor
        setPreviewUrl((prev) => {
          if (prev) URL.revokeObjectURL(prev);
          return null;
        });
        toast.error("Error al subir el logo");
      } finally {
        if (!cancelRef.current) setUploading(false);
        // FIX: limpiar input para permitir seleccionar el mismo archivo de nuevo
        if (fileInputRef.current) fileInputRef.current.value = "";
      }
    },
    [user?.id, refreshProfile],
  );

  // ── Guardar datos del formulario ───────────────────────────────────────────

  const handleSave = useCallback(async () => {
    if (!user?.id) return;

    if (!storeData.store_name.trim()) {
      toast.error("El nombre de la tienda es obligatorio");
      return;
    }

    /*
      FIX: validación básica de formato de email antes de guardar.
      Un email malformado como "nombre@" o "sinArroba" podía guardarse en la BD.
    */
    const emailTrimmed = storeData.email?.trim();
    if (emailTrimmed && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailTrimmed)) {
      toast.error("El correo electrónico no tiene un formato válido");
      return;
    }

    setSaving(true);
    try {
      const { error } = await supabase
        .from("profiles")
        .update({
          store_name: storeData.store_name.trim(),
          nit_rut: storeData.nit_rut?.trim() || null,
          phone: storeData.phone?.trim() || null,
          email: emailTrimmed || null,
        })
        .eq("user_id", user.id);

      if (cancelRef.current) return;
      if (error) throw error;

      toast.success("Información de tienda actualizada");
      await refreshProfile();
    } catch (error) {
      if (cancelRef.current) return;
      console.error("Error saving store profile:", error);
      toast.error("Error al guardar los datos");
    } finally {
      if (!cancelRef.current) setSaving(false);
    }
  }, [user?.id, storeData, refreshProfile]);

  // ── Render: cargando ───────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20" role="status" aria-label="Cargando datos de la tienda...">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (fetchError) {
    return (
      <div className="flex flex-col items-center gap-4 py-20 text-center">
        <AlertCircle className="h-10 w-10 text-destructive/60" aria-hidden="true" />
        <p className="text-sm text-muted-foreground">{fetchError}</p>
        <Button type="button" variant="outline" onClick={fetchStoreProfile} className="gap-2">
          <RefreshCw className="h-4 w-4" aria-hidden="true" />
          Reintentar
        </Button>
      </div>
    );
  }

  // URL a mostrar: preview local durante el upload, o logo guardado en el CDN
  const displayLogoUrl = previewUrl ?? storeData.logo_url;

  return (
    <motion.div
      initial={{ opacity: 0, y: prefersReducedMotion ? 0 : 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-6"
    >
      {/* Header */}
      <div className="flex items-center gap-3 mb-4">
        <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-purple-500 to-purple-600 shadow-lg shadow-purple-500/30 flex-shrink-0">
          <Store className="h-6 w-6 text-white" aria-hidden="true" />
        </div>
        <div>
          <h2 className="text-xl font-bold text-foreground">Mi Tienda</h2>
          <p className="text-sm text-muted-foreground">Gestiona la identidad de tu negocio</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Sección logo */}
        <motion.div
          className="lg:col-span-1"
          initial={{ opacity: 0, x: prefersReducedMotion ? 0 : -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: prefersReducedMotion ? 0 : 0.1 }}
        >
          <div className="rounded-2xl bg-card border border-border p-6 shadow-sm text-center">
            <h3 className="font-semibold text-foreground mb-4">Logo de Tienda</h3>

            {/*
              FIX: `<div onClick>` convertido en elemento interactivo accesible.
              Un div clickeable no es accesible por teclado ni anunciado por
              lectores de pantalla. Añadidos `role="button"`, `tabIndex={0}`,
              `onKeyDown` (Enter/Space) y `aria-label` descriptivo.

              FIX: `focus-within` para mostrar el overlay también cuando el
              elemento recibe foco por teclado.
            */}
            <div
              role="button"
              tabIndex={0}
              aria-label={
                displayLogoUrl
                  ? `Cambiar logo de ${storeData.store_name || "la tienda"}`
                  : "Subir logo — haz clic para seleccionar imagen"
              }
              onClick={() => fileInputRef.current?.click()}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  fileInputRef.current?.click();
                }
              }}
              className="relative mx-auto w-32 h-32 rounded-2xl bg-muted border-2 border-dashed border-border overflow-hidden cursor-pointer hover:border-primary transition-colors group focus:outline-none focus:ring-2 focus:ring-primary/50"
            >
              {displayLogoUrl ? (
                <img
                  src={displayLogoUrl}
                  /*
                    FIX: alt con nombre de la tienda en lugar del genérico "Logo de tienda".
                    Si el nombre aún no está configurado se usa "la tienda".
                  */
                  alt={`Logo de ${storeData.store_name || "la tienda"}`}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
                  <Store className="h-10 w-10 mb-2" aria-hidden="true" />
                  <span className="text-xs">Sin logo</span>
                </div>
              )}

              {/* Overlay de hover / foco */}
              <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 group-focus:opacity-100 transition-opacity flex items-center justify-center">
                {uploading ? (
                  <Loader2 className="h-6 w-6 text-white animate-spin" />
                ) : (
                  <Camera className="h-6 w-6 text-white" aria-hidden="true" />
                )}
              </div>
            </div>

            {/*
              FIX: `accept="image/*"` → tipos explícitos.
              `image/*` puede permitir seleccionar SVG en algunos navegadores.
              La validación JS es la barrera real, pero `accept` explícito
              mejora la UX filtrando el diálogo de archivos del sistema.
            */}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              onChange={handleLogoUpload}
              className="hidden"
              aria-hidden="true"
            />

            <Button
              type="button"
              variant="outline"
              size="sm"
              className="mt-4 gap-2"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
              aria-busy={uploading}
            >
              {uploading ? (
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
              ) : (
                <Upload className="h-4 w-4" aria-hidden="true" />
              )}
              {uploading ? "Subiendo..." : "Cambiar Logo"}
            </Button>

            <p className="text-xs text-muted-foreground mt-3">JPG, PNG o WebP — Máx. 2 MB</p>
          </div>
        </motion.div>

        {/* Formulario de información */}
        <motion.div
          className="lg:col-span-2"
          initial={{ opacity: 0, x: prefersReducedMotion ? 0 : 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: prefersReducedMotion ? 0 : 0.2 }}
        >
          <div className="rounded-2xl bg-card border border-border p-6 shadow-sm space-y-5">
            <h3 className="font-semibold text-foreground flex items-center gap-2">
              <FileText className="h-4 w-4 text-primary" aria-hidden="true" />
              Información de la Tienda
            </h3>

            <div className="space-y-4">
              {/* Nombre */}
              <div className="space-y-2">
                <Label htmlFor={`${uid}-store-name`} className="text-sm font-medium">
                  Nombre de la Tienda{" "}
                  <span className="text-destructive" aria-hidden="true">
                    *
                  </span>
                  <span className="sr-only">(requerido)</span>
                </Label>
                <Input
                  id={`${uid}-store-name`}
                  value={storeData.store_name}
                  onChange={(e) => setStoreData((prev) => ({ ...prev, store_name: e.target.value }))}
                  placeholder="Ej: Mi Tienda Online"
                  className="h-11"
                  required
                  aria-required="true"
                  autoComplete="organization"
                />
                <p className="text-xs text-muted-foreground">Este nombre aparecerá en las guías como remitente</p>
              </div>

              {/* NIT / RUT */}
              <div className="space-y-2">
                <Label htmlFor={`${uid}-nit`} className="text-sm font-medium flex items-center gap-1">
                  <FileText className="h-3.5 w-3.5" aria-hidden="true" />
                  NIT / RUT
                </Label>
                <Input
                  id={`${uid}-nit`}
                  value={storeData.nit_rut ?? ""}
                  onChange={(e) => setStoreData((prev) => ({ ...prev, nit_rut: e.target.value || null }))}
                  placeholder="Ej: 900.123.456-7"
                  className="h-11"
                  autoComplete="off"
                  spellCheck="false"
                />
              </div>

              {/* Teléfono y Email */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor={`${uid}-phone`} className="text-sm font-medium flex items-center gap-1">
                    <Phone className="h-3.5 w-3.5" aria-hidden="true" />
                    Teléfono de Contacto
                  </Label>
                  <Input
                    id={`${uid}-phone`}
                    /*
                      FIX: `type="tel"` en lugar de `type="text"` (default del
                      componente Input de shadcn). `type="tel"` activa el teclado
                      numérico en móviles y habilita sugerencias del navegador.
                    */
                    type="tel"
                    value={storeData.phone ?? ""}
                    onChange={(e) => setStoreData((prev) => ({ ...prev, phone: e.target.value || null }))}
                    placeholder="Ej: 3001234567"
                    className="h-11"
                    autoComplete="tel"
                    inputMode="tel"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor={`${uid}-email`} className="text-sm font-medium flex items-center gap-1">
                    <Mail className="h-3.5 w-3.5" aria-hidden="true" />
                    Correo Electrónico
                  </Label>
                  <Input
                    id={`${uid}-email`}
                    type="email"
                    value={storeData.email ?? ""}
                    onChange={(e) => setStoreData((prev) => ({ ...prev, email: e.target.value || null }))}
                    placeholder="Ej: tienda@email.com"
                    className="h-11"
                    autoComplete="email"
                    inputMode="email"
                  />
                </div>
              </div>
            </div>

            {/* Botón guardar */}
            <div className="pt-4 border-t border-border">
              <Button
                type="button"
                onClick={handleSave}
                disabled={saving || !storeData.store_name.trim()}
                className="w-full sm:w-auto gap-2 h-11"
                aria-busy={saving}
              >
                {saving ? (
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                ) : (
                  <Save className="h-4 w-4" aria-hidden="true" />
                )}
                {saving ? "Guardando..." : "Guardar Cambios"}
              </Button>
            </div>
          </div>

          {/* Info contextual */}
          <motion.div
            className="mt-4 rounded-xl bg-green-500/10 border border-green-500/20 p-4 flex items-start gap-3"
            role="note"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: prefersReducedMotion ? 0 : 0.4 }}
          >
            <CheckCircle className="h-5 w-5 text-green-600 flex-shrink-0 mt-0.5" aria-hidden="true" />
            <div>
              <p className="text-sm font-medium text-green-700">¿Por qué es importante?</p>
              <p className="text-sm text-green-600 mt-1">
                Tu nombre de tienda y logo aparecerán en el encabezado del panel, en las guías de envío y ayudan a que
                tus clientes identifiquen tu marca.
              </p>
            </div>
          </motion.div>
        </motion.div>
      </div>
    </motion.div>
  );
};

export default MiTiendaView;
