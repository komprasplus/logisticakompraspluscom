import { useCallback, useMemo, useState, useEffect } from "react";
import {
  GoogleMap,
  useJsApiLoader,
  MarkerF,
  InfoWindowF,
  PolylineF,
} from "@react-google-maps/api";
import { Loader2 } from "lucide-react";

import { GOOGLE_MAPS_API_KEY, GOOGLE_MAPS_LIBRARIES } from "@/lib/googleMapsConfig";

// Warehouse coordinates - Calle 14 # 19-64, Bogotá (Plus Envíos)
const BODEGA_COORDS = { lat: 4.6066, lng: -74.0747 };

// Map styling - clean professional look (Light Mode)
const lightMapStyles = [
  { featureType: "poi", elementType: "labels", stylers: [{ visibility: "off" }] },
  { featureType: "transit", elementType: "labels", stylers: [{ visibility: "off" }] },
];

// Night Mode Styling for Dark Theme
const darkMapStyles = [
  { elementType: "geometry", stylers: [{ color: "#1d2c4d" }] },
  { elementType: "labels.text.fill", stylers: [{ color: "#8ec3b9" }] },
  { elementType: "labels.text.stroke", stylers: [{ color: "#1a3646" }] },
  { featureType: "administrative.country", elementType: "geometry.stroke", stylers: [{ color: "#4b6878" }] },
  { featureType: "administrative.land_parcel", elementType: "labels.text.fill", stylers: [{ color: "#64779e" }] },
  { featureType: "administrative.province", elementType: "geometry.stroke", stylers: [{ color: "#4b6878" }] },
  { featureType: "landscape.man_made", elementType: "geometry.stroke", stylers: [{ color: "#334e87" }] },
  { featureType: "landscape.natural", elementType: "geometry", stylers: [{ color: "#1d3d59" }] },
  { featureType: "poi", elementType: "geometry", stylers: [{ color: "#283d6a" }] },
  { featureType: "poi", elementType: "labels", stylers: [{ visibility: "off" }] },
  { featureType: "poi", elementType: "labels.text.fill", stylers: [{ color: "#6f9ba5" }] },
  { featureType: "poi", elementType: "labels.text.stroke", stylers: [{ color: "#1d2c4d" }] },
  { featureType: "poi.park", elementType: "geometry.fill", stylers: [{ color: "#023e58" }] },
  { featureType: "poi.park", elementType: "labels.text.fill", stylers: [{ color: "#3C7680" }] },
  { featureType: "road", elementType: "geometry", stylers: [{ color: "#304a7d" }] },
  { featureType: "road", elementType: "labels.text.fill", stylers: [{ color: "#98a5be" }] },
  { featureType: "road", elementType: "labels.text.stroke", stylers: [{ color: "#1d2c4d" }] },
  { featureType: "road.highway", elementType: "geometry", stylers: [{ color: "#2c6675" }] },
  { featureType: "road.highway", elementType: "geometry.stroke", stylers: [{ color: "#255763" }] },
  { featureType: "road.highway", elementType: "labels.text.fill", stylers: [{ color: "#b0d5ce" }] },
  { featureType: "road.highway", elementType: "labels.text.stroke", stylers: [{ color: "#1a3646" }] },
  { featureType: "transit", elementType: "labels", stylers: [{ visibility: "off" }] },
  { featureType: "transit", elementType: "labels.text.fill", stylers: [{ color: "#98a5be" }] },
  { featureType: "transit", elementType: "labels.text.stroke", stylers: [{ color: "#1d2c4d" }] },
  { featureType: "transit.line", elementType: "geometry.fill", stylers: [{ color: "#283d6a" }] },
  { featureType: "transit.station", elementType: "geometry", stylers: [{ color: "#3a4762" }] },
  { featureType: "water", elementType: "geometry", stylers: [{ color: "#0e1626" }] },
  { featureType: "water", elementType: "labels.text.fill", stylers: [{ color: "#4e6d70" }] },
];

const mapContainerStyle = {
  width: "100%",
  height: "100%",
  minHeight: "250px",
  borderRadius: "20px",
};

interface Pedido {
  id: number;
  numero_guia: string | null;
  cliente_nombre: string | null;
  direccion_entrega: string | null;
  estado: string | null;
  latitud: number | null;
  longitud: number | null;
}

interface MotorizadoMapGoogleProps {
  pedidos: Pedido[];
  userLocation?: { lat: number; lng: number } | null;
  onPedidoClick?: (pedido: Pedido) => void;
  /** Encoded polyline de la ruta optimizada (Google Directions). */
  routePolyline?: string | null;
  /** Orden óptimo de pedidos (IDs). Si está, los markers se numeran según este orden. */
  routeOrderedIds?: number[] | null;
}

const MotorizadoMapGoogle = ({
  pedidos,
  userLocation,
  onPedidoClick,
  routePolyline,
  routeOrderedIds,
}: MotorizadoMapGoogleProps) => {
  const [map, setMap] = useState<google.maps.Map | null>(null);
  const [selectedMarker, setSelectedMarker] = useState<{
    type: "pedido" | "user" | "bodega";
    data: Pedido | null;
    index?: number;
  } | null>(null);
  const [isDark, setIsDark] = useState(false);

  // Listen for dark mode changes
  useEffect(() => {
    const checkDarkMode = () => {
      setIsDark(document.documentElement.classList.contains("dark"));
    };
    
    checkDarkMode();
    
    // Observer for class changes on html element
    const observer = new MutationObserver(checkDarkMode);
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
    
    return () => observer.disconnect();
  }, []);

  // Update map styles when dark mode changes
  useEffect(() => {
    if (map) {
      map.setOptions({ styles: isDark ? darkMapStyles : lightMapStyles });
    }
  }, [map, isDark]);

  const { isLoaded, loadError } = useJsApiLoader({
    googleMapsApiKey: GOOGLE_MAPS_API_KEY,
    libraries: GOOGLE_MAPS_LIBRARIES,
  });

  // Decodificar la polyline cuando llegue
  const decodedPath = useMemo(() => {
    if (!isLoaded || !routePolyline) return null;
    try {
      const geometry = (window as any).google?.maps?.geometry?.encoding;
      if (!geometry?.decodePath) return null;
      const path = geometry.decodePath(routePolyline) as Array<{
        lat: () => number;
        lng: () => number;
      }>;
      return path.map((p) => ({ lat: p.lat(), lng: p.lng() }));
    } catch {
      return null;
    }
  }, [isLoaded, routePolyline]);

  // Auto-fit del mapa cuando hay ruta
  useEffect(() => {
    if (!map || !decodedPath || decodedPath.length === 0) return;
    const bounds = new (window as any).google.maps.LatLngBounds();
    bounds.extend(BODEGA_COORDS);
    decodedPath.forEach((p) => bounds.extend(p));
    map.fitBounds(bounds, 60);
  }, [map, decodedPath]);

  const onMapLoad = useCallback((mapInstance: google.maps.Map) => {
    setMap(mapInstance);
  }, []);

  // Filter valid pedidos
  const validPedidos = useMemo(() => {
    const valid = pedidos.filter(
      (p) =>
        p.latitud != null &&
        p.longitud != null &&
        !isNaN(Number(p.latitud)) &&
        !isNaN(Number(p.longitud))
    );
    // Si hay orden optimizado, reordenar los validos según ese orden
    if (routeOrderedIds && routeOrderedIds.length > 0) {
      const map = new Map(valid.map((p) => [p.id, p]));
      const ordered: Pedido[] = [];
      for (const id of routeOrderedIds) {
        const p = map.get(id);
        if (p) {
          ordered.push(p);
          map.delete(id);
        }
      }
      // Append los que no estaban en el orden (por si hay desfase)
      return [...ordered, ...map.values()];
    }
    return valid;
  }, [pedidos, routeOrderedIds]);

  // Calculate center based on pedidos
  const center = useMemo(() => {
    if (userLocation) {
      return userLocation;
    }
    if (validPedidos.length > 0) {
      const avgLat = validPedidos.reduce((sum, p) => sum + Number(p.latitud), 0) / validPedidos.length;
      const avgLng = validPedidos.reduce((sum, p) => sum + Number(p.longitud), 0) / validPedidos.length;
      return { lat: avgLat, lng: avgLng };
    }
    return BODEGA_COORDS;
  }, [validPedidos, userLocation]);

  // Get marker color based on status
  const getMarkerColor = (status: string | null): string => {
    const s = status?.toLowerCase();
    if (s === "entregado") return "#22c55e";
    if (s === "cancelado" || s === "novedad") return "#ef4444";
    if (s === "en ruta" || s === "en camino") return "#3b82f6";
    return "#f59e0b"; // Pending - amber
  };

  // Get status label
  const getStatusLabel = (status: string | null): string => {
    const s = status?.toLowerCase();
    switch (s) {
      case "entregado": return "✅ Entregado";
      case "en ruta":
      case "en camino": return "🚚 En Ruta";
      case "cancelado":
      case "novedad": return "❌ Novedad";
      default: return "⏳ Pendiente";
    }
  };

  // Create marker icon URL
  const createPedidoMarkerIcon = useCallback((color: string, index: number) => {
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 36 36" width="36" height="36">
      <circle cx="18" cy="18" r="15" fill="${color}" stroke="white" stroke-width="3"/>
      <text x="18" y="23" text-anchor="middle" fill="white" font-size="14" font-weight="bold" font-family="Arial">${index}</text>
    </svg>`;
    return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
  }, []);

  const userMarkerIcon = useMemo(() => {
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 40 40" width="40" height="40">
      <circle cx="20" cy="20" r="15" fill="#6366f1" stroke="white" stroke-width="4" opacity="0.9"/>
      <circle cx="20" cy="20" r="22" fill="#6366f1" opacity="0.2"/>
    </svg>`;
    return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
  }, []);

  const warehouseMarkerIcon = useMemo(() => {
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 50 50" width="50" height="50">
      <rect x="5" y="5" width="40" height="40" rx="10" fill="#334155" stroke="white" stroke-width="3"/>
      <text x="25" y="32" text-anchor="middle" font-size="22">🏬</text>
    </svg>`;
    return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
  }, []);

  // Open navigation in Google Maps or Waze
  const openNavigation = (lat: number, lng: number, app: "google" | "waze") => {
    if (app === "waze") {
      window.open(`https://waze.com/ul?ll=${lat},${lng}&navigate=yes`, "_blank");
    } else {
      window.open(`https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`, "_blank");
    }
  };

  if (loadError) {
    return (
      <div className="flex items-center justify-center h-full min-h-[250px] neu-flat">
        <div className="text-center text-destructive">
          <p className="font-medium">Error al cargar Google Maps</p>
          <p className="text-sm text-muted-foreground mt-1">Verifica tu conexión</p>
        </div>
      </div>
    );
  }

  if (!isLoaded) {
    return (
      <div className="flex items-center justify-center h-full min-h-[250px] neu-flat">
        <div className="flex items-center gap-3">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
          <span className="text-muted-foreground">Cargando mapa...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="relative h-full w-full rounded-2xl overflow-hidden neu-elevated" style={{ minHeight: "250px" }}>
      <GoogleMap
        mapContainerStyle={mapContainerStyle}
        center={center}
        zoom={14}
        onLoad={onMapLoad}
        options={{
          styles: isDark ? darkMapStyles : lightMapStyles,
          disableDefaultUI: false,
          zoomControl: true,
          streetViewControl: false,
          mapTypeControl: false,
          fullscreenControl: false,
        }}
      >
        {/* Polyline de ruta optimizada */}
        {decodedPath && decodedPath.length > 0 && (
          <PolylineF
            path={decodedPath}
            options={{
              strokeColor: "#1B2959",
              strokeOpacity: 0.85,
              strokeWeight: 5,
              geodesic: true,
              icons: [
                {
                  icon: { path: "M 0,-1 0,1", strokeOpacity: 1, scale: 3 },
                  offset: "0",
                  repeat: "16px",
                },
              ],
            }}
          />
        )}

        {/* Warehouse Marker */}
        <MarkerF
          position={BODEGA_COORDS}
          icon={{
            url: warehouseMarkerIcon,
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
            options={{ zIndex: 10010 }}
          >
            <div style={{ padding: "8px", minWidth: "180px" }}>
              <p style={{ fontWeight: "bold", fontSize: "14px", margin: "0 0 8px 0" }}>
                🏬 Bodega Kompras Plus
              </p>
              <p style={{ margin: "0 0 4px 0", color: "#6b7280", fontSize: "12px" }}>
                📍 Calle 14 # 19-64 Bodega 403
              </p>
              <p style={{ margin: "0 0 8px 0", color: "#3b82f6", fontSize: "12px" }}>
                📞 324 222 3825
              </p>
              <div style={{ display: "flex", gap: "8px", marginTop: "8px" }}>
                <button
                  onClick={() => openNavigation(BODEGA_COORDS.lat, BODEGA_COORDS.lng, "google")}
                  style={{
                    flex: 1,
                    padding: "6px 8px",
                    backgroundColor: "#4285F4",
                    color: "white",
                    border: "none",
                    borderRadius: "6px",
                    fontSize: "11px",
                    fontWeight: "600",
                    cursor: "pointer",
                  }}
                >
                  Google Maps
                </button>
                <button
                  onClick={() => openNavigation(BODEGA_COORDS.lat, BODEGA_COORDS.lng, "waze")}
                  style={{
                    flex: 1,
                    padding: "6px 8px",
                    backgroundColor: "#33CCFF",
                    color: "white",
                    border: "none",
                    borderRadius: "6px",
                    fontSize: "11px",
                    fontWeight: "600",
                    cursor: "pointer",
                  }}
                >
                  Waze
                </button>
              </div>
            </div>
          </InfoWindowF>
        )}

        {/* Pedido Markers */}
        {validPedidos.map((pedido, index) => (
          <MarkerF
            key={`pedido-${pedido.id}`}
            position={{ lat: Number(pedido.latitud), lng: Number(pedido.longitud) }}
            icon={{
              url: createPedidoMarkerIcon(getMarkerColor(pedido.estado), index + 1),
              scaledSize: new google.maps.Size(36, 36),
              anchor: new google.maps.Point(18, 18),
            }}
            zIndex={100 + index}
            onClick={() => {
              setSelectedMarker({ type: "pedido", data: pedido, index: index + 1 });
              onPedidoClick?.(pedido);
            }}
          />
        ))}

        {/* Pedido InfoWindow */}
        {selectedMarker?.type === "pedido" && selectedMarker.data && (
          <InfoWindowF
            position={{
              lat: Number(selectedMarker.data.latitud),
              lng: Number(selectedMarker.data.longitud),
            }}
            onCloseClick={() => setSelectedMarker(null)}
            options={{ maxWidth: 320, zIndex: 10010 }}
          >
            <div style={{ padding: "8px", minWidth: "220px" }}>
              <p style={{ fontWeight: "bold", fontSize: "14px", margin: "0 0 6px 0" }}>
                #{selectedMarker.index} - {selectedMarker.data.numero_guia || `ID ${selectedMarker.data.id}`}
              </p>
              <p style={{ margin: "0 0 4px 0", color: "#374151", fontWeight: "500" }}>
                {selectedMarker.data.cliente_nombre || "Sin nombre"}
              </p>
              <p style={{ margin: "0 0 8px 0", color: "#6b7280", fontSize: "12px" }}>
                📍 {selectedMarker.data.direccion_entrega || "Sin dirección"}
              </p>
              <p style={{ margin: "0 0 10px 0", fontWeight: "500" }}>
                {getStatusLabel(selectedMarker.data.estado)}
              </p>
              
              {/* Navigation Buttons */}
              <div style={{ display: "flex", gap: "8px" }}>
                <button
                  onClick={() => openNavigation(
                    Number(selectedMarker.data!.latitud),
                    Number(selectedMarker.data!.longitud),
                    "google"
                  )}
                  style={{
                    flex: 1,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: "4px",
                    padding: "8px",
                    backgroundColor: "#4285F4",
                    color: "white",
                    border: "none",
                    borderRadius: "8px",
                    fontSize: "12px",
                    fontWeight: "600",
                    cursor: "pointer",
                  }}
                >
                  <span>🗺️</span> Google Maps
                </button>
                <button
                  onClick={() => openNavigation(
                    Number(selectedMarker.data!.latitud),
                    Number(selectedMarker.data!.longitud),
                    "waze"
                  )}
                  style={{
                    flex: 1,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: "4px",
                    padding: "8px",
                    backgroundColor: "#33CCFF",
                    color: "white",
                    border: "none",
                    borderRadius: "8px",
                    fontSize: "12px",
                    fontWeight: "600",
                    cursor: "pointer",
                  }}
                >
                  <span>📍</span> Waze
                </button>
              </div>
            </div>
          </InfoWindowF>
        )}

        {/* User Location Marker */}
        {userLocation && (
          <MarkerF
            position={userLocation}
            icon={{
              url: userMarkerIcon,
              scaledSize: new google.maps.Size(40, 40),
              anchor: new google.maps.Point(20, 20),
            }}
            zIndex={900}
            onClick={() => setSelectedMarker({ type: "user", data: null })}
          />
        )}

        {/* User Location InfoWindow */}
        {selectedMarker?.type === "user" && userLocation && (
          <InfoWindowF
            position={userLocation}
            onCloseClick={() => setSelectedMarker(null)}
            options={{ zIndex: 10010 }}
          >
            <div style={{ padding: "4px" }}>
              <p style={{ fontWeight: "bold", fontSize: "13px", margin: 0 }}>
                📍 Tu ubicación actual
              </p>
            </div>
          </InfoWindowF>
        )}
      </GoogleMap>
    </div>
  );
};

export default MotorizadoMapGoogle;
