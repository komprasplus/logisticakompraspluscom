import { useEffect, useRef, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

interface UseLocationTrackingOptions {
  enabled: boolean;
  userId: string | undefined;
  intervalMs?: number;
}

const useLocationTracking = ({
  enabled,
  userId,
  intervalMs = 30000, // 30 seconds default
}: UseLocationTrackingOptions) => {
  const watchIdRef = useRef<number | null>(null);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const lastSavedRef = useRef<{ lat: number; lng: number; time: number } | null>(null);

  const saveLocation = useCallback(async (position: GeolocationPosition) => {
    if (!userId) return;

    const { latitude, longitude, accuracy, speed, heading } = position.coords;
    const now = Date.now();

    // Skip if location hasn't changed significantly (< 10 meters) and less than 30 seconds
    if (lastSavedRef.current) {
      const { lat, lng, time } = lastSavedRef.current;
      const distance = calculateDistance(lat, lng, latitude, longitude);
      const timeDiff = now - time;

      if (distance < 10 && timeDiff < 25000) {
        return; // Skip saving if not moved much
      }
    }

    try {
      // Save to location_history table
      const { error: historyError } = await supabase
        .from("location_history")
        .insert({
          motorizado_id: userId,
          latitude,
          longitude,
          accuracy,
          speed,
          heading,
          recorded_at: new Date().toISOString(),
        });

      if (historyError) {
        console.error("Error saving location history:", historyError);
      }

      // Update profile with latest location
      const { error: profileError } = await supabase
        .from("profiles")
        .update({
          last_location_lat: latitude,
          last_location_lng: longitude,
          last_location_updated_at: new Date().toISOString(),
        })
        .eq("user_id", userId);

      if (profileError) {
        console.error("Error updating profile location:", profileError);
      }

      lastSavedRef.current = { lat: latitude, lng: longitude, time: now };
    } catch (error) {
      console.error("Error in saveLocation:", error);
    }
  }, [userId]);

  const startTracking = useCallback(() => {
    if (!navigator.geolocation || !enabled || !userId) return;

    // Use watchPosition for continuous tracking
    watchIdRef.current = navigator.geolocation.watchPosition(
      (position) => {
        saveLocation(position);
      },
      (error) => {
        console.error("Geolocation error:", error);
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 5000,
      }
    );

    // Also use interval as backup to ensure periodic updates
    intervalRef.current = setInterval(() => {
      navigator.geolocation.getCurrentPosition(
        saveLocation,
        (error) => console.error("Interval geolocation error:", error),
        {
          enableHighAccuracy: true,
          timeout: 10000,
          maximumAge: 5000,
        }
      );
    }, intervalMs);
  }, [enabled, userId, intervalMs, saveLocation]);

  const stopTracking = useCallback(() => {
    if (watchIdRef.current !== null) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);

  useEffect(() => {
    if (enabled && userId) {
      startTracking();
    } else {
      stopTracking();
    }

    return () => {
      stopTracking();
    };
  }, [enabled, userId, startTracking, stopTracking]);

  return { startTracking, stopTracking };
};

// Haversine formula to calculate distance
const calculateDistance = (
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number => {
  const R = 6371e3;
  const φ1 = (lat1 * Math.PI) / 180;
  const φ2 = (lat2 * Math.PI) / 180;
  const Δφ = ((lat2 - lat1) * Math.PI) / 180;
  const Δλ = ((lon2 - lon1) * Math.PI) / 180;

  const a =
    Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
    Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c;
};

export default useLocationTracking;
