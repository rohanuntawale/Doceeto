"use client";

import dynamic from "next/dynamic";
import type { MapProps } from "@/components/map/map-impl";

// Leaflet touches `window`, so it must never render on the server.
// Lazy-loading it also keeps it off the critical (SOS) render path.
const MapImpl = dynamic(() => import("@/components/map/map-impl"), {
  ssr: false,
  loading: () => (
    <div
      className="grid place-items-center rounded-card border border-[var(--border)] bg-espresso-800"
      style={{ height: 420 }}
    >
      <span className="font-jp text-2xl text-[var(--text-faint)] animate-pulse">
        地図
      </span>
    </div>
  ),
});

export function LiveMap(props: MapProps) {
  return <MapImpl {...props} />;
}
