// Google Maps types declaration
declare namespace google {
  namespace maps {
    namespace places {
      class AutocompleteService {
        getPlacePredictions(
          request: AutocompletionRequest,
          callback: (
            predictions: AutocompletePrediction[] | null,
            status: PlacesServiceStatus
          ) => void
        ): void;
      }

      class PlacesService {
        constructor(attrContainer: HTMLElement);
        getDetails(
          request: PlaceDetailsRequest,
          callback: (
            result: PlaceResult | null,
            status: PlacesServiceStatus
          ) => void
        ): void;
      }

      class AutocompleteSessionToken {}

      interface AutocompletionRequest {
        input: string;
        componentRestrictions?: { country: string | string[] };
        types?: string[];
        sessionToken?: AutocompleteSessionToken;
        location?: LatLng;
        radius?: number;
      }

      interface AutocompletePrediction {
        place_id: string;
        description: string;
        structured_formatting: {
          main_text: string;
          secondary_text: string;
        };
        types: string[];
      }

      interface PlaceDetailsRequest {
        placeId: string;
        fields?: string[];
        sessionToken?: AutocompleteSessionToken;
      }

      interface PlaceResult {
        place_id?: string;
        formatted_address?: string;
        geometry?: {
          location: LatLng;
        };
        address_components?: AddressComponent[];
        name?: string;
      }

      interface AddressComponent {
        long_name: string;
        short_name: string;
        types: string[];
      }

      enum PlacesServiceStatus {
        OK = "OK",
        ZERO_RESULTS = "ZERO_RESULTS",
        INVALID_REQUEST = "INVALID_REQUEST",
        OVER_QUERY_LIMIT = "OVER_QUERY_LIMIT",
        REQUEST_DENIED = "REQUEST_DENIED",
        UNKNOWN_ERROR = "UNKNOWN_ERROR",
      }
    }

    class LatLng {
      constructor(lat: number, lng: number);
      lat(): number;
      lng(): number;
    }
  }
}

interface Window {
  google?: typeof google;
}
