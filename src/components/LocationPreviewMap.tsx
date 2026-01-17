import { useState, useEffect, useCallback, useRef } from "react";
import { motion } from "framer-motion";
import { MapPin, Check, X, Loader2, AlertTriangle, Navigation } from "lucide-react";
import L from "leaflet";

// Default fallback location: Kompras Plus office
const DEFAULT_LOCATION: [number, number] = [4.6097, -74.0817]; // Bogotá center
const KOMPRAS_PLUS_LOCATION: [number, number] = [4.6051, -74.0906]; // Carrera 20 #14-30

interface LocationPreviewMapProps {
  direccion: string;
  barrio: string;
  localidad: string;
  onConfirm: (lat: number, lng: number) => void;
  onCancel: () => void;
}

const LocationPreviewMap = ({
  direccion,
  barrio,
  localidad,
  onConfirm,
  onCancel,
}: LocationPreviewMapProps) => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [position, setPosition] = useState<[number, number] | null>(null);
  const [markerMoved, setMarkerMoved] = useState(false);
  const [mapReady, setMapReady] = useState(false);
  const [leafletLoaded, setLeafletLoaded] = useState(false);
  
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const markerRef = useRef<L.Marker | null>(null);

  // Build complete search query combining all fields
  const buildSearchQuery = useCallback(() => {
    const parts: string[] = [];
    
    if (direccion.trim()) {
      parts.push(direccion.trim());
    }
    if (barrio.trim()) {
      parts.push(barrio.trim());
    }
    if (localidad.trim()) {
      parts.push(localidad.trim());
    }
    
    // Add Colombia context
    parts.push("Bogotá");
    parts.push("Colombia");
    
    return parts.join(", ");
  }, [direccion, barrio, localidad]);

  // Geocode the address using Nominatim
  const geocodeAddress = useCallback(async () => {
    setLoading(true);
    setError(null);

    const searchQuery = buildSearchQuery();
    
    try {
      const query = encodeURIComponent(searchQuery);
      const response = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${query}&limit=1&countrycodes=co`
      );
      const data = await response.json();

      if (data && data.length > 0) {
        setPosition([parseFloat(data[0].lat), parseFloat(data[0].lon)]);
      } else {
        // Fallback: try with just barrio and localidad
        const fallbackQuery = encodeURIComponent(`${barrio}, ${localidad}, Bogotá, Colombia`);
        const fallbackResponse = await fetch(
          `https://nominatim.openstreetmap.org/search?format=json&q=${fallbackQuery}&limit=1&countrycodes=co`
        );
        const fallbackData = await fallbackResponse.json();

        if (fallbackData && fallbackData.length > 0) {
          setPosition([parseFloat(fallbackData[0].lat), parseFloat(fallbackData[0].lon)]);
          setError("No encontramos la dirección exacta. Mueve el marcador a la ubicación correcta.");
        } else {
          // Try with just localidad
          const localidadQuery = encodeURIComponent(`${localidad}, Bogotá, Colombia`);
          const localidadResponse = await fetch(
            `https://nominatim.openstreetmap.org/search?format=json&q=${localidadQuery}&limit=1&countrycodes=co`
          );
          const localidadData = await localidadResponse.json();

          if (localidadData && localidadData.length > 0) {
            setPosition([parseFloat(localidadData[0].lat), parseFloat(localidadData[0].lon)]);
            setError("Solo encontramos la localidad. Arrastra el marcador a tu ubicación exacta.");
          } else {
            // Ultimate fallback: Kompras Plus office
            setPosition(KOMPRAS_PLUS_LOCATION);
            setError("No pudimos ubicar la dirección. El mapa muestra nuestra bodega. Arrastra el marcador a tu casa.");
          }
        }
      }
    } catch (err) {
      console.error("Geocoding error:", err);
      // Fallback to Kompras Plus office
      setPosition(KOMPRAS_PLUS_LOCATION);
      setError("Error al buscar la ubicación. Arrastra el marcador manualmente a tu casa.");
    } finally {
      setLoading(false);
    }
  }, [buildSearchQuery, barrio, localidad]);

  // Load Leaflet CSS dynamically
  useEffect(() => {
    const linkId = 'leaflet-css';
    if (!document.getElementById(linkId)) {
      const link = document.createElement('link');
      link.id = linkId;
      link.rel = 'stylesheet';
      link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
      link.integrity = 'sha256-p4NxAoJBhIIN+hmNHrzRCf9tD/miZyoHS5obTRR9BMY=';
      link.crossOrigin = '';
      document.head.appendChild(link);
    }
    
    // Mark leaflet as loaded after a short delay to ensure CSS is applied
    const timer = setTimeout(() => {
      setLeafletLoaded(true);
    }, 100);
    
    return () => clearTimeout(timer);
  }, []);

  // Geocode on mount
  useEffect(() => {
    geocodeAddress();
  }, [geocodeAddress]);

  // Initialize map when position is available and container is ready
  useEffect(() => {
    if (!position || !mapContainerRef.current || !leafletLoaded || mapInstanceRef.current) {
      return;
    }

    // Small delay to ensure DOM is ready
    const timer = setTimeout(() => {
      if (!mapContainerRef.current) return;
      
      try {
        // Create custom icon
        const customIcon = new L.Icon({
          iconUrl: "https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-red.png",
          shadowUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png",
          iconSize: [25, 41],
          iconAnchor: [12, 41],
          popupAnchor: [1, -34],
          shadowSize: [41, 41],
        });

        // Create map
        const map = L.map(mapContainerRef.current, {
          center: position,
          zoom: 17,
          scrollWheelZoom: true,
        });

        // Add tile layer
        L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
          attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
        }).addTo(map);

        // Add draggable marker
        const marker = L.marker(position, {
          draggable: true,
          icon: customIcon,
        }).addTo(map);

        // Handle marker drag
        marker.on("dragend", () => {
          const newPos = marker.getLatLng();
          setPosition([newPos.lat, newPos.lng]);
          setMarkerMoved(true);
          setError(null);
        });

        // Handle map click
        map.on("click", (e) => {
          const newPos = e.latlng;
          marker.setLatLng(newPos);
          setPosition([newPos.lat, newPos.lng]);
          setMarkerMoved(true);
          setError(null);
        });

        mapInstanceRef.current = map;
        markerRef.current = marker;
        setMapReady(true);

        // Force a resize to ensure proper rendering
        setTimeout(() => {
          map.invalidateSize();
        }, 100);
      } catch (err) {
        console.error("Error initializing map:", err);
        setError("Error al cargar el mapa. Por favor, intenta de nuevo.");
      }
    }, 150);

    return () => {
      clearTimeout(timer);
    };
  }, [position, leafletLoaded]);

  // Update marker position when position changes
  useEffect(() => {
    if (mapInstanceRef.current && markerRef.current && position) {
      markerRef.current.setLatLng(position);
      mapInstanceRef.current.setView(position, mapInstanceRef.current.getZoom());
    }
  }, [position]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
        markerRef.current = null;
      }
    };
  }, []);

  const handleConfirm = () => {
    if (position) {
      onConfirm(position[0], position[1]);
    }
  };

  const displayAddress = [direccion, barrio, localidad].filter(Boolean).join(", ");

  return (
    <motion.div
      className="fixed inset-0 z-[60] flex items-center justify-center p-4"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onCancel}
      />

      {/* Modal */}
      <motion.div
        className="relative z-10 w-full max-w-2xl bg-card rounded-2xl shadow-xl overflow-hidden"
        initial={{ scale: 0.95, y: 20 }}
        animate={{ scale: 1, y: 0 }}
        exit={{ scale: 0.95, y: 20 }}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border bg-card p-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
              <MapPin className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h3 className="font-bold text-foreground">Confirmar Ubicación</h3>
              <p className="text-xs text-muted-foreground">¿Es aquí donde quieres recibir tu paquete?</p>
            </div>
          </div>
          <button
            onClick={onCancel}
            className="flex h-8 w-8 items-center justify-center rounded-full hover:bg-muted transition-colors"
          >
            <X className="h-5 w-5 text-muted-foreground" />
          </button>
        </div>

        {/* Address Display */}
        <div className="bg-muted/50 px-4 py-3 border-b border-border">
          <div className="flex items-start gap-2">
            <Navigation className="h-4 w-4 text-primary mt-0.5 flex-shrink-0" />
            <p className="text-sm text-foreground">{displayAddress || "Sin dirección especificada"}</p>
          </div>
        </div>

        {/* Map Container */}
        <div className="relative h-[350px] w-full">
          {loading ? (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-muted/50 gap-3">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <p className="text-sm text-muted-foreground">Buscando ubicación...</p>
            </div>
          ) : (
            <div 
              ref={mapContainerRef} 
              className="h-full w-full"
              style={{ minHeight: "350px" }}
            />
          )}

          {/* Loading overlay for map initialization */}
          {!loading && !mapReady && position && (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-muted/50 gap-3 z-10">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <p className="text-sm text-muted-foreground">Cargando mapa...</p>
            </div>
          )}

          {/* Instructions Overlay */}
          {mapReady && (
            <div className="absolute bottom-3 left-3 right-3 z-[1000]">
              <div className="bg-background/90 backdrop-blur-sm rounded-lg px-3 py-2 text-xs text-center text-muted-foreground">
                <span className="font-medium text-foreground">Arrastra el marcador</span> o <span className="font-medium text-foreground">toca el mapa</span> para ajustar la posición
              </div>
            </div>
          )}
        </div>

        {/* Error/Warning Message */}
        {error && (
          <div className="flex items-start gap-2 bg-amber-500/10 border-t border-amber-500/20 px-4 py-3">
            <AlertTriangle className="h-4 w-4 text-amber-500 mt-0.5 flex-shrink-0" />
            <p className="text-sm text-amber-600 dark:text-amber-400">{error}</p>
          </div>
        )}

        {/* Marker moved confirmation */}
        {markerMoved && !error && (
          <div className="flex items-start gap-2 bg-green-500/10 border-t border-green-500/20 px-4 py-3">
            <Check className="h-4 w-4 text-green-500 mt-0.5 flex-shrink-0" />
            <p className="text-sm text-green-600 dark:text-green-400">
              ¡Ubicación actualizada! Confirma si es correcta.
            </p>
          </div>
        )}

        {/* Footer Actions */}
        <div className="flex gap-3 p-4 border-t border-border">
          <button
            onClick={onCancel}
            className="flex-1 flex items-center justify-center gap-2 rounded-xl border border-border bg-background py-3 font-medium text-foreground transition-colors hover:bg-muted"
          >
            <X className="h-4 w-4" />
            Cancelar
          </button>
          <button
            onClick={handleConfirm}
            disabled={!position || !mapReady}
            className="flex-1 flex items-center justify-center gap-2 rounded-xl bg-primary py-3 font-bold text-primary-foreground transition-all hover:opacity-90 disabled:opacity-50"
          >
            <Check className="h-4 w-4" />
            {markerMoved ? "Confirmar Nueva Ubicación" : "Sí, es aquí"}
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
};

export default LocationPreviewMap;
