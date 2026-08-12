"use client";

import { useEffect, useRef } from "react";
import {
  holdFineLocation,
  startDeviceLocation,
  useDeviceLocation,
} from "@/lib/geo/device-location";
import { useCurrentProvider } from "@/lib/hooks/use-current-doctor";
import { useActions, useConsultRequests } from "@/lib/hooks/data";
import { tripStageOfRequest } from "@/lib/scheduling/trip";

/**
 * How often a fix reaches the server.
 *
 * IDLE is a presence signal — "this provider is somewhere in this part of
 * town" — and 15s is plenty. TRAVELLING feeds a patient watching a puck cross
 * a map, and there the interval IS the frame rate of the journey: at 15s the
 * marker teleports a block at a time no matter how well the client
 * interpolates, because there is nothing in between to interpolate towards.
 */
const IDLE_PUBLISH_MS = 15_000;
const TRAVELLING_PUBLISH_MS = 4_000;

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
  const requests = useConsultRequests();
  const lastSent = useRef(0);

  const active = !!me && me.status !== "offline";
  const meId = me?.id;

  /**
   * On the way to someone's home right now. Only this justifies the faster
   * cadence and the finer movement gate: the extra writes and the extra
   * battery buy a live journey somebody is actually watching.
   */
  const travelling =
    !!meId &&
    requests.some(
      (r) =>
        r.doctorId === meId &&
        r.status === "accepted" &&
        r.type === "home_visit" &&
        tripStageOfRequest(r) === "enroute",
    );

  // Only follow a provider who is actually on duty — an offline provider is off
  // the platform, and tracking them would be neither useful nor decent.
  useEffect(() => {
    if (active) startDeviceLocation();
  }, [active]);

  // Drop the shared store's movement threshold for the duration of the trip,
  // so small, real movements are published instead of swallowed as jitter.
  useEffect(() => {
    if (!active || !travelling) return;
    return holdFineLocation();
  }, [active, travelling]);

  const { status, lat, lng } = geo;

  useEffect(() => {
    if (!active || !meId) return;
    if (status !== "granted" || lat == null || lng == null) return;
    const now = Date.now();
    const gap = travelling ? TRAVELLING_PUBLISH_MS : IDLE_PUBLISH_MS;
    if (now - lastSent.current < gap) return;
    lastSent.current = now;
    updateDoctor(meId, { lat, lng });
  }, [active, meId, status, lat, lng, travelling, updateDoctor]);

  return null;
}
