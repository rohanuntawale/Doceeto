"use client";

import { Video, Home, Building2 } from "lucide-react";
import { StatusPill } from "@/components/ui/status-pill";
import { consultStatus, consultType } from "@/lib/labels";
import { formatINR, initials, timeAgo } from "@/lib/utils/format";
import { useMounted } from "@/lib/hooks/use-mounted";
import { useConsultRequests, useDoctors } from "@/lib/hooks/data";
import type { ConsultRequest, Doctor } from "@/lib/types/domain";

const typeIcon = {
  video: <Video className="h-3.5 w-3.5" />,
  home_visit: <Home className="h-3.5 w-3.5" />,
  clinic: <Building2 className="h-3.5 w-3.5" />,
};

/** The patient's booked doctors — current (pending/accepted) and past. */
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
              <BookingRow key={r.id} req={r} doctor={doctorOf(r.doctorId)} mounted={mounted} past />
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
  const st = consultStatus[req.status];
  const name = doctor?.fullName ?? "Iyashi doctor";
  const waiting = req.status === "pending";

  return (
    <div
      className={`flex items-center gap-3 rounded-card border border-[var(--border)] bg-espresso-800 p-3.5 shadow-card ${past ? "opacity-80" : ""}`}
    >
      <span
        className="grid h-10 w-10 shrink-0 place-items-center rounded-lg text-xs font-medium text-cream"
        style={{ background: doctor?.avatarColor ?? "#6B615A" }}
      >
        {initials(name.replace("Dr. ", ""))}
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-cream">{name}</p>
        <p className="flex items-center gap-1.5 text-xs text-[var(--text-muted)]">
          {typeIcon[req.type]}
          {consultType[req.type].label}
          {doctor?.specialty ? ` · ${doctor.specialty}` : ""}
        </p>
        {waiting && (
          <p className="mt-0.5 text-xs text-tan">Awaiting confirmation…</p>
        )}
      </div>
      <div className="flex shrink-0 flex-col items-end gap-1">
        <StatusPill tone={st.tone}>{st.label}</StatusPill>
        <span className="font-mono text-[10px] text-[var(--text-faint)]">
          {formatINR(req.fee)} · {mounted ? timeAgo(req.createdAt) : ""}
        </span>
      </div>
    </div>
  );
}
