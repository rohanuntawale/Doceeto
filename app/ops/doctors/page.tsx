"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { BadgeCheck, Star, Briefcase, Trash2, ChevronRight } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardHeader } from "@/components/ui/card";
import { StatCard } from "@/components/ui/stat-card";
import { StatusPill } from "@/components/ui/status-pill";
import { useDoctors, useNurses, useActions } from "@/lib/hooks/data";
import { useToast } from "@/components/ui/toast";
import { doctorStatusOf } from "@/lib/labels";
import { formatINR, initials, timeAgo } from "@/lib/utils/format";
import { useMounted } from "@/lib/hooks/use-mounted";
import { DeleteDoctorDialog } from "@/components/ops/delete-doctor-dialog";
import { cn } from "@/lib/utils/cn";
import type { Cadre, Doctor } from "@/lib/types/domain";

export default function DoctorsNetwork() {
  // Both rosters are fetched; the tab decides which is rendered. They are
  // separate reads because /api/data splits providers by cadre — a nurse must
  // never appear in a doctor list by accident.
  const allDoctors = useDoctors();
  const allNurses = useNurses();
  const mounted = useMounted();
  const router = useRouter();
  const { deleteDoctor, verifyProvider } = useActions();
  const toast = useToast();
  const [pendingDelete, setPendingDelete] = useState<Doctor | null>(null);
  const [cadre, setCadre] = useState<Cadre>("doctor");

  const doctors = cadre === "nurse" ? allNurses : allDoctors;
  const isNurseTab = cadre === "nurse";

  async function toggleVerified(d: Doctor) {
    try {
      await verifyProvider(d.id, !d.verified);
      toast.push({
        tone: "success",
        title: d.verified ? "Verification withdrawn" : "Provider verified",
        desc: d.fullName,
      });
    } catch (e) {
      toast.push({
        tone: "error",
        title: "Could not update verification",
        desc: e instanceof Error ? e.message : "Please try again.",
      });
    }
  }

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
      <PageHeader
        label="DOCEETO · NETWORK"
        title={isNurseTab ? "Nurse network" : "Doctor network"}
      />

      {/* Cadre tabs. Nurses need a roster of their own because verification is
          a precondition for them, not a badge, an unverified nurse reaches no
          patient, so this is where that decision gets made. */}
      <div className="mb-4 flex w-fit rounded-full border border-[var(--border)] bg-espresso/60 p-1 text-sm">
        {(["doctor", "nurse"] as Cadre[]).map((c) => (
          <button
            key={c}
            onClick={() => setCadre(c)}
            className={cn(
              "rounded-full px-4 py-1.5 font-medium transition-colors",
              cadre === c
                ? "bg-terracotta text-on-accent"
                : "text-[var(--text-muted)] hover:text-cream",
            )}
          >
            {c === "doctor" ? "Doctors" : "Nurses"}
            <span className="ml-2 font-mono text-xs opacity-70">
              {c === "doctor" ? allDoctors.length : allNurses.length}
            </span>
          </button>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard value={`${online}/${doctors.length}`} label="Online now" accent />
        {isNurseTab ? (
          <StatCard
            value={doctors.filter((d) => !d.verified).length}
            label="Awaiting verification"
            sub="Not discoverable yet"
          />
        ) : (
          <StatCard value={onGig} label="On a gig" sub={`${gigsLive} gigs listed`} />
        )}
        <StatCard value={verified} label="Verified" />
        <StatCard value={avgRating} label="Avg rating" />
      </div>

      {/* overflow-hidden keeps the scrolling roster clipped to the card radius */}
      <Card className="mt-5 overflow-hidden">
        <CardHeader
          label="ROSTER"
          title={`${doctors.length} ${isNurseTab ? "nurses" : "doctors"}`}
        />
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] text-sm">
            <thead>
              <tr className="border-b border-[var(--border)] text-left">
                {[
                  isNurseTab ? "Nurse" : "Doctor",
                  isNurseTab ? "Title" : "Specialty",
                  "Status",
                  isNurseTab ? "Verified" : "Working on",
                  isNurseTab ? "Services" : "Gigs",
                  "Rating",
                  "Consult",
                  "Home visit",
                  "Joined",
                  "Last seen",
                  "",
                ].map((h, i) => (
                  <th key={h || `col-${i}`} className="label px-5 py-3 font-normal">
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
                    onClick={() => router.push(`/ops/doctors/${d.id}`)}
                    className="cursor-pointer border-b border-[var(--border)] last:border-0 hover:bg-white/[0.04]"
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
                    {/* For a nurse this column is the ops decision itself: a
                        nurse is invisible to patients until it is Yes. For a
                        doctor it stays "what are they occupied with", which
                        `status` (their own intent) doesn't tell you. */}
                    <td className="px-5 py-3" onClick={(e) => e.stopPropagation()}>
                      {isNurseTab ? (
                        <button
                          onClick={() => toggleVerified(d)}
                          className={cn(
                            "rounded-full border px-3 py-1 text-xs font-semibold transition-colors",
                            d.verified
                              ? "border-status-ok/40 text-status-ok hover:bg-status-ok/10"
                              : "border-[var(--border)] text-[var(--text-muted)] hover:text-cream",
                          )}
                        >
                          {d.verified ? "Verified" : "Verify"}
                        </button>
                      ) : d.onGig ? (
                        <StatusPill tone="warn">On a gig</StatusPill>
                      ) : d.onConsult ? (
                        <StatusPill tone="info">In consult</StatusPill>
                      ) : (
                        <span className="text-xs text-[var(--text-faint)]">Free</span>
                      )}
                    </td>
                    <td className="px-5 py-3">
                      {isNurseTab ? (
                        <span className="text-xs text-[var(--text-muted)]">
                          {d.skills?.length
                            ? `${d.skills.length} service${d.skills.length === 1 ? "" : "s"}`
                            : ", "}
                        </span>
                      ) : d.gigCount ? (
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
                        <span className="text-xs text-[var(--text-faint)]">, </span>
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
                      {d.createdAt
                        ? mounted
                          ? new Date(d.createdAt).toLocaleDateString(undefined, {
                              day: "2-digit",
                              month: "short",
                              year: "numeric",
                            })
                          : ""
                        : ", "}
                    </td>
                    <td className="px-5 py-3 font-mono text-xs text-[var(--text-faint)]">
                      {mounted ? timeAgo(d.lastSeen) : ""}
                    </td>
                    {/* stopPropagation: the row itself opens the profile, so a
                        delete click must not also navigate behind the dialog. */}
                    <td className="px-5 py-3" onClick={(e) => e.stopPropagation()}>
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => setPendingDelete(d)}
                          aria-label={`Delete ${d.fullName}`}
                          title="Delete this doctor"
                          className="grid h-8 w-8 place-items-center rounded-lg text-[var(--text-faint)] transition-colors hover:bg-status-critical/15 hover:text-status-critical"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                        <ChevronRight className="h-4 w-4 text-[var(--text-faint)]" />
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>

      <DeleteDoctorDialog
        doctor={pendingDelete}
        onClose={() => setPendingDelete(null)}
        onConfirm={deleteDoctor}
      />
    </>
  );
}
