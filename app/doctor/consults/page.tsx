"use client";

import { PageHeader } from "@/components/layout/page-header";
import { Card } from "@/components/ui/card";
import { StatusPill } from "@/components/ui/status-pill";
import { EmptyState } from "@/components/ui/empty-state";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { useConsultRequests, useActions } from "@/lib/hooks/data";
import { useCurrentDoctor } from "@/lib/hooks/use-current-doctor";
import { consultStatus, consultType } from "@/lib/labels";
import { formatINR, timeAgo } from "@/lib/utils/format";
import { useMounted } from "@/lib/hooks/use-mounted";

export default function ConsultsPage() {
  const requests = useConsultRequests();
  const me = useCurrentDoctor();
  const actions = useActions();
  const toast = useToast();
  const mounted = useMounted();

  const mine = requests
    .filter(
      (r) =>
        r.doctorId === me?.id &&
        (r.status === "accepted" || r.status === "completed"),
    )
    .sort((a, b) => (a.status === "accepted" ? -1 : 1));

  return (
    <>
      <PageHeader kanji="診" label="ZUMI · CONSULTS" title="Your consults" />

      {mine.length === 0 ? (
        <EmptyState
          kanji="診"
          title="No consults yet"
          desc="Accept a request to start your first consult."
        />
      ) : (
        <Card>
          <div className="divide-y divide-[var(--border)]">
            {mine.map((r) => {
              const st = consultStatus[r.status];
              return (
                <div
                  key={r.id}
                  className="flex flex-wrap items-center gap-3 px-5 py-4"
                >
                  <div className="min-w-[140px] flex-1">
                    <p className="font-medium text-cream">{r.patientName}</p>
                    <p className="text-xs text-[var(--text-muted)]">
                      {consultType[r.type].label} · {r.symptoms}
                    </p>
                  </div>
                  <span className="font-mono text-xs text-[var(--text-faint)]">
                    {mounted ? timeAgo(r.createdAt) : ""}
                  </span>
                  <div className="metric text-lg text-cream">
                    {formatINR(r.fee)}
                  </div>
                  <StatusPill tone={st.tone}>{st.label}</StatusPill>
                  {r.status === "accepted" && (
                    <Button
                      size="sm"
                      variant="subtle"
                      onClick={() => {
                        actions.completeRequest(r.id);
                        toast.push({ tone: "success", title: "Consult completed" });
                      }}
                    >
                      Complete
                    </Button>
                  )}
                </div>
              );
            })}
          </div>
        </Card>
      )}
    </>
  );
}
