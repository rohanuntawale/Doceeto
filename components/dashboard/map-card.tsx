"use client";

import dynamic from "next/dynamic";
import { MapPin, Stethoscope, Clock, Navigation, LoaderCircle } from "lucide-react";
import type { AdvancedMapProps } from "@/components/ui/interactive-map";
import { useDoctors } from "@/lib/hooks/data";
import type { PatientIdentity } from "@/lib/hooks/use-current-patient";
import { requestDeviceLocation, useDeviceLocation } from "@/lib/geo/device-location";
import { useState } from "react";

const AdvancedMap = dynamic(
  () => import("@/components/ui/interactive-map").then((module) => module.AdvancedMap),
  { ssr: false, loading: () => <div className="h-full w-full animate-pulse bg-[#e8efeb]" /> },
);

/**
 * Dashboard map card — a real (Leaflet) map centred on the patient with
 * nearby doctors, plus frosted glass overlay chips showing live health metrics.
 */
export function MapCard({ patient }: { patient: PatientIdentity }) {
  const doctors = useDoctors();
  const geo = useDeviceLocation();
  const [requesting, setRequesting] = useState(false);
  const nearby = doctors.filter((d) => d.status !== "offline");
  const markers: AdvancedMapProps["markers"] = nearby.flatMap((doctor) =>
    doctor.lat != null && doctor.lng != null
      ? [{
          id: doctor.id,
          position: [doctor.lat, doctor.lng] as [number, number],
          color: doctor.status === "online" ? "green" : "blue",
          size: "medium",
          popup: { title: doctor.fullName, content: doctor.specialty },
        }]
      : [],
  );
  const area = patient.located && patient.address
    ? patient.address
    : geo.status === "locating" || requesting
      ? "Finding your area…"
      : geo.status === "unsupported"
        ? "Location unavailable"
        : geo.status === "denied"
          ? "Location blocked"
        : "Allow location";

  async function locate() {
    if (requesting || geo.status === "unsupported") return;
    setRequesting(true);
    await requestDeviceLocation();
    setRequesting(false);
  }

  return (
    <section className="fh-card map-chip-overlay relative overflow-hidden rounded-3xl">
      <div className="h-[330px] w-full sm:h-[350px]">
        <AdvancedMap
          center={[patient.lat, patient.lng]}
          zoom={13}
          markers={markers}
          enableClustering={markers.length > 4}
          enableSearch
          enableControls
          style={{ height: "100%", width: "100%" }}
        />
      </div>

      {/* Glass overlays. The deeper bottom padding leaves the map's
          attribution strip its own lane under the action row. */}
      <div className="pointer-events-none absolute inset-0 flex flex-col justify-between p-3 pb-8">
        <div className="flex items-start justify-between gap-2">
          <button
            type="button"
            onClick={locate}
            disabled={requesting || geo.status === "unsupported"}
            aria-label="Use my current location"
            title={geo.status === "denied"
              ? "Allow location for this site in your browser settings, then try again."
              : "Use your current location"}
            className="pointer-events-auto inline-flex max-w-[13rem] items-center gap-1.5 rounded-full border border-[var(--border)] bg-[var(--glass-bg-strong)] px-2.5 py-1.5 text-left text-[11px] font-medium text-cream backdrop-blur-md disabled:cursor-default"
          >
            {requesting || geo.status === "locating" ? (
              <LoaderCircle className="h-3.5 w-3.5 animate-spin text-[rgb(var(--c-terracotta))]" />
            ) : (
              <MapPin className="h-3.5 w-3.5 shrink-0 text-[rgb(var(--c-terracotta))]" />
            )}
            <span className="max-w-[9rem] truncate">{area}</span>
          </button>
          <Chip>
            <span className="h-1.5 w-1.5 rounded-full bg-[rgb(var(--c-status-ok))]" />
            <span className="text-[rgb(var(--c-status-ok))]">Live</span>
          </Chip>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Chip>
            <Stethoscope className="h-3.5 w-3.5 text-[rgb(var(--c-terracotta))]" />
            {nearby.length} doctors nearby
          </Chip>
          <Chip>
            <Clock className="h-3.5 w-3.5 text-[rgb(var(--c-salmon))]" />
            ~24 min arrival
          </Chip>
          <button
            onClick={() => { window.location.href = "/patient/doctors"; }}
            className="pointer-events-auto ml-auto flex items-center gap-1.5 rounded-full bg-primary px-3.5 py-1.5 text-xs font-semibold text-on-accent"
          >
            <Navigation className="h-3.5 w-3.5" /> Find care
          </button>
        </div>
      </div>
    </section>
  );
}

function Chip({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-[var(--border)] bg-[var(--glass-bg-strong)] px-2.5 py-1.5 text-[11px] font-medium text-cream backdrop-blur-md">
      {children}
    </span>
  );
}
