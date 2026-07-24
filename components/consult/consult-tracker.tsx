"use client";

import { MapPin, Navigation, Video, Home, Building2, Stethoscope } from "lucide-react";
import { Card } from "@/components/ui/card";
import { StatusPill } from "@/components/ui/status-pill";
import { TrackMap } from "@/components/map/track-map";
import { useConsultRequests, useDoctors } from "@/lib/hooks/data";
import { consultType } from "@/lib/labels";
import { haversineKm, formatKm } from "@/lib/utils/geo";
import { initials } from "@/lib/utils/format";
import type { ConsultRequest, Doctor, LatLng } from "@/lib/types/domain";
import type { PatientIdentity } from "@/lib/hooks/use-current-patient";

const typeIcon = {
  video: <Video className="h-3.5 w-3.5" />,
  home_visit: <Home className="h-3.5 w-3.5" />,
  clinic: <Building2 className="h-3.5 w-3.5" />,
};

const hasCoords = (p: { lat: number; lng: number } | null | undefined) =>
  !!p && (p.lat !== 0 || p.lng !== 0);

/** Rough urban ETA (~24 km/h) — only meaningful for a home visit. */
function etaMins(km: number) {
  return Math.max(1, Math.round(km / 0.4));
}

// ── Patient side: track the doctor who accepted ──────────────
export function PatientConsultTracker({ patient }: { patient: PatientIdentity }) {
  const requests = useConsultRequests();
  const doctors = useDoctors();

  const accepted = requests
    .filter((r) => r.patientId === patient.id && r.status === "accepted" && r.doctorId)
    .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));

  if (accepted.length === 0) return null;

  return (
    <div className="space-y-3">
      {accepted.map((req) => {
        const doctor = doctors.find((d) => d.id === req.doctorId);
        return (
          <TrackerCard
            key={req.id}
            self={{ lat: patient.lat, lng: patient.lng, label: "You" }}
            other={doctor ? { lat: doctor.lat, lng: doctor.lng, label: doctor.fullName } : null}
            avatar={{ text: doctor ? initials(doctor.fullName.replace("Dr. ", "")) : "Dr", color: doctor?.avatarColor }}
            title={doctor?.fullName ?? "Your doctor"}
            subtitle={doctor?.specialty}
            req={req}
            side="patient"
          />
        );
      })}
    </div>
  );
}

// ── Doctor side: track the patient you accepted ──────────────
export function DoctorConsultTracker({ doctor }: { doctor: Doctor }) {
  const requests = useConsultRequests();

  const accepted = requests
    .filter((r) => r.doctorId === doctor.id && r.status === "accepted")
    .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));

  if (accepted.length === 0) return null;

  return (
    <div className="space-y-3">
      {accepted.map((req) => (
        <TrackerCard
          key={req.id}
          self={{ lat: doctor.lat, lng: doctor.lng, label: "You" }}
          other={{ lat: req.lat, lng: req.lng, label: req.patientName }}
          avatar={{ text: initials(req.patientName), color: undefined }}
          title={req.patientName}
          subtitle="Patient"
          req={req}
          side="doctor"
        />
      ))}
    </div>
  );
}

// ── Shared card ──────────────────────────────────────────────
function TrackerCard({
  self,
  other,
  avatar,
  title,
  subtitle,
  req,
  side,
}: {
  self: LatLng & { label?: string };
  other: (LatLng & { label?: string }) | null;
  avatar: { text: string; color?: string };
  title: string;
  subtitle?: string;
  req: ConsultRequest;
  side: "patient" | "doctor";
}) {
  const known = hasCoords(other);
  const km = known ? haversineKm(self, other as LatLng) : null;
  const isHomeVisit = req.type === "home_visit";

  const statusText =
    side === "patient"
      ? isHomeVisit
        ? "On the way to you"
        : req.type === "video"
          ? "Ready for your video call"
          : "Expecting you at the clinic"
      : isHomeVisit
        ? "Head to the patient"
        : "Consult accepted";

  return (
    <Card className="overflow-hidden">
      <div className="flex items-center gap-3 border-b border-[var(--border)] px-4 py-3">
        <span
          className="grid h-10 w-10 shrink-0 place-items-center rounded-lg text-xs font-medium text-cream"
          style={{ background: avatar.color ?? "rgb(var(--c-espresso-700))" }}
        >
          {avatar.text}
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate font-medium text-cream">{title}</p>
          <p className="flex items-center gap-1.5 text-xs text-[var(--text-muted)]">
            {typeIcon[req.type]} {consultType[req.type].label}
            {subtitle ? ` · ${subtitle}` : ""}
          </p>
        </div>
        <StatusPill tone="info">Accepted</StatusPill>
      </div>

      {known ? (
        <div className="p-3">
          <TrackMap self={self} other={other as LatLng & { label?: string }} height={260} />
          <div className="mt-3 flex flex-wrap items-center justify-between gap-2 px-1">
            <span className="flex items-center gap-1.5 text-sm text-cream">
              <Navigation className="h-4 w-4 text-tan" />
              {statusText}
            </span>
            <span className="flex items-center gap-3 text-xs text-[var(--text-muted)]">
              <span className="flex items-center gap-1.5">
                <MapPin className="h-3.5 w-3.5" />
                {km !== null ? formatKm(km) : "—"} apart
              </span>
              {isHomeVisit && km !== null && (
                <span className="font-mono text-tan">~{etaMins(km)} min</span>
              )}
            </span>
          </div>
          <div className="mt-2 flex items-center gap-4 px-1 text-[11px] text-[var(--text-faint)]">
            <span className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-[rgb(var(--c-cream))]" /> You
            </span>
            <span className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-tan" />
              {side === "patient" ? "Your doctor" : "Patient"}
            </span>
          </div>

          {/* Detailed address + one-tap directions */}
          <div className="mt-3 flex items-center justify-between gap-3 border-t border-[var(--border)] px-1 pt-3">
            <div className="min-w-0">
              <div className="label">
                {side === "doctor" ? "Patient address" : "Doctor's location"}
              </div>
              <p className="mt-0.5 flex items-center gap-1.5 text-sm text-cream">
                <MapPin className="h-3.5 w-3.5 shrink-0 text-tan" />
                <span className="truncate">
                  {side === "doctor"
                    ? req.address || "Shared live location"
                    : "Live location, shown on the map"}
                </span>
              </p>
            </div>
            <a
              href={
                side === "doctor"
                  ? `https://www.google.com/maps/dir/?api=1&destination=${(other as LatLng).lat},${(other as LatLng).lng}`
                  : `https://www.google.com/maps?q=${(other as LatLng).lat},${(other as LatLng).lng}`
              }
              target="_blank"
              rel="noreferrer"
              className="flex shrink-0 items-center gap-1.5 rounded-lg border border-[var(--border)] px-3 py-1.5 text-xs font-medium text-cream transition-colors hover:border-terracotta/50"
            >
              <Navigation className="h-3.5 w-3.5 text-tan" />
              {side === "doctor" ? "Navigate" : "Open in Maps"}
            </a>
          </div>
        </div>
      ) : (
        <div className="flex items-center gap-2 px-4 py-6 text-sm text-[var(--text-muted)]">
          <Stethoscope className="h-4 w-4" />
          {side === "patient"
            ? "Waiting for your doctor to share their live location…"
            : "Waiting for the patient's live location…"}
        </div>
      )}
    </Card>
  );
}
