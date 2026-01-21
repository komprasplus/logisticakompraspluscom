import { useEffect, useRef, useState, useCallback } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import "leaflet.markercluster/dist/MarkerCluster.css";
import "leaflet.markercluster/dist/MarkerCluster.Default.css";
import "leaflet.markercluster";
import { supabase } from "@/integrations/supabase/client";
import { getMapMarkerColor, getStatusConfig, isOperationalStatus } from "@/lib/orderStatuses";
import { format } from "date-fns";
import { es } from "date-fns/locale";

// Fix for default markers in Leaflet
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
});

// Warehouse coordinates
const BODEGA_COORDS: L.LatLngExpression = [4.60922, -74.08463];

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

interface LocationHistory {
  id: string;
  motorizado_id: string;
  latitude: number;
  longitude: number;
  recorded_at: string;
}

interface AdminMapEnhancedProps {
  pedidos: Pedido[];
  selectedDate: Date | null; // null = live/today
  onPedidoClick?: (pedido: Pedido) => void;
  onMotorizadoClick?: (motorizado: Motorizado) => void;
  selectedPedidoId?: number | null;
}

const AdminMapEnhanced = ({
  pedidos,
  selectedDate,
  onPedidoClick,
  onMotorizadoClick,
  selectedPedidoId,
}: AdminMapEnhancedProps) => {
  const mapRef = useRef<L.Map | null>(null);
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const markerClusterRef = useRef<L.MarkerClusterGroup | null>(null);
  const motorizadoMarkersRef = useRef<Map<string, L.Marker>>(new Map());
  const routePolylinesRef = useRef<Map<string, L.Polyline>>(new Map());
  const warehouseMarkerRef = useRef<L.Marker | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  
  const [motorizados, setMotorizados] = useState<Motorizado[]>([]);
  const [locationHistory, setLocationHistory] = useState<Record<string, LocationHistory[]>>({});
  const [selectedMotorizado, setSelectedMotorizado] = useState<string | null>(null);

  const isLiveView = selectedDate === null;

  // Create motorcycle icon
  const createMotorcycleIcon = (isOnline: boolean, isSelected: boolean) => {
    const baseColor = isOnline ? "#22c55e" : "#9ca3af";
    const size = isSelected ? 40 : 32;
    
    return L.divIcon({
      className: "motorcycle-icon",
      html: `
        <div style="
          position: relative;
          width: ${size}px;
          height: ${size}px;
          display: flex;
          align-items: center;
          justify-content: center;
        ">
          ${isOnline ? `
            <div style="
              position: absolute;
              width: ${size + 12}px;
              height: ${size + 12}px;
              background: ${baseColor}33;
              border-radius: 50%;
              animation: pulse 2s infinite;
            "></div>
          ` : ''}
          <div style="
            position: relative;
            background: linear-gradient(145deg, ${baseColor}, ${isOnline ? '#16a34a' : '#6b7280'});
            width: ${size}px;
            height: ${size}px;
            border-radius: 50%;
            border: 3px solid white;
            box-shadow: 0 4px 12px rgba(0,0,0,0.3);
            display: flex;
            align-items: center;
            justify-content: center;
            ${isSelected ? 'transform: scale(1.1);' : ''}
          ">
            <span style="font-size: ${size * 0.5}px;">🏍️</span>
          </div>
        </div>
      `,
      iconSize: [size, size],
      iconAnchor: [size / 2, size / 2],
    });
  };

  // Create delivery icon with clustering support
  const createDeliveryIcon = (pedido: Pedido) => {
    const isUnassigned = !pedido.motorizado_asignado;
    const color = getMapMarkerColor(pedido.estado, !isUnassigned);
    const isSelected = selectedPedidoId === pedido.id;
    const size = isSelected ? 28 : 20;

    if (isUnassigned) {
      return L.divIcon({
        className: "custom-marker-icon",
        html: `<div style="
          background-color: ${color}; 
          width: ${size}px; 
          height: ${size}px; 
          border-radius: 4px; 
          border: 3px solid white; 
          box-shadow: 0 2px 8px rgba(0,0,0,0.4);
          display: flex;
          align-items: center;
          justify-content: center;
        ">
          <span style="color: white; font-size: ${size * 0.5}px; font-weight: bold;">?</span>
        </div>`,
        iconSize: [size, size],
        iconAnchor: [size / 2, size / 2],
      });
    }

    return L.divIcon({
      className: "custom-marker-icon",
      html: `<div style="
        background-color: ${color}; 
        width: ${size}px; 
        height: ${size}px; 
        border-radius: 50%; 
        border: 3px solid white; 
        box-shadow: 0 2px 8px rgba(0,0,0,0.3);
      "></div>`,
      iconSize: [size, size],
      iconAnchor: [size / 2, size / 2],
    });
  };

  const createWarehouseIcon = () => {
    return L.divIcon({
      className: "warehouse-icon",
      html: `
        <div style="position: relative;">
          <div style="
            position: relative;
            background: linear-gradient(145deg, #334155 0%, #1e293b 100%);
            width: 48px;
            height: 48px;
            border-radius: 14px;
            border: 3px solid white;
            box-shadow: 0 10px 30px rgba(0,0,0,0.5);
            display: flex;
            align-items: center;
            justify-content: center;
          ">
            <span style="font-size: 24px;">🏬</span>
          </div>
        </div>
      `,
      iconSize: [48, 48],
      iconAnchor: [24, 24],
    });
  };

  // Fetch motorizados with location data
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

  // Fetch location history for a specific motorizado and date
  const fetchLocationHistory = useCallback(async (motorizadoId: string, date: Date) => {
    try {
      const startOfDay = new Date(date);
      startOfDay.setHours(0, 0, 0, 0);
      
      const endOfDay = new Date(date);
      endOfDay.setHours(23, 59, 59, 999);

      const { data, error } = await supabase
        .from("location_history")
        .select("*")
        .eq("motorizado_id", motorizadoId)
        .gte("recorded_at", startOfDay.toISOString())
        .lte("recorded_at", endOfDay.toISOString())
        .order("recorded_at", { ascending: true });

      if (error) throw error;

      setLocationHistory((prev) => ({
        ...prev,
        [motorizadoId]: data || [],
      }));
    } catch (error) {
      console.error("Error fetching location history:", error);
    }
  }, []);

  // Animate motorizado marker to new position
  const animateMarkerTo = (
    marker: L.Marker,
    newLat: number,
    newLng: number,
    duration: number = 1000
  ) => {
    const startPos = marker.getLatLng();
    const startTime = performance.now();

    const animate = (currentTime: number) => {
      const elapsed = currentTime - startTime;
      const progress = Math.min(elapsed / duration, 1);
      
      // Ease out cubic
      const easeProgress = 1 - Math.pow(1 - progress, 3);
      
      const lat = startPos.lat + (newLat - startPos.lat) * easeProgress;
      const lng = startPos.lng + (newLng - startPos.lng) * easeProgress;
      
      marker.setLatLng([lat, lng]);

      if (progress < 1) {
        animationFrameRef.current = requestAnimationFrame(animate);
      }
    };

    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
    }
    animationFrameRef.current = requestAnimationFrame(animate);
  };

  // Initialize map
  useEffect(() => {
    if (!mapContainerRef.current) return;

    if (!mapRef.current) {
      mapRef.current = L.map(mapContainerRef.current, {
        preferCanvas: true, // Better performance for many markers
      }).setView(BODEGA_COORDS, 13);

      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      }).addTo(mapRef.current);

      // Add warehouse marker
      warehouseMarkerRef.current = L.marker(BODEGA_COORDS, {
        icon: createWarehouseIcon(),
        zIndexOffset: 2000,
      })
        .bindPopup(`
          <div style="font-size: 13px; min-width: 180px; padding: 6px;">
            <p style="font-weight: bold; margin: 0 0 8px 0; font-size: 15px;">🏬 Bodega Kompras Plus</p>
            <p style="margin: 0 0 4px 0; color: #6b7280; font-size: 12px;">📍 Carrera 20 # 14-30 Local 212</p>
            <p style="margin: 0; color: #3b82f6; font-size: 12px;">📞 324 222 3825</p>
          </div>
        `)
        .addTo(mapRef.current);

      // Initialize marker cluster group
      markerClusterRef.current = L.markerClusterGroup({
        maxClusterRadius: 50,
        spiderfyOnMaxZoom: true,
        showCoverageOnHover: false,
        zoomToBoundsOnClick: true,
        disableClusteringAtZoom: 16,
        iconCreateFunction: (cluster) => {
          const count = cluster.getChildCount();
          let size = "small";
          if (count > 10) size = "medium";
          if (count > 25) size = "large";
          
          const sizeMap = { small: 30, medium: 40, large: 50 };
          const s = sizeMap[size as keyof typeof sizeMap];
          
          return L.divIcon({
            html: `<div style="
              background: linear-gradient(145deg, hsl(var(--primary)), hsl(var(--primary)/0.8));
              width: ${s}px;
              height: ${s}px;
              border-radius: 50%;
              border: 3px solid white;
              box-shadow: 0 4px 12px rgba(0,0,0,0.3);
              display: flex;
              align-items: center;
              justify-content: center;
              color: white;
              font-weight: bold;
              font-size: ${s * 0.35}px;
            ">${count}</div>`,
            className: "marker-cluster",
            iconSize: [s, s],
          });
        },
      });
      mapRef.current.addLayer(markerClusterRef.current);
    }

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
  }, []);

  // Fetch data on mount and set up subscriptions
  useEffect(() => {
    fetchMotorizados();

    // Real-time subscription for profile updates
    const channel = supabase
      .channel("admin-map-fleet")
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "profiles" },
        () => fetchMotorizados()
      )
      .subscribe();

    // Poll for location updates every 15 seconds in live mode
    let interval: NodeJS.Timeout | null = null;
    if (isLiveView) {
      interval = setInterval(fetchMotorizados, 15000);
    }

    return () => {
      supabase.removeChannel(channel);
      if (interval) clearInterval(interval);
    };
  }, [fetchMotorizados, isLiveView]);

  // Update pedido markers
  useEffect(() => {
    if (!mapRef.current || !markerClusterRef.current) return;

    markerClusterRef.current.clearLayers();

    const validPedidos = pedidos.filter(
      (p) =>
        p.latitud != null &&
        p.longitud != null &&
        !isNaN(Number(p.latitud)) &&
        !isNaN(Number(p.longitud)) &&
        isOperationalStatus(p.estado)
    );

    validPedidos.forEach((pedido) => {
      const statusConfig = getStatusConfig(pedido.estado);
      const isUnassigned = !pedido.motorizado_asignado;
      const statusLabel = isUnassigned ? "Sin Asignar" : statusConfig.label;

      const marker = L.marker([Number(pedido.latitud), Number(pedido.longitud)], {
        icon: createDeliveryIcon(pedido),
      });

      const popupContent = `
        <div style="font-size: 12px; min-width: 200px;">
          <p style="font-weight: bold; margin: 0 0 4px 0;">${statusConfig.icon} ${pedido.numero_guia || `#${pedido.id}`}</p>
          <p style="margin: 0 0 4px 0; color: #374151;">${pedido.cliente_nombre || "Sin nombre"}</p>
          <p style="margin: 0 0 8px 0; color: #6b7280; font-size: 11px;">${pedido.direccion_entrega || "Sin dirección"}</p>
          ${pedido.motorizado_asignado
            ? `<p style="margin: 0 0 8px 0; color: #3b82f6; font-size: 11px;">🏍️ ${pedido.motorizado_asignado}</p>`
            : `<p style="margin: 0 0 8px 0; color: #f59e0b; font-size: 11px; font-weight: bold;">⚠️ Pendiente de asignación</p>`
          }
          <span style="display: inline-block; padding: 4px 10px; border-radius: 12px; font-size: 11px; font-weight: 500; background: ${statusConfig.color}; color: white;">
            ${statusLabel}
          </span>
        </div>
      `;

      marker.bindPopup(popupContent);
      
      if (onPedidoClick) {
        marker.on("click", () => onPedidoClick(pedido));
      }

      markerClusterRef.current!.addLayer(marker);
    });
  }, [pedidos, selectedPedidoId, onPedidoClick]);

  // Update motorizado markers
  useEffect(() => {
    if (!mapRef.current) return;

    // Remove markers for motorizados no longer in list
    motorizadoMarkersRef.current.forEach((marker, id) => {
      if (!motorizados.find((m) => m.user_id === id)) {
        marker.remove();
        motorizadoMarkersRef.current.delete(id);
      }
    });

    // Update or create markers for each motorizado
    motorizados.forEach((motorizado) => {
      if (motorizado.last_location_lat && motorizado.last_location_lng) {
        const existingMarker = motorizadoMarkersRef.current.get(motorizado.user_id);
        const isSelected = selectedMotorizado === motorizado.user_id;

        if (existingMarker) {
          // Animate to new position
          animateMarkerTo(
            existingMarker,
            motorizado.last_location_lat,
            motorizado.last_location_lng
          );
          existingMarker.setIcon(createMotorcycleIcon(motorizado.is_online, isSelected));
        } else {
          // Create new marker
          const marker = L.marker(
            [motorizado.last_location_lat, motorizado.last_location_lng],
            {
              icon: createMotorcycleIcon(motorizado.is_online, isSelected),
              zIndexOffset: 1000,
            }
          );

          const timeAgo = motorizado.last_location_updated_at
            ? format(new Date(motorizado.last_location_updated_at), "HH:mm", { locale: es })
            : "Sin dato";

          marker.bindPopup(`
            <div style="font-size: 12px; min-width: 180px;">
              <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 8px;">
                <span style="font-size: 20px;">🏍️</span>
                <div>
                  <p style="font-weight: bold; margin: 0;">${motorizado.full_name}</p>
                  <p style="margin: 0; color: ${motorizado.is_online ? '#22c55e' : '#9ca3af'}; font-size: 11px;">
                    ${motorizado.is_online ? '🟢 En línea' : '⚪ Desconectado'}
                  </p>
                </div>
              </div>
              <p style="margin: 0 0 4px 0; color: #6b7280; font-size: 11px;">
                📦 ${motorizado.activeOrders || 0} pedidos activos
              </p>
              <p style="margin: 0; color: #6b7280; font-size: 11px;">
                🕐 Última ubicación: ${timeAgo}
              </p>
            </div>
          `);

          marker.on("click", () => {
            setSelectedMotorizado(motorizado.user_id);
            onMotorizadoClick?.(motorizado);
            
            // Fetch route history for this motorizado
            const targetDate = selectedDate || new Date();
            fetchLocationHistory(motorizado.user_id, targetDate);
          });

          marker.addTo(mapRef.current!);
          motorizadoMarkersRef.current.set(motorizado.user_id, marker);
        }
      }
    });
  }, [motorizados, selectedMotorizado, selectedDate, onMotorizadoClick, fetchLocationHistory]);

  // Draw route polylines for selected motorizado
  useEffect(() => {
    if (!mapRef.current) return;

    // Clear existing polylines
    routePolylinesRef.current.forEach((polyline) => polyline.remove());
    routePolylinesRef.current.clear();

    if (selectedMotorizado && locationHistory[selectedMotorizado]) {
      const history = locationHistory[selectedMotorizado];
      
      if (history.length > 1) {
        const points: L.LatLngExpression[] = history.map((loc) => [
          loc.latitude,
          loc.longitude,
        ]);

        // Create gradient-like polyline with multiple segments
        const polyline = L.polyline(points, {
          color: "#3b82f6",
          weight: 4,
          opacity: 0.8,
          smoothFactor: 1,
          lineCap: "round",
          lineJoin: "round",
        }).addTo(mapRef.current);

        // Add directional arrows/markers along the route
        const arrowIcon = L.divIcon({
          className: "route-arrow",
          html: `<div style="
            width: 8px;
            height: 8px;
            background: #3b82f6;
            border-radius: 50%;
            border: 2px solid white;
          "></div>`,
          iconSize: [8, 8],
          iconAnchor: [4, 4],
        });

        // Add markers at intervals along the route
        const step = Math.max(1, Math.floor(history.length / 10));
        for (let i = 0; i < history.length; i += step) {
          const loc = history[i];
          L.marker([loc.latitude, loc.longitude], {
            icon: arrowIcon,
            interactive: false,
          }).addTo(mapRef.current);
        }

        routePolylinesRef.current.set(selectedMotorizado, polyline);

        // Fit bounds to show the route
        if (points.length > 0) {
          const bounds = L.latLngBounds(points);
          mapRef.current.fitBounds(bounds, { padding: [50, 50] });
        }
      }
    }
  }, [selectedMotorizado, locationHistory]);

  // Clear selection when clicking elsewhere
  const handleMapClick = useCallback(() => {
    setSelectedMotorizado(null);
  }, []);

  useEffect(() => {
    if (mapRef.current) {
      mapRef.current.on("click", handleMapClick);
    }
    return () => {
      if (mapRef.current) {
        mapRef.current.off("click", handleMapClick);
      }
    };
  }, [handleMapClick]);

  return (
    <div
      ref={mapContainerRef}
      className="h-full w-full rounded-xl"
      style={{ minHeight: "100%" }}
    />
  );
};

export default AdminMapEnhanced;
