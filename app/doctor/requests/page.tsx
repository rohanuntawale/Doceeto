"use client";

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

  const pending = requests.filter((r) => r.status === "pending");
  const accepted = requests.filter(
    (r) => r.status === "accepted" && r.doctorId === me?.id,
  );

  return (
    <>
      <PageHeader kanji="頼" label="ZUMI · FREELANCE DOCTOR" title="Requests" />

      <section className="mb-8">
        <div className="label mb-3">OPEN · {pending.length}</div>
        {pending.length === 0 ? (
          <EmptyState kanji="頼" title="No open requests right now" />
        ) : (
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {pending.map((r) => (
              <RequestCard
                key={r.id}
                request={r}
                onAccept={() => {
                  if (!me) return;
                  actions.acceptRequest(r.id, me.id);
                  toast.push({
                    tone: "success",
                    title: "Consult accepted",
                    desc: r.patientName,
                  });
                }}
                onDecline={() => actions.declineRequest(r.id)}
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
