"use client";

import { BadgeCheck, Star, Briefcase } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardHeader } from "@/components/ui/card";
import { StatCard } from "@/components/ui/stat-card";
import { StatusPill } from "@/components/ui/status-pill";
import { useDoctors } from "@/lib/hooks/data";
import { doctorStatusOf } from "@/lib/labels";
import { formatINR, initials, timeAgo } from "@/lib/utils/format";
import { useMounted } from "@/lib/hooks/use-mounted";

export default function DoctorsNetwork() {
  const doctors = useDoctors();
  const mounted = useMounted();

  const online = doctors.filter((d) => d.status === "online").length;
  const verified = doctors.filter((d) => d.verified).length;
  // onGig/gigCount are derived on read by /api/data — nothing is stored.
  const onGig = doctors.filter((d) => d.onGig).length;
  const gigsLive = doctors.reduce((a, d) => a + (d.gigCount ?? 0), 0);
  const avgRating =
    doctors.length > 0
      ? (doctors.reduce((a, d) => a + d.rating, 0) / doctors.length).toFixed(1)
      : "0.0";

  return (
    <>
      <PageHeader kanji="医" label="ZUMI · NETWORK" title="Doctor network" />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard value={`${online}/${doctors.length}`} label="Online now" accent />
        <StatCard value={onGig} label="On a gig" sub={`${gigsLive} gigs listed`} />
        <StatCard value={verified} label="Verified" />
        <StatCard value={avgRating} label="Avg rating" />
      </div>

      <Card className="mt-5">
        <CardHeader label="ROSTER" title={`${doctors.length} doctors`} />
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] text-sm">
            <thead>
              <tr className="border-b border-[var(--border)] text-left">
                {[
                  "Doctor",
                  "Specialty",
                  "Status",
                  "Working on",
                  "Gigs",
                  "Rating",
                  "Consult",
                  "Home visit",
                  "Last seen",
                ].map((h) => (
                  <th key={h} className="label px-5 py-3 font-normal">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {doctors.map((d) => {
                const st = doctorStatusOf(d.status);
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
                    {/* What they're actually occupied with, which `status`
                        (their own online/offline intent) doesn't tell you. */}
                    <td className="px-5 py-3">
                      {d.onGig ? (
                        <StatusPill tone="warn">On a gig</StatusPill>
                      ) : d.onConsult ? (
                        <StatusPill tone="info">In consult</StatusPill>
                      ) : (
                        <span className="text-xs text-[var(--text-faint)]">Free</span>
                      )}
                    </td>
                    <td className="px-5 py-3">
                      {d.gigCount ? (
                        <span className="flex items-center gap-1.5 text-cream">
                          <Briefcase className="h-3.5 w-3.5 text-salmon" />
                          {d.gigCount}
                          {d.gigFromPrice != null && (
                            <span className="font-mono text-xs text-[var(--text-faint)]">
                              from {formatINR(d.gigFromPrice)}
                            </span>
                          )}
                        </span>
                      ) : (
                        <span className="text-xs text-[var(--text-faint)]">—</span>
                      )}
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
