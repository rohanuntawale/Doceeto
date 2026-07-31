"use client";

import { useState } from "react";
import Link from "next/link";
import { Video, Home, Building2, ChevronRight, CalendarDays, Zap } from "lucide-react";
import { StatusPill } from "@/components/ui/status-pill";
import { RateDoctor } from "@/components/patient/rate-doctor";
import { useToast } from "@/components/ui/toast";
import { consultStatusOf, consultTypeOf } from "@/lib/labels";
import { formatINR, initials, timeAgo } from "@/lib/utils/format";
import { useMounted } from "@/lib/hooks/use-mounted";
import { useConsultRequests, useDoctors, useActions } from "@/lib/hooks/data";
import { isScheduled } from "@/lib/scheduling/slots";
import { formatSlotRange } from "@/lib/scheduling/time";
import { DoctorAvatar } from "@/components/ui/doctor-avatar";
import type { ConsultRequest, Doctor } from "@/lib/types/domain";

const typeIcon = {
  video: <Video className="h-3.5 w-3.5" />,
  home_visit: <Home className="h-3.5 w-3.5" />,
  clinic: <Building2 className="h-3.5 w-3.5" />,
};

/** The patient's booked doctors: current (pending/accepted) and past. */
export function PatientBookings({ patientId }: { patientId: string }) {
  const mounted = useMounted();
  const doctors = useDoctors();
  const mine = useConsultRequests().filter((r) => r.patientId === patientId);

  const current = mine.filter(
    (r) => r.status === "pending" || r.status === "accepted",
  );
  const previous = mine.filter(
    (r) => r.status === "completed" || r.status === "declined" || r.status === "cancelled",
  );
  // Soonest appointment first; urgent requests (no slot) stay on top.
  current.sort((a, b) => {
    const at = a.scheduledAt ? Date.parse(a.scheduledAt) : 0;
    const bt = b.scheduledAt ? Date.parse(b.scheduledAt) : 0;
    return at - bt;
  });

  if (mine.length === 0) return null;

  const doctorOf = (id: string | null) =>
    doctors.find((d) => d.id === id);

  return (
    <div className="space-y-5">
      {current.length > 0 && (
        <section>
          <div className="label mb-2.5">YOUR DOCTORS · CURRENT</div>
          <div className="space-y-2.5">
            {current.map((r) => (
              <BookingRow key={r.id} req={r} doctor={doctorOf(r.doctorId)} mounted={mounted} />
            ))}
          </div>
        </section>
      )}

      {previous.length > 0 && (
        <section>
          <div className="label mb-2.5">PREVIOUSLY BOOKED</div>
          <div className="space-y-2.5">
            {previous.map((r) => (
              <BookingRow
                key={r.id}
                req={r}
                doctor={doctorOf(r.doctorId)}
                mounted={mounted}
                past
              />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

function BookingRow({
  req,
  doctor,
  mounted,
  past = false,
}: {
  req: ConsultRequest;
  doctor?: Doctor;
  mounted: boolean;
  past?: boolean;
}) {
  const toast = useToast();
  const { cancelRequest } = useActions();
  const [cancelling, setCancelling] = useState(false);
  const st = consultStatusOf(req.status);
  const name = doctor?.fullName ?? "Doceeto doctor";
  const waiting = req.status === "pending";
  const canRate = req.status === "completed" && !!req.doctorId && !req.reviewed;
  const booked = isScheduled(req);
  const canCancel = !past && (req.status === "pending" || req.status === "accepted");

  async function cancel() {
    setCancelling(true);
    try {
      await cancelRequest(req.id);
      toast.push({
        tone: "success",
        title: "Booking cancelled",
        desc: booked ? "The slot is free again." : undefined,
      });
    } catch (e) {
      toast.push({
        tone: "error",
        title: "Couldn't cancel",
        desc: e instanceof Error ? e.message : "Please try again.",
      });
    } finally {
      setCancelling(false);
    }
  }

  const head = (
    <>
      <DoctorAvatar
        doctor={doctor ?? { fullName: name }}
        className="h-10 w-10 rounded-lg text-xs font-medium text-cream"
      />
      <div className="min-w-0 flex-1">
        <p className="flex items-center gap-1 truncate text-sm font-medium text-cream group-hover:text-salmon">
          {name}
          {doctor && (
            <ChevronRight className="h-3.5 w-3.5 shrink-0 text-[var(--text-faint)] transition-transform group-hover:translate-x-0.5 group-hover:text-terracotta" />
          )}
        </p>
        <p className="flex items-center gap-1.5 text-xs text-[var(--text-muted)]">
          {typeIcon[req.type]}
          {consultTypeOf(req.type).label}
          {doctor?.specialty ? ` · ${doctor.specialty}` : ""}
        </p>
        {/* When it is — the detail the patient actually came back for. */}
        <p
          className={`mt-0.5 flex items-center gap-1 text-xs ${booked ? "text-salmon" : "text-tan"}`}
        >
          {booked ? (
            <>
              <CalendarDays className="h-3 w-3 shrink-0" />
              {mounted && req.scheduledAt
                ? formatSlotRange(req.scheduledAt, req.scheduledEnd)
                : "Booked slot"}
            </>
          ) : (
            <>
              <Zap className="h-3 w-3 shrink-0" /> Urgent · as soon as possible
            </>
          )}
        </p>
        {waiting && (
          <p className="mt-0.5 text-xs text-[var(--text-faint)]">
            {booked ? "Waiting for the doctor to confirm…" : "Awaiting confirmation…"}
          </p>
        )}
      </div>
      <div className="flex shrink-0 flex-col items-end gap-1">
        <StatusPill tone={st.tone}>{st.label}</StatusPill>
        <span className="font-mono text-[10px] text-[var(--text-faint)]">
          {formatINR(req.fee)} · {mounted ? timeAgo(req.createdAt) : ""}
        </span>
      </div>
    </>
  );

  return (
    <div
      className={`rounded-card border border-[var(--border)] bg-espresso-800 p-3.5 shadow-card transition-colors ${past ? "opacity-80" : ""} ${doctor ? "hover:border-terracotta/40" : ""}`}
    >
      {doctor ? (
        <Link
          href={`/patient/doctors/${doctor.id}`}
          aria-label={`View ${name}'s profile`}
          className="group flex items-center gap-3"
        >
          {head}
        </Link>
      ) : (
        <div className="flex items-center gap-3">{head}</div>
      )}

      {canCancel && (
        <div className="mt-2.5 flex justify-end border-t border-[var(--border)] pt-2.5">
          <button
            type="button"
            onClick={cancel}
            disabled={cancelling}
            className="text-xs font-medium text-[var(--text-muted)] transition-colors hover:text-status-critical disabled:opacity-50"
          >
            {cancelling ? "Cancelling…" : "Cancel booking"}
          </button>
        </div>
      )}

      {canRate && <RateDoctor req={req} doctorName={doctor?.fullName} />}
    </div>
  );
}
