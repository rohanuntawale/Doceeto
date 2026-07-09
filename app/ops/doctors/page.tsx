"use client";

import { BadgeCheck, Star } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardHeader } from "@/components/ui/card";
import { StatCard } from "@/components/ui/stat-card";
import { StatusPill } from "@/components/ui/status-pill";
import { useDoctors } from "@/lib/hooks/data";
import { doctorStatus } from "@/lib/labels";
import { formatINR, initials, timeAgo } from "@/lib/utils/format";
import { useMounted } from "@/lib/hooks/use-mounted";

export default function DoctorsNetwork() {
  const doctors = useDoctors();
  const mounted = useMounted();

  const online = doctors.filter((d) => d.status === "online").length;
  const verified = doctors.filter((d) => d.verified).length;
  const avgRating =
    doctors.length > 0
      ? (doctors.reduce((a, d) => a + d.rating, 0) / doctors.length).toFixed(1)
      : "—";

  return (
    <>
      <PageHeader kanji="医" label="ZUMI · NETWORK" title="Doctor network" />

      <div className="grid grid-cols-3 gap-3">
        <StatCard value={`${online}/${doctors.length}`} label="Online now" accent />
        <StatCard value={verified} label="Verified" />
        <StatCard value={avgRating} label="Avg rating" />
      </div>

      <Card className="mt-5">
        <CardHeader label="ROSTER" title={`${doctors.length} doctors`} />
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-sm">
            <thead>
              <tr className="border-b border-[var(--border)] text-left">
                {["Doctor", "Specialty", "Status", "Rating", "Consult", "Home visit", "Last seen"].map(
                  (h) => (
                    <th key={h} className="label px-5 py-3 font-normal">
                      {h}
                    </th>
                  ),
                )}
              </tr>
            </thead>
            <tbody>
              {doctors.map((d) => {
                const st = doctorStatus[d.status];
                return (
                  <tr
                    key={d.id}
                    className="border-b border-[var(--border)] last:border-0 hover:bg-white/[0.02]"
                  >
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-3">
                        <span
                          className="grid h-9 w-9 shrink-0 place-items-center rounded-lg text-xs font-medium text-cream"
                          style={{ background: d.avatarColor }}
                        >
                          {initials(d.fullName.replace("Dr. ", ""))}
                        </span>
                        <span className="flex items-center gap-1.5 font-medium text-cream">
                          {d.fullName}
                          {d.verified && (
                            <BadgeCheck className="h-4 w-4 text-status-ok" />
                          )}
                        </span>
                      </div>
                    </td>
                    <td className="px-5 py-3 text-[var(--text-muted)]">
                      {d.specialty}
                    </td>
                    <td className="px-5 py-3">
                      <StatusPill tone={st.tone}>{st.label}</StatusPill>
                    </td>
                    <td className="px-5 py-3">
                      <span className="flex items-center gap-1 text-tan">
                        <Star className="h-3.5 w-3.5 fill-tan" />
                        {d.rating.toFixed(1)}
                      </span>
                    </td>
                    <td className="px-5 py-3 font-mono text-cream">
                      {formatINR(d.consultFee)}
                    </td>
                    <td className="px-5 py-3 font-mono text-cream">
                      {formatINR(d.homeVisitFee)}
                    </td>
                    <td className="px-5 py-3 font-mono text-xs text-[var(--text-faint)]">
                      {mounted ? timeAgo(d.lastSeen) : ""}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>
    </>
  );
}
