"use client";

import Link from "next/link";
import { Stethoscope, Pill, ChevronRight, Briefcase } from "lucide-react";
import { StatusPill } from "@/components/ui/status-pill";
import { EmptyState } from "@/components/ui/empty-state";
import { RateDoctor } from "@/components/patient/rate-doctor";
import { consultStatusOf, consultTypeOf, orderStatusOf, tripStageOf } from "@/lib/labels";
import { isGig } from "@/lib/scheduling/slots";
import { tripStageOfRequest } from "@/lib/scheduling/trip";
import { timeAgo } from "@/lib/utils/format";
import { useMounted } from "@/lib/hooks/use-mounted";
import { useConsultRequests, useOrders, useDoctors } from "@/lib/hooks/data";
import type { PatientIdentity } from "@/lib/hooks/use-current-patient";

/**
 * The patient's own live care. Updates the instant a doctor or ops acts.
 * On the dashboard we only show the top few rows so the page stays short —
 * `limit` caps the list and the rest is summarised by a link to the full view.
 */
export function CareStatus({
  patient,
  limit,
  moreHref = "/patient/care",
}: {
  patient: PatientIdentity;
  limit?: number;
  moreHref?: string;
}) {
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
        action={
          <div className="flex flex-wrap justify-center gap-2">
            <Link
              href="/patient/doctors"
              className="flex items-center gap-1.5 rounded-full bg-terracotta px-4 py-2 text-sm font-semibold text-on-accent"
            >
              <Stethoscope className="h-4 w-4" /> Find a doctor
            </Link>
            <Link
              href="/patient/medicine"
              className="flex items-center gap-1.5 rounded-full border border-[var(--border)] px-4 py-2 text-sm font-medium text-cream"
            >
              <Pill className="h-4 w-4" /> Order medicine
            </Link>
          </div>
        }
      />
    );
  }

  // One merged feed: still-running care first, then most recent — so a capped
  // list always surfaces what the patient actually needs to act on.
  const items = [
    ...requests.map((r) => ({
      key: r.id,
      done: r.status === "completed",
      createdAt: r.createdAt,
      node: (
        <Row
          key={r.id}
          icon={
            isGig(r) ? <Briefcase className="h-4 w-4" /> : <Stethoscope className="h-4 w-4" />
          }
          title={isGig(r) && r.gigTitle ? r.gigTitle : consultTypeOf(r.type).label}
          sub={
            // A doctor who cancels owes an explanation, so it leads here.
            r.status === "cancelled" && r.cancelledBy === "doctor"
              ? `Cancelled by ${docName(r.doctorId) ?? "the doctor"}${r.cancelReason ? ` — ${r.cancelReason}` : ""}`
              : r.status === "completed"
                ? `Consult with ${docName(r.doctorId)} completed`
                : r.doctorId
                  ? // Once accepted, the stage is more useful than "accepted".
                    `${docName(r.doctorId)} · ${tripStageOf(tripStageOfRequest(r)).label.toLowerCase()}`
                  : r.broadcast
                    ? "Finding you a doctor nearby…"
                    : "Waiting for a doctor to accept…"
          }
          time={mounted ? timeAgo(r.createdAt) : ""}
          pill={<StatusPill tone={consultStatusOf(r.status).tone}>{consultStatusOf(r.status).label}</StatusPill>}
          footer={
            r.status === "completed" && r.doctorId ? (
              <RateDoctor req={r} doctorName={docName(r.doctorId) ?? undefined} />
            ) : null
          }
        />
      ),
    })),
    ...orders.map((o) => ({
      key: o.id,
      done: o.status === "delivered",
      createdAt: o.createdAt,
      node: (
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
          pill={<StatusPill tone={orderStatusOf(o.status).tone}>{orderStatusOf(o.status).label}</StatusPill>}
        />
      ),
    })),
  ].sort((a, b) =>
    a.done !== b.done
      ? Number(a.done) - Number(b.done)
      : new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  );

  const shown = limit ? items.slice(0, limit) : items;
  const hidden = items.length - shown.length;

  return (
    <div className="space-y-3">
      {shown.map((i) => i.node)}

      {hidden > 0 && (
        <Link
          href={moreHref}
          className="flex items-center justify-center gap-1 rounded-card border border-[var(--border)] py-2.5 text-xs font-medium text-[var(--text-muted)] transition-colors hover:text-cream"
        >
          {hidden} more {hidden === 1 ? "item" : "items"} in your care
          <ChevronRight className="h-3.5 w-3.5" />
        </Link>
      )}
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
