import { useState, useEffect, useRef, useCallback } from "react";
import { MapPin, Loader2, Search, Navigation } from "lucide-react";
import { cn } from "@/lib/utils";

// Google Maps API Key (publishable)
const GOOGLE_MAPS_API_KEY = "AIzaSyDvV2fL5jv0OIp45Si4m4-gaWSt9gIXznA";

// Municipalities/localities we cover
const COVERED_AREAS = [
  "Bogotá",
  "Bogota",
  "Soacha", 
  "Funza",
  "Madrid",
  "Mosquera",
  "Chía",
  "Chia",
  "Cota",
  "Sibaté",
  "Sibate",
];

interface PlaceResult {
  placeId: string;
  displayName: string;
  fullAddress: string;
  barrio: string;
  localidad: string;
  ciudad: string;
  lat: number;
  lng: number;
}

interface GooglePlacesAutocompleteProps {
  onSelect: (result: {
    direccion: string;
    barrio: string;
    localidad: string;
    ciudad: string;
    lat: number;
    lng: number;
  }) => void;
  placeholder?: string;
  value?: string;
  className?: string;
  municipio?: string;
}

// Track if the script has been loaded
let googleMapsLoaded = false;
let googleMapsLoading = false;
const loadCallbacks: (() => void)[] = [];

const loadGoogleMapsScript = (callback: () => void) => {
  if (googleMapsLoaded && window.google?.maps?.places) {
    callback();
    return;
  }

  loadCallbacks.push(callback);

  if (googleMapsLoading) {
    return;
  }

  googleMapsLoading = true;

  const script = document.createElement("script");
  script.src = `https://maps.googleapis.com/maps/api/js?key=${GOOGLE_MAPS_API_KEY}&libraries=places&language=es&region=CO`;
  script.async = true;
  script.defer = true;
  
  script.onload = () => {
    googleMapsLoaded = true;
    googleMapsLoading = false;
    loadCallbacks.forEach((cb) => cb());
    loadCallbacks.length = 0;
  };

  script.onerror = () => {
    console.error("Failed to load Google Maps script");
    googleMapsLoading = false;
  };

  document.head.appendChild(script);
};

const GooglePlacesAutocomplete = ({
  onSelect,
  placeholder = "Buscar dirección, barrio o localidad...",
  value = "",
  className,
  municipio,
}: GooglePlacesAutocompleteProps) => {
  const [query, setQuery] = useState(value);
  const [results, setResults] = useState<PlaceResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const [isScriptLoaded, setIsScriptLoaded] = useState(false);
  
  const searchTimeout = useRef<NodeJS.Timeout | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const autocompleteServiceRef = useRef<google.maps.places.AutocompleteService | null>(null);
  const placesServiceRef = useRef<google.maps.places.PlacesService | null>(null);
  const sessionTokenRef = useRef<google.maps.places.AutocompleteSessionToken | null>(null);

  // Load Google Maps script
  useEffect(() => {
    loadGoogleMapsScript(() => {
      setIsScriptLoaded(true);
    });
  }, []);

  // Initialize services once script is loaded
  useEffect(() => {
    if (!isScriptLoaded || !window.google?.maps?.places) return;

    autocompleteServiceRef.current = new google.maps.places.AutocompleteService();
    
    // Create a hidden div for PlacesService
    const dummyDiv = document.createElement("div");
    placesServiceRef.current = new google.maps.places.PlacesService(dummyDiv);
    
    // Create session token for billing optimization
    sessionTokenRef.current = new google.maps.places.AutocompleteSessionToken();
  }, [isScriptLoaded]);

  // Parse place details to extract address components
  const parsePlaceDetails = useCallback((place: google.maps.places.PlaceResult): PlaceResult | null => {
    if (!place.geometry?.location || !place.address_components) return null;

    const components = place.address_components;
    
    let barrio = "";
    let localidad = "";
    let ciudad = "";
    let route = "";
    let streetNumber = "";

    for (const component of components) {
      const types = component.types;
      
      if (types.includes("sublocality_level_1") || types.includes("neighborhood")) {
        barrio = component.long_name;
      }
      if (types.includes("sublocality") || types.includes("locality")) {
        if (!barrio) barrio = component.long_name;
      }
      if (types.includes("administrative_area_level_2")) {
        localidad = component.long_name;
      }
      if (types.includes("locality") || types.includes("administrative_area_level_1")) {
        ciudad = component.long_name;
      }
      if (types.includes("route")) {
        route = component.long_name;
      }
      if (types.includes("street_number")) {
        streetNumber = component.long_name;
      }
    }

    // Build display name
    const parts: string[] = [];
    if (route) {
      parts.push(streetNumber ? `${route} #${streetNumber}` : route);
    }
    if (barrio && !parts.includes(barrio)) parts.push(barrio);
    if (localidad && localidad !== barrio) parts.push(localidad);
    if (ciudad && !parts.some(p => p.toLowerCase().includes(ciudad.toLowerCase()))) {
      parts.push(ciudad);
    }

    const displayName = parts.slice(0, 3).join(", ");

    return {
      placeId: place.place_id || "",
      displayName: displayName || place.formatted_address || "",
      fullAddress: place.formatted_address || "",
      barrio,
      localidad: localidad || ciudad,
      ciudad: ciudad || "Bogotá",
      lat: place.geometry.location.lat(),
      lng: place.geometry.location.lng(),
    };
  }, []);

  // Check if a result is in covered areas
  const isInCoveredArea = useCallback((description: string): boolean => {
    const descLower = description.toLowerCase();
    return COVERED_AREAS.some(area => descLower.includes(area.toLowerCase()));
  }, []);

  // Search using Google Places
  const searchPlaces = useCallback(async (searchQuery: string) => {
    if (searchQuery.length < 3 || !autocompleteServiceRef.current || !placesServiceRef.current) {
      setResults([]);
      return;
    }

    setLoading(true);

    try {
      // Build enhanced query with municipality context
      let enhancedQuery = searchQuery;
      if (municipio) {
        enhancedQuery = `${searchQuery}, ${municipio}, Colombia`;
      } else {
        enhancedQuery = `${searchQuery}, Colombia`;
      }

      const request: google.maps.places.AutocompletionRequest = {
        input: enhancedQuery,
        componentRestrictions: { country: "co" },
        types: ["geocode", "establishment"],
        sessionToken: sessionTokenRef.current || undefined,
      };

      autocompleteServiceRef.current.getPlacePredictions(
        request,
        (predictions, status) => {
          if (status !== google.maps.places.PlacesServiceStatus.OK || !predictions) {
            setResults([]);
            setLoading(false);
            return;
          }

          // Filter to covered areas
          const filteredPredictions = predictions.filter(p => 
            isInCoveredArea(p.description)
          );

          if (filteredPredictions.length === 0) {
            setResults([]);
            setLoading(false);
            return;
          }

          // Get details for each prediction
          const detailPromises = filteredPredictions.slice(0, 5).map(
            (prediction) =>
              new Promise<PlaceResult | null>((resolve) => {
                if (!placesServiceRef.current) {
                  resolve(null);
                  return;
                }

                placesServiceRef.current.getDetails(
                  {
                    placeId: prediction.place_id,
                    fields: ["geometry", "formatted_address", "address_components", "place_id"],
                    sessionToken: sessionTokenRef.current || undefined,
                  },
                  (place, detailStatus) => {
                    if (detailStatus === google.maps.places.PlacesServiceStatus.OK && place) {
                      resolve(parsePlaceDetails(place));
                    } else {
                      resolve(null);
                    }
                  }
                );
              })
          );

          Promise.all(detailPromises).then((detailedResults) => {
            const validResults = detailedResults.filter(
              (r): r is PlaceResult => r !== null
            );
            setResults(validResults);
            setSelectedIndex(-1);
            setLoading(false);

            // Generate new session token after completing a session
            sessionTokenRef.current = new google.maps.places.AutocompleteSessionToken();
          });
        }
      );
    } catch (error) {
      console.error("Google Places search error:", error);
      setResults([]);
      setLoading(false);
    }
  }, [municipio, parsePlaceDetails, isInCoveredArea]);

  // Debounced search
  useEffect(() => {
    if (searchTimeout.current) {
      clearTimeout(searchTimeout.current);
    }

    if (query.length >= 3 && isScriptLoaded) {
      searchTimeout.current = setTimeout(() => {
        searchPlaces(query);
      }, 400);
    } else {
      setResults([]);
    }

    return () => {
      if (searchTimeout.current) {
        clearTimeout(searchTimeout.current);
      }
    };
  }, [query, searchPlaces, isScriptLoaded]);

  // Handle result selection
  const handleSelect = (result: PlaceResult) => {
    setQuery(result.displayName);
    setShowDropdown(false);
    setResults([]);
    
    onSelect({
      direccion: result.fullAddress,
      barrio: result.barrio,
      localidad: result.localidad,
      ciudad: result.ciudad,
      lat: result.lat,
      lng: result.lng,
    });
  };

  // Handle keyboard navigation
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!showDropdown || results.length === 0) return;

    switch (e.key) {
      case "ArrowDown":
        e.preventDefault();
        setSelectedIndex((prev) => 
          prev < results.length - 1 ? prev + 1 : prev
        );
        break;
      case "ArrowUp":
        e.preventDefault();
        setSelectedIndex((prev) => (prev > 0 ? prev - 1 : -1));
        break;
      case "Enter":
        e.preventDefault();
        if (selectedIndex >= 0) {
          handleSelect(results[selectedIndex]);
        }
        break;
      case "Escape":
        setShowDropdown(false);
        break;
    }
  };

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        setShowDropdown(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <div ref={containerRef} className={cn("relative", className)}>
      {/* Input Field */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground z-10" />
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setShowDropdown(true);
          }}
          onFocus={() => setShowDropdown(true)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          className="w-full rounded-lg border border-border bg-background py-2.5 pl-10 pr-10 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
        />
        {loading && (
          <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-muted-foreground" />
        )}
      </div>

      {/* Hint Text */}
      <div className="mt-1 flex items-center gap-1">
        <span className="text-xs text-muted-foreground">
          {municipio 
            ? `🔍 Busca en ${municipio} (Google Maps)`
            : "🔍 Busca en Bogotá y municipios cercanos (Google Maps)"}
        </span>
        <img 
          src="https://developers.google.com/static/maps/documentation/images/google_on_white.png" 
          alt="Powered by Google" 
          className="h-3 opacity-60"
        />
      </div>

      {/* Results Dropdown */}
      {showDropdown && (query.length >= 3 || results.length > 0) && (
        <div className="absolute z-[10000] mt-1 w-full max-h-64 overflow-y-auto rounded-lg border border-border bg-card shadow-xl">
          {loading && results.length === 0 ? (
            <div className="flex items-center justify-center gap-2 px-4 py-3">
              <Loader2 className="h-4 w-4 animate-spin text-primary" />
              <span className="text-sm text-muted-foreground">Buscando en {municipio || "Colombia"}...</span>
            </div>
          ) : !isScriptLoaded ? (
            <div className="flex items-center justify-center gap-2 px-4 py-3">
              <Loader2 className="h-4 w-4 animate-spin text-primary" />
              <span className="text-sm text-muted-foreground">Cargando Google Maps...</span>
            </div>
          ) : results.length > 0 ? (
            results.map((result, index) => (
              <button
                key={result.placeId}
                type="button"
                onClick={() => handleSelect(result)}
                className={cn(
                  "w-full flex items-start gap-3 px-4 py-3 text-left transition-colors",
                  index === selectedIndex
                    ? "bg-primary/10"
                    : "hover:bg-muted"
                )}
              >
                <MapPin className="h-4 w-4 text-primary mt-0.5 flex-shrink-0" />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-foreground truncate">
                    {result.displayName}
                  </p>
                  <div className="flex items-center gap-2 mt-0.5">
                    {result.barrio && (
                      <span className="text-xs text-muted-foreground">
                        {result.barrio}
                      </span>
                    )}
                    {result.localidad && result.localidad !== result.barrio && (
                      <>
                        <span className="text-xs text-muted-foreground">•</span>
                        <span className="text-xs text-primary font-medium">
                          {result.localidad}
                        </span>
                      </>
                    )}
                    {result.ciudad && (
                      <>
                        <span className="text-xs text-muted-foreground">•</span>
                        <span className="text-xs text-muted-foreground">
                          {result.ciudad}
                        </span>
                      </>
                    )}
                  </div>
                </div>
                <Navigation className="h-3 w-3 text-muted-foreground mt-1 flex-shrink-0" />
              </button>
            ))
          ) : query.length >= 3 && !loading ? (
            <div className="px-4 py-3 text-center">
              <p className="text-sm text-muted-foreground">
                No se encontraron resultados {municipio ? `en ${municipio}` : ""}
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                Intenta con otro término o escribe la dirección completa
              </p>
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
};

export default GooglePlacesAutocomplete;
