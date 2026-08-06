"use client";

import { useEffect, useState } from "react";
import {
  MapPin,
  Navigation,
  Video,
  Home,
  Building2,
  Stethoscope,
  Check,
  ArrowRight,
  X,
  Briefcase,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { StatusPill } from "@/components/ui/status-pill";
import { TrackMap } from "@/components/map/track-map";
import { useToast } from "@/components/ui/toast";
import { StartCodeForDoctor, StartCodeForPatient } from "@/components/consult/start-code";
import { CancelVisitDialog } from "@/components/doctor/cancel-visit-dialog";
import { PrescriptionComposer } from "@/components/prescription/prescription-composer";
import { useActions, useConsultRequests, useDoctors } from "@/lib/hooks/data";
import {
  requestDeviceLocation,
  startDeviceLocation,
  useDeviceLocation,
} from "@/lib/geo/device-location";
import { labelsIn } from "@/lib/labels";
import { useT } from "@/lib/i18n";
import { isGig } from "@/lib/scheduling/slots";
import { awaitingStartCode, stagesFor, tripStageOfRequest } from "@/lib/scheduling/trip";
import { haversineKm, formatKm } from "@/lib/utils/geo";
import { initials } from "@/lib/utils/format";
import { cn } from "@/lib/utils/cn";
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

/**
 * A Google Maps directions link.
 *
 * `origin` is only set when we hold a REAL live fix. Without one, omitting it
 * lets Maps start from the device's own position — which on a phone is right —
 * whereas passing the last position we happened to persist would actively
 * route the driver from somewhere they no longer are. A stale origin is worse
 * than no origin: it looks authoritative and is wrong.
 */
function directionsUrl(to: LatLng, from: LatLng | null): string {
  const params = new URLSearchParams({
    api: "1",
    destination: `${to.lat},${to.lng}`,
    travelmode: "driving",
  });
  if (from) params.set("origin", `${from.lat},${from.lng}`);
  return `https://www.google.com/maps/dir/?${params.toString()}`;
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
  const device = useDeviceLocation();
  const toast = useToast();
  const isHomeVisit = req.type === "home_visit";

  // Someone travelling to an address needs the device following them, not the
  // row they last wrote. Idempotent, so this shares the publisher's watch.
  useEffect(() => {
    if (side === "doctor" && isHomeVisit) startDeviceLocation();
  }, [side, isHomeVisit]);

  /**
   * Where "you" actually are. `self` is the persisted row — written at most
   * every 15s, and only while online — so it lags and can be a seeded position
   * entirely. The live fix wins whenever we have one; everything on this card
   * (the map, the distance, the ETA, the route origin) then agrees.
   */
  const liveFix: LatLng | null =
    device.status === "granted" && device.lat != null && device.lng != null
      ? { lat: device.lat, lng: device.lng }
      : null;
  const here = liveFix ? { ...liveFix, label: self.label } : self;

  const known = hasCoords(other);
  const km = known ? haversineKm(here, other as LatLng) : null;
  const { t } = useT();
  const L = labelsIn(t);
  const stage = tripStageOfRequest(req);
  const st = L.tripStage(stage);

  // Copy follows the stage, so the patient sees the journey rather than a
  // static "accepted" until it's over.
  const statusText =
    stage === "arrived"
      ? side === "patient"
        ? "At your door"
        : "You've arrived"
      : stage === "in_progress"
        ? "Consult under way"
        : side === "patient"
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
            {isGig(req) ? (
              <>
                <Briefcase className="h-3.5 w-3.5" />
                <span className="truncate">{req.gigTitle || "Gig"}</span>
              </>
            ) : (
              <>
                {typeIcon[req.type]} {L.consultType(req.type).label}
                {subtitle ? ` · ${subtitle}` : ""}
              </>
            )}
          </p>
        </div>
        <StatusPill tone={st.tone}>{st.label}</StatusPill>
      </div>

      {/* The rail — where the visit has got to. */}
      <TripRail req={req} />

      {/* The arrival handshake. The patient's four digits, the doctor's
          keypad — the step that turns "arrived" into "in consult". */}
      {awaitingStartCode(req) && (
        <div className="px-3 pt-3">
          {side === "patient" ? (
            <StartCodeForPatient req={req} />
          ) : (
            <StartCodeForDoctor req={req} />
          )}
        </div>
      )}

      {known ? (
        <div className="p-3">
          <TrackMap self={here} other={other as LatLng & { label?: string }} height={260} />
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

          {/* Detailed address + one-tap directions. The address is deliberately
              NOT truncated: this is the line someone reads to find a front
              door, and a clipped "5 Broadcast Ln…" is worse than useless. The
              coordinates sit under it as the ground truth for when the postal
              address is vague or wrong. */}
          <div className="mt-3 flex flex-wrap items-start justify-between gap-3 border-t border-[var(--border)] px-1 pt-3">
            <div className="min-w-0 flex-1">
              <div className="label">
                {side === "doctor" ? "Patient address" : "Doctor's location"}
              </div>
              <p className="mt-0.5 flex items-start gap-1.5 text-sm text-cream">
                <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0 text-tan" />
                <span className="break-words">
                  {side === "doctor"
                    ? req.address || "Shared live location"
                    : "Live location, shown on the map"}
                </span>
              </p>
              {side === "doctor" && (
                <button
                  type="button"
                  onClick={() => {
                    const line = [req.address, `${(other as LatLng).lat.toFixed(5)}, ${(other as LatLng).lng.toFixed(5)}`]
                      .filter(Boolean)
                      .join(" · ");
                    void navigator.clipboard?.writeText(line).then(
                      () => toast.push({ tone: "success", title: "Address copied" }),
                      () => {},
                    );
                  }}
                  className="mt-1 font-mono text-[11px] text-[var(--text-faint)] underline decoration-dotted underline-offset-2 transition-colors hover:text-[var(--text-muted)]"
                  title="Copy address and coordinates"
                >
                  {(other as LatLng).lat.toFixed(5)}, {(other as LatLng).lng.toFixed(5)}
                </button>
              )}
            </div>
            <a
              href={
                side === "doctor"
                  ? directionsUrl(other as LatLng, liveFix)
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

      {/* Only the doctor drives the visit forward. */}
      {side === "doctor" && <TripControls req={req} />}
    </Card>
  );
}

/**
 * The stage rail. Video consults have no journey, so their rail is shorter —
 * stagesFor() owns that, not the markup. Exported so the on-gig banner can
 * show the same journey without duplicating it.
 */
export function TripRail({ req }: { req: ConsultRequest }) {
  const rail = stagesFor(req.type);
  const { t } = useT();
  const L = labelsIn(t);
  const current = tripStageOfRequest(req);
  const at = current ? rail.indexOf(current) : -1;

  // Video and clinic visits have no journey — nothing to draw.
  if (rail.length < 2) return null;

  return (
    <div className="flex items-start gap-1 border-b border-[var(--border)] px-4 py-3">
      {rail.map((s, i) => {
        const done = i <= at;
        return (
          <div key={s} className="flex min-w-0 flex-1 flex-col items-center gap-1.5">
            <div className="flex w-full items-center">
              <span
                className={cn(
                  "h-0.5 flex-1",
                  i === 0 ? "opacity-0" : done ? "bg-terracotta" : "bg-[var(--border)]",
                )}
              />
              <span
                className={cn(
                  "grid h-4 w-4 shrink-0 place-items-center rounded-full transition-colors",
                  done ? "bg-terracotta text-on-accent" : "bg-[var(--border)]",
                )}
              >
                {done && <Check className="h-2.5 w-2.5" />}
              </span>
              <span
                className={cn(
                  "h-0.5 flex-1",
                  i === rail.length - 1
                    ? "opacity-0"
                    : i < at
                      ? "bg-terracotta"
                      : "bg-[var(--border)]",
                )}
              />
            </div>
            <span
              className={cn(
                "truncate text-[10px] font-medium",
                i === at ? "text-cream" : "text-[var(--text-faint)]",
              )}
            >
              {L.tripStage(s).label}
            </span>
          </div>
        );
      })}
    </div>
  );
}

/**
 * The doctor's controls, delivery-app style: ONE "On the way" tap for a home
 * visit, then arrival is detected from their live GPS position — no stage
 * buttons to babysit. Everything else is just "Mark complete" and Cancel.
 */
export function TripControls({ req }: { req: ConsultRequest }) {
  const { advanceTrip } = useActions();
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [prescribing, setPrescribing] = useState(false);

  const { t } = useT();
  const L = labelsIn(t);
  const stage = tripStageOfRequest(req);
  const startJourney = req.type === "home_visit" && stage === "accepted";
  const travelling = req.type === "home_visit" && stage === "enroute";

  const geo = useDeviceLocation();
  const locating = geo.status !== "granted" || geo.lat == null || geo.lng == null;

  /** One step along the rail (accepted → enroute, or enroute → arrived). */
  async function step(successTitle: string, successDesc: string) {
    setBusy(true);
    try {
      await advanceTrip(req.id);
      toast.push({ tone: "success", title: successTitle, desc: successDesc });
    } catch (e) {
      toast.push({
        tone: "error",
        title: t("trip.updateFailed"),
        desc: e instanceof Error ? e.message : t("common.retry"),
      });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-2 border-t border-[var(--border)] px-4 py-3">
      {startJourney ? (
        <Button
          size="sm"
          className="flex-1"
          disabled={busy}
          onClick={() => step(t("trip.onTheWayToast"), t("trip.onTheWayToastDesc"))}
        >
          {t("trip.onTheWay")} <ArrowRight className="h-3.5 w-3.5" />
        </Button>
      ) : travelling ? (
        /**
         * The manual arrival. GPS is still the primary path — it fires on its
         * own and this button disappears with it — but it cannot be the ONLY
         * path: indoors, on a denied permission, or on a desktop with no real
         * fix, the visit would otherwise sit at "on the way" forever with no
         * keypad and no way to finish. Completing is deliberately not offered
         * here, because the server refuses it until the code is entered, and
         * offering a button that always errors is worse than not offering one.
         */
        <Button
          size="sm"
          className="flex-1"
          disabled={busy}
          onClick={() => step(t("trip.arrivedToast"), t("trip.arrivedToastDesc"))}
        >
          <MapPin className="h-3.5 w-3.5" /> {t("trip.arrived")}
        </Button>
      ) : (
        /**
         * Finishing a consult IS writing the prescription, so this opens the
         * composer rather than closing the visit outright. Completing with
         * nothing prescribed is still one tap — it lives at the bottom of the
         * composer, where a doctor who has just decided "no medicine" is
         * already looking.
         */
        <Button size="sm" className="flex-1" onClick={() => setPrescribing(true)}>
          <Check className="h-3.5 w-3.5" /> {t("trip.finishConsult")}
        </Button>
      )}
      <Button size="sm" variant="ghost" onClick={() => setCancelling(true)}>
        <X className="h-3.5 w-3.5" /> {t("common.cancel")}
      </Button>
      {travelling &&
        (locating ? (
          // Both auto-arrival AND the Navigate route come from this fix, so a
          // blocked permission is worth saying out loud rather than silently
          // degrading to a wrong route.
          <div className="flex w-full flex-wrap items-center gap-2 rounded-lg border border-tan/30 bg-tan/10 px-3 py-2">
            <p className="min-w-0 flex-1 text-[11px] leading-relaxed text-tan">
              {geo.status === "denied" ? t("trip.geoBlocked") : t("trip.geoWaiting")}
            </p>
            <button
              type="button"
              onClick={() => void requestDeviceLocation()}
              className="shrink-0 rounded-lg border border-tan/40 px-2.5 py-1 text-[11px] font-medium text-tan transition-colors hover:bg-tan/10"
            >
              {t("common.retry")}
            </button>
          </div>
        ) : (
          <p className="w-full text-[11px] leading-relaxed text-[var(--text-faint)]">
            {t("trip.autoArrivalHint")}
          </p>
        ))}
      <CancelVisitDialog
        request={req}
        open={cancelling}
        onClose={() => setCancelling(false)}
      />
      {prescribing && (
        <PrescriptionComposer
          request={req}
          open
          onClose={() => setPrescribing(false)}
        />
      )}
    </div>
  );
}
