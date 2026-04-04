import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { MapPin, Phone, User, Loader2 } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

const GOOGLE_MAPS_API_KEY = "AIzaSyDvV2fL5jv0OIp45Si4m4-gaWSt9gIXznA";

interface WebhookGpsData {
  latitude: number;
  longitude: number;
  driverName?: string;
  driverPhone?: string;
  timestamp?: string;
}

interface WebhookLiveMapProps {
  /** numero_guia to filter webhook events for this specific order */
  numeroGuia: string;
  /** Fallback coordinates from the pedido itself */
  fallbackLat?: number | null;
  fallbackLng?: number | null;
  /** Class name for the container */
  className?: string;
}

/**
 * Extracts GPS data from a webhook payload (Virtech or generic format).
 * Returns null if no valid coordinates found.
 */
const extractGpsFromPayload = (payload: Record<string, unknown>): WebhookGpsData | null => {
  // Try Virtech format first
  const lat = Number(
    payload?.latitude ?? payload?.lat ?? payload?.ubicacion_lat ??
    (payload?.location as Record<string, unknown>)?.latitude ??
    (payload?.location as Record<string, unknown>)?.lat
  );
  const lng = Number(
    payload?.longitude ?? payload?.lng ?? payload?.ubicacion_lng ??
    (payload?.location as Record<string, unknown>)?.longitude ??
    (payload?.location as Record<string, unknown>)?.lng
  );

  if (isNaN(lat) || isNaN(lng) || lat === 0 || lng === 0) return null;

  // Extract driver info (Virtech format)
  const driverName =
    (payload?.conductor_nombre as string) ??
    (payload?.driver_name as string) ??
    (payload?.conductor as string) ??
    ((payload?.driver as Record<string, unknown>)?.name as string) ??
    undefined;

  const driverPhone =
    (payload?.conductor_telefono as string) ??
    (payload?.driver_phone as string) ??
    ((payload?.driver as Record<string, unknown>)?.phone as string) ??
    ((payload?.conductor as Record<string, unknown>)?.telefono as string) ??
    undefined;

  return { latitude: lat, longitude: lng, driverName, driverPhone };
};

const WebhookLiveMap = ({
  numeroGuia,
  fallbackLat,
  fallbackLng,
  className = "",
}: WebhookLiveMapProps) => {
  const [gpsData, setGpsData] = useState<WebhookGpsData | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Fetch initial data from recent webhook logs
  const fetchLatestWebhookGps = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from("webhook_logs_incoming")
        .select("payload, created_at")
        .order("created_at", { ascending: false })
        .limit(50);

      if (error) throw error;

      // Find the most recent log that matches our guia and has GPS data
      for (const log of data ?? []) {
        const payload = log.payload as Record<string, unknown>;
        const guia =
          (payload?.guia as string) ??
          (payload?.tracking as string) ??
          (payload?.numero_guia as string) ??
          (payload?.trackingNumber as string);

        if (guia && guia.toLowerCase().includes(numeroGuia.toLowerCase())) {
          const extracted = extractGpsFromPayload(payload);
          if (extracted) {
            extracted.timestamp = log.created_at;
            setGpsData(extracted);
            break;
          }
        }
      }
    } catch (err) {
      console.error("Error fetching webhook GPS data:", err);
    } finally {
      setIsLoading(false);
    }
  }, [numeroGuia]);

  useEffect(() => {
    fetchLatestWebhookGps();
  }, [fetchLatestWebhookGps]);

  // Subscribe to Realtime changes on webhook_logs_incoming
  useEffect(() => {
    const channel = supabase
      .channel("webhook-gps-live")
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "webhook_logs_incoming",
        },
        (payload) => {
          const newRow = payload.new as { payload: Record<string, unknown>; created_at: string };
          const webhookPayload = newRow.payload;

          // Check if this webhook is for our guia
          const guia =
            (webhookPayload?.guia as string) ??
            (webhookPayload?.tracking as string) ??
            (webhookPayload?.numero_guia as string) ??
            (webhookPayload?.trackingNumber as string);

          if (guia && guia.toLowerCase().includes(numeroGuia.toLowerCase())) {
            const extracted = extractGpsFromPayload(webhookPayload);
            if (extracted) {
              extracted.timestamp = newRow.created_at;
              setGpsData(extracted);
            }
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [numeroGuia]);

  // Determine which coordinates to show
  const displayLat = gpsData?.latitude ?? fallbackLat;
  const displayLng = gpsData?.longitude ?? fallbackLng;

  // No coordinates at all — don't render
  if (!displayLat || !displayLng) {
    if (isLoading) {
      return (
        <div className={`flex items-center justify-center h-40 rounded-xl bg-muted/50 border border-border ${className}`}>
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      );
    }
    return null;
  }

  const isLive = !!gpsData;
  const mapUrl = `https://maps.googleapis.com/maps/api/staticmap?center=${displayLat},${displayLng}&zoom=15&size=600x250&scale=2&markers=color:red%7C${displayLat},${displayLng}&key=${GOOGLE_MAPS_API_KEY}`;

  return (
    <div className={`relative rounded-xl overflow-hidden border border-border ${className}`}>
      {/* Map Image */}
      <img
        src={mapUrl}
        alt="Ubicación en tiempo real"
        className="w-full h-44 sm:h-52 object-cover"
        loading="lazy"
      />

      {/* Live Badge */}
      {isLive && (
        <div className="absolute top-3 left-3 flex items-center gap-1.5 rounded-full bg-green-500 px-3 py-1 shadow-lg">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-75" />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-white" />
          </span>
          <span className="text-xs font-bold text-white">EN VIVO</span>
        </div>
      )}

      {/* Driver Info Tooltip Overlay */}
      {gpsData?.driverName && (
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <div className="absolute bottom-3 left-3 right-3 flex items-center gap-3 rounded-xl bg-white/95 backdrop-blur p-3 shadow-lg border border-border cursor-default">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 flex-shrink-0">
                  <User className="h-5 w-5 text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold text-foreground truncate">
                    {gpsData.driverName}
                  </p>
                  {gpsData.driverPhone && (
                    <a
                      href={`tel:${gpsData.driverPhone}`}
                      className="flex items-center gap-1 text-xs text-primary hover:underline"
                    >
                      <Phone className="h-3 w-3" />
                      {gpsData.driverPhone}
                    </a>
                  )}
                </div>
                <div className="flex items-center gap-1 text-xs text-muted-foreground">
                  <MapPin className="h-3 w-3" />
                  <span>GPS</span>
                </div>
              </div>
            </TooltipTrigger>
            <TooltipContent side="top" className="max-w-xs">
              <p className="text-xs">
                🛵 Conductor: <strong>{gpsData.driverName}</strong>
                {gpsData.driverPhone && <> | 📞 {gpsData.driverPhone}</>}
                {gpsData.timestamp && (
                  <>
                    <br />
                    Última actualización:{" "}
                    {new Date(gpsData.timestamp).toLocaleTimeString("es-CO", {
                      timeZone: "America/Bogota",
                    })}
                  </>
                )}
              </p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      )}

      {/* Fallback indicator */}
      {!isLive && (
        <div className="absolute top-3 left-3 flex items-center gap-1.5 rounded-full bg-muted px-3 py-1 shadow-sm border border-border">
          <MapPin className="h-3 w-3 text-muted-foreground" />
          <span className="text-xs font-medium text-muted-foreground">Último punto conocido</span>
        </div>
      )}
    </div>
  );
};

export default WebhookLiveMap;
