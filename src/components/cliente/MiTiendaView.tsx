import { useState, useRef, useEffect } from "react";
import { motion } from "framer-motion";
import { 
  Store, 
  Camera, 
  Save, 
  Loader2, 
  Phone, 
  Mail, 
  FileText,
  CheckCircle,
  Upload
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

interface StoreProfile {
  store_name: string;
  nit_rut: string | null;
  phone: string | null;
  email: string | null;
  logo_url: string | null;
}

const MiTiendaView = () => {
  const { user, refreshProfile } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [storeData, setStoreData] = useState<StoreProfile>({
    store_name: "",
    nit_rut: null,
    phone: null,
    email: null,
    logo_url: null,
  });
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (user?.id) {
      fetchStoreProfile();
    }
  }, [user?.id]);

  const fetchStoreProfile = async () => {
    try {
      const { data, error } = await supabase
        .from("profiles")
        .select("store_name, nit_rut, phone, email, logo_url")
        .eq("user_id", user?.id)
        .single();

      if (error) throw error;
      
      setStoreData({
        store_name: data?.store_name || "",
        nit_rut: data?.nit_rut || null,
        phone: data?.phone || null,
        email: data?.email || null,
        logo_url: data?.logo_url || null,
      });
    } catch (error) {
      console.error("Error fetching store profile:", error);
      toast.error("Error al cargar datos de la tienda");
    } finally {
      setLoading(false);
    }
  };

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user?.id) return;

    // Validate file
    if (!file.type.startsWith("image/")) {
      toast.error("Por favor selecciona una imagen");
      return;
    }

    if (file.size > 2 * 1024 * 1024) {
      toast.error("La imagen debe ser menor a 2MB");
      return;
    }

    setUploading(true);
    try {
      const fileExt = file.name.split(".").pop();
      const fileName = `${user.id}/logo.${fileExt}`;

      // Delete old logo if exists
      if (storeData.logo_url) {
        const oldPath = storeData.logo_url.split("/logos_tiendas/")[1];
        if (oldPath) {
          await supabase.storage.from("logos_tiendas").remove([oldPath]);
        }
      }

      // Upload new logo
      const { error: uploadError } = await supabase.storage
        .from("logos_tiendas")
        .upload(fileName, file, { upsert: true });

      if (uploadError) throw uploadError;

      // Get public URL
      const { data: urlData } = supabase.storage
        .from("logos_tiendas")
        .getPublicUrl(fileName);

      const logoUrl = urlData.publicUrl;

      // Update profile
      const { error: updateError } = await supabase
        .from("profiles")
        .update({ logo_url: logoUrl })
        .eq("user_id", user.id);

      if (updateError) throw updateError;

      setStoreData((prev) => ({ ...prev, logo_url: logoUrl }));
      toast.success("Logo actualizado exitosamente");
      await refreshProfile();
    } catch (error) {
      console.error("Error uploading logo:", error);
      toast.error("Error al subir el logo");
    } finally {
      setUploading(false);
    }
  };

  const handleSave = async () => {
    if (!user?.id) return;
    
    if (!storeData.store_name.trim()) {
      toast.error("El nombre de la tienda es obligatorio");
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
          email: storeData.email?.trim() || null,
        })
        .eq("user_id", user.id);

      if (error) throw error;

      toast.success("Información de tienda actualizada");
      await refreshProfile();
    } catch (error) {
      console.error("Error saving store profile:", error);
      toast.error("Error al guardar los datos");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-6"
    >
      {/* Header */}
      <div className="flex items-center gap-3 mb-4">
        <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-purple-500 to-purple-600 shadow-lg shadow-purple-500/30">
          <Store className="h-6 w-6 text-white" />
        </div>
        <div>
          <h2 className="text-xl font-bold text-foreground">Mi Tienda</h2>
          <p className="text-sm text-muted-foreground">Gestiona la identidad de tu negocio</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Logo Upload Section */}
        <motion.div
          className="lg:col-span-1"
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.1 }}
        >
          <div className="rounded-2xl bg-card border border-border p-6 shadow-sm text-center">
            <h3 className="font-semibold text-foreground mb-4">Logo de Tienda</h3>
            
            {/* Logo Preview */}
            <div 
              className="relative mx-auto w-32 h-32 rounded-2xl bg-muted border-2 border-dashed border-border overflow-hidden cursor-pointer hover:border-primary transition-colors group"
              onClick={() => fileInputRef.current?.click()}
            >
              {storeData.logo_url ? (
                <img
                  src={storeData.logo_url}
                  alt="Logo de tienda"
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
                  <Store className="h-10 w-10 mb-2" />
                  <span className="text-xs">Sin logo</span>
                </div>
              )}
              
              {/* Overlay */}
              <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                {uploading ? (
                  <Loader2 className="h-6 w-6 text-white animate-spin" />
                ) : (
                  <Camera className="h-6 w-6 text-white" />
                )}
              </div>
            </div>

            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleLogoUpload}
              className="hidden"
            />

            <Button
              variant="outline"
              size="sm"
              className="mt-4 gap-2"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
            >
              {uploading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Upload className="h-4 w-4" />
              )}
              {uploading ? "Subiendo..." : "Cambiar Logo"}
            </Button>

            <p className="text-xs text-muted-foreground mt-3">
              JPG, PNG o WEBP. Máx 2MB
            </p>
          </div>
        </motion.div>

        {/* Store Information Form */}
        <motion.div
          className="lg:col-span-2"
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.2 }}
        >
          <div className="rounded-2xl bg-card border border-border p-6 shadow-sm space-y-5">
            <h3 className="font-semibold text-foreground flex items-center gap-2">
              <FileText className="h-4 w-4 text-primary" />
              Información de la Tienda
            </h3>

            <div className="space-y-4">
              {/* Store Name */}
              <div className="space-y-2">
                <Label htmlFor="store_name" className="text-sm font-medium">
                  Nombre de la Tienda <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="store_name"
                  value={storeData.store_name}
                  onChange={(e) => setStoreData((prev) => ({ ...prev, store_name: e.target.value }))}
                  placeholder="Ej: Mi Tienda Online"
                  className="h-11"
                />
                <p className="text-xs text-muted-foreground">
                  Este nombre aparecerá en las guías como remitente
                </p>
              </div>

              {/* NIT/RUT */}
              <div className="space-y-2">
                <Label htmlFor="nit_rut" className="text-sm font-medium flex items-center gap-1">
                  <FileText className="h-3.5 w-3.5" />
                  NIT / RUT
                </Label>
                <Input
                  id="nit_rut"
                  value={storeData.nit_rut || ""}
                  onChange={(e) => setStoreData((prev) => ({ ...prev, nit_rut: e.target.value }))}
                  placeholder="Ej: 900.123.456-7"
                  className="h-11"
                />
              </div>

              {/* Phone and Email Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="phone" className="text-sm font-medium flex items-center gap-1">
                    <Phone className="h-3.5 w-3.5" />
                    Teléfono de Contacto
                  </Label>
                  <Input
                    id="phone"
                    value={storeData.phone || ""}
                    onChange={(e) => setStoreData((prev) => ({ ...prev, phone: e.target.value }))}
                    placeholder="Ej: 3001234567"
                    className="h-11"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="email" className="text-sm font-medium flex items-center gap-1">
                    <Mail className="h-3.5 w-3.5" />
                    Correo Electrónico
                  </Label>
                  <Input
                    id="email"
                    type="email"
                    value={storeData.email || ""}
                    onChange={(e) => setStoreData((prev) => ({ ...prev, email: e.target.value }))}
                    placeholder="Ej: tienda@email.com"
                    className="h-11"
                  />
                </div>
              </div>
            </div>

            {/* Save Button */}
            <div className="pt-4 border-t border-border">
              <Button
                onClick={handleSave}
                disabled={saving || !storeData.store_name.trim()}
                className="w-full sm:w-auto gap-2 h-11"
              >
                {saving ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Save className="h-4 w-4" />
                )}
                {saving ? "Guardando..." : "Guardar Cambios"}
              </Button>
            </div>
          </div>

          {/* Success Info */}
          <motion.div
            className="mt-4 rounded-xl bg-green-500/10 border border-green-500/20 p-4 flex items-start gap-3"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.4 }}
          >
            <CheckCircle className="h-5 w-5 text-green-600 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-medium text-green-700">¿Por qué es importante?</p>
              <p className="text-sm text-green-600 mt-1">
                Tu nombre de tienda y logo aparecerán en el encabezado del panel, en las guías de envío 
                y ayudan a que tus clientes identifiquen tu marca.
              </p>
            </div>
          </motion.div>
        </motion.div>
      </div>
    </motion.div>
  );
};

export default MiTiendaView;
