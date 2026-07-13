"use client";

import dynamic from "next/dynamic";
import type { DoctorMapProps } from "@/components/map/doctor-map-impl";

// Leaflet touches `window`, so it must never render on the server.
const DoctorMapImpl = dynamic(() => import("@/components/map/doctor-map-impl"), {
  ssr: false,
  loading: () => (
    <div
      className="grid place-items-center rounded-card border border-[var(--border)]"
      style={{ height: 340 }}
    >
      <span className="font-jp text-2xl text-[var(--text-faint)] animate-pulse">
        地図
      </span>
    </div>
  ),
});

export function DoctorMap(props: DoctorMapProps) {
  return <DoctorMapImpl {...props} />;
}
