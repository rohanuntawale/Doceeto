"use client";

import { useState } from "react";
import { PageHeader } from "@/components/layout/page-header";
import { RequestCard } from "@/components/zumi/request-card";
import { EmptyState } from "@/components/ui/empty-state";
import { useToast } from "@/components/ui/toast";
import { PrescriptionDialog } from "@/components/doctor/prescription-dialog";
import { useConsultRequests, useActions } from "@/lib/hooks/data";
import { useCurrentDoctor } from "@/lib/hooks/use-current-doctor";
import type { Acuity, ConsultRequest } from "@/lib/types/domain";

const ACUITY_RANK: Record<Acuity, number> = { emergency: 0, urgent: 1, routine: 2 };

export default function RequestsPage() {
  const requests = useConsultRequests();
  const actions = useActions();
  const me = useCurrentDoctor();
  const toast = useToast();
  // Requests this doctor passed on locally. Passing on a broadcast request
  // only hides it for this doctor, it stays open for everyone else.
  const [passed, setPassed] = useState<Set<string>>(new Set());
  const [rxFor, setRxFor] = useState<ConsultRequest | null>(null);

  // A doctor sees requests open to everyone nearby (doctorId null) and
  // requests a patient sent straight to them — most urgent first.
  const pending = requests
    .filter(
      (r) =>
        r.status === "pending" &&
        !passed.has(r.id) &&
        (r.doctorId === null || r.doctorId === me?.id),
    )
    .sort((a, b) => ACUITY_RANK[a.acuity] - ACUITY_RANK[b.acuity]);
  const verified = me?.verificationStatus === "verified";
  const active = requests.filter(
    (r) =>
      r.doctorId === me?.id &&
      (r.status === "accepted" || r.status === "enroute" || r.status === "arrived"),
  );

  return (
    <>
      <PageHeader kanji="頼" label="REQUESTS" title="Requests" />

      <section className="mb-8">
        <div className="label mb-3">OPEN · {pending.length}</div>
        {pending.length === 0 ? (
          <EmptyState
            kanji="頼"
            title="No open requests right now"
            desc="Make sure you're online. New requests from patients nearby will appear here."
          />
        ) : (
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {pending.map((r) => (
              <RequestCard
                key={r.id}
                request={r}
                note={
                  r.doctorId === me?.id ? "Chose you" : "Open to nearby doctors"
                }
                onAccept={() => {
                  if (!me) return;
                  if (!verified) {
                    toast.push({
                      tone: "error",
                      title: "Verification needed",
                      desc: "You can accept requests once our team verifies you.",
                    });
                    return;
                  }
                  actions.acceptRequest(r.id, me.id);
                  toast.push({
                    tone: "success",
                    title: "Consult accepted",
                    desc: r.patientName,
                  });
                }}
                onDecline={() => {
                  // Directed to me → decline it. Open broadcast → just
                  // hide it for me so others can still take it.
                  if (r.doctorId === me?.id) actions.declineRequest(r.id);
                  else setPassed((p) => new Set(p).add(r.id));
                }}
              />
            ))}
          </div>
        )}
      </section>

      <section>
        <div className="label mb-3">IN PROGRESS · {active.length}</div>
        {active.length === 0 ? (
          <EmptyState
            kanji="診"
            title="Nothing in progress"
            desc="Accepted visits show up here until you complete them."
          />
        ) : (
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {active.map((r) => (
              <RequestCard
                key={r.id}
                request={r}
                onStart={() => actions.startVisit(r.id)}
                onArrive={() => actions.arriveVisit(r.id)}
                onPrescribe={() => setRxFor(r)}
                onComplete={() => actions.completeRequest(r.id)}
              />
            ))}
          </div>
        )}
      </section>

      {rxFor && me && (
        <PrescriptionDialog request={rxFor} doctorId={me.id} onClose={() => setRxFor(null)} />
      )}
    </>
  );
}
