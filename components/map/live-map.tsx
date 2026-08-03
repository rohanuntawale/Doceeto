"use client";

import dynamic from "next/dynamic";
import type { MapProps } from "@/components/map/map-impl";

// Leaflet touches `window`, so it must never render on the server.
// Lazy-loading it also keeps it off the first-paint critical path.
const MapImpl = dynamic(() => import("@/components/map/map-impl"), {
  ssr: false,
  loading: () => (
    <div
      className="grid place-items-center rounded-card border border-[var(--border)] bg-espresso-800"
      style={{ height: 420 }}
    >
      <span className="text-sm text-[var(--text-faint)] animate-pulse">
        Loading map…
      </span>
    </div>
  ),
});

export function LiveMap(props: MapProps) {
  return <MapImpl {...props} />;
}
