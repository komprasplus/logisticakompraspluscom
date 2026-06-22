import { useState, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import { MapPin, Check, X, Loader2, AlertTriangle, Navigation } from "lucide-react";
import {
  GoogleMap,
  useJsApiLoader,
  MarkerF,
} from "@react-google-maps/api";

import { GOOGLE_MAPS_API_KEY, GOOGLE_MAPS_LIBRARIES } from "@/lib/googleMapsConfig";

// Default fallback location: Kompras Plus office
const DEFAULT_LOCATION = { lat: 4.6097, lng: -74.0817 }; // Bogotá center
const KOMPRAS_PLUS_LOCATION = { lat: 4.60922, lng: -74.08463 }; // Carrera 20 #14-30

const mapContainerStyle = {
  width: "100%",
  height: "350px",
};

const mapStyles = [
  { featureType: "poi", elementType: "labels", stylers: [{ visibility: "off" }] },
  { featureType: "transit", elementType: "labels", stylers: [{ visibility: "simplified" }] },
];

interface LocationPreviewMapGoogleProps {
  direccion: string;
  barrio: string;
  localidad: string;
  onConfirm: (lat: number, lng: number) => void;
  onCancel: () => void;
  initialLat?: number;
  initialLng?: number;
}

const LocationPreviewMapGoogle = ({
  direccion,
  barrio,
  localidad,
  onConfirm,
  onCancel,
  initialLat,
  initialLng,
}: LocationPreviewMapGoogleProps) => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [position, setPosition] = useState<{ lat: number; lng: number } | null>(null);
  const [markerMoved, setMarkerMoved] = useState(false);
  const [map, setMap] = useState<google.maps.Map | null>(null);

  const { isLoaded, loadError } = useJsApiLoader({
    googleMapsApiKey: GOOGLE_MAPS_API_KEY,
    libraries: GOOGLE_MAPS_LIBRARIES,
  });

  // Build complete search query
  const buildSearchQuery = useCallback(() => {
    const parts: string[] = [];
    if (direccion.trim()) parts.push(direccion.trim());
    if (barrio.trim()) parts.push(barrio.trim());
    if (localidad.trim()) parts.push(localidad.trim());
    
    if (!localidad.toLowerCase().includes("bogotá")) {
      parts.push("Colombia");
    } else {
      parts.push("Bogotá, Colombia");
    }
    
    return parts.join(", ");
  }, [direccion, barrio, localidad]);

  // Geocode using Google's Geocoding API
  const geocodeAddress = useCallback(async () => {
    // If we have initial coordinates, use them directly
    if (initialLat && initialLng) {
      setPosition({ lat: initialLat, lng: initialLng });
      setLoading(false);
      return;
    }

    if (!isLoaded || !window.google?.maps) {
      return;
    }

    setLoading(true);
    setError(null);

    const geocoder = new google.maps.Geocoder();
    const searchQuery = buildSearchQuery();

    try {
      geocoder.geocode(
        { 
          address: searchQuery,
          componentRestrictions: { country: "co" }
        },
        (results, status) => {
          if (status === google.maps.GeocoderStatus.OK && results && results[0]) {
            const location = results[0].geometry.location;
            setPosition({ lat: location.lat(), lng: location.lng() });
          } else {
            // Fallback: try with just barrio and localidad
            geocoder.geocode(
              { 
                address: `${barrio}, ${localidad}, Colombia`,
                componentRestrictions: { country: "co" }
              },
              (fallbackResults, fallbackStatus) => {
                if (fallbackStatus === google.maps.GeocoderStatus.OK && fallbackResults && fallbackResults[0]) {
                  const location = fallbackResults[0].geometry.location;
                  setPosition({ lat: location.lat(), lng: location.lng() });
                  setError("No encontramos la dirección exacta. Arrastra el marcador.");
                } else {
                  // Ultimate fallback: Kompras Plus office
                  setPosition(KOMPRAS_PLUS_LOCATION);
                  setError("No pudimos ubicar la dirección. Arrastra el marcador a tu casa.");
                }
              }
            );
          }
          setLoading(false);
        }
      );
    } catch (err) {
      console.error("Geocoding error:", err);
      setPosition(KOMPRAS_PLUS_LOCATION);
      setError("Error al buscar la ubicación. Arrastra el marcador manualmente.");
      setLoading(false);
    }
  }, [buildSearchQuery, barrio, localidad, initialLat, initialLng, isLoaded]);

  // Geocode on mount when Google Maps is loaded
  useEffect(() => {
    if (isLoaded) {
      geocodeAddress();
    }
  }, [isLoaded, geocodeAddress]);

  const onMapLoad = useCallback((mapInstance: google.maps.Map) => {
    setMap(mapInstance);
  }, []);

  const handleMarkerDrag = useCallback((e: google.maps.MapMouseEvent) => {
    if (e.latLng) {
      setPosition({ lat: e.latLng.lat(), lng: e.latLng.lng() });
      setMarkerMoved(true);
      setError(null);
    }
  }, []);

  const handleMapClick = useCallback((e: google.maps.MapMouseEvent) => {
    if (e.latLng) {
      setPosition({ lat: e.latLng.lat(), lng: e.latLng.lng() });
      setMarkerMoved(true);
      setError(null);
    }
  }, []);

  const handleConfirm = () => {
    if (position) {
      onConfirm(position.lat, position.lng);
    }
  };

  const displayAddress = [direccion, barrio, localidad].filter(Boolean).join(", ");

  // Custom marker icon
  const markerIcon = {
    url: `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(`
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 40 50" width="40" height="50">
        <path d="M20 0 C9 0 0 9 0 20 C0 35 20 50 20 50 C20 50 40 35 40 20 C40 9 31 0 20 0 Z" fill="#ef4444" stroke="white" stroke-width="2"/>
        <circle cx="20" cy="18" r="8" fill="white"/>
      </svg>
    `)}`,
    scaledSize: isLoaded ? new google.maps.Size(40, 50) : undefined,
    anchor: isLoaded ? new google.maps.Point(20, 50) : undefined,
  };

  if (loadError) {
    return (
      <motion.div
        className="fixed inset-0 z-[60] flex items-center justify-center p-4"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
      >
        <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onCancel} />
        <div className="relative z-10 bg-card rounded-2xl p-6 text-center">
          <AlertTriangle className="h-12 w-12 text-destructive mx-auto mb-4" />
          <p className="text-foreground font-medium">Error al cargar Google Maps</p>
          <button
            onClick={onCancel}
            className="mt-4 px-6 py-2 bg-muted rounded-lg text-foreground"
          >
            Cerrar
          </button>
        </div>
      </motion.div>
    );
  }

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
          {(loading || !isLoaded) ? (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-muted/50 gap-3">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <p className="text-sm text-muted-foreground">
                {!isLoaded ? "Cargando Google Maps..." : "Buscando ubicación..."}
              </p>
            </div>
          ) : position ? (
            <GoogleMap
              mapContainerStyle={mapContainerStyle}
              center={position}
              zoom={17}
              onLoad={onMapLoad}
              onClick={handleMapClick}
              options={{
                styles: mapStyles,
                disableDefaultUI: false,
                zoomControl: true,
                streetViewControl: false,
                mapTypeControl: false,
                fullscreenControl: false,
              }}
            >
              <MarkerF
                position={position}
                draggable
                onDragEnd={handleMarkerDrag}
                icon={markerIcon}
                zIndex={1000}
              />
            </GoogleMap>
          ) : null}

          {/* Instructions Overlay */}
          {isLoaded && position && (
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
            disabled={!position || !isLoaded}
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

export default LocationPreviewMapGoogle;
