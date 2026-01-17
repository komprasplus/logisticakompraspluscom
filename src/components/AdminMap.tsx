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

interface AdminMapProps {
  pedidos: Pedido[];
}

const AdminMap = ({ pedidos }: AdminMapProps) => {
  const mapRef = useRef<L.Map | null>(null);
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const markersRef = useRef<L.Marker[]>([]);

  // Bogotá center coordinates
  const bogotaCenter: L.LatLngExpression = [4.6097, -74.0817];

  const getMarkerColor = (status: string | null): string => {
    const s = status?.toLowerCase();
    if (s === "entregado") return "#22c55e";
    if (s === "cancelado" || s === "novedad") return "#ef4444";
    return "#3b82f6";
  };

  const createIcon = (color: string) => {
    return L.divIcon({
      className: "custom-marker-icon",
      html: `<div style="background-color: ${color}; width: 24px; height: 24px; border-radius: 50%; border: 3px solid white; box-shadow: 0 2px 8px rgba(0,0,0,0.3);"></div>`,
      iconSize: [24, 24],
      iconAnchor: [12, 12],
    });
  };

  const getStatusBadgeClass = (status: string | null): string => {
    const s = status?.toLowerCase();
    switch (s) {
      case "entregado":
        return "background: #22c55e; color: white;";
      case "en ruta":
      case "en camino":
        return "background: #3b82f6; color: white;";
      case "cancelado":
      case "novedad":
        return "background: #ef4444; color: white;";
      default:
        return "background: #6b7280; color: white;";
    }
  };

  useEffect(() => {
    if (!mapContainerRef.current) return;

    // Initialize map only once
    if (!mapRef.current) {
      mapRef.current = L.map(mapContainerRef.current).setView(bogotaCenter, 12);

      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
      }).addTo(mapRef.current);
    }

    // Clear existing markers
    markersRef.current.forEach((marker) => marker.remove());
    markersRef.current = [];

    // Add markers for pedidos with valid coordinates
    const validPedidos = pedidos.filter(
      (p) =>
        p.latitud != null &&
        p.longitud != null &&
        !isNaN(Number(p.latitud)) &&
        !isNaN(Number(p.longitud))
    );

    validPedidos.forEach((pedido) => {
      const marker = L.marker([Number(pedido.latitud), Number(pedido.longitud)], {
        icon: createIcon(getMarkerColor(pedido.estado)),
      });

      const popupContent = `
        <div style="font-size: 12px; min-width: 150px;">
          <p style="font-weight: bold; margin: 0 0 4px 0;">${pedido.numero_guia || `#${pedido.id}`}</p>
          <p style="margin: 0 0 4px 0; color: #374151;">${pedido.cliente_nombre || "Sin nombre"}</p>
          <p style="margin: 0 0 8px 0; color: #6b7280; font-size: 11px;">${pedido.direccion_entrega || "Sin dirección"}</p>
          <span style="display: inline-block; padding: 2px 8px; border-radius: 12px; font-size: 10px; ${getStatusBadgeClass(pedido.estado)}">
            ${pedido.estado || "Sin estado"}
          </span>
        </div>
      `;

      marker.bindPopup(popupContent);
      marker.addTo(mapRef.current!);
      markersRef.current.push(marker);
    });

    // Cleanup on unmount
    return () => {
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
  }, []);

  // Update markers when pedidos change (without recreating the map)
  useEffect(() => {
    if (!mapRef.current) return;

    // Clear existing markers
    markersRef.current.forEach((marker) => marker.remove());
    markersRef.current = [];

    // Add new markers
    const validPedidos = pedidos.filter(
      (p) =>
        p.latitud != null &&
        p.longitud != null &&
        !isNaN(Number(p.latitud)) &&
        !isNaN(Number(p.longitud))
    );

    validPedidos.forEach((pedido) => {
      const marker = L.marker([Number(pedido.latitud), Number(pedido.longitud)], {
        icon: createIcon(getMarkerColor(pedido.estado)),
      });

      const popupContent = `
        <div style="font-size: 12px; min-width: 150px;">
          <p style="font-weight: bold; margin: 0 0 4px 0;">${pedido.numero_guia || `#${pedido.id}`}</p>
          <p style="margin: 0 0 4px 0; color: #374151;">${pedido.cliente_nombre || "Sin nombre"}</p>
          <p style="margin: 0 0 8px 0; color: #6b7280; font-size: 11px;">${pedido.direccion_entrega || "Sin dirección"}</p>
          <span style="display: inline-block; padding: 2px 8px; border-radius: 12px; font-size: 10px; ${getStatusBadgeClass(pedido.estado)}">
            ${pedido.estado || "Sin estado"}
          </span>
        </div>
      `;

      marker.bindPopup(popupContent);
      marker.addTo(mapRef.current!);
      markersRef.current.push(marker);
    });
  }, [pedidos]);

  return (
    <div
      ref={mapContainerRef}
      className="h-full w-full"
      style={{ minHeight: "500px" }}
    />
  );
};

export default AdminMap;
