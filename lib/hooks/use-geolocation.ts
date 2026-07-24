"use client";

import { useEffect, useRef, useState } from "react";
import { haversineKm } from "@/lib/utils/geo";

export interface GeoState {
  lat: number | null;
  lng: number | null;
  accuracy: number | null;
  /** "idle" until requested, then granted/denied/unsupported. */
  status: "idle" | "locating" | "granted" | "denied" | "unsupported";
}

/**
 * Live device position via navigator.geolocation.watchPosition.
 * Emits only on meaningful movement (> minMoveMeters) to avoid
 * re-render + persistence churn.
 */
export function useGeolocation(options?: {
  enabled?: boolean;
  minMoveMeters?: number;
}): GeoState {
  const { enabled = true, minMoveMeters = 25 } = options ?? {};
  const [state, setState] = useState<GeoState>({
    lat: null,
    lng: null,
    accuracy: null,
    status: "idle",
  });
  const last = useRef<{ lat: number; lng: number } | null>(null);

  useEffect(() => {
    if (!enabled) return;
    if (typeof navigator === "undefined" || !("geolocation" in navigator)) {
      setState((s) => ({ ...s, status: "unsupported" }));
      return;
    }

    setState((s) => (s.status === "idle" ? { ...s, status: "locating" } : s));

    const id = navigator.geolocation.watchPosition(
      (pos) => {
        const { latitude: lat, longitude: lng, accuracy } = pos.coords;
        const moved =
          !last.current ||
          haversineKm(last.current, { lat, lng }) * 1000 >= minMoveMeters;
        if (!moved) return;
        last.current = { lat, lng };
        setState({ lat, lng, accuracy, status: "granted" });
      },
      (err) => {
        setState((s) => ({
          ...s,
          status: err.code === err.PERMISSION_DENIED ? "denied" : s.status,
        }));
      },
      { enableHighAccuracy: true, maximumAge: 15_000, timeout: 20_000 },
    );

    return () => navigator.geolocation.clearWatch(id);
  }, [enabled, minMoveMeters]);

  return state;
}
