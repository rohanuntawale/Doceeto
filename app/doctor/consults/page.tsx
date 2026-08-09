"use client";

import { useState } from "react";
import Link from "next/link";
import { FileText } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { PrescriptionComposer } from "@/components/prescription/prescription-composer";
import { Card } from "@/components/ui/card";
import { StatusPill } from "@/components/ui/status-pill";
import { EmptyState } from "@/components/ui/empty-state";
import { Button } from "@/components/ui/button";
import { StarInput } from "@/components/ui/star-rating";
import { useToast } from "@/components/ui/toast";
import { useConsultRequests, useActions, usePrescriptions } from "@/lib/hooks/data";
import { useCurrentDoctor } from "@/lib/hooks/use-current-doctor";
import { consultStatusOf, consultTypeOf } from "@/lib/labels";
import { formatINR, timeAgo } from "@/lib/utils/format";
import { useMounted } from "@/lib/hooks/use-mounted";
import { isScheduled } from "@/lib/scheduling/slots";
import { formatSlotRange } from "@/lib/scheduling/time";

export default function ConsultsPage() {
  const requests = useConsultRequests();
  const me = useCurrentDoctor();
  const actions = useActions();
  const toast = useToast();
  const mounted = useMounted();
  const prescriptions = usePrescriptions();
  const [prescribingFor, setPrescribingFor] = useState<string | null>(null);

  /** The prescription issued for a consult, if there is one. */
  const rxFor = (requestId: string) =>
    prescriptions.find((rx) => rx.requestId === requestId);

  const mine = requests
    .filter(
      (r) =>
        r.doctorId === me?.id &&
        (r.status === "accepted" || r.status === "completed"),
    )
    .sort((a, b) => (a.status === "accepted" ? -1 : 1));

  return (
    <>
      <PageHeader label="DOCEETO · CONSULTS" title="Your consults" />

      {mine.length === 0 ? (
        <EmptyState
          title="No consults yet"
          desc="Accept a request to start your first consult."
          action={
            <Link
              href="/doctor/requests"
              className="rounded-full bg-terracotta px-4 py-2 text-sm font-semibold text-on-accent"
            >
              Open requests
            </Link>
          }
        />
      ) : (
        <Card>
          <div className="divide-y divide-[var(--border)]">
            {mine.map((r) => {
              const st = consultStatusOf(r.status);
              return (
                <div
                  key={r.id}
                  className="flex flex-wrap items-center gap-3 px-5 py-4"
                >
                  <div className="min-w-[140px] flex-1">
                    <p className="truncate font-medium text-cream">{r.patientName}</p>
                    <p className="line-clamp-2 text-xs text-[var(--text-muted)]">
                      {consultTypeOf(r.type).label} · {r.symptoms}
                    </p>
                  </div>
                  {/* A booked visit is dated by its slot — "2h ago" would be
                      the moment it was requested, not when it happens. */}
                  <span className="text-xs text-[var(--text-faint)]">
                    {!mounted
                      ? ""
                      : isScheduled(r) && r.scheduledAt
                        ? formatSlotRange(r.scheduledAt, r.scheduledEnd)
                        : timeAgo(r.createdAt)}
                  </span>
                  <div className="metric text-lg text-cream">
                    {formatINR(r.fee)}
                  </div>
                  <StatusPill tone={st.tone}>{st.label}</StatusPill>
                  {r.status === "accepted" && (
                    <Button size="sm" variant="subtle" onClick={() => setPrescribingFor(r.id)}>
                      Finish consult
                    </Button>
                  )}
                  {/* A prescription is part of the record of a consult, so it
                      belongs on the consult row. Issuing after the fact is
                      allowed — a doctor who closed the visit and then
                      remembered the antibiotic should not have to reopen
                      anything to send it. */}
                  {r.status === "completed" && (
                    <div className="flex w-full justify-end sm:w-auto">
                      {rxFor(r.id) ? (
                        <span className="inline-flex items-center gap-1.5 rounded-full border border-[var(--border)] px-2.5 py-1 font-mono text-[10px] tracking-wider text-[var(--text-muted)]">
                          <FileText className="h-3 w-3 text-status-ok" />
                          {rxFor(r.id)!.code}
                        </span>
                      ) : (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => setPrescribingFor(r.id)}
                        >
                          <FileText className="h-3.5 w-3.5" /> Write prescription
                        </Button>
                      )}
                    </div>
                  )}
                  {r.status === "completed" && (
                    <div className="flex w-full items-center justify-end gap-2 sm:w-auto">
                      {r.patientRated ? (
                        <span className="inline-flex items-center gap-1 text-xs text-[var(--text-muted)]">
                          <span className="text-tan">✓</span> You rated this patient
                        </span>
                      ) : (
                        <>
                          <span className="text-xs text-[var(--text-muted)]">Rate patient</span>
                          <StarInput
                            onRate={async (rating) => {
                              try {
                                await actions.ratePatient({ requestId: r.id, rating });
                                toast.push({ tone: "success", title: "Patient rated" });
                              } catch (e) {
                                toast.push({
                                  tone: "error",
                                  title: "Couldn't submit rating",
                                  desc: e instanceof Error ? e.message : "Please try again.",
                                });
                              }
                            }}
                          />
                        </>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </Card>
      )}

      {prescribingFor && (
        <PrescriptionComposer
          request={mine.find((r) => r.id === prescribingFor)!}
          open
          onClose={() => setPrescribingFor(null)}
        />
      )}
    </>
  );
}
