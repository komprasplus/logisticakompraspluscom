import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { 
  MapPin, 
  Circle, 
  Truck, 
  Clock,
  RefreshCw,
  User,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface Motorizado {
  user_id: string;
  full_name: string;
  phone: string | null;
  avatar_url: string | null;
  is_online: boolean;
  last_location_lat: number | null;
  last_location_lng: number | null;
  last_location_updated_at: string | null;
  activeOrders?: number;
}

interface FleetMonitorProps {
  onMotorizadoClick?: (motorizado: Motorizado) => void;
  compact?: boolean;
}

const FleetMonitor = ({ onMotorizadoClick, compact = false }: FleetMonitorProps) => {
  const [motorizados, setMotorizados] = useState<Motorizado[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    fetchMotorizados();
    
    // Set up realtime subscription for profile updates
    const channel = supabase
      .channel("fleet-monitor")
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "profiles" },
        () => {
          fetchMotorizados();
        }
      )
      .subscribe();

    // Poll every 30 seconds for location updates
    const interval = setInterval(fetchMotorizados, 30000);

    return () => {
      supabase.removeChannel(channel);
      clearInterval(interval);
    };
  }, []);

  const fetchMotorizados = async () => {
    try {
      // Get motorizado user IDs
      const { data: roles } = await supabase
        .from("user_roles")
        .select("user_id")
        .eq("role", "motorizado");

      if (!roles || roles.length === 0) {
        setMotorizados([]);
        setLoading(false);
        return;
      }

      const userIds = roles.map((r) => r.user_id);

      // Get profiles with location data
      const { data: profiles, error } = await supabase
        .from("profiles")
        .select("user_id, full_name, phone, avatar_url, is_online, last_location_lat, last_location_lng, last_location_updated_at")
        .in("user_id", userIds)
        .eq("status", "activo");

      if (error) throw error;

      // Get active orders count per motorizado
      const { data: orderCounts } = await supabase
        .from("pedidos")
        .select("motorizado_id")
        .in("motorizado_id", userIds)
        .in("estado", ["Asignado", "En Ruta"]);

      const countMap: Record<string, number> = {};
      orderCounts?.forEach((o) => {
        if (o.motorizado_id) {
          countMap[o.motorizado_id] = (countMap[o.motorizado_id] || 0) + 1;
        }
      });

      const motorizadosWithOrders = (profiles || []).map((p) => ({
        ...p,
        activeOrders: countMap[p.user_id] || 0,
      }));

      // Sort: online first, then by active orders
      motorizadosWithOrders.sort((a, b) => {
        if (a.is_online && !b.is_online) return -1;
        if (!a.is_online && b.is_online) return 1;
        return (b.activeOrders || 0) - (a.activeOrders || 0);
      });

      setMotorizados(motorizadosWithOrders);
    } catch (error) {
      console.error("Error fetching motorizados:", error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handleRefresh = () => {
    setRefreshing(true);
    fetchMotorizados();
  };

  const getTimeAgo = (timestamp: string | null) => {
    if (!timestamp) return "Sin ubicación";
    const diff = Date.now() - new Date(timestamp).getTime();
    const minutes = Math.floor(diff / 60000);
    if (minutes < 1) return "Ahora";
    if (minutes < 60) return `${minutes}m`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h`;
    return `${Math.floor(hours / 24)}d`;
  };

  const onlineCount = motorizados.filter((m) => m.is_online).length;

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <RefreshCw className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className={cn("space-y-3", compact && "space-y-2")}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="relative">
            <Truck className="h-5 w-5 text-primary" />
            {onlineCount > 0 && (
              <span className="absolute -top-1 -right-1 h-3 w-3 bg-green-500 rounded-full border-2 border-card animate-pulse" />
            )}
          </div>
          <span className="font-semibold text-foreground">
            Flota
            <span className="text-muted-foreground font-normal ml-1">
              ({onlineCount} en línea)
            </span>
          </span>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={handleRefresh}
          disabled={refreshing}
          className="h-8 w-8 p-0"
        >
          <RefreshCw className={cn("h-4 w-4", refreshing && "animate-spin")} />
        </Button>
      </div>

      {/* List */}
      <div className={cn(
        "space-y-2 max-h-[300px] overflow-y-auto pr-1",
        compact && "max-h-[200px]"
      )}>
        {motorizados.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">
            No hay motorizados activos
          </p>
        ) : (
          motorizados.map((motorizado, index) => (
            <motion.div
              key={motorizado.user_id}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: index * 0.05 }}
              onClick={() => onMotorizadoClick?.(motorizado)}
              className={cn(
                "flex items-center gap-3 p-2.5 rounded-lg border transition-all",
                motorizado.is_online
                  ? "bg-green-50 border-green-200 hover:bg-green-100"
                  : "bg-card border-border hover:bg-muted",
                onMotorizadoClick && "cursor-pointer"
              )}
            >
              {/* Avatar */}
              <div className="relative flex-shrink-0">
                {motorizado.avatar_url ? (
                  <img
                    src={motorizado.avatar_url}
                    alt={motorizado.full_name}
                    className="w-9 h-9 rounded-full object-cover"
                  />
                ) : (
                  <div className="w-9 h-9 rounded-full bg-muted flex items-center justify-center">
                    <User className="h-4 w-4 text-muted-foreground" />
                  </div>
                )}
                {/* Online indicator */}
                <span className={cn(
                  "absolute -bottom-0.5 -right-0.5 h-3.5 w-3.5 rounded-full border-2 border-card",
                  motorizado.is_online ? "bg-green-500" : "bg-gray-400"
                )} />
              </div>

              {/* Info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5">
                  <span className="font-medium text-sm text-foreground truncate">
                    {motorizado.full_name}
                  </span>
                  {motorizado.is_online && (
                    <span className="text-xs text-green-600 font-medium">
                      En línea
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  {motorizado.activeOrders !== undefined && motorizado.activeOrders > 0 && (
                    <span className="flex items-center gap-0.5">
                      📦 {motorizado.activeOrders}
                    </span>
                  )}
                  {motorizado.last_location_updated_at && (
                    <span className="flex items-center gap-0.5">
                      <Clock className="h-3 w-3" />
                      {getTimeAgo(motorizado.last_location_updated_at)}
                    </span>
                  )}
                </div>
              </div>

              {/* Location indicator */}
              {motorizado.last_location_lat && motorizado.last_location_lng && (
                <div className="flex-shrink-0">
                  <MapPin className={cn(
                    "h-4 w-4",
                    motorizado.is_online ? "text-green-600" : "text-muted-foreground"
                  )} />
                </div>
              )}
            </motion.div>
          ))
        )}
      </div>
    </div>
  );
};

export default FleetMonitor;
