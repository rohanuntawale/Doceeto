"use client";

import { Wallet, CheckCircle2, Clock3 } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { StatCard } from "@/components/ui/stat-card";
import { Card, CardHeader } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { useConsultRequests } from "@/lib/hooks/data";
import { useCurrentDoctor } from "@/lib/hooks/use-current-doctor";
import { formatINR, formatINRCompact, timeAgo } from "@/lib/utils/format";
import { consultType } from "@/lib/labels";
import { useMounted } from "@/lib/hooks/use-mounted";

export default function EarningsPage() {
  const requests = useConsultRequests();
  const me = useCurrentDoctor();
  const mounted = useMounted();

  const completed = requests.filter(
    (r) => r.status === "completed" && r.doctorId === me?.id,
  );
  const accepted = requests.filter(
    (r) => r.status === "accepted" && r.doctorId === me?.id,
  );

  const settled = completed.reduce((a, r) => a + r.fee, 0);
  const pending = accepted.reduce((a, r) => a + r.fee, 0);
  // Iyashi take rate on Zumi is a transparent commission (deck: business model).
  const TAKE = 0.15;
  const net = Math.round(settled * (1 - TAKE));

  return (
    <>
      <PageHeader kanji="円" label="ZUMI · TAKE RATE" title="Earnings" />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard value={formatINRCompact(net)} label="Net payout" accent icon={<Wallet className="h-4 w-4" />} />
        <StatCard value={formatINRCompact(settled)} label="Gross settled" icon={<CheckCircle2 className="h-4 w-4" />} />
        <StatCard value={formatINRCompact(pending)} label="In progress" icon={<Clock3 className="h-4 w-4" />} />
        <StatCard value={`${Math.round(TAKE * 100)}%`} label="Platform fee" />
      </div>

      <Card className="mt-5">
        <CardHeader label="LEDGER" title="Completed consults" />
        {completed.length === 0 ? (
          <div className="p-4">
            <EmptyState kanji="円" title="No settled earnings yet" />
          </div>
        ) : (
          <div className="divide-y divide-[var(--border)]">
            {completed.map((r) => (
              <div key={r.id} className="flex items-center gap-3 px-5 py-3.5">
                <div className="flex-1">
                  <p className="text-sm font-medium text-cream">{r.patientName}</p>
                  <p className="text-xs text-[var(--text-faint)]">
                    {consultType[r.type].label} ·{" "}
                    {mounted ? timeAgo(r.createdAt) : ""}
                  </p>
                </div>
                <span className="metric text-base text-cream">
                  {formatINR(r.fee)}
                </span>
              </div>
            ))}
          </div>
        )}
      </Card>
    </>
  );
}
