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
  motorizado_asignado: string | null;
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

  // Get marker color based on assignment and status
  const getMarkerColor = (pedido: Pedido): string => {
    // Unassigned = gray
    if (!pedido.motorizado_asignado) {
      return "#9ca3af"; // gray-400
    }

    const s = pedido.estado?.toLowerCase();
    
    // Assigned - color by status
    if (s === "entregado") return "#22c55e"; // green
    if (s === "cancelado" || s?.includes("novedad")) return "#ef4444"; // red
    if (s === "en ruta" || s === "en camino") return "#3b82f6"; // blue
    
    return "#f59e0b"; // amber for pending
  };

  const createIcon = (color: string, isUnassigned: boolean) => {
    // Different shape for unassigned (square) vs assigned (circle)
    if (isUnassigned) {
      return L.divIcon({
        className: "custom-marker-icon",
        html: `<div style="
          background-color: ${color}; 
          width: 20px; 
          height: 20px; 
          border-radius: 4px; 
          border: 3px solid white; 
          box-shadow: 0 2px 8px rgba(0,0,0,0.4);
          display: flex;
          align-items: center;
          justify-content: center;
        ">
          <span style="color: white; font-size: 10px; font-weight: bold;">?</span>
        </div>`,
        iconSize: [20, 20],
        iconAnchor: [10, 10],
      });
    }

    return L.divIcon({
      className: "custom-marker-icon",
      html: `<div style="
        background-color: ${color}; 
        width: 24px; 
        height: 24px; 
        border-radius: 50%; 
        border: 3px solid white; 
        box-shadow: 0 2px 8px rgba(0,0,0,0.3);
      "></div>`,
      iconSize: [24, 24],
      iconAnchor: [12, 12],
    });
  };

  const getStatusBadgeStyle = (pedido: Pedido): string => {
    if (!pedido.motorizado_asignado) {
      return "background: #9ca3af; color: white;";
    }

    const s = pedido.estado?.toLowerCase();
    switch (s) {
      case "entregado":
        return "background: #22c55e; color: white;";
      case "en ruta":
      case "en camino":
        return "background: #3b82f6; color: white;";
      case "cancelado":
        return "background: #ef4444; color: white;";
      default:
        if (s?.includes("novedad")) {
          return "background: #ef4444; color: white;";
        }
        return "background: #f59e0b; color: white;";
    }
  };

  useEffect(() => {
    if (!mapContainerRef.current) return;

    // Initialize map only once
    if (!mapRef.current) {
      mapRef.current = L.map(mapContainerRef.current).setView(bogotaCenter, 12);

      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution:
          '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
      }).addTo(mapRef.current);
    }

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
      const isUnassigned = !pedido.motorizado_asignado;
      const color = getMarkerColor(pedido);

      const marker = L.marker([Number(pedido.latitud), Number(pedido.longitud)], {
        icon: createIcon(color, isUnassigned),
      });

      const statusLabel = isUnassigned
        ? "Sin Asignar"
        : pedido.estado || "Sin estado";

      const popupContent = `
        <div style="font-size: 12px; min-width: 180px;">
          <p style="font-weight: bold; margin: 0 0 4px 0;">${pedido.numero_guia || `#${pedido.id}`}</p>
          <p style="margin: 0 0 4px 0; color: #374151;">${pedido.cliente_nombre || "Sin nombre"}</p>
          <p style="margin: 0 0 8px 0; color: #6b7280; font-size: 11px;">${pedido.direccion_entrega || "Sin dirección"}</p>
          ${
            pedido.motorizado_asignado
              ? `<p style="margin: 0 0 8px 0; color: #3b82f6; font-size: 11px;">🏍️ ${pedido.motorizado_asignado}</p>`
              : `<p style="margin: 0 0 8px 0; color: #f59e0b; font-size: 11px; font-weight: bold;">⚠️ Pendiente de asignación</p>`
          }
          <span style="display: inline-block; padding: 2px 8px; border-radius: 12px; font-size: 10px; ${getStatusBadgeStyle(pedido)}">
            ${statusLabel}
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
