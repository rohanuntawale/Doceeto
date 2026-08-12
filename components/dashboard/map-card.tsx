"use client";

import { useRouter } from "next/navigation";
import { MapPin, Stethoscope, Clock, Navigation } from "lucide-react";
import { DoctorMap } from "@/components/map/doctor-map";
import { useDoctors } from "@/lib/hooks/data";
import type { PatientIdentity } from "@/lib/hooks/use-current-patient";

/**
 * Dashboard map card — a real (MapLibre) map centred on the patient with
 * nearby doctors, plus frosted glass overlay chips showing live health metrics.
 */
export function MapCard({ patient }: { patient: PatientIdentity }) {
  const router = useRouter();
  const doctors = useDoctors();
  const nearby = doctors.filter((d) => d.status !== "offline");

  return (
    <section className="fh-card map-chip-overlay relative overflow-hidden rounded-3xl">
      <div className="h-[260px] w-full">
        <DoctorMap
          patient={patient}
          doctors={nearby}
          selectedId={null}
          onSelect={() => router.push("/patient/doctors")}
          height={260}
        />
      </div>

      {/* Glass overlays. The deeper bottom padding leaves the map's
          attribution strip its own lane under the action row. */}
      <div className="pointer-events-none absolute inset-0 flex flex-col justify-between p-3 pb-8">
        <div className="flex items-start justify-between gap-2">
          <Chip>
            <MapPin className="h-3.5 w-3.5 text-[rgb(var(--c-terracotta))]" />
            <span className="max-w-[9rem] truncate">{patient.address || "Your area"}</span>
          </Chip>
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
            onClick={() => router.push("/patient/doctors")}
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
