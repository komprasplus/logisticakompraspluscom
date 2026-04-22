import { useEffect, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { getMapMarkerColor, getStatusConfig, isOperationalStatus } from "@/lib/orderStatuses";

// Fix for default markers in Leaflet
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
});

// Warehouse coordinates - Carrera 20 # 14-30, Bogotá (Exact)
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
  tipo_novedad?: string | null;
}

interface AdminMapProps {
  pedidos: Pedido[];
  onPedidoClick?: (pedido: Pedido) => void;
  selectedPedidoId?: number | null;
}

const AdminMap = ({ pedidos, onPedidoClick, selectedPedidoId }: AdminMapProps) => {
  const mapRef = useRef<L.Map | null>(null);
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const markersRef = useRef<L.Marker[]>([]);
  const warehouseMarkerRef = useRef<L.Marker | null>(null);

  // Bogotá center coordinates
  const bogotaCenter: L.LatLngExpression = [4.6097, -74.0817];

  // Get marker color based on assignment and status
  const getMarkerColor = (pedido: Pedido): string => {
    return getMapMarkerColor(pedido.estado, !!pedido.motorizado_asignado);
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

    const config = getStatusConfig(pedido.estado);
    return `background: ${config.color}; color: white;`;
  };

  const createWarehouseIcon = () => {
    return L.divIcon({
      className: "warehouse-icon",
      html: `
        <div style="position: relative;">
          <div style="position: absolute; inset: 0; background: linear-gradient(180deg, rgba(30,41,59,0.5) 0%, transparent 100%); border-radius: 14px; transform: translateY(5px); filter: blur(8px);"></div>
          <div style="
            position: relative;
            background: linear-gradient(145deg, #334155 0%, #1e293b 100%);
            width: 48px;
            height: 48px;
            border-radius: 14px;
            border: 3px solid white;
            box-shadow: 0 10px 30px rgba(0,0,0,0.5), inset 0 2px 6px rgba(255,255,255,0.15);
            display: flex;
            align-items: center;
            justify-content: center;
          ">
            <span style="font-size: 24px; filter: drop-shadow(0 2px 3px rgba(0,0,0,0.4));">🏬</span>
          </div>
        </div>
      `,
      iconSize: [48, 48],
      iconAnchor: [24, 24],
    });
  };

  useEffect(() => {
    if (!mapContainerRef.current) return;

    // Initialize map only once - centered on warehouse
    if (!mapRef.current) {
      mapRef.current = L.map(mapContainerRef.current).setView(BODEGA_COORDS, 14);

      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution:
          '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
      }).addTo(mapRef.current);

      // Add warehouse marker
      warehouseMarkerRef.current = L.marker(BODEGA_COORDS, {
        icon: createWarehouseIcon(),
        zIndexOffset: 1000, // Always on top
      })
        .bindPopup(`
          <div style="font-size: 13px; min-width: 180px; padding: 6px;">
            <p style="font-weight: bold; margin: 0 0 8px 0; font-size: 15px;">🏬 Bodega Kompras Plus</p>
            <p style="margin: 0 0 4px 0; color: #6b7280; font-size: 12px;">📍 Calle 14 # 19-64 Bodega 403</p>
            <p style="margin: 0; color: #3b82f6; font-size: 12px;">📞 324 222 3825</p>
          </div>
        `)
        .addTo(mapRef.current);
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

    // Add new markers - filter out cancelled orders from map display
    const validPedidos = pedidos.filter(
      (p) =>
        p.latitud != null &&
        p.longitud != null &&
        !isNaN(Number(p.latitud)) &&
        !isNaN(Number(p.longitud)) &&
        isOperationalStatus(p.estado) // Exclude cancelled orders from map
    );

    validPedidos.forEach((pedido) => {
      const isUnassigned = !pedido.motorizado_asignado;
      const color = getMarkerColor(pedido);
      const isSelected = selectedPedidoId === pedido.id;
      const statusConfig = getStatusConfig(pedido.estado);

      const marker = L.marker([Number(pedido.latitud), Number(pedido.longitud)], {
        icon: createIcon(color, isUnassigned),
        zIndexOffset: isSelected ? 1000 : 0,
      });

      const statusLabel = isUnassigned
        ? "Sin Asignar"
        : statusConfig.label;

      const novedadInfo = pedido.tipo_novedad 
        ? `<p style="margin: 4px 0 0 0; color: #f97316; font-size: 11px;">📋 ${pedido.tipo_novedad}</p>` 
        : "";

      const popupContent = `
        <div style="font-size: 12px; min-width: 200px;">
          <p style="font-weight: bold; margin: 0 0 4px 0;">${statusConfig.icon} ${pedido.numero_guia || `#${pedido.id}`}</p>
          <p style="margin: 0 0 4px 0; color: #374151;">${pedido.cliente_nombre || "Sin nombre"}</p>
          <p style="margin: 0 0 8px 0; color: #6b7280; font-size: 11px;">${pedido.direccion_entrega || "Sin dirección"}</p>
          ${
            pedido.motorizado_asignado
              ? `<p style="margin: 0 0 8px 0; color: #3b82f6; font-size: 11px;">🏍️ ${pedido.motorizado_asignado}</p>`
              : `<p style="margin: 0 0 8px 0; color: #f59e0b; font-size: 11px; font-weight: bold;">⚠️ Pendiente de asignación</p>`
          }
          <span style="display: inline-block; padding: 4px 10px; border-radius: 12px; font-size: 11px; font-weight: 500; ${getStatusBadgeStyle(pedido)}">
            ${statusLabel}
          </span>
          ${novedadInfo}
        </div>
      `;

      marker.bindPopup(popupContent);
      
      if (onPedidoClick) {
        marker.on('click', () => onPedidoClick(pedido));
      }

      marker.addTo(mapRef.current!);
      markersRef.current.push(marker);
    });

    // Fit bounds to show all markers including warehouse
    if (validPedidos.length > 0) {
      const bounds = L.latLngBounds(
        validPedidos.map((p) => [Number(p.latitud), Number(p.longitud)] as L.LatLngTuple)
      );
      bounds.extend(BODEGA_COORDS);
      mapRef.current.fitBounds(bounds, { padding: [40, 40] });
    }
  }, [pedidos, selectedPedidoId, onPedidoClick]);

  return (
    <div
      ref={mapContainerRef}
      className="h-full w-full rounded-xl"
      style={{ minHeight: "100%" }}
    />
  );
};

export default AdminMap;
