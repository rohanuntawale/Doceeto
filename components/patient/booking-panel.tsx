"use client";

/**
 * The patient's booking flow: how soon → when → what kind → how to pay.
 *
 * Slots come from useDoctorSchedule, which is fed by the same grid the
 * server validates against, so a slot shown here is a slot the write will
 * accept. A taken or expired slot is rendered struck-through rather than
 * hidden — "9:30 is gone" reads better than a gap.
 */
import { useEffect, useMemo, useState } from "react";
import {
  Video,
  Home,
  Building2,
  Zap,
  CalendarDays,
  Clock,
  Check,
} from "lucide-react";
import { useToast } from "@/components/ui/toast";
import { useActions } from "@/lib/hooks/data";
import { ensureLocated } from "@/lib/hooks/use-current-patient";
import { useMounted } from "@/lib/hooks/use-mounted";
import { useDoctorSchedule, type DoctorSchedule } from "@/lib/hooks/use-schedule";
import { formatINR } from "@/lib/utils/format";
import { formatSlotTime } from "@/lib/scheduling/time";
import { describeWindows } from "@/lib/scheduling/slots";
import { cn } from "@/lib/utils/cn";
import type { ConsultType, Doctor } from "@/lib/types/domain";

const MODES: { type: ConsultType; label: string; icon: React.ReactNode; help: string }[] = [
  { type: "video", label: "Video", icon: <Video className="h-4 w-4" />, help: "Talk from home" },
  { type: "clinic", label: "Clinic", icon: <Building2 className="h-4 w-4" />, help: "Visit the clinic" },
  { type: "home_visit", label: "Home", icon: <Home className="h-4 w-4" />, help: "Doctor comes to you" },
];

export function BookingPanel({
  doctor,
  patient,
  onBooked,
  schedule: given,
}: {
  doctor: Doctor;
  patient: {
    id: string;
    name: string;
    address: string;
    lat: number;
    lng: number;
    /** False until the device has reported a real fix — see ensureLocated. */
    located?: boolean;
  };
  onBooked: () => void;
  /** Pass the parent's schedule to avoid a second poll of /api/availability. */
  schedule?: DoctorSchedule;
}) {
  const toast = useToast();
  const mounted = useMounted();
  const { createRequest } = useActions();
  const own = useDoctorSchedule(given ? null : doctor.id);
  const schedule = given ?? own;

  const [when, setWhen] = useState<"emergency" | "scheduled">("scheduled");
  const [dayIndex, setDayIndex] = useState(0);
  const [slot, setSlot] = useState<string | null>(null);
  const [type, setType] = useState<ConsultType>("video");
  const [payMethod, setPayMethod] = useState<"online" | "cash">("online");
  const [busy, setBusy] = useState(false);

  const days = schedule.days;
  // Land the patient on the first day that actually has something free,
  // rather than on a fully-booked today.
  const firstOpen = useMemo(() => {
    const i = days.findIndex((d) => d.openCount > 0);
    return i < 0 ? 0 : i;
  }, [days]);

  useEffect(() => {
    setDayIndex(firstOpen);
  }, [firstOpen]);

  // A doctor who keeps no calendar can still be reached urgently — don't
  // strand the patient on a tab that can never be completed.
  useEffect(() => {
    if (schedule.loading) return;
    if (!schedule.takesAppointments && schedule.emergencyAvailable) setWhen("emergency");
  }, [schedule.loading, schedule.takesAppointments, schedule.emergencyAvailable]);

  // A slot claimed by someone else between polls must not stay selected.
  const day = days[dayIndex];
  useEffect(() => {
    if (!slot) return;
    const still = days.some((d) => d.slots.some((s) => s.start === slot && !s.taken && !s.past));
    if (!still) setSlot(null);
  }, [days, slot]);

  const fee = type === "home_visit" ? doctor.homeVisitFee : doctor.consultFee;
  const address =
    type === "home_visit"
      ? patient.address || "Your address"
      : type === "clinic"
        ? doctor.clinicAddress || "At the doctor's clinic"
        : "Video call";

  // While the doctor is on a gig nothing new can be booked, so both paths are
  // closed and the tiles say so rather than silently failing on submit.
  const firstName = doctor.fullName.replace("Dr. ", "").split(" ")[0];
  const onGigNote = `${firstName} is on a gig right now`;
  const canBook =
    when === "emergency" ? schedule.emergencyAvailable : schedule.appointmentsOpen && Boolean(slot);

  async function book() {
    if (!canBook || busy) return;

    // A home visit sends a clinician to a door. Until the device has reported
    // a fix, patient.lat/lng are the Nagpur map centre — see ensureLocated.
    const liveLocation = type === "home_visit" ? await ensureLocated(patient) : null;
    if (type === "home_visit" && !liveLocation) {
      toast.push({
        tone: "error",
        title: "We need your location",
        desc: "Allow location access so the doctor reaches the right address.",
      });
      return;
    }

    setBusy(true);
    try {
      await createRequest({
        patientId: patient.id,
        patientName: patient.name,
        type,
        symptoms: "General consultation.",
        paymentMethod: payMethod,
        fee,
        address,
        lat: liveLocation?.lat ?? patient.lat,
        lng: liveLocation?.lng ?? patient.lng,
        doctorId: doctor.id,
        mode: when,
        scheduledAt: when === "scheduled" ? slot : null,
      });
      toast.push({
        tone: "success",
        title:
          when === "emergency"
            ? `Request sent to ${doctor.fullName}`
            : `Appointment requested for ${formatSlotTime(slot!)}`,
        desc:
          when === "emergency"
            ? "You'll see it under your care the moment they accept."
            : "It's on their calendar — you'll be told once they confirm.",
      });
      onBooked();
    } catch (e) {
      // The server owns the truth about a slot; show exactly what it said.
      toast.push({
        tone: "error",
        title: "Couldn't book that",
        desc: e instanceof Error ? e.message : "Please try again.",
      });
      if (when === "scheduled") setSlot(null);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="rounded-card border border-terracotta/30 bg-espresso-800 p-5 shadow-card">
      <div className="label">Book a visit</div>

      {/* ── How soon ──────────────────────────────────── */}
      <div className="mt-3 grid grid-cols-2 gap-2">
        <WhenTile
          active={when === "scheduled"}
          disabled={!schedule.appointmentsOpen}
          onClick={() => setWhen("scheduled")}
          icon={<CalendarDays className="h-4 w-4" />}
          title="Book a slot"
          help={
            schedule.onGig && !schedule.appointmentsOpen
              ? onGigNote
              : schedule.takesAppointments
                ? describeWindows(schedule.availability)
                : "Not taking appointments yet"
          }
        />
        <WhenTile
          active={when === "emergency"}
          disabled={!schedule.emergencyAvailable}
          onClick={() => setWhen("emergency")}
          icon={<Zap className="h-4 w-4" />}
          title="See me now"
          help={
            schedule.emergencyAvailable
              ? "Goes straight through as urgent"
              : schedule.onGig
                ? onGigNote
                : schedule.onConsult
                  ? "With another patient right now"
                  : doctor.status === "online"
                    ? "Not taking urgent visits"
                    : `${firstName} is offline`
          }
        />
      </div>

      {/* ── When ──────────────────────────────────────── */}
      {when === "scheduled" && (
        <div className="mt-4">
          <div className="label mb-2">Pick a time</div>
          {/* The grid is relative to "now", so it is only ever painted on the
              client — an SSR pass would bake in a stale today. */}
          {!mounted || schedule.loading ? (
            <p className="rounded-lg border border-[var(--border)] bg-espresso px-3 py-6 text-center text-sm text-[var(--text-muted)]">
              Loading the calendar…
            </p>
          ) : days.length === 0 ? (
            <p className="rounded-lg border border-[var(--border)] bg-espresso px-3 py-6 text-center text-sm text-[var(--text-muted)]">
              {doctor.fullName} has no appointment hours set up yet.
            </p>
          ) : (
            <>
              {/* Day strip */}
              <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                {days.map((d, i) => (
                  <button
                    key={d.date}
                    type="button"
                    onClick={() => setDayIndex(i)}
                    className={cn(
                      "shrink-0 rounded-lg border px-3 py-2 text-left transition-colors",
                      i === dayIndex
                        ? "border-terracotta bg-terracotta/10"
                        : "border-[var(--border)] hover:border-terracotta/40",
                      d.openCount === 0 && "opacity-50",
                    )}
                  >
                    <span className="block text-xs font-medium text-cream">{d.label}</span>
                    <span className="block text-[10px] text-[var(--text-faint)]">
                      {d.openCount > 0 ? `${d.openCount} free` : "Full"}
                    </span>
                  </button>
                ))}
              </div>

              {/* Slots for the chosen day */}
              <div className="mt-2 grid grid-cols-3 gap-2 sm:grid-cols-4">
                {(day?.slots ?? []).map((s) => {
                  const gone = s.taken || s.past;
                  const picked = slot === s.start;
                  return (
                    <button
                      key={s.start}
                      type="button"
                      disabled={gone}
                      onClick={() => setSlot(s.start)}
                      title={s.taken ? "Already booked" : s.past ? "Too soon" : undefined}
                      className={cn(
                        "rounded-lg border px-2 py-2 text-center text-xs font-medium transition-colors",
                        picked
                          ? "border-terracotta bg-terracotta/15 text-cream"
                          : gone
                            ? "cursor-not-allowed border-[var(--border)] text-[var(--text-faint)] line-through"
                            : "border-[var(--border)] text-cream hover:border-terracotta/50 hover:bg-terracotta/10",
                      )}
                    >
                      {formatSlotTime(s.start)}
                    </button>
                  );
                })}
              </div>
              {day && day.openCount === 0 && (
                <p className="mt-2 text-center text-xs text-tan">
                  Every slot on {day.label.toLowerCase()} is taken — try another day.
                </p>
              )}
            </>
          )}
        </div>
      )}

      {when === "emergency" && (
        <p className="mt-3 flex items-start gap-2 rounded-lg bg-tan/10 p-3 text-xs text-tan">
          <Zap className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          Urgent requests go through immediately and are only shown to doctors
          who are free right now.
        </p>
      )}

      {/* ── Kind of visit ─────────────────────────────── */}
      <div className="mt-4">
        <div className="label mb-2">Visit type</div>
        {/* Stacks on the narrowest phones — three-up leaves ~60px per tile
            at 320px, too little for the price + helper line. */}
        <div className="grid grid-cols-1 gap-2 min-[380px]:grid-cols-3">
          {MODES.map((m) => {
            const active = type === m.type;
            return (
              <button
                key={m.type}
                type="button"
                onClick={() => setType(m.type)}
                className={cn(
                  "flex flex-col items-center gap-1 rounded-lg border px-2 py-3 text-center transition-colors",
                  active
                    ? "border-terracotta bg-terracotta/10"
                    : "border-[var(--border)] hover:border-terracotta/40",
                )}
              >
                <span className="text-salmon">{m.icon}</span>
                <span className="text-xs font-medium text-cream">{m.label}</span>
                <span className="text-sm font-semibold text-cream">
                  {formatINR(m.type === "home_visit" ? doctor.homeVisitFee : doctor.consultFee)}
                </span>
                <span className="text-[10px] text-[var(--text-faint)]">{m.help}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* ── Payment ───────────────────────────────────── */}
      <div className="mt-4">
        <div className="label mb-2">Payment</div>
        <div className="grid grid-cols-2 gap-2">
          {([
            { m: "online", label: "Pay online", help: "UPI / card, held safely" },
            { m: "cash", label: "Cash on visit", help: "Pay the doctor directly" },
          ] as const).map((p) => (
            <button
              key={p.m}
              type="button"
              onClick={() => setPayMethod(p.m)}
              className={cn(
                "rounded-lg border px-3 py-2.5 text-left transition-colors",
                payMethod === p.m
                  ? "border-terracotta bg-terracotta/10"
                  : "border-[var(--border)] hover:border-terracotta/40",
              )}
            >
              <span className="block text-sm font-medium text-cream">{p.label}</span>
              <span className="block text-xs text-[var(--text-faint)]">{p.help}</span>
            </button>
          ))}
        </div>
      </div>

      {/* ── Confirm ───────────────────────────────────── */}
      <div className="mt-4 rounded-lg border border-[var(--border)] bg-espresso p-3">
        <div className="flex items-center justify-between text-sm">
          <span className="flex items-center gap-1.5 text-[var(--text-muted)]">
            <Clock className="h-3.5 w-3.5" />
            {when === "emergency"
              ? "As soon as possible"
              : slot
                ? `${day?.label ?? ""} · ${formatSlotTime(slot)}`
                : "No time picked yet"}
          </span>
          <span className="font-semibold text-cream">{formatINR(fee)}</span>
        </div>
        <p className="mt-1 truncate text-xs text-[var(--text-faint)]">{address}</p>
      </div>

      <button
        type="button"
        onClick={book}
        disabled={!canBook || busy}
        className="mt-3 flex w-full items-center justify-center gap-2 rounded-lg bg-primary py-3 text-sm font-semibold text-on-accent transition-opacity disabled:cursor-not-allowed disabled:opacity-45"
      >
        {busy ? (
          "Sending…"
        ) : (
          <>
            <Check className="h-4 w-4" />
            {when === "emergency" ? "Request an urgent visit" : "Confirm appointment"}
          </>
        )}
      </button>

      <p className="mt-2 text-center text-[11px] text-[var(--text-faint)]">
        {payMethod === "online"
          ? "Paid online and held safely — released to the doctor after your visit."
          : "You'll pay the doctor directly at the visit."}
      </p>
    </div>
  );
}

function WhenTile({
  active,
  disabled,
  onClick,
  icon,
  title,
  help,
}: {
  active: boolean;
  disabled?: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  title: string;
  help: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "rounded-lg border px-3 py-2.5 text-left transition-colors",
        active && !disabled
          ? "border-terracotta bg-terracotta/10"
          : "border-[var(--border)] hover:border-terracotta/40",
        disabled && "cursor-not-allowed opacity-45 hover:border-[var(--border)]",
      )}
    >
      <span className="flex items-center gap-1.5 text-sm font-medium text-cream">
        <span className="text-salmon">{icon}</span>
        {title}
      </span>
      <span className="mt-0.5 block text-[11px] leading-tight text-[var(--text-faint)]">
        {help}
      </span>
    </button>
  );
}
