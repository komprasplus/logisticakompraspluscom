import { useCallback, useMemo, useState, useEffect } from "react";
import {
  GoogleMap,
  useJsApiLoader,
  MarkerF,
  InfoWindowF,
  MarkerClustererF,
} from "@react-google-maps/api";
import { supabase } from "@/integrations/supabase/client";
import { getMapMarkerColor, getStatusConfig } from "@/lib/orderStatuses";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { Loader2 } from "lucide-react";

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
}

interface Motorizado {
  user_id: string;
  full_name: string;
  is_online: boolean;
  last_location_lat: number | null;
  last_location_lng: number | null;
  last_location_updated_at: string | null;
  activeOrders?: number;
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
  const [selectedMarker, setSelectedMarker] = useState<{
    type: "pedido" | "motorizado" | "bodega";
    data: Pedido | Motorizado | null;
  } | null>(null);

  const isLiveView = selectedDate === null;

  const { isLoaded, loadError } = useJsApiLoader({
    googleMapsApiKey: GOOGLE_MAPS_API_KEY,
    libraries: ["places"],
  });

  // Fetch motorizados
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
        .select("user_id, full_name, is_online, last_location_lat, last_location_lng, last_location_updated_at")
        .in("user_id", userIds)
        .eq("status", "activo");

      // Get active orders count
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

      setMotorizados(
        (profiles || []).map((p) => ({
          ...p,
          activeOrders: countMap[p.user_id] || 0,
        }))
      );
    } catch (error) {
      console.error("Error fetching motorizados:", error);
    }
  }, []);

  useEffect(() => {
    fetchMotorizados();
    
    // Poll for updates in live view
    let interval: NodeJS.Timeout | null = null;
    if (isLiveView) {
      interval = setInterval(fetchMotorizados, 15000);
    }
    
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [fetchMotorizados, isLiveView]);

  const onMapLoad = useCallback((mapInstance: google.maps.Map) => {
    setMap(mapInstance);
  }, []);

  // Filter valid pedidos for markers
  const validPedidos = useMemo(() => {
    return pedidos.filter(
      (p) =>
        p.latitud &&
        p.longitud &&
        !isNaN(p.latitud) &&
        !isNaN(p.longitud) &&
        p.estado?.toLowerCase() !== "anulado"
    );
  }, [pedidos]);

  // Create marker icon URL based on status
  const getPedidoMarkerIcon = useCallback((pedido: Pedido) => {
    const isUnassigned = !pedido.motorizado_asignado;
    const color = getMapMarkerColor(pedido.estado, !isUnassigned);
    // Using SVG data URI for custom colored markers
    const svg = isUnassigned
      ? `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="28" height="28">
          <rect x="2" y="2" width="20" height="20" rx="4" fill="${color}" stroke="white" stroke-width="2"/>
          <text x="12" y="16" text-anchor="middle" fill="white" font-size="12" font-weight="bold">?</text>
        </svg>`
      : `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="24" height="24">
          <circle cx="12" cy="12" r="10" fill="${color}" stroke="white" stroke-width="2"/>
        </svg>`;
    return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
  }, []);

  const getMotorizadoMarkerIcon = useCallback((isOnline: boolean) => {
    const color = isOnline ? "#22c55e" : "#9ca3af";
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 40 40" width="40" height="40">
      <circle cx="20" cy="20" r="18" fill="${color}" stroke="white" stroke-width="3"/>
      <text x="20" y="26" text-anchor="middle" font-size="18">🏍️</text>
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

        {/* Motorizado Markers */}
        {isLiveView &&
          motorizados
            .filter((m) => m.last_location_lat && m.last_location_lng)
            .map((motorizado) => (
              <MarkerF
                key={`moto-${motorizado.user_id}`}
                position={{
                  lat: motorizado.last_location_lat!,
                  lng: motorizado.last_location_lng!,
                }}
                icon={{
                  url: getMotorizadoMarkerIcon(motorizado.is_online || false),
                  scaledSize: new google.maps.Size(40, 40),
                  anchor: new google.maps.Point(20, 20),
                }}
                zIndex={500}
                onClick={() => {
                  setSelectedMarker({ type: "motorizado", data: motorizado });
                  onMotorizadoClick?.(motorizado);
                }}
              />
            ))}

        {/* Motorizado InfoWindow */}
        {selectedMarker?.type === "motorizado" && selectedMarker.data && (
          <InfoWindowF
            position={{
              lat: (selectedMarker.data as Motorizado).last_location_lat!,
              lng: (selectedMarker.data as Motorizado).last_location_lng!,
            }}
            onCloseClick={() => setSelectedMarker(null)}
            options={{ maxWidth: 280, zIndex: 10010 }}
          >
            <div style={{ padding: "8px", minWidth: "200px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "8px" }}>
                <span style={{ fontWeight: "bold", fontSize: "14px" }}>
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
              <p style={{ margin: "0 0 4px 0", fontSize: "12px" }}>
                📦 Pedidos activos: <strong>{(selectedMarker.data as Motorizado).activeOrders || 0}</strong>
              </p>
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
