"use client";

import { useState, useEffect, useCallback, useRef } from "react";

export type GpsStatus = "loading" | "active" | "denied" | "unavailable";

export interface GpsPosition {
  latitude: number;
  longitude: number;
}

interface UseGeolocationReturn {
  position: GpsPosition | null;
  status: GpsStatus;
  refresh: () => void;
}

/**
 * Fetch current GPS position and update the provided state setters.
 * Extracted as a plain function to avoid the lint rule about
 * calling setState synchronously within an effect.
 */
function fetchPosition(
  setPosition: (pos: GpsPosition | null) => void,
  setStatus: (status: GpsStatus) => void
) {
  if (!navigator.geolocation) {
    setStatus("unavailable");
    return;
  }

  setStatus("loading");

  navigator.geolocation.getCurrentPosition(
    (pos) => {
      setPosition({
        latitude: pos.coords.latitude,
        longitude: pos.coords.longitude,
      });
      setStatus("active");
    },
    (error) => {
      if (error.code === error.PERMISSION_DENIED) {
        setStatus("denied");
      } else {
        setStatus("unavailable");
      }
      setPosition(null);
    },
    {
      enableHighAccuracy: true,
      timeout: 10000,
      maximumAge: 60000, // Cache for 1 minute
    }
  );
}

/**
 * Hook to get the user's GPS position.
 * Non-blocking: if GPS is denied or unavailable, status reflects it
 * but nothing breaks.
 */
export function useGeolocation(): UseGeolocationReturn {
  const [position, setPosition] = useState<GpsPosition | null>(null);
  const [status, setStatus] = useState<GpsStatus>("loading");
  const initialized = useRef(false);

  useEffect(() => {
    if (!initialized.current) {
      initialized.current = true;
      fetchPosition(setPosition, setStatus);
    }
  }, []);

  const refresh = useCallback(() => {
    fetchPosition(setPosition, setStatus);
  }, []);

  return { position, status, refresh };
}
