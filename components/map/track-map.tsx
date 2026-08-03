"use client";

import dynamic from "next/dynamic";
import type { TrackMapProps } from "@/components/map/track-map-impl";

// Leaflet touches `window`, so it must never render on the server.
const TrackMapImpl = dynamic(() => import("@/components/map/track-map-impl"), {
  ssr: false,
  loading: () => (
    <div
      className="grid place-items-center rounded-card border border-[var(--border)]"
      style={{ height: 300 }}
    >
      <span className="text-sm text-[var(--text-faint)] animate-pulse">Loading map…</span>
    </div>
  ),
});

export function TrackMap(props: TrackMapProps) {
  return <TrackMapImpl {...props} />;
}
