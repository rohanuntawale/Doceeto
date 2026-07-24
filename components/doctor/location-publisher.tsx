"use client";

import { useEffect, useRef } from "react";
import { useGeolocation } from "@/lib/hooks/use-geolocation";
import { useCurrentDoctor } from "@/lib/hooks/use-current-doctor";
import { useActions } from "@/lib/hooks/data";

const MIN_PUBLISH_MS = 15_000;

/**
 * Mounted once in the doctor layout. While the doctor is ONLINE (or
 * busy), streams the device's real position to the backend via the
 * shared updateDoctor action — demo store locally, /api/actions →
 * Neo4j in live mode — so patients and ops see the doctor where they
 * actually are. Renders nothing.
 */
export function DoctorLocationPublisher() {
  const me = useCurrentDoctor();
  const { updateDoctor } = useActions();
  const active = !!me && me.status !== "offline";
  const geo = useGeolocation({ enabled: active, minMoveMeters: 30 });
  const lastSent = useRef(0);

  useEffect(() => {
    if (!active || !me) return;
    if (geo.status !== "granted" || geo.lat == null || geo.lng == null) return;
    const now = Date.now();
    if (now - lastSent.current < MIN_PUBLISH_MS) return;
    lastSent.current = now;
    updateDoctor(me.id, { lat: geo.lat, lng: geo.lng });
  }, [active, me, geo.status, geo.lat, geo.lng, updateDoctor]);

  return null;
}
