import { useState } from "react";
import { Clock, MapPin } from "lucide-react";

const GOOGLE_MAPS_API_KEY = "AIzaSyDvV2fL5jv0OIp45Si4m4-gaWSt9gIXznA";

interface PedidoMiniMapProps {
  userLat?: number | null;
  userLng?: number | null;
  destLat?: number | null;
  destLng?: number | null;
  distanceText?: string | null;
  isWithinRange?: boolean;
  height?: number;
  width?: number;
}

/**
 * Mini-mapa con Google Maps Static API.
 * Muestra ruta entre tú y el destino, con marcadores personalizados.
 *
 * Fallback: si no hay coordenadas o falla la imagen, muestra un placeholder elegante.
 */
const PedidoMiniMap = ({
  userLat,
  userLng,
  destLat,
  destLng,
  distanceText,
  isWithinRange,
  height = 110,
  width = 380,
}: PedidoMiniMapProps) => {
  const [imageError, setImageError] = useState(false);

  // Sin destino → mostrar fallback decorativo
  if (destLat == null || destLng == null) {
    return (
      <div
        className="relative bg-gradient-to-br from-blue-100 to-blue-200 flex items-center justify-center"
        style={{ height }}
      >
        <div className="text-center">
          <MapPin className="h-6 w-6 text-primary mx-auto opacity-40" />
          <span className="text-[10px] text-muted-foreground">Ubicación no disponible</span>
        </div>
      </div>
    );
  }

  // Calcular centro del mapa
  const hasUser = userLat != null && userLng != null;
  const centerLat = hasUser ? (userLat + destLat) / 2 : destLat;
  const centerLng = hasUser ? (userLng + destLng) / 2 : destLng;

  // Construir URL de Google Maps Static API
  const params = new URLSearchParams({
    center: `${centerLat},${centerLng}`,
    zoom: hasUser ? "13" : "15",
    size: `${width}x${height}`,
    scale: "2",
    maptype: "roadmap",
    language: "es",
    region: "CO",
    style:
      "feature:poi|visibility:off|feature:transit|visibility:off|feature:road|element:labels.icon|visibility:off",
    key: GOOGLE_MAPS_API_KEY,
  });

  // Marker del destino (rojo con etiqueta D)
  params.append(
    "markers",
    `color:0xE8175D|label:D|${destLat},${destLng}`,
  );

  // Marker del motorizado + path entre ambos
  if (hasUser) {
    params.append(
      "markers",
      `color:0x1B2959|label:Y|${userLat},${userLng}`,
    );
    params.append(
      "path",
      `color:0x1B2959|weight:3|${userLat},${userLng}|${destLat},${destLng}`,
    );
  }

  const mapUrl = `https://maps.googleapis.com/maps/api/staticmap?${params.toString()}`;

  // Si la imagen falla, fallback elegante
  if (imageError) {
    return (
      <div
        className="relative bg-gradient-to-br from-blue-50 to-blue-100 flex items-center justify-center"
        style={{ height }}
      >
        <MapPin className="h-6 w-6 text-pink" />
        <div className="absolute bottom-1.5 right-1.5 bg-white/95 px-2 py-1 rounded-md flex items-center gap-1 shadow-sm">
          <Clock className="h-3 w-3 text-primary" />
          <span className="text-[10px] font-semibold text-primary">{distanceText || "—"}</span>
        </div>
      </div>
    );
  }

  return (
    <div className="relative overflow-hidden" style={{ height }}>
      <img
        src={mapUrl}
        alt="Mapa del pedido"
        loading="lazy"
        onError={() => setImageError(true)}
        className="w-full h-full object-cover"
      />

      {/* ETA badge */}
      {distanceText && (
        <div className="absolute bottom-1.5 right-1.5 bg-white/95 px-2 py-1 rounded-md flex items-center gap-1 shadow-sm">
          <Clock className="h-3 w-3 text-primary" />
          <span className="text-[10px] font-semibold text-primary">{distanceText}</span>
        </div>
      )}

      {/* In-range badge */}
      {isWithinRange && (
        <div className="absolute top-1.5 right-1.5 bg-success text-success-foreground px-2 py-0.5 rounded-md text-[10px] font-bold">
          En rango
        </div>
      )}
    </div>
  );
};

export default PedidoMiniMap;
