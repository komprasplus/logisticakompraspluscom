/**
 * Configuración centralizada del Google Maps loader.
 *
 * IMPORTANTE: useJsApiLoader debe llamarse en TODO el árbol React con la
 * misma API key y EL MISMO array de libraries. Si dos componentes piden
 * librerías distintas el loader falla (o solo carga las del primero),
 * dejando google.maps undefined para el resto y rompiendo el render.
 */
export const GOOGLE_MAPS_API_KEY = "AIzaSyDvV2fL5jv0OIp45Si4m4-gaWSt9gIXznA";

// Lista canónica usada en todos los mapas de la app. Mantener estable —
// agregar libs aquí, nunca en componentes individuales.
// Nota: "geocoding" no existe como librería; el Geocoder es parte del core.
export const GOOGLE_MAPS_LIBRARIES: ("places" | "geometry" | "drawing" | "visualization" | "marker")[] = [
  "places",
  "geometry",
];
