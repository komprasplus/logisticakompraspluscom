import { useEffect, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

// Fix for default markers in Leaflet
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
});

interface Pedido {
  id: number;
  numero_guia: string | null;
  cliente_nombre: string | null;
  direccion_entrega: string | null;
  estado: string | null;
  latitud: number | null;
  longitud: number | null;
}

interface MotorizadoMapProps {
  pedidos: Pedido[];
  userLocation?: { lat: number; lng: number } | null;
  onPedidoClick?: (pedido: Pedido) => void;
}

// Warehouse coordinates (approximate for Carrera 20 # 14-30)
const BODEGA_COORDS: L.LatLngExpression = [4.6066, -74.0747];

const MotorizadoMap = ({ pedidos, userLocation, onPedidoClick }: MotorizadoMapProps) => {
  const mapRef = useRef<L.Map | null>(null);
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const markersRef = useRef<L.Marker[]>([]);
  const userMarkerRef = useRef<L.Marker | null>(null);
  const warehouseMarkerRef = useRef<L.Marker | null>(null);

  // Bogotá center coordinates
  const bogotaCenter: L.LatLngExpression = [4.6097, -74.0817];

  const getMarkerColor = (status: string | null): string => {
    const s = status?.toLowerCase();
    if (s === "entregado") return "#22c55e";
    if (s === "cancelado" || s === "novedad") return "#ef4444";
    if (s === "en ruta" || s === "en camino") return "#3b82f6";
    return "#f59e0b"; // Pending - amber
  };

  const createDeliveryIcon = (color: string, index?: number) => {
    return L.divIcon({
      className: "custom-marker-icon",
      html: `
        <div style="position: relative; display: flex; align-items: center; justify-content: center;">
          <div style="background-color: ${color}; width: 32px; height: 32px; border-radius: 50%; border: 3px solid white; box-shadow: 0 2px 8px rgba(0,0,0,0.3); display: flex; align-items: center; justify-content: center;">
            ${index !== undefined ? `<span style="color: white; font-size: 12px; font-weight: bold;">${index}</span>` : '📦'}
          </div>
        </div>
      `,
      iconSize: [32, 32],
      iconAnchor: [16, 16],
    });
  };

  const createUserIcon = () => {
    return L.divIcon({
      className: "user-location-icon",
      html: `
        <div style="position: relative;">
          <div style="background-color: #6366f1; width: 20px; height: 20px; border-radius: 50%; border: 4px solid white; box-shadow: 0 2px 12px rgba(99, 102, 241, 0.5);"></div>
          <div style="position: absolute; top: -4px; left: -4px; width: 28px; height: 28px; border-radius: 50%; background-color: rgba(99, 102, 241, 0.2); animation: pulse 2s infinite;"></div>
        </div>
      `,
      iconSize: [20, 20],
      iconAnchor: [10, 10],
    });
  };

  const createWarehouseIcon = () => {
    return L.divIcon({
      className: "warehouse-icon",
      html: `
        <div style="background-color: #1e293b; width: 36px; height: 36px; border-radius: 8px; border: 3px solid white; box-shadow: 0 2px 8px rgba(0,0,0,0.3); display: flex; align-items: center; justify-content: center;">
          <span style="font-size: 18px;">🏭</span>
        </div>
      `,
      iconSize: [36, 36],
      iconAnchor: [18, 18],
    });
  };

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

  useEffect(() => {
    if (!mapContainerRef.current) return;

    // Initialize map only once
    if (!mapRef.current) {
      mapRef.current = L.map(mapContainerRef.current).setView(bogotaCenter, 12);

      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      }).addTo(mapRef.current);

      // Add warehouse marker
      warehouseMarkerRef.current = L.marker(BODEGA_COORDS, {
        icon: createWarehouseIcon(),
      })
        .bindPopup(`
          <div style="font-size: 12px; min-width: 120px;">
            <p style="font-weight: bold; margin: 0 0 4px 0;">🏭 Bodega Principal</p>
            <p style="margin: 0; color: #6b7280; font-size: 11px;">Carrera 20 # 14-30 Local 212</p>
          </div>
        `)
        .addTo(mapRef.current);
    }

    // Cleanup on unmount
    return () => {
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
  }, []);

  // Update markers when pedidos change
  useEffect(() => {
    if (!mapRef.current) return;

    // Clear existing delivery markers
    markersRef.current.forEach((marker) => marker.remove());
    markersRef.current = [];

    // Filter and add markers for pedidos with valid coordinates
    const validPedidos = pedidos.filter(
      (p) =>
        p.latitud != null &&
        p.longitud != null &&
        !isNaN(Number(p.latitud)) &&
        !isNaN(Number(p.longitud))
    );

    validPedidos.forEach((pedido, index) => {
      const marker = L.marker([Number(pedido.latitud), Number(pedido.longitud)], {
        icon: createDeliveryIcon(getMarkerColor(pedido.estado), index + 1),
      });

      const popupContent = `
        <div style="font-size: 12px; min-width: 160px;">
          <p style="font-weight: bold; margin: 0 0 4px 0;">#${index + 1} - ${pedido.numero_guia || `ID ${pedido.id}`}</p>
          <p style="margin: 0 0 4px 0; color: #374151;">${pedido.cliente_nombre || "Sin nombre"}</p>
          <p style="margin: 0 0 8px 0; color: #6b7280; font-size: 11px;">${pedido.direccion_entrega || "Sin dirección"}</p>
          <p style="margin: 0; font-weight: 500;">${getStatusLabel(pedido.estado)}</p>
        </div>
      `;

      marker.bindPopup(popupContent);
      
      if (onPedidoClick) {
        marker.on('click', () => onPedidoClick(pedido));
      }

      marker.addTo(mapRef.current!);
      markersRef.current.push(marker);
    });

    // Fit bounds to show all markers
    if (validPedidos.length > 0) {
      const bounds = L.latLngBounds(
        validPedidos.map((p) => [Number(p.latitud), Number(p.longitud)] as L.LatLngTuple)
      );
      bounds.extend(BODEGA_COORDS);
      mapRef.current.fitBounds(bounds, { padding: [30, 30] });
    }
  }, [pedidos, onPedidoClick]);

  // Update user location marker
  useEffect(() => {
    if (!mapRef.current) return;

    // Remove existing user marker
    if (userMarkerRef.current) {
      userMarkerRef.current.remove();
      userMarkerRef.current = null;
    }

    // Add user location marker if available
    if (userLocation) {
      userMarkerRef.current = L.marker([userLocation.lat, userLocation.lng], {
        icon: createUserIcon(),
      })
        .bindPopup(`
          <div style="font-size: 12px;">
            <p style="font-weight: bold; margin: 0;">📍 Tu ubicación actual</p>
          </div>
        `)
        .addTo(mapRef.current);
    }
  }, [userLocation]);

  return (
    <div
      ref={mapContainerRef}
      className="h-full w-full rounded-2xl overflow-hidden"
      style={{ minHeight: "250px" }}
    />
  );
};

export default MotorizadoMap;
