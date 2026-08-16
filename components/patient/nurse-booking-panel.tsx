"use client";

import { useEffect, useMemo, useState } from "react";
import { CalendarDays, Check, ChevronDown, Clock, Home, Zap } from "lucide-react";
import { GigList } from "@/components/patient/gig-list";
import { useToast } from "@/components/ui/toast";
import { StatusPill } from "@/components/ui/status-pill";
import { useActions, useGigs } from "@/lib/hooks/data";
import { ensureLocated } from "@/lib/hooks/use-current-patient";
import { useMounted } from "@/lib/hooks/use-mounted";
import { useDoctorSchedule } from "@/lib/hooks/use-schedule";
import { activeGigs } from "@/lib/gigs/rules";
import { NURSE_ACCENT_VARS, NURSE_SERVICES, skillsOf } from "@/lib/nurse";
import { formatINR } from "@/lib/utils/format";
import { formatSlotTime } from "@/lib/scheduling/time";
import { cn } from "@/lib/utils/cn";
import type { Doctor } from "@/lib/types/domain";

export function NurseBookingPanel({
  nurse,
  patient,
  onBooked,
}: {
  nurse: Doctor;
  patient: { id: string; name: string; address: string; addressFull?: string; lat: number; lng: number };
  onBooked: () => void;
}) {
  const toast = useToast();
  const mounted = useMounted();
  const { createRequest } = useActions();
  const schedule = useDoctorSchedule(nurse.id);
  const services = skillsOf(nurse);
  const [service, setService] = useState(services[0] ?? null);
  const [mode, setMode] = useState<"scheduled" | "emergency">("scheduled");
  const [dayIndex, setDayIndex] = useState(0);
  const [slot, setSlot] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const firstOpen = useMemo(
    () => Math.max(0, schedule.days.findIndex((day) => day.openCount > 0)),
    [schedule.days],
  );

  useEffect(() => setDayIndex(firstOpen), [firstOpen]);
  useEffect(() => {
    if (mode === "scheduled" && !schedule.appointmentsOpen && schedule.emergencyAvailable) {
      setMode("emergency");
    }
  }, [mode, schedule.appointmentsOpen, schedule.emergencyAvailable]);

  const day = schedule.days[dayIndex];
  const selectedLabel = service
    ? NURSE_SERVICES.find((item) => item.id === service)?.label ?? "Home nursing visit"
    : "Home nursing visit";
  const address = patient.addressFull || patient.address || "Your saved home address";
  const canBook = mode === "emergency"
    ? schedule.emergencyAvailable
    : schedule.appointmentsOpen && Boolean(slot);

  async function book() {
    if (!canBook || busy) return;
    const liveLocation = await ensureLocated(patient);
    if (!liveLocation) {
      toast.push({
        tone: "error",
        title: "We need your location",
        desc: "Allow location access so the nurse reaches the right address.",
      });
      return;
    }
    setBusy(true);
    try {
      await createRequest({
        patientId: patient.id,
        patientName: patient.name,
        type: "home_visit",
        mode,
        scheduledAt: mode === "scheduled" ? slot : null,
        targetCadre: "nurse",
        doctorId: nurse.id,
        symptoms: selectedLabel,
        fee: nurse.homeVisitFee,
        address,
        lat: liveLocation.lat,
        lng: liveLocation.lng,
      });
      toast.push({
        tone: "success",
        title: mode === "scheduled" ? "Nurse visit requested" : "Urgent nurse request sent",
        desc: mode === "scheduled" ? "The nurse will confirm your selected time." : "The nurse will respond shortly.",
      });
      onBooked();
    } catch (error) {
      toast.push({
        tone: "error",
        title: "Could not book the nurse",
        desc: error instanceof Error ? error.message : "Please try another time.",
      });
      if (mode === "scheduled") setSlot(null);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mt-5 rounded-2xl border border-[#2F7BC4]/35 bg-[#2F7BC4]/[0.06] p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-cream">Plan care with {nurse.fullName}</p>
          <p className="mt-1 text-xs text-[var(--text-muted)]">Choose a service and a time that works for you.</p>
        </div>
        <span className="flex shrink-0 items-center gap-1 text-sm font-semibold text-[#8CC1E8]">
          <Home className="h-4 w-4" /> {formatINR(nurse.homeVisitFee)}
        </span>
      </div>

      <div className="mt-4 flex gap-2">
        <ModeButton active={mode === "scheduled"} disabled={!schedule.appointmentsOpen} onClick={() => setMode("scheduled")} icon={<CalendarDays className="h-4 w-4" />} label="Choose a time" />
        <ModeButton active={mode === "emergency"} disabled={!schedule.emergencyAvailable} onClick={() => setMode("emergency")} icon={<Zap className="h-4 w-4" />} label="Request now" />
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        {services.map((id) => {
          const item = NURSE_SERVICES.find((serviceItem) => serviceItem.id === id);
          return <button key={id} type="button" onClick={() => setService(id)} className={cn("rounded-full border px-3 py-1.5 text-xs", service === id ? "border-[#2F7BC4] bg-[#2F7BC4]/20 text-cream" : "border-[var(--border)] text-[var(--text-muted)]")}>{item?.short ?? id}</button>;
        })}
      </div>

      {mode === "scheduled" ? (
        <div className="mt-4">
          {!mounted || schedule.loading ? (
            <p className="rounded-xl border border-[var(--border)] px-3 py-5 text-center text-xs text-[var(--text-muted)]">Loading available times…</p>
          ) : schedule.days.length === 0 ? (
            <p className="rounded-xl border border-[var(--border)] px-3 py-5 text-center text-xs text-[var(--text-muted)]">This nurse has no calendar hours yet.</p>
          ) : (
            <>
              <div className="flex gap-2 overflow-x-auto pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                {schedule.days.map((item, index) => <button key={item.date} type="button" onClick={() => setDayIndex(index)} className={cn("shrink-0 rounded-xl border px-3 py-2 text-left", index === dayIndex ? "border-[#2F7BC4] bg-[#2F7BC4]/15" : "border-[var(--border)]", item.openCount === 0 && "opacity-45")}><span className="block text-xs font-medium text-cream">{item.label}</span><span className="block text-[10px] text-[var(--text-faint)]">{item.openCount ? `${item.openCount} free` : "Full"}</span></button>)}
              </div>
              <div className="mt-2 grid grid-cols-3 gap-2 sm:grid-cols-4">
                {(day?.slots ?? []).map((item) => { const unavailable = item.taken || item.past; return <button key={item.start} type="button" disabled={unavailable} onClick={() => setSlot(item.start)} className={cn("rounded-xl border px-2 py-2 text-xs", slot === item.start ? "border-[#2F7BC4] bg-[#2F7BC4]/20 text-cream" : unavailable ? "border-[var(--border)] text-[var(--text-faint)] line-through" : "border-[var(--border)] text-cream hover:border-[#2F7BC4]/60")}>{formatSlotTime(item.start)}</button>; })}
              </div>
            </>
          )}
        </div>
      ) : (
        <p className="mt-4 rounded-xl bg-tan/10 p-3 text-xs text-tan">Urgent requests are shown to nurses who are free now.</p>
      )}

      <div className="mt-4 flex items-center justify-between gap-3 rounded-xl border border-[var(--border)] bg-espresso px-3 py-2.5 text-xs">
        <span className="flex min-w-0 items-center gap-1.5 truncate text-[var(--text-muted)]"><Clock className="h-3.5 w-3.5 shrink-0" />{mode === "scheduled" ? slot ? `${day?.label} · ${formatSlotTime(slot)}` : "Choose a time" : "As soon as possible"}</span>
        <span className="shrink-0 font-semibold text-cream">{formatINR(nurse.homeVisitFee)}</span>
      </div>
      <p className="mt-2 truncate text-[11px] text-[var(--text-faint)]">{address}</p>
      <button type="button" onClick={book} disabled={!canBook || busy} className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl bg-[#2F7BC4] py-2.5 text-sm font-semibold text-white disabled:opacity-45"><Check className="h-4 w-4" />{busy ? "Sending…" : mode === "scheduled" ? "Confirm nurse visit" : "Send urgent request"}</button>
    </div>
  );
}

/**
 * How a patient engages a nurse — the exact shape of the doctor profile page:
 * GIGS LEAD when the nurse publishes any (hiring a named package is the
 * primary way to engage them), the appointment picker sits demoted behind a
 * disclosure, and it takes over entirely when there are no gigs. Everything
 * renders under the nurse-blue accent vars, so the shared GigList recolours
 * without a fork.
 */
export function NurseEngagePanel({
  nurse,
  patient,
  onDone,
}: {
  nurse: Doctor;
  patient: { id: string; name: string; address: string; addressFull?: string; lat: number; lng: number };
  onDone: () => void;
}) {
  const gigs = useGigs(nurse.id);
  const schedule = useDoctorSchedule(nurse.id);
  const [showBooking, setShowBooking] = useState(false);
  const live = activeGigs(gigs);
  const firstName = nurse.fullName.replace(/^Dr\.\s*/i, "").split(" ")[0] || "This nurse";

  if (live.length === 0) {
    return <NurseBookingPanel nurse={nurse} patient={patient} onBooked={onDone} />;
  }

  return (
    <div style={NURSE_ACCENT_VARS} className="mt-5 space-y-3">
      <div className="rounded-2xl border border-terracotta/30 bg-terracotta/[0.06] p-4">
        <div className="flex items-center justify-between">
          <div className="label">What {firstName} offers</div>
          {schedule.onGig && <StatusPill tone="warn">On a visit</StatusPill>}
        </div>
        <p className="mb-3 mt-1 text-xs text-[var(--text-faint)]">
          {schedule.onGig
            ? `${firstName} is finishing another visit, you can hire once they're free.`
            : "Pick a care package and hire them directly."}
        </p>
        <GigList
          doctor={nurse}
          gigs={live}
          patient={patient}
          hireable={schedule.gigsHireable}
          lockedReason={
            schedule.onGig
              ? `${firstName} is on a visit right now. Try again once they're free.`
              : `${firstName} is with another patient right now.`
          }
          onHired={onDone}
        />
      </div>

      {/* Appointments, demoted but not hidden, same disclosure as doctors. */}
      <button
        type="button"
        onClick={() => setShowBooking((v) => !v)}
        className="flex w-full items-center justify-between rounded-2xl border border-[var(--border)] bg-espresso-800 px-4 py-3 text-left transition-colors hover:border-terracotta/40"
      >
        <span className="flex items-center gap-2.5">
          <CalendarDays className="h-4 w-4 text-salmon" />
          <span className="text-sm font-medium text-cream">Or book a time slot instead</span>
        </span>
        <ChevronDown
          className={cn(
            "h-4 w-4 text-[var(--text-faint)] transition-transform",
            showBooking && "rotate-180",
          )}
        />
      </button>
      {showBooking && (
        <NurseBookingPanel nurse={nurse} patient={patient} onBooked={onDone} />
      )}
    </div>
  );
}

function ModeButton({ active, disabled, onClick, icon, label }: { active: boolean; disabled: boolean; onClick: () => void; icon: React.ReactNode; label: string }) {
  return <button type="button" disabled={disabled} onClick={onClick} className={cn("flex flex-1 items-center justify-center gap-1.5 rounded-xl border px-3 py-2.5 text-xs font-medium", active && !disabled ? "border-[#2F7BC4] bg-[#2F7BC4]/15 text-cream" : "border-[var(--border)] text-[var(--text-muted)]", disabled && "cursor-not-allowed opacity-40")}>{icon}{label}</button>;
}
