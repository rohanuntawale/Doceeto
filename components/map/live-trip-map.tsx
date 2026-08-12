"use client";

import dynamic from "next/dynamic";
import type { LiveTripMapProps } from "@/components/map/live-trip-map-impl";

export type { LiveTripMapProps, TripEta } from "@/components/map/live-trip-map-impl";

// MapLibre needs `window` and a WebGL context, so it must never render on the
// server. Lazy-loading it also keeps ~800KB of renderer off the first paint of
// every page that merely CAN show a map.
const Impl = dynamic(() => import("@/components/map/live-trip-map-impl"), {
  ssr: false,
  loading: () => (
    <div className="grid h-full min-h-[260px] w-full place-items-center rounded-card bg-espresso-800">
      <span className="animate-pulse text-sm text-[var(--text-faint)]">Loading map…</span>
    </div>
  ),
});

/** The Uber-style tracking map: real road route, a puck that moves and points
 *  where it is going, and a live ETA. */
export function LiveTripMap(props: LiveTripMapProps) {
  return <Impl {...props} />;
}
