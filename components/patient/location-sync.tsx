"use client";

import { useEffect, useRef } from "react";
import {
  startDeviceLocation,
  useDeviceLocation,
} from "@/lib/geo/device-location";
import { updatePatient } from "@/lib/hooks/use-current-patient";
import { apiFetch } from "@/lib/api/client";
import { haversineKm } from "@/lib/utils/geo";

/**
 * Mounted once in the patient layout. Follows the device and keeps the shared
 * patient identity — and the server record — on the patient's CURRENT
 * position, so the doctor map centers on where they actually are and every
 * request / order carries live coordinates and a live address.
 *
 * The address is deliberately re-resolved as they move: an address captured
 * once at sign-up is wrong the moment someone travels, and "where do I send
 * the doctor" is not a question to answer with stale data. Renders nothing.
 */

/** Re-name the position (and tell the server) only after a real move. */
const RESOLVE_METERS = 150;
/** …or after this long in one place, so a fix that arrived before the network
 *  did still reaches the server. */
const RESOLVE_MAX_AGE = 10 * 60_000;

export function PatientLocationSync() {
  const geo = useDeviceLocation();
  const synced = useRef<{ lat: number; lng: number; at: number } | null>(null);
  const inFlight = useRef(false);

  // One watch for the whole app, started here.
  useEffect(() => {
    startDeviceLocation();
  }, []);

  const { status, lat, lng } = geo;

  useEffect(() => {
    if (status !== "granted" || lat == null || lng == null) return;

    // Coordinates are cheap and local — publish every fix immediately so the
    // map and any in-progress booking follow along without waiting on a
    // network round-trip.
    updatePatient({ lat, lng, located: true });

    const prev = synced.current;
    const worthResolving =
      !prev ||
      haversineKm(prev, { lat, lng }) * 1000 >= RESOLVE_METERS ||
      Date.now() - prev.at >= RESOLVE_MAX_AGE;
    if (!worthResolving || inFlight.current) return;

    inFlight.current = true;
    synced.current = { lat, lng, at: Date.now() };

    apiFetch("/api/geo/locate", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ lat, lng }),
    })
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data?.address) updatePatient({ address: data.address });
      })
      .catch(() => {
        // Naming the place is a nicety; the coordinates are already applied.
        // Let the next movement retry rather than blocking on it.
        synced.current = null;
      })
      .finally(() => {
        inFlight.current = false;
      });
  }, [status, lat, lng]);

  return null;
}
