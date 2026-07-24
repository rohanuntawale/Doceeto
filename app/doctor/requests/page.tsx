"use client";

import { useState } from "react";
import { PageHeader } from "@/components/layout/page-header";
import { RequestCard } from "@/components/zumi/request-card";
import { EmptyState } from "@/components/ui/empty-state";
import { useToast } from "@/components/ui/toast";
import { useConsultRequests, useActions } from "@/lib/hooks/data";
import { useCurrentDoctor } from "@/lib/hooks/use-current-doctor";

export default function RequestsPage() {
  const requests = useConsultRequests();
  const actions = useActions();
  const me = useCurrentDoctor();
  const toast = useToast();
  // Requests this doctor passed on locally. Passing on a broadcast request
  // only hides it for this doctor, it stays open for everyone else.
  const [passed, setPassed] = useState<Set<string>>(new Set());

  // A doctor sees requests open to everyone nearby (doctorId null) and
  // requests a patient sent straight to them.
  const pending = requests.filter(
    (r) =>
      r.status === "pending" &&
      !passed.has(r.id) &&
      (r.doctorId === null || r.doctorId === me?.id),
  );
  const accepted = requests.filter(
    (r) => r.status === "accepted" && r.doctorId === me?.id,
  );
  // One active consult at a time: block new accepts while one is in progress.
  const hasActive = accepted.length > 0;

  return (
    <>
      <PageHeader kanji="頼" label="ZUMI · FREELANCE DOCTOR" title="Requests" />

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
                canAccept={!hasActive}
                note={
                  r.doctorId === me?.id ? "Chose you" : "Open to nearby doctors"
                }
                onAccept={async () => {
                  if (!me) return;
                  try {
                    await actions.acceptRequest(r.id, me.id);
                    toast.push({
                      tone: "success",
                      title: "Consult accepted",
                      desc: r.patientName,
                    });
                  } catch (e) {
                    toast.push({
                      tone: "error",
                      title: "Couldn't accept",
                      desc: e instanceof Error ? e.message : "Please try again.",
                    });
                  }
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
        <div className="label mb-3">ACCEPTED BY YOU · {accepted.length}</div>
        {accepted.length === 0 ? (
          <EmptyState
            kanji="診"
            title="Nothing in progress"
            desc="Accepted consults show up here until you complete them."
          />
        ) : (
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {accepted.map((r) => (
              <RequestCard
                key={r.id}
                request={r}
                onComplete={() => {
                  actions.completeRequest(r.id);
                  toast.push({ tone: "success", title: "Consult completed" });
                }}
              />
            ))}
          </div>
        )}
      </section>
    </>
  );
}
