"use client";

import { Stethoscope, Pill } from "lucide-react";
import { StatusPill } from "@/components/ui/status-pill";
import { EmptyState } from "@/components/ui/empty-state";
import { RateDoctor } from "@/components/patient/rate-doctor";
import { consultStatus, consultType, orderStatus } from "@/lib/labels";
import { timeAgo } from "@/lib/utils/format";
import { useMounted } from "@/lib/hooks/use-mounted";
import { useConsultRequests, useOrders, useDoctors } from "@/lib/hooks/data";
import type { PatientIdentity } from "@/lib/hooks/use-current-patient";

/** The patient's own live care. Updates the instant a doctor or ops acts. */
export function CareStatus({ patient }: { patient: PatientIdentity }) {
  const mounted = useMounted();
  // A completed consult stays here only until the patient rates it — once
  // reviewed (persisted server-side), the doctor drops out of active care.
  const requests = useConsultRequests().filter(
    (r) => r.patientId === patient.id && !(r.status === "completed" && r.reviewed),
  );
  const orders = useOrders().filter((o) => o.patientId === patient.id);
  const doctors = useDoctors();

  const docName = (id: string | null) =>
    id ? doctors.find((d) => d.id === id)?.fullName ?? "a doctor" : null;

  const isEmpty = requests.length === 0 && orders.length === 0;

  if (isEmpty) {
    return (
      <EmptyState
        kanji="癒"
        title="No active care"
        desc="Book a doctor or order medicine. It shows up here and updates live."
      />
    );
  }

  return (
    <div className="space-y-3">
      {requests.map((r) => (
        <Row
          key={r.id}
          icon={<Stethoscope className="h-4 w-4" />}
          title={consultType[r.type].label}
          sub={
            r.status === "completed"
              ? `Consult with ${docName(r.doctorId)} completed`
              : r.doctorId
                ? `${docName(r.doctorId)} accepted your request`
                : "Waiting for a doctor to accept…"
          }
          time={mounted ? timeAgo(r.createdAt) : ""}
          pill={<StatusPill tone={consultStatus[r.status].tone}>{consultStatus[r.status].label}</StatusPill>}
          footer={
            r.status === "completed" && r.doctorId ? (
              <RateDoctor req={r} doctorName={docName(r.doctorId) ?? undefined} />
            ) : null
          }
        />
      ))}

      {orders.map((o) => (
        <Row
          key={o.id}
          icon={<Pill className="h-4 w-4" />}
          title={`AuraMed · ${o.items.length} item${o.items.length > 1 ? "s" : ""}`}
          sub={
            o.status === "delivered"
              ? "Delivered"
              : `${o.darkStore} · ETA ${o.etaMins}m`
          }
          time={mounted ? timeAgo(o.createdAt) : ""}
          pill={<StatusPill tone={orderStatus[o.status].tone}>{orderStatus[o.status].label}</StatusPill>}
        />
      ))}
    </div>
  );
}

function Row({
  icon,
  title,
  sub,
  time,
  pill,
  footer,
}: {
  icon: React.ReactNode;
  title: string;
  sub: string | null;
  time: string;
  pill: React.ReactNode;
  footer?: React.ReactNode;
}) {
  return (
    <div className="rounded-card border border-[var(--border)] bg-espresso-800 p-3.5 shadow-card">
      <div className="flex items-center gap-3">
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-white/5 text-salmon">
          {icon}
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium text-cream">{title}</p>
          {sub && <p className="truncate text-xs text-[var(--text-muted)]">{sub}</p>}
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1">
          {pill}
          <span className="font-mono text-[10px] text-[var(--text-faint)]">{time}</span>
        </div>
      </div>
      {footer}
    </div>
  );
}
