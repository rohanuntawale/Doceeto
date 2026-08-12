"use client";

import { useEffect, useRef, useState } from "react";
import { haversineKm, type LatLng } from "@/lib/utils/geo";
import { snapToLine, toPos, type Pos } from "@/lib/maps/geo";

export interface TripRoute {
  line: Pos[];
  distanceM: number;
  durationS: number;
  /** True when the line is the straight fallback, not real road geometry. */
  straight: boolean;
}

/** Off the line by more than this and the driver has taken a different road. */
const REROUTE_OFFSET_KM = 0.2;
/** The destination moving further than this invalidates the route outright. */
const DEST_MOVED_KM = 0.1;
/** Refresh anyway at this age, so a long trip picks up a better estimate. */
const MAX_AGE_MS = 5 * 60_000;

const straightLine = (from: LatLng, to: LatLng): TripRoute => {
  const km = haversineKm(from, to);
  return {
    line: [toPos(from), toPos(to)],
    distanceM: km * 1000,
    // ~24 km/h through Indian city traffic — the same assumption the tracker
    // used before routing existed, kept only for when routing is unavailable.
    durationS: (km / 24) * 3600,
    straight: true,
  };
};

/**
 * The route from the provider to the destination, kept fresh cheaply.
 *
 * The naive version — re-route on every position ping — would fire a routing
 * call every few seconds per active trip and still draw a line that jitters as
 * each response lands slightly different. Instead the route is fetched once
 * and the provider is SNAPPED onto it; a new one is only requested when the
 * route is genuinely wrong: they have left it, the destination moved, or it
 * has gone stale. That is also how the travelled-vs-remaining split stays
 * stable enough to animate.
 */
export function useTripRoute(
  from: LatLng | null,
  to: LatLng | null,
  enabled = true,
): TripRoute | null {
  const [route, setRoute] = useState<TripRoute | null>(null);
  // Held in a ref as well as state: the effect below decides whether to fetch
  // by reading the CURRENT route, and depending on it in state would re-run
  // the effect every time a fetch resolved.
  const current = useRef<TripRoute | null>(null);
  const fetchedAt = useRef(0);
  const dest = useRef<LatLng | null>(null);
  const inFlight = useRef(false);

  useEffect(() => {
    if (!enabled || !from || !to) {
      current.current = null;
      dest.current = null;
      setRoute(null);
      return;
    }

    const held = current.current;
    const destMoved =
      !dest.current || haversineKm(dest.current, to) > DEST_MOVED_KM;
    const drifted =
      !!held &&
      !held.straight &&
      (snapToLine(held.line, toPos(from))?.offsetKm ?? Infinity) > REROUTE_OFFSET_KM;
    const stale = Date.now() - fetchedAt.current > MAX_AGE_MS;

    if (held && !destMoved && !drifted && !stale) return;
    if (inFlight.current) return;

    inFlight.current = true;
    let cancelled = false;

    // Show the straight line immediately on a cold start so the map is never
    // blank while routing is in flight; a real route replaces it in a moment.
    if (!held) {
      const fallback = straightLine(from, to);
      current.current = fallback;
      setRoute(fallback);
    }

    const q = `from=${from.lat},${from.lng}&to=${to.lat},${to.lng}`;
    fetch(`/api/geo/directions?${q}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((json: { route?: TripRoute | null } | null) => {
        if (cancelled) return;
        const got = json?.route;
        const next: TripRoute =
          got && got.line?.length >= 2
            ? { ...got, straight: false }
            : straightLine(from, to);
        fetchedAt.current = Date.now();
        dest.current = to;
        current.current = next;
        setRoute(next);
      })
      .catch(() => {
        if (cancelled) return;
        // Keep whatever we already had; a failed refresh should not blank a
        // route that is still broadly right.
        fetchedAt.current = Date.now();
        dest.current = to;
        if (!current.current) {
          const fallback = straightLine(from, to);
          current.current = fallback;
          setRoute(fallback);
        }
      })
      .finally(() => {
        inFlight.current = false;
      });

    return () => {
      cancelled = true;
    };
  }, [enabled, from?.lat, from?.lng, to?.lat, to?.lng]); // eslint-disable-line react-hooks/exhaustive-deps

  return route;
}
