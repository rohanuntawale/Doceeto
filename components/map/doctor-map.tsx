"use client";

import dynamic from "next/dynamic";
import type { DoctorMapProps } from "@/components/map/doctor-map-impl";

// Leaflet touches `window`, so it must never render on the server.
const DoctorMapImpl = dynamic(() => import("@/components/map/doctor-map-impl"), {
  ssr: false,
  loading: () => (
    <div className="grid h-full min-h-[340px] w-full place-items-center bg-[var(--c-espresso-800)]">
      <span className="text-sm text-[var(--text-faint)] animate-pulse">
        Loading map…
      </span>
    </div>
  ),
});

export function DoctorMap(props: DoctorMapProps) {
  return <DoctorMapImpl {...props} />;
}
