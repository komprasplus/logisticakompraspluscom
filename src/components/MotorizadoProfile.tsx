import { useState, useRef } from "react";
import { motion } from "framer-motion";
import {
  User,
  Camera,
  Bike,
  Phone,
  CheckCircle2,
  DollarSign,
  Loader2,
  X,
  Edit2,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface MotorizadoProfileProps {
  profile: {
    id: string;
    user_id: string;
    full_name: string;
    phone: string | null;
    email: string | null;
    avatar_url?: string | null;
    vehicle_plate?: string | null;
  } | null;
  onProfileUpdate: () => void;
  dailyStats: {
    deliveredCount: number;
    collectedAmount: number;
  };
  onClose: () => void;
}

const MotorizadoProfile = ({
  profile,
  onProfileUpdate,
  dailyStats,
  onClose,
}: MotorizadoProfileProps) => {
  const [uploading, setUploading] = useState(false);
  const [editing, setEditing] = useState(false);
  const [vehiclePlate, setVehiclePlate] = useState(profile?.vehicle_plate || "");
  const [saving, setSaving] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !profile) return;

    // Validate file type
    if (!file.type.startsWith("image/")) {
      toast.error("Por favor selecciona una imagen válida");
      return;
    }

    // Validate file size (max 2MB)
    if (file.size > 2 * 1024 * 1024) {
      toast.error("La imagen no debe superar 2MB");
      return;
    }

    setUploading(true);
    try {
      const fileExt = file.name.split(".").pop();
      const fileName = `${profile.user_id}/avatar.${fileExt}`;

      // Upload to storage
      const { error: uploadError } = await supabase.storage
        .from("avatars")
        .upload(fileName, file, { upsert: true });

      if (uploadError) throw uploadError;

      // Get public URL
      const { data: urlData } = supabase.storage
        .from("avatars")
        .getPublicUrl(fileName);

      // Update profile with avatar URL
      const { error: updateError } = await supabase
        .from("profiles")
        .update({ 
          avatar_url: urlData.publicUrl + `?t=${Date.now()}`,
          updated_at: new Date().toISOString() 
        })
        .eq("user_id", profile.user_id);

      if (updateError) throw updateError;

      toast.success("Foto de perfil actualizada");
      onProfileUpdate();
    } catch (error) {
      console.error("Error uploading avatar:", error);
      toast.error("Error al subir la foto");
    } finally {
      setUploading(false);
    }
  };

  const handleSaveProfile = async () => {
    if (!profile) return;

    setSaving(true);
    try {
      const { error } = await supabase
        .from("profiles")
        .update({ 
          vehicle_plate: vehiclePlate.toUpperCase().trim() || null,
          updated_at: new Date().toISOString() 
        })
        .eq("user_id", profile.user_id);

      if (error) throw error;

      toast.success("Perfil actualizado");
      setEditing(false);
      onProfileUpdate();
    } catch (error) {
      console.error("Error updating profile:", error);
      toast.error("Error al actualizar el perfil");
    } finally {
      setSaving(false);
    }
  };

  const getInitials = (name: string) => {
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };

  return (
    <motion.div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      <motion.div
        className="w-full max-w-md rounded-3xl bg-white p-6 shadow-2xl"
        initial={{ scale: 0.9, y: 20 }}
        animate={{ scale: 1, y: 0 }}
      >
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-bold text-foreground">Mi Perfil</h2>
          <button
            onClick={onClose}
            className="p-2 rounded-full hover:bg-muted transition-colors"
          >
            <X className="h-5 w-5 text-muted-foreground" />
          </button>
        </div>

        {/* Avatar Section */}
        <div className="flex flex-col items-center mb-6">
          <div className="relative">
            <Avatar className="h-28 w-28 border-4 border-primary/20 shadow-lg">
              <AvatarImage 
                src={profile?.avatar_url || undefined} 
                alt={profile?.full_name} 
              />
              <AvatarFallback className="bg-primary text-primary-foreground text-2xl font-bold">
                {profile ? getInitials(profile.full_name) : "?"}
              </AvatarFallback>
            </Avatar>
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
              className="absolute bottom-0 right-0 flex h-10 w-10 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg hover:bg-primary/90 transition-colors disabled:opacity-50"
            >
              {uploading ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : (
                <Camera className="h-5 w-5" />
              )}
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleAvatarUpload}
            />
          </div>
          <h3 className="mt-4 text-lg font-bold text-foreground">
            {profile?.full_name || "Motorizado"}
          </h3>
          <p className="text-sm text-muted-foreground">
            {profile?.email || "Sin email"}
          </p>
        </div>

        {/* Profile Info */}
        <div className="space-y-4 mb-6">
          <div className="flex items-center gap-3 p-3 rounded-xl bg-muted/50">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
              <Phone className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Teléfono</p>
              <p className="font-medium text-foreground">
                {profile?.phone || "Sin teléfono"}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3 p-3 rounded-xl bg-muted/50">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
              <Bike className="h-5 w-5 text-primary" />
            </div>
            <div className="flex-1">
              <p className="text-xs text-muted-foreground">Placa del vehículo</p>
              {editing ? (
                <div className="flex gap-2 mt-1">
                  <Input
                    value={vehiclePlate}
                    onChange={(e) => setVehiclePlate(e.target.value)}
                    placeholder="ABC-123"
                    className="h-8 text-sm uppercase"
                    maxLength={10}
                  />
                  <Button
                    size="sm"
                    onClick={handleSaveProfile}
                    disabled={saving}
                    className="h-8"
                  >
                    {saving ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      "Guardar"
                    )}
                  </Button>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <p className="font-medium text-foreground">
                    {profile?.vehicle_plate || "Sin registrar"}
                  </p>
                  <button
                    onClick={() => setEditing(true)}
                    className="p-1 rounded hover:bg-muted"
                  >
                    <Edit2 className="h-3 w-3 text-muted-foreground" />
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Daily Stats */}
        <div className="p-4 rounded-2xl bg-gradient-to-r from-primary/10 to-green-500/10 border border-primary/20">
          <p className="text-sm font-medium text-foreground mb-3">
            📊 Estadísticas del día
          </p>
          <div className="grid grid-cols-2 gap-4">
            <div className="text-center">
              <div className="flex items-center justify-center gap-1 mb-1">
                <CheckCircle2 className="h-5 w-5 text-green-500" />
                <span className="text-2xl font-bold text-foreground">
                  {dailyStats.deliveredCount}
                </span>
              </div>
              <p className="text-xs text-muted-foreground">Entregas Exitosas</p>
            </div>
            <div className="text-center">
              <div className="flex items-center justify-center gap-1 mb-1">
                <DollarSign className="h-5 w-5 text-primary" />
                <span className="text-2xl font-bold text-foreground">
                  ${dailyStats.collectedAmount.toLocaleString()}
                </span>
              </div>
              <p className="text-xs text-muted-foreground">Efectivo recaudado</p>
            </div>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
};

export default MotorizadoProfile;
