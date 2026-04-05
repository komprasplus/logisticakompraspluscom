import { useCallback, useMemo, useState, useEffect, useRef } from "react";
import {
  GoogleMap,
  useJsApiLoader,
  MarkerF,
  InfoWindowF,
  MarkerClustererF,
} from "@react-google-maps/api";
import { supabase } from "@/integrations/supabase/client";
import { getMapMarkerColor, getStatusConfig } from "@/lib/orderStatuses";
import { format, isToday, parseISO, startOfDay } from "date-fns";
import { es } from "date-fns/locale";
import { Loader2, AlertTriangle } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";

const GOOGLE_MAPS_API_KEY = "AIzaSyDvV2fL5jv0OIp45Si4m4-gaWSt9gIXznA";

// Warehouse coordinates - Bogotá
const BODEGA_COORDS = { lat: 4.60922, lng: -74.08463 };

// Map styling - clean professional look
const mapStyles = [
  { featureType: "poi", elementType: "labels", stylers: [{ visibility: "off" }] },
  { featureType: "transit", elementType: "labels", stylers: [{ visibility: "off" }] },
];

const mapContainerStyle = {
  width: "100%",
  height: "100%",
  minHeight: "400px",
};

// Operational statuses to show on map
const OPERATIONAL_STATUSES = ["en ruta", "novedad", "asignado", "recibido en bodega"];
// Statuses that are considered "closed" - hide from previous days
const CLOSED_STATUSES = ["entregado", "liquidado", "anulado", "rechazado", "devolución"];

interface Pedido {
  id: number;
  numero_guia: string | null;
  cliente_nombre: string | null;
  direccion_entrega: string | null;
  estado: string | null;
  latitud: number | null;
  longitud: number | null;
  motorizado_asignado: string | null;
  motorizado_id: string | null;
  tipo_novedad?: string | null;
  barrio?: string | null;
  zona?: string | null;
  fecha_creacion?: string | null;
  fecha_entrega?: string | null;
}

interface Motorizado {
  user_id: string;
  full_name: string;
  phone: string | null;
  is_online: boolean;
  last_location_lat: number | null;
  last_location_lng: number | null;
  last_location_updated_at: string | null;
  activeOrders?: number;
}

// Animated position for smooth GPS tracking
interface AnimatedPosition {
  lat: number;
  lng: number;
  targetLat: number;
  targetLng: number;
}

interface AdminMapGoogleProps {
  pedidos: Pedido[];
  selectedDate: Date | null;
  onPedidoClick?: (pedido: Pedido) => void;
  onMotorizadoClick?: (motorizado: Motorizado) => void;
  selectedPedidoId?: number | null;
}

const AdminMapGoogle = ({
  pedidos,
  selectedDate,
  onPedidoClick,
  onMotorizadoClick,
  selectedPedidoId,
}: AdminMapGoogleProps) => {
  const [map, setMap] = useState<google.maps.Map | null>(null);
  const [motorizados, setMotorizados] = useState<Motorizado[]>([]);
  const [animatedPositions, setAnimatedPositions] = useState<Record<string, AnimatedPosition>>({});
  const [showNovedadesOnly, setShowNovedadesOnly] = useState(false);
  const [selectedMarker, setSelectedMarker] = useState<{
    type: "pedido" | "motorizado" | "bodega";
    data: Pedido | Motorizado | null;
  } | null>(null);
  
  const animationFrameRef = useRef<number | null>(null);
  const prevSelectedPedidoIdRef = useRef<number | null | undefined>(undefined);

  const isLiveView = selectedDate === null;

  // FlyTo effect when selectedPedidoId changes
  useEffect(() => {
    if (!map || selectedPedidoId == null || selectedPedidoId === prevSelectedPedidoIdRef.current) return;
    prevSelectedPedidoIdRef.current = selectedPedidoId;
    const target = pedidos.find((p) => p.id === selectedPedidoId);
    if (!target || !target.latitud || !target.longitud) return;
    map.panTo({ lat: target.latitud, lng: target.longitud });
    map.setZoom(16);
    // Open the pedido's InfoWindow
    setTimeout(() => {
      setSelectedMarker({ type: "pedido", data: target });
    }, 400);
  }, [map, selectedPedidoId, pedidos]);

  const { isLoaded, loadError } = useJsApiLoader({
    googleMapsApiKey: GOOGLE_MAPS_API_KEY,
    libraries: ["places"],
  });

  // Fetch motorizados with phone numbers
  const fetchMotorizados = useCallback(async () => {
    try {
      const { data: roles } = await supabase
        .from("user_roles")
        .select("user_id")
        .eq("role", "motorizado");

      if (!roles || roles.length === 0) {
        setMotorizados([]);
        return;
      }

      const userIds = roles.map((r) => r.user_id);

      const { data: profiles } = await supabase
        .from("profiles")
        .select("user_id, full_name, phone, is_online, last_location_lat, last_location_lng, last_location_updated_at")
        .in("user_id", userIds)
        .eq("status", "activo");

      // Get active orders count per motorizado
      const { data: orderCounts } = await supabase
        .from("pedidos")
        .select("motorizado_id")
        .in("motorizado_id", userIds)
        .in("estado", ["Asignado", "En Ruta", "Novedad"]);

      const countMap: Record<string, number> = {};
      orderCounts?.forEach((o) => {
        if (o.motorizado_id) {
          countMap[o.motorizado_id] = (countMap[o.motorizado_id] || 0) + 1;
        }
      });

      const newMotorizados = (profiles || []).map((p) => ({
        ...p,
        activeOrders: countMap[p.user_id] || 0,
      }));

      setMotorizados(newMotorizados);

      // Initialize animated positions for new motorizados
      setAnimatedPositions((prev) => {
        const updated = { ...prev };
        newMotorizados.forEach((m) => {
          if (m.last_location_lat && m.last_location_lng) {
            if (!updated[m.user_id]) {
              // New motorizado - set position directly
              updated[m.user_id] = {
                lat: m.last_location_lat,
                lng: m.last_location_lng,
                targetLat: m.last_location_lat,
                targetLng: m.last_location_lng,
              };
            } else {
              // Existing - update target for smooth animation
              updated[m.user_id] = {
                ...updated[m.user_id],
                targetLat: m.last_location_lat,
                targetLng: m.last_location_lng,
              };
            }
          }
        });
        return updated;
      });
    } catch (error) {
      console.error("Error fetching motorizados:", error);
    }
  }, []);

  // Smooth animation for motorizado positions
  useEffect(() => {
    if (!isLiveView) return;

    const animate = () => {
      setAnimatedPositions((prev) => {
        let hasChanges = false;
        const updated = { ...prev };

        Object.keys(updated).forEach((userId) => {
          const pos = updated[userId];
          const latDiff = pos.targetLat - pos.lat;
          const lngDiff = pos.targetLng - pos.lng;

          // If position is close enough, snap to target
          if (Math.abs(latDiff) < 0.00001 && Math.abs(lngDiff) < 0.00001) {
            if (pos.lat !== pos.targetLat || pos.lng !== pos.targetLng) {
              updated[userId] = { ...pos, lat: pos.targetLat, lng: pos.targetLng };
              hasChanges = true;
            }
          } else {
            // Smooth interpolation (ease-out)
            updated[userId] = {
              ...pos,
              lat: pos.lat + latDiff * 0.15,
              lng: pos.lng + lngDiff * 0.15,
            };
            hasChanges = true;
          }
        });

        return hasChanges ? updated : prev;
      });

      animationFrameRef.current = requestAnimationFrame(animate);
    };

    animationFrameRef.current = requestAnimationFrame(animate);

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [isLiveView]);

  // Real-time subscription for motorizado location updates
  useEffect(() => {
    if (!isLiveView) return;

    fetchMotorizados();

    // Subscribe to profile location changes
    const channel = supabase
      .channel('motorizado-locations')
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'profiles',
          filter: 'last_location_lat=neq.null',
        },
        (payload) => {
          const updated = payload.new as {
            user_id: string;
            last_location_lat: number | null;
            last_location_lng: number | null;
            last_location_updated_at: string | null;
            is_online: boolean | null;
          };

          // Check if this is a motorizado we're tracking
          setMotorizados((prev) => {
            const existing = prev.find((m) => m.user_id === updated.user_id);
            if (!existing) return prev;

            return prev.map((m) =>
              m.user_id === updated.user_id
                ? {
                    ...m,
                    last_location_lat: updated.last_location_lat,
                    last_location_lng: updated.last_location_lng,
                    last_location_updated_at: updated.last_location_updated_at,
                    is_online: updated.is_online ?? m.is_online,
                  }
                : m
            );
          });

          // Update animated position target
          if (updated.last_location_lat && updated.last_location_lng) {
            setAnimatedPositions((prev) => ({
              ...prev,
              [updated.user_id]: {
                ...(prev[updated.user_id] || { lat: updated.last_location_lat!, lng: updated.last_location_lng! }),
                targetLat: updated.last_location_lat!,
                targetLng: updated.last_location_lng!,
              },
            }));
          }
        }
      )
      .subscribe();

    // Fallback polling every 30s for robustness
    const interval = setInterval(fetchMotorizados, 30000);

    return () => {
      supabase.removeChannel(channel);
      clearInterval(interval);
    };
  }, [fetchMotorizados, isLiveView]);

  const onMapLoad = useCallback((mapInstance: google.maps.Map) => {
    setMap(mapInstance);
  }, []);

  // Smart filter: operational statuses + lagged orders from previous days
  const validPedidos = useMemo(() => {
    const today = startOfDay(new Date());

    return pedidos.filter((p) => {
      // Must have valid coordinates
      if (!p.latitud || !p.longitud || isNaN(p.latitud) || isNaN(p.longitud)) {
        return false;
      }

      const estado = p.estado?.toLowerCase() || "";

      // Always exclude "anulado"
      if (estado === "anulado") return false;

      // If "novedades only" toggle is on, show only novedades
      if (showNovedadesOnly) {
        return estado === "novedad" || estado.includes("novedad");
      }

      // For today's orders, show all operational statuses
      const orderDate = p.fecha_creacion ? startOfDay(parseISO(p.fecha_creacion)) : null;
      const deliveryDate = p.fecha_entrega ? startOfDay(parseISO(p.fecha_entrega)) : null;
      const isOrderFromToday = orderDate && orderDate.getTime() === today.getTime();
      const isDeliveryToday = deliveryDate && deliveryDate.getTime() === today.getTime();

      if (isOrderFromToday || isDeliveryToday) {
        // Today's orders: show all except closed/completed from previous days
        return !CLOSED_STATUSES.includes(estado);
      }

      // For previous days: only show if NOT in a closed status (lagged/problem orders)
      // This includes: En Ruta, Novedad, Asignado, Recibido en Bodega
      return OPERATIONAL_STATUSES.includes(estado);
    });
  }, [pedidos, showNovedadesOnly]);

  // Create marker icon URL based on status
  const getPedidoMarkerIcon = useCallback((pedido: Pedido) => {
    const isUnassigned = !pedido.motorizado_asignado;
    const color = getMapMarkerColor(pedido.estado, !isUnassigned);
    const isNovedad = pedido.estado?.toLowerCase().includes("novedad");
    
    // Using SVG data URI for custom colored markers
    const svg = isUnassigned
      ? `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="28" height="28">
          <rect x="2" y="2" width="20" height="20" rx="4" fill="${color}" stroke="white" stroke-width="2"/>
          <text x="12" y="16" text-anchor="middle" fill="white" font-size="12" font-weight="bold">?</text>
        </svg>`
      : isNovedad
      ? `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 28 28" width="28" height="28">
          <circle cx="14" cy="14" r="12" fill="${color}" stroke="white" stroke-width="2"/>
          <text x="14" y="19" text-anchor="middle" fill="white" font-size="14" font-weight="bold">!</text>
        </svg>`
      : `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="24" height="24">
          <circle cx="12" cy="12" r="10" fill="${color}" stroke="white" stroke-width="2"/>
        </svg>`;
    return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
  }, []);

  const getMotorizadoMarkerIcon = useCallback((isOnline: boolean) => {
    const color = isOnline ? "#22c55e" : "#9ca3af";
    // Motorcycle icon with pulsing effect for online
    const pulseAnimation = isOnline 
      ? `<animate attributeName="r" values="18;20;18" dur="1.5s" repeatCount="indefinite"/>`
      : "";
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 44 44" width="44" height="44">
      <circle cx="22" cy="22" r="18" fill="${color}" stroke="white" stroke-width="3">
        ${pulseAnimation}
      </circle>
      <text x="22" y="28" text-anchor="middle" font-size="18">🏍️</text>
    </svg>`;
    return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
  }, []);

  const warehouseIcon = useMemo(() => {
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 50 50" width="50" height="50">
      <rect x="5" y="5" width="40" height="40" rx="10" fill="#334155" stroke="white" stroke-width="3"/>
      <text x="25" y="32" text-anchor="middle" font-size="22">🏬</text>
    </svg>`;
    return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
  }, []);

  // Cluster options
  const clusterOptions = useMemo(
    () => ({
      imagePath: "https://developers.google.com/maps/documentation/javascript/examples/markerclusterer/m",
      gridSize: 50,
      minimumClusterSize: 3,
      maxZoom: 15,
    }),
    []
  );

  // Count novedades for toggle label
  const novedadesCount = useMemo(() => {
    return pedidos.filter((p) => {
      const estado = p.estado?.toLowerCase() || "";
      return estado === "novedad" || estado.includes("novedad");
    }).length;
  }, [pedidos]);

  if (loadError) {
    return (
      <div className="flex items-center justify-center h-full min-h-[400px] bg-muted rounded-xl">
        <div className="text-center text-destructive">
          <p className="font-medium">Error al cargar Google Maps</p>
          <p className="text-sm text-muted-foreground mt-1">Verifica la conexión a internet</p>
        </div>
      </div>
    );
  }

  if (!isLoaded) {
    return (
      <div className="flex items-center justify-center h-full min-h-[400px] bg-muted rounded-xl">
        <div className="flex items-center gap-3">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
          <span className="text-muted-foreground">Cargando mapa...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="relative h-full w-full rounded-xl overflow-hidden shadow-lg">
      {/* Toggle for Novedades Only */}
      <div className="absolute top-4 left-4 z-[600] bg-card/95 backdrop-blur-sm rounded-lg px-3 py-2 shadow-lg border border-border">
        <div className="flex items-center gap-2">
          <Switch
            id="novedades-only"
            checked={showNovedadesOnly}
            onCheckedChange={setShowNovedadesOnly}
          />
          <Label 
            htmlFor="novedades-only" 
            className="text-sm font-medium cursor-pointer flex items-center gap-1"
          >
            <AlertTriangle className="h-4 w-4 text-orange-500" />
            Ver solo Novedades
            {novedadesCount > 0 && (
              <span className="ml-1 bg-orange-500 text-white text-xs px-1.5 py-0.5 rounded-full">
                {novedadesCount}
              </span>
            )}
          </Label>
        </div>
      </div>

      {/* Live indicator */}
      {isLiveView && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 z-[600] bg-green-500/90 text-white text-xs font-medium px-3 py-1 rounded-full flex items-center gap-1.5 shadow-lg">
          <span className="w-2 h-2 bg-white rounded-full animate-pulse" />
          En vivo
        </div>
      )}

      <GoogleMap
        mapContainerStyle={mapContainerStyle}
        center={BODEGA_COORDS}
        zoom={12}
        onLoad={onMapLoad}
        options={{
          styles: mapStyles,
          disableDefaultUI: false,
          zoomControl: true,
          streetViewControl: false,
          mapTypeControl: false,
          fullscreenControl: true,
        }}
      >
        {/* Warehouse Marker */}
        <MarkerF
          position={BODEGA_COORDS}
          icon={{
            url: warehouseIcon,
            scaledSize: new google.maps.Size(50, 50),
            anchor: new google.maps.Point(25, 25),
          }}
          zIndex={1000}
          onClick={() => setSelectedMarker({ type: "bodega", data: null })}
        />

        {/* Bodega InfoWindow */}
        {selectedMarker?.type === "bodega" && (
          <InfoWindowF
            position={BODEGA_COORDS}
            onCloseClick={() => setSelectedMarker(null)}
          >
            <div style={{ padding: "8px", minWidth: "200px", zIndex: 10010 }}>
              <p style={{ fontWeight: "bold", fontSize: "15px", margin: "0 0 8px 0" }}>
                🏬 Bodega Plus Envíos
              </p>
              <p style={{ margin: "0 0 4px 0", color: "#6b7280", fontSize: "12px" }}>
                📍 Carrera 20 # 14-30 Local 212
              </p>
              <p style={{ margin: 0, color: "#3b82f6", fontSize: "12px" }}>
                📞 324 222 3825
              </p>
            </div>
          </InfoWindowF>
        )}

        {/* Pedido Markers with Clustering */}
        <MarkerClustererF options={clusterOptions}>
          {(clusterer) => (
            <>
              {validPedidos.map((pedido) => (
                <MarkerF
                  key={`pedido-${pedido.id}`}
                  position={{ lat: pedido.latitud!, lng: pedido.longitud! }}
                  icon={{
                    url: getPedidoMarkerIcon(pedido),
                    scaledSize: new google.maps.Size(
                      selectedPedidoId === pedido.id ? 32 : 24,
                      selectedPedidoId === pedido.id ? 32 : 24
                    ),
                    anchor: new google.maps.Point(12, 12),
                  }}
                  clusterer={clusterer}
                  zIndex={selectedPedidoId === pedido.id ? 999 : 100}
                  onClick={() => {
                    setSelectedMarker({ type: "pedido", data: pedido });
                    onPedidoClick?.(pedido);
                  }}
                />
              ))}
            </>
          )}
        </MarkerClustererF>

        {/* Pedido InfoWindow */}
        {selectedMarker?.type === "pedido" && selectedMarker.data && (
          <InfoWindowF
            position={{
              lat: (selectedMarker.data as Pedido).latitud!,
              lng: (selectedMarker.data as Pedido).longitud!,
            }}
            onCloseClick={() => setSelectedMarker(null)}
            options={{ maxWidth: 320, zIndex: 10010 }}
          >
            <div style={{ padding: "8px", minWidth: "250px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "start", marginBottom: "8px" }}>
                <span style={{ fontWeight: "bold", fontSize: "14px" }}>
                  {(selectedMarker.data as Pedido).numero_guia || `#${(selectedMarker.data as Pedido).id}`}
                </span>
                <span
                  style={{
                    padding: "2px 8px",
                    borderRadius: "12px",
                    fontSize: "11px",
                    fontWeight: "600",
                    backgroundColor: getMapMarkerColor((selectedMarker.data as Pedido).estado, true),
                    color: "white",
                  }}
                >
                  {(selectedMarker.data as Pedido).estado}
                </span>
              </div>
              <p style={{ margin: "0 0 6px 0", fontWeight: "600" }}>
                👤 {(selectedMarker.data as Pedido).cliente_nombre || "Sin nombre"}
              </p>
              <p style={{ margin: "0 0 6px 0", color: "#6b7280", fontSize: "12px" }}>
                📍 {(selectedMarker.data as Pedido).direccion_entrega}
              </p>
              {(selectedMarker.data as Pedido).zona && (
                <p style={{ margin: "0 0 6px 0", fontSize: "12px" }}>
                  <strong>Zona:</strong> {(selectedMarker.data as Pedido).zona} | <strong>Barrio:</strong> {(selectedMarker.data as Pedido).barrio}
                </p>
              )}
              {(selectedMarker.data as Pedido).motorizado_asignado ? (
                <p style={{ margin: "0", fontSize: "12px", color: "#22c55e" }}>
                  🏍️ {(selectedMarker.data as Pedido).motorizado_asignado}
                </p>
              ) : (
                <p style={{ margin: "0", fontSize: "12px", color: "#f59e0b", fontWeight: "600" }}>
                  ⚠️ Sin motorizado asignado
                </p>
              )}
              {(selectedMarker.data as Pedido).tipo_novedad && (
                <p style={{ margin: "6px 0 0 0", fontSize: "11px", color: "#ea580c" }}>
                  ⚡ Novedad: {(selectedMarker.data as Pedido).tipo_novedad}
                </p>
              )}
            </div>
          </InfoWindowF>
        )}

        {/* Motorizado Markers with smooth animation */}
        {isLiveView &&
          motorizados
            .filter((m) => animatedPositions[m.user_id])
            .map((motorizado) => {
              const pos = animatedPositions[motorizado.user_id];
              return (
                <MarkerF
                  key={`moto-${motorizado.user_id}`}
                  position={{ lat: pos.lat, lng: pos.lng }}
                  icon={{
                    url: getMotorizadoMarkerIcon(motorizado.is_online || false),
                    scaledSize: new google.maps.Size(44, 44),
                    anchor: new google.maps.Point(22, 22),
                  }}
                  zIndex={500}
                  onClick={() => {
                    setSelectedMarker({ type: "motorizado", data: motorizado });
                    onMotorizadoClick?.(motorizado);
                  }}
                />
              );
            })}

        {/* Motorizado InfoWindow - Enhanced with phone and orders */}
        {selectedMarker?.type === "motorizado" && selectedMarker.data && (
          <InfoWindowF
            position={{
              lat: animatedPositions[(selectedMarker.data as Motorizado).user_id]?.lat ||
                   (selectedMarker.data as Motorizado).last_location_lat!,
              lng: animatedPositions[(selectedMarker.data as Motorizado).user_id]?.lng ||
                   (selectedMarker.data as Motorizado).last_location_lng!,
            }}
            onCloseClick={() => setSelectedMarker(null)}
            options={{ maxWidth: 300, zIndex: 10010 }}
          >
            <div style={{ padding: "10px", minWidth: "220px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "10px" }}>
                <span style={{ fontWeight: "bold", fontSize: "15px" }}>
                  🏍️ {(selectedMarker.data as Motorizado).full_name}
                </span>
                <span
                  style={{
                    padding: "2px 8px",
                    borderRadius: "12px",
                    fontSize: "10px",
                    fontWeight: "600",
                    backgroundColor: (selectedMarker.data as Motorizado).is_online ? "#22c55e" : "#9ca3af",
                    color: "white",
                  }}
                >
                  {(selectedMarker.data as Motorizado).is_online ? "En línea" : "Offline"}
                </span>
              </div>
              
              {/* Phone */}
              {(selectedMarker.data as Motorizado).phone && (
                <p style={{ margin: "0 0 6px 0", fontSize: "13px" }}>
                  📞{" "}
                  <a 
                    href={`tel:${(selectedMarker.data as Motorizado).phone}`}
                    style={{ color: "#3b82f6", textDecoration: "none" }}
                  >
                    {(selectedMarker.data as Motorizado).phone}
                  </a>
                </p>
              )}
              
              {/* Active orders count */}
              <p style={{ margin: "0 0 6px 0", fontSize: "13px", fontWeight: "500" }}>
                📦 Pedidos asignados:{" "}
                <span style={{ 
                  color: (selectedMarker.data as Motorizado).activeOrders ? "#22c55e" : "#9ca3af",
                  fontWeight: "bold" 
                }}>
                  {(selectedMarker.data as Motorizado).activeOrders || 0}
                </span>
              </p>
              
              {/* Last location update */}
              {(selectedMarker.data as Motorizado).last_location_updated_at && (
                <p style={{ margin: "0", fontSize: "11px", color: "#6b7280" }}>
                  📍 Última ubicación:{" "}
                  {format(
                    new Date((selectedMarker.data as Motorizado).last_location_updated_at!),
                    "HH:mm",
                    { locale: es }
                  )}
                </p>
              )}
            </div>
          </InfoWindowF>
        )}
      </GoogleMap>
    </div>
  );
};

export default AdminMapGoogle;
