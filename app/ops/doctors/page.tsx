"use client";

import { BadgeCheck, Star, Check, X, ShieldCheck } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardHeader } from "@/components/ui/card";
import { StatCard } from "@/components/ui/stat-card";
import { StatusPill } from "@/components/ui/status-pill";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { useToast } from "@/components/ui/toast";
import { useDoctors, useActions } from "@/lib/hooks/data";
import { doctorStatus, doctorKind } from "@/lib/labels";
import { formatINR, initials, timeAgo } from "@/lib/utils/format";
import { useMounted } from "@/lib/hooks/use-mounted";

export default function DoctorsNetwork() {
  const doctors = useDoctors();
  const { verifyDoctor } = useActions();
  const toast = useToast();
  const mounted = useMounted();

  const online = doctors.filter((d) => d.status === "online").length;
  const verified = doctors.filter((d) => d.verified).length;
  const pendingVerify = doctors.filter((d) => d.verificationStatus === "pending");
  const avgRating =
    doctors.length > 0
      ? (doctors.reduce((a, d) => a + d.rating, 0) / doctors.length).toFixed(1)
      : "0.0";

  return (
    <>
      <PageHeader kanji="医" label="ZUMI · NETWORK" title="Doctor network" />

      <div className="grid grid-cols-3 gap-3">
        <StatCard value={`${online}/${doctors.length}`} label="Online now" accent />
        <StatCard value={verified} label="Verified" />
        <StatCard value={avgRating} label="Avg rating" />
      </div>

      {/* Verification queue — no doctor can go online until approved here. */}
      <Card className="mt-5">
        <CardHeader
          label="TRUST & SAFETY"
          title={`Verification queue (${pendingVerify.length})`}
        />
        <div className="p-4">
          {pendingVerify.length === 0 ? (
            <EmptyState
              kanji="検"
              title="No doctors waiting"
              desc="New doctors appear here for registration checks before they can work."
            />
          ) : (
            <div className="space-y-2.5">
              {pendingVerify.map((d) => (
                <div
                  key={d.id}
                  className="flex flex-wrap items-center gap-3 rounded-card border border-status-warn/25 bg-espresso-800 p-3.5 shadow-card"
                >
                  <span
                    className="grid h-10 w-10 shrink-0 place-items-center rounded-lg text-xs font-medium text-cream"
                    style={{ background: d.avatarColor }}
                  >
                    {initials(d.fullName.replace("Dr. ", ""))}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium text-cream">{d.fullName}</p>
                    <p className="text-xs text-[var(--text-muted)]">
                      {d.specialty} · {doctorKind[d.kind].label} · {d.experienceYears} yrs
                    </p>
                    <p className="mt-0.5 flex items-center gap-1.5 font-mono text-xs text-[var(--text-faint)]">
                      <ShieldCheck className="h-3.5 w-3.5" />
                      Reg: {d.regNo ?? "not provided"}
                    </p>
                  </div>
                  <div className="flex shrink-0 gap-2">
                    <Button
                      size="sm"
                      onClick={() => {
                        verifyDoctor(d.id, true);
                        toast.push({ tone: "success", title: "Doctor verified", desc: d.fullName });
                      }}
                    >
                      <Check className="h-3.5 w-3.5" /> Verify
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => {
                        verifyDoctor(d.id, false);
                        toast.push({ tone: "info", title: "Doctor rejected", desc: d.fullName });
                      }}
                    >
                      <X className="h-3.5 w-3.5" /> Reject
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </Card>

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
