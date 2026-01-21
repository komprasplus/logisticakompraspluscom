import { useState, useEffect, useCallback, useRef } from "react";
import { MapPin, Loader2, Search, Navigation } from "lucide-react";
import { cn } from "@/lib/utils";

// Municipalities/localities we cover
const COVERED_AREAS = [
  "Bogotá",
  "Soacha", 
  "Funza",
  "Madrid",
  "Mosquera",
  "Chía",
  "Cota",
  "Sibaté",
];

// Bounding box for Bogotá and surrounding areas
const BOGOTA_VIEWBOX = "-74.35,4.35,-73.85,5.05"; // left,bottom,right,top (expanded for surrounding municipalities)

interface NominatimResult {
  place_id: number;
  lat: string;
  lon: string;
  display_name: string;
  address: {
    road?: string;
    house_number?: string;
    neighbourhood?: string;
    suburb?: string;
    city_district?: string;
    city?: string;
    town?: string;
    municipality?: string;
    county?: string;
    state?: string;
    postcode?: string;
    country?: string;
  };
}

interface AddressResult {
  id: number;
  displayName: string;
  fullAddress: string;
  barrio: string;
  localidad: string;
  ciudad: string;
  lat: number;
  lng: number;
}

interface AddressAutocompleteProps {
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
  municipio?: string; // NEW: Filter results by municipality
}

const AddressAutocomplete = ({
  onSelect,
  placeholder = "Buscar dirección, barrio o localidad...",
  value = "",
  className,
  municipio,
}: AddressAutocompleteProps) => {
  const [query, setQuery] = useState(value);
  const [results, setResults] = useState<AddressResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const searchTimeout = useRef<NodeJS.Timeout | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Parse Nominatim result to extract barrio and localidad
  const parseNominatimResult = (result: NominatimResult): AddressResult => {
    const addr = result.address;
    
    // Extract barrio (neighbourhood, suburb, or city_district)
    const barrio = addr.neighbourhood || addr.suburb || addr.city_district || "";
    
    // Extract localidad (city_district for Bogotá, or municipality for other areas)
    let localidad = addr.city_district || addr.suburb || "";
    
    // Extract ciudad
    const ciudad = addr.city || addr.town || addr.municipality || "Bogotá";
    
    // For Bogotá, use city_district as localidad
    if (ciudad.toLowerCase().includes("bogotá") || ciudad.toLowerCase().includes("bogota")) {
      localidad = addr.city_district || addr.suburb || "Bogotá";
    }
    
    // Build display name
    const parts: string[] = [];
    if (addr.road) {
      let street = addr.road;
      if (addr.house_number) street += ` #${addr.house_number}`;
      parts.push(street);
    }
    if (barrio) parts.push(barrio);
    if (localidad && localidad !== barrio) parts.push(localidad);
    if (ciudad) parts.push(ciudad);
    
    const displayName = parts.slice(0, 3).join(", ");
    const fullAddress = parts.join(", ");

    return {
      id: result.place_id,
      displayName,
      fullAddress,
      barrio,
      localidad,
      ciudad,
      lat: parseFloat(result.lat),
      lng: parseFloat(result.lon),
    };
  };

  // Check if a result matches the selected municipality
  const matchesMunicipio = (result: AddressResult): boolean => {
    if (!municipio) return true; // No filter applied
    
    const municipioLower = municipio.toLowerCase();
    const ciudadLower = result.ciudad.toLowerCase();
    const localidadLower = result.localidad.toLowerCase();
    
    // Special case for Bogotá (city contains "bogotá" or "bogota")
    if (municipioLower === "bogotá" || municipioLower === "bogota") {
      return ciudadLower.includes("bogotá") || ciudadLower.includes("bogota");
    }
    
    // Check if ciudad or localidad matches the selected municipio
    return ciudadLower.includes(municipioLower) || 
           localidadLower.includes(municipioLower) ||
           municipioLower.includes(ciudadLower);
  };

  // Search using Nominatim
  const searchAddress = useCallback(async (searchQuery: string) => {
    if (searchQuery.length < 3) {
      setResults([]);
      return;
    }

    setLoading(true);

    try {
      // Build query with municipality context if provided
      let enhancedQuery = searchQuery;
      if (municipio) {
        enhancedQuery = `${searchQuery}, ${municipio}, Colombia`;
      } else {
        enhancedQuery = `${searchQuery}, Colombia`;
      }
      
      const encodedQuery = encodeURIComponent(enhancedQuery);
      
      // Use Nominatim with structured query and viewbox for better results
      const response = await fetch(
        `https://nominatim.openstreetmap.org/search?format=jsonv2&addressdetails=1&q=${encodedQuery}&viewbox=${BOGOTA_VIEWBOX}&bounded=0&limit=10&countrycodes=co`,
        {
          headers: {
            "Accept-Language": "es",
          },
        }
      );
      
      if (!response.ok) throw new Error("Search failed");
      
      const data: NominatimResult[] = await response.json();
      
      // Filter results to only show covered areas AND match selected municipality
      const filteredResults = data
        .map(parseNominatimResult)
        .filter((result) => {
          const ciudad = result.ciudad.toLowerCase();
          const localidad = result.localidad.toLowerCase();
          
          // First check if it's in covered areas
          const inCoveredArea = COVERED_AREAS.some(
            (area) =>
              ciudad.includes(area.toLowerCase()) ||
              localidad.includes(area.toLowerCase())
          );
          
          if (!inCoveredArea) return false;
          
          // Then check if it matches the selected municipality
          return matchesMunicipio(result);
        });

      setResults(filteredResults);
      setSelectedIndex(-1);
    } catch (error) {
      console.error("Nominatim search error:", error);
      setResults([]);
    } finally {
      setLoading(false);
    }
  }, [municipio]);

  // Debounced search
  useEffect(() => {
    if (searchTimeout.current) {
      clearTimeout(searchTimeout.current);
    }

    if (query.length >= 3) {
      searchTimeout.current = setTimeout(() => {
        searchAddress(query);
      }, 400);
    } else {
      setResults([]);
    }

    return () => {
      if (searchTimeout.current) {
        clearTimeout(searchTimeout.current);
      }
    };
  }, [query, searchAddress]);

  // Handle result selection
  const handleSelect = (result: AddressResult) => {
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
      <p className="mt-1 text-xs text-muted-foreground">
        {municipio 
          ? `Escribe dirección o barrio en ${municipio}`
          : "Escribe dirección, barrio o localidad (Bogotá, Soacha, Funza, Madrid, Mosquera)"}
      </p>

      {/* Results Dropdown */}
      {showDropdown && (query.length >= 3 || results.length > 0) && (
        <div className="absolute z-50 mt-1 w-full max-h-64 overflow-y-auto rounded-lg border border-border bg-card shadow-lg">
          {loading && results.length === 0 ? (
            <div className="flex items-center justify-center gap-2 px-4 py-3">
              <Loader2 className="h-4 w-4 animate-spin text-primary" />
              <span className="text-sm text-muted-foreground">Buscando en {municipio || "Colombia"}...</span>
            </div>
          ) : results.length > 0 ? (
            results.map((result, index) => (
              <button
                key={result.id}
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

export default AddressAutocomplete;