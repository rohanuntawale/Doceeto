"use client";

import { useEffect, useRef } from "react";
import {
  startDeviceLocation,
  useDeviceLocation,
} from "@/lib/geo/device-location";
import { useCurrentProvider } from "@/lib/hooks/use-current-doctor";
import { useActions } from "@/lib/hooks/data";

const MIN_PUBLISH_MS = 15_000;

/**
 * Mounted once in the doctor and nurse layouts. While the provider is ONLINE
 * (or busy), streams the device's real position to the backend via the shared
 * updateDoctor action, so patients and ops see them where they actually are.
 * Renders nothing.
 *
 * Reads the SHARED device-location store rather than opening its own watch:
 * the consult tracker needs the same live fix to draw the route and to hand a
 * real origin to Google Maps, and two independent watchPosition calls would
 * disagree with each other and prompt the user twice.
 */
export function DoctorLocationPublisher() {
  const me = useCurrentProvider();
  const { updateDoctor } = useActions();
  const geo = useDeviceLocation();
  const lastSent = useRef(0);

  const active = !!me && me.status !== "offline";
  const meId = me?.id;

  // Only follow a provider who is actually on duty — an offline provider is off
  // the platform, and tracking them would be neither useful nor decent.
  useEffect(() => {
    if (active) startDeviceLocation();
  }, [active]);

  const { status, lat, lng } = geo;

  useEffect(() => {
    if (!active || !meId) return;
    if (status !== "granted" || lat == null || lng == null) return;
    const now = Date.now();
    if (now - lastSent.current < MIN_PUBLISH_MS) return;
    lastSent.current = now;
    updateDoctor(meId, { lat, lng });
  }, [active, meId, status, lat, lng, updateDoctor]);

  return null;
}
