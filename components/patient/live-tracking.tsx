"use client";

import { useEffect, useMemo, useState } from "react";
import { Star, BadgeCheck, Video } from "lucide-react";
import { TrackMap } from "@/components/map/track-map";
import { Button } from "@/components/ui/button";
import { useConsultRequests, useDoctors, useActions } from "@/lib/hooks/data";
import { isDemoMode } from "@/lib/config";
import { DEMO_TRIP_MS } from "@/lib/demo/simulator";
import { initials } from "@/lib/utils/format";
import { cn } from "@/lib/utils/cn";
import type { PatientIdentity } from "@/lib/hooks/use-current-patient";

const STEPS = ["Requested", "Accepted", "On the way", "Arrived"] as const;
const STEP_OF: Record<string, number> = {
  pending: 0,
  accepted: 1,
  enroute: 2,
  arrived: 3,
};
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

/** The post-booking "your doctor is coming to you" experience — a live map
 *  with the doctor moving toward you and a counting-down ETA. */
export function LiveTracking({ patient }: { patient: PatientIdentity }) {
  const requests = useConsultRequests();
  const doctors = useDoctors();
  const { declineRequest } = useActions();
  // 1s heartbeat so the marker + ETA update.
  const [, setNow] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setNow((n) => n + 1), 1000);
    return () => clearInterval(t);
  }, []);

  const active = useMemo(() => {
    const mine = requests.filter(
      (r) =>
        r.patientId === patient.id &&
        (r.status === "pending" ||
          r.status === "accepted" ||
          r.status === "enroute" ||
          r.status === "arrived"),
    );
    return mine.sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1))[0] ?? null;
  }, [requests, patient.id]);

  if (!active) return null;

  const doctor = doctors.find((d) => d.id === active.doctorId);

  // ── Waiting for a doctor to accept ──
  if (active.status === "pending") {
    return (
      <div className="glass-strong rounded-card p-5 text-center">
        <div className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-terracotta/15">
          <span className="h-3 w-3 animate-pulse rounded-full bg-terracotta" />
        </div>
        <p className="mt-3 font-serif text-lg text-cream">Finding a doctor near you…</p>
        <p className="mt-1 text-sm text-[var(--text-muted)]">
          Sending your request to nearby doctors. The first to accept will come to you.
        </p>
        <button
          onClick={() => declineRequest(active.id)}
          className="mt-4 text-xs font-medium text-[var(--text-faint)] hover:text-cream"
        >
          Cancel request
        </button>
      </div>
    );
  }

  const name = doctor?.fullName ?? "Your doctor";
  const step = STEP_OF[active.status] ?? 1;
  const isVideo = active.type === "video";

  // Trip progress: elapsed since accept, over the trip duration.
  const acceptedMs = active.acceptedAt ? new Date(active.acceptedAt).getTime() : Date.now();
  const durationMs = isDemoMode ? DEMO_TRIP_MS : (active.etaMins ?? 10) * 60_000;
  const rawFraction = Math.min(1, Math.max(0, (Date.now() - acceptedMs) / durationMs));
  const fraction = active.status === "arrived" ? 1 : rawFraction;
  const etaLeft =
    active.status === "arrived"
      ? 0
      : Math.max(1, Math.ceil((active.etaMins ?? 10) * (1 - fraction)));

  const doctorPos = doctor
    ? { lat: lerp(doctor.lat, patient.lat, fraction), lng: lerp(doctor.lng, patient.lng, fraction) }
    : patient;

  const headline =
    active.status === "arrived"
      ? `${name} has arrived`
      : active.status === "enroute"
        ? `${name} is on the way`
        : `${name} accepted your request`;

  return (
    <div className="glass-strong overflow-hidden rounded-card">
      {/* Header: doctor + ETA */}
      <div className="flex items-center gap-3 p-4">
        <span
          className="grid h-11 w-11 shrink-0 place-items-center rounded-xl text-sm font-medium text-cream"
          style={{ background: doctor?.avatarColor ?? "#6B615A" }}
        >
          {initials(name.replace("Dr. ", ""))}
        </span>
        <div className="min-w-0 flex-1">
          <p className="flex items-center gap-1.5 truncate font-medium text-cream">
            {name}
            {doctor?.verified && <BadgeCheck className="h-4 w-4 shrink-0 text-status-ok" />}
          </p>
          <p className="truncate text-xs text-[var(--text-muted)]">
            {doctor?.specialty}
            {doctor ? ` · ` : ""}
            {doctor && (
              <span className="text-tan">
                <Star className="inline h-3 w-3 fill-tan" /> {doctor.rating.toFixed(1)}
              </span>
            )}
          </p>
        </div>
        {!isVideo && (
          <div className="shrink-0 text-right">
            <div className="metric text-2xl text-cream">
              {active.status === "arrived" ? "Here" : `${etaLeft}m`}
            </div>
            <div className="label">{active.status === "arrived" ? "arrived" : "away"}</div>
          </div>
        )}
      </div>

      {/* Live map (in-person) or video panel */}
      {isVideo ? (
        <div className="mx-4 mb-4 rounded-card border border-[var(--border)] bg-espresso p-5 text-center">
          <Video className="mx-auto h-8 w-8 text-salmon" />
          <p className="mt-2 text-sm text-cream">{headline}</p>
          <p className="mt-1 text-xs text-[var(--text-muted)]">
            Your video consultation is ready.
          </p>
          <Button
            className="mt-3"
            onClick={() =>
              window.open(`https://meet.jit.si/iyashi-${active.id}`, "_blank", "noopener")
            }
          >
            <Video className="h-4 w-4" /> Join video call
          </Button>
        </div>
      ) : (
        <div className="px-4">
          <TrackMap patient={patient} doctor={doctorPos} doctorName={name} height={260} />
        </div>
      )}

      {/* Status stepper */}
      <div className="p-4">
        <p className="mb-2 text-sm font-medium text-cream">{headline}</p>
        <div className="flex items-center gap-1.5">
          {STEPS.map((s, i) => (
            <div key={s} className="flex flex-1 flex-col items-center gap-1">
              <div
                className={cn(
                  "h-1.5 w-full rounded-full transition-colors",
                  i <= step ? "bg-terracotta" : "bg-white/10",
                )}
              />
              <span
                className={cn(
                  "text-[10px]",
                  i <= step ? "text-salmon" : "text-[var(--text-faint)]",
                )}
              >
                {s}
              </span>
            </div>
          ))}
        </div>

      </div>
    </div>
  );
}
