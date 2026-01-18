import { useState, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import { Power, MapPin, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Switch } from "@/components/ui/switch";

interface ConnectionToggleProps {
  userId: string;
  isOnline: boolean;
  onStatusChange: (isOnline: boolean) => void;
  userLocation: { lat: number; lng: number } | null;
}

const ConnectionToggle = ({
  userId,
  isOnline,
  onStatusChange,
  userLocation,
}: ConnectionToggleProps) => {
  const [updating, setUpdating] = useState(false);

  // Update location periodically when online
  useEffect(() => {
    if (!isOnline || !userLocation) return;

    const updateLocation = async () => {
      try {
        await supabase
          .from("profiles")
          .update({
            last_location_lat: userLocation.lat,
            last_location_lng: userLocation.lng,
            last_location_updated_at: new Date().toISOString(),
          })
          .eq("user_id", userId);
      } catch (error) {
        console.error("Error updating location:", error);
      }
    };

    // Update immediately
    updateLocation();

    // Then update every 30 seconds
    const interval = setInterval(updateLocation, 30000);

    return () => clearInterval(interval);
  }, [isOnline, userLocation, userId]);

  const handleToggle = async (checked: boolean) => {
    setUpdating(true);
    try {
      const updateData: any = {
        is_online: checked,
        updated_at: new Date().toISOString(),
      };

      // If going online and we have location, update it
      if (checked && userLocation) {
        updateData.last_location_lat = userLocation.lat;
        updateData.last_location_lng = userLocation.lng;
        updateData.last_location_updated_at = new Date().toISOString();
      }

      // If going offline, clear location
      if (!checked) {
        updateData.last_location_lat = null;
        updateData.last_location_lng = null;
        updateData.last_location_updated_at = null;
      }

      const { error } = await supabase
        .from("profiles")
        .update(updateData)
        .eq("user_id", userId);

      if (error) throw error;

      onStatusChange(checked);
      
      if (checked) {
        toast.success("🟢 Conectado - Estás listo para recibir pedidos", {
          duration: 3000,
        });
      } else {
        toast.info("🔴 Desconectado - No recibirás nuevos pedidos", {
          duration: 3000,
        });
      }
    } catch (error) {
      console.error("Error toggling connection:", error);
      toast.error("Error al cambiar estado de conexión");
    } finally {
      setUpdating(false);
    }
  };

  return (
    <motion.div
      className={`flex items-center justify-between p-3 rounded-xl transition-colors ${
        isOnline
          ? "bg-green-50 border border-green-200"
          : "bg-gray-50 border border-gray-200"
      }`}
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
    >
      <div className="flex items-center gap-3">
        <div
          className={`flex h-10 w-10 items-center justify-center rounded-full transition-colors ${
            isOnline ? "bg-green-500" : "bg-gray-400"
          }`}
        >
          <Power className="h-5 w-5 text-white" />
        </div>
        <div>
          <p className="font-semibold text-foreground text-sm">
            {isOnline ? "Conectado para trabajar" : "Desconectado"}
          </p>
          <p className="text-xs text-muted-foreground">
            {isOnline ? (
              <span className="flex items-center gap-1">
                <MapPin className="h-3 w-3" />
                GPS activo
              </span>
            ) : (
              "Activa para recibir pedidos"
            )}
          </p>
        </div>
      </div>

      <div className="flex items-center gap-2">
        {updating && <Loader2 className="h-4 w-4 animate-spin text-primary" />}
        <Switch
          checked={isOnline}
          onCheckedChange={handleToggle}
          disabled={updating}
          className="data-[state=checked]:bg-green-500"
        />
      </div>
    </motion.div>
  );
};

export default ConnectionToggle;
