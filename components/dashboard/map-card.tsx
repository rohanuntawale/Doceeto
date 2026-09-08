"use client";

import dynamic from "next/dynamic";
import { MapPin, Stethoscope, Clock, Navigation, LoaderCircle } from "lucide-react";
import type { AdvancedMapProps } from "@/components/ui/interactive-map";
import { useDoctors } from "@/lib/hooks/data";
import type { PatientIdentity } from "@/lib/hooks/use-current-patient";
import { requestDeviceLocation, useDeviceLocation } from "@/lib/geo/device-location";
import { useMemo, useState } from "react";

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

  // Use the real device location when available; fall back to patient record
  // (Nagpur centre) while loading or when geolocation is unavailable.
  const effectiveCenter: [number, number] = useMemo(
    () =>
      geo.lat != null && geo.lng != null
        ? [geo.lat, geo.lng]
        : [patient.lat, patient.lng],
    [geo.lat, geo.lng, patient.lat, patient.lng],
  );

  const markers: NonNullable<AdvancedMapProps["markers"]> = [
    // Patient "you are here" dot — always first so it renders on top.
    {
      id: "__me",
      position: effectiveCenter,
      color: "red" as const,
      size: "large" as const,
      popup: { title: "You are here", content: "Your current location" },
    },
    ...nearby.flatMap((doctor) =>
      doctor.lat != null && doctor.lng != null
        ? [{
            id: doctor.id,
            position: [doctor.lat, doctor.lng] as [number, number],
            color: (doctor.status === "online" ? "green" : "blue") as "green" | "blue",
            size: "medium" as const,
            popup: { title: doctor.fullName, content: doctor.specialty },
          }]
        : [],
    ),
  ];
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
      <div className="relative z-0 h-[330px] w-full sm:h-[350px]">
        <AdvancedMap
          center={effectiveCenter}
          zoom={13}
          markers={markers}
          enableClustering={markers.length > 4}
          enableSearch={true}
          enableControls={true}
          style={{ height: "100%", width: "100%" }}
        />
      </div>

      {/* Glass overlays. Bottom space is deliberately reserved for the map
          source notice, so narrow cards never stack the action over it. */}
      <div className="pointer-events-none absolute inset-0 z-10 flex flex-col justify-between p-3 pb-11">
        <div className="flex items-start justify-between gap-2 pt-12">
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

        <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
          <Chip className="px-2 py-1 text-[10px] sm:px-2.5 sm:py-1.5 sm:text-[11px]">
            <Stethoscope className="h-3.5 w-3.5 text-[rgb(var(--c-terracotta))]" />
            {nearby.length} doctors nearby
          </Chip>
          <Chip className="px-2 py-1 text-[10px] sm:px-2.5 sm:py-1.5 sm:text-[11px]">
            <Clock className="h-3.5 w-3.5 text-[rgb(var(--c-salmon))]" />
            ~24 min arrival
          </Chip>
          <button
            onClick={() => { window.location.href = "/patient/doctors"; }}
            className="pointer-events-auto ml-auto flex shrink-0 items-center gap-1.5 rounded-full bg-primary px-2.5 py-1 text-[11px] font-semibold text-on-accent sm:px-3.5 sm:py-1.5 sm:text-xs"
          >
            <Navigation className="h-3.5 w-3.5" /> Find care
          </button>
        </div>
      </div>
    </section>
  );
}

function Chip({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full border border-[var(--border)] bg-[var(--glass-bg-strong)] font-medium text-cream backdrop-blur-md ${className ?? "px-2.5 py-1.5 text-[11px]"}`}>
      {children}
    </span>
  );
}
