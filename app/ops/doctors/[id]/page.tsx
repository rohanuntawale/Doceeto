"use client";

import { useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import {
  ArrowLeft,
  BadgeCheck,
  Star,
  Trash2,
  MapPin,
  Mail,
  Phone,
  Clock,
  Briefcase,
  Wallet,
  Stethoscope,
  ShieldCheck,
  KeyRound,
  Monitor,
  CalendarDays,
} from "lucide-react";
import { Card, CardHeader } from "@/components/ui/card";
import { StatCard } from "@/components/ui/stat-card";
import { StatusPill } from "@/components/ui/status-pill";
import { EmptyState } from "@/components/ui/empty-state";
import { DeleteDoctorDialog } from "@/components/ops/delete-doctor-dialog";
import { useDoctorDetail, useActions } from "@/lib/hooks/data";
import { useMounted } from "@/lib/hooks/use-mounted";
import {
  consultStatusOf,
  consultTypeOf,
  doctorKindOf,
  doctorStatusOf,
  gigStatusOf,
} from "@/lib/labels";
import { formatINR, initials, timeAgo } from "@/lib/utils/format";
import { cn } from "@/lib/utils/cn";

/** Full timestamp — day, date and time — which is what ops needs to answer
 *  "when exactly did this happen", not a fuzzy "3 days ago". */
function fullStamp(iso?: string | null): string {
  if (!iso) return ", ";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return ", ";
  return d.toLocaleString(undefined, {
    weekday: "long",
    day: "2-digit",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function shortStamp(iso?: string | null): string {
  if (!iso) return ", ";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return ", ";
  return d.toLocaleString(undefined, {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function DoctorProfile() {
  const params = useParams<{ id: string }>();
  const id = String(params?.id ?? "");
  const router = useRouter();
  const mounted = useMounted();
  const { detail, loading, error } = useDoctorDetail(id);
  const { deleteDoctor } = useActions();
  const [confirming, setConfirming] = useState(false);

  if (loading && !detail) {
    return <p className="py-20 text-center text-sm text-[var(--text-faint)]">Loading…</p>;
  }
  if (error || !detail) {
    return (
      <>
        <BackLink />
        <EmptyState
          title={error?.message ?? "Doctor not found"}
          desc="They may have been removed from the platform."
          action={
            <Link
              href="/ops/doctors"
              className="rounded-xl bg-terracotta px-4 py-2.5 text-sm font-semibold text-on-accent"
            >
              Back to the network
            </Link>
          }
        />
      </>
    );
  }

  const { doctor: d, account, reviews, requests, gigs, transactions, activeSessions } = detail;
  const st = doctorStatusOf(d.status);
  const kind = doctorKindOf(d.kind);

  const completed = requests.filter((r) => r.status === "completed").length;
  const cancelled = requests.filter((r) => r.status === "cancelled").length;
  const earned = transactions
    .filter((t) => t.kind === "earning")
    .reduce((a, t) => a + t.net, 0);
  const paidOut = transactions
    .filter((t) => t.kind === "payout")
    .reduce((a, t) => a + Math.abs(t.net), 0);

  return (
    <>
      <BackLink />

      {/* ── Identity header ── */}
      <Card className="p-5">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
          {d.avatarUrl ? (
            // eslint-disable-next-line @next/next/no-img-element -- data-URL avatar
            <img
              src={d.avatarUrl}
              alt={d.fullName}
              className="h-20 w-20 shrink-0 rounded-2xl object-cover"
            />
          ) : (
            <span
              className="grid h-20 w-20 shrink-0 place-items-center rounded-2xl text-xl font-medium text-cream"
              style={{ background: d.avatarColor }}
            >
              {initials(d.fullName.replace("Dr. ", ""))}
            </span>
          )}

          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="font-serif text-2xl text-cream sm:text-3xl">{d.fullName}</h1>
              {d.verified && <BadgeCheck className="h-5 w-5 text-status-ok" />}
              <StatusPill tone={st.tone}>{st.label}</StatusPill>
              {d.onGig && <StatusPill tone="warn">On a gig</StatusPill>}
              {d.onConsult && <StatusPill tone="info">In consult</StatusPill>}
            </div>
            <p className="mt-1 text-sm text-[var(--text-muted)]">
              {d.specialty} · {kind.label} · {d.experienceYears} yrs experience
            </p>
            <p className="mt-1 flex items-center gap-1.5 text-sm text-tan">
              <Star className="h-3.5 w-3.5 fill-tan" />
              {d.rating.toFixed(1)}
              <span className="text-[var(--text-faint)]">
                from {reviews.length} review{reviews.length === 1 ? "" : "s"}
              </span>
            </p>
            <p className="mt-2 font-mono text-[11px] text-[var(--text-faint)]">{d.id}</p>
          </div>

          <button
            onClick={() => setConfirming(true)}
            className="flex shrink-0 items-center justify-center gap-2 rounded-xl border border-status-critical/40 px-4 py-2.5 text-sm font-semibold text-status-critical transition-colors hover:bg-status-critical/10"
          >
            <Trash2 className="h-4 w-4" /> Delete account
          </button>
        </div>
      </Card>

      {/* ── Headline numbers ── */}
      <div className="mt-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard value={completed} label="Consults completed" accent />
        <StatCard value={reviews.length} label="Reviews" sub={`${cancelled} cancelled`} />
        <StatCard value={formatINR(earned)} label="Net earned" sub={`${formatINR(paidOut)} paid out`} />
        <StatCard value={gigs.length} label="Gig listings" sub={`${activeSessions} device(s) signed in`} />
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        {/* ── Onboarding + account ── */}
        <Card className="p-5">
          <CardHeader label="ACCOUNT" title="Onboarding & login" />
          <dl className="space-y-3">
            <Row icon={<CalendarDays className="h-4 w-4" />} label="Joined the platform">
              {mounted ? fullStamp(d.createdAt) : ""}
              {!d.createdAt && (
                <span className="block text-xs text-[var(--text-faint)]">
                  Seeded catalog doctor, no signup record.
                </span>
              )}
            </Row>
            <Row icon={<ShieldCheck className="h-4 w-4" />} label="Account created">
              {mounted ? fullStamp(account?.createdAt) : ""}
            </Row>
            <Row icon={<Mail className="h-4 w-4" />} label="Email">
              {account?.email ?? ",  (no login account)"}
            </Row>
            <Row icon={<KeyRound className="h-4 w-4" />} label="Sign-in method">
              {account
                ? [
                    account.hasPassword ? "Password" : null,
                    account.googleLinked ? "Google" : null,
                  ]
                    .filter(Boolean)
                    .join(" + ") || "None set"
                : ", "}
            </Row>
            <Row icon={<Monitor className="h-4 w-4" />} label="Active sessions">
              {activeSessions === 0 ? "Not signed in" : `${activeSessions} device(s)`}
            </Row>
            <Row icon={<Clock className="h-4 w-4" />} label="Last seen">
              {mounted ? `${shortStamp(d.lastSeen)} (${timeAgo(d.lastSeen)})` : ""}
            </Row>
          </dl>
        </Card>

        {/* ── Professional detail ── */}
        <Card className="p-5">
          <CardHeader label="PROFILE" title="Credentials & practice" />
          <dl className="space-y-3">
            <Row icon={<Stethoscope className="h-4 w-4" />} label="Qualifications">
              {d.qualifications || ", "}
            </Row>
            <Row icon={<ShieldCheck className="h-4 w-4" />} label="Registration no.">
              {d.registrationNo || ", "}
            </Row>
            <Row icon={<Briefcase className="h-4 w-4" />} label="Education">
              {d.education || ", "}
            </Row>
            <Row icon={<Phone className="h-4 w-4" />} label="Languages">
              {d.languages.join(", ") || ", "}
            </Row>
            <Row icon={<Star className="h-4 w-4" />} label="Age / gender">
              {[d.age ? `${d.age}` : null, d.gender].filter(Boolean).join(" · ")}
            </Row>
            <Row icon={<Wallet className="h-4 w-4" />} label="Fees">
              {formatINR(d.consultFee)} consult · {formatINR(d.homeVisitFee)} home visit
            </Row>
            {d.about && (
              <Row icon={<Stethoscope className="h-4 w-4" />} label="About">
                {d.about}
              </Row>
            )}
          </dl>
        </Card>
      </div>

      {/* ── Location ── */}
      <Card className="mt-4 p-5">
        <CardHeader label="LOCATION" title="Where they are" />
        <dl className="space-y-3">
          <Row icon={<MapPin className="h-4 w-4" />} label="Clinic address">
            {d.clinicAddress || ", "}
          </Row>
          <Row icon={<MapPin className="h-4 w-4" />} label="Account address">
            {account?.address || ", "}
          </Row>
          <Row icon={<MapPin className="h-4 w-4" />} label="Live coordinates">
            <span className="font-mono text-xs">
              {d.lat.toFixed(5)}, {d.lng.toFixed(5)}
            </span>
            <a
              href={`https://www.google.com/maps?q=${d.lat},${d.lng}`}
              target="_blank"
              rel="noopener noreferrer"
              className="ml-2 text-xs text-salmon underline underline-offset-2"
            >
              Open in Maps
            </a>
          </Row>
        </dl>
      </Card>

      {/* ── Consult history ── */}
      <Card className="mt-4 overflow-hidden">
        <CardHeader label="HISTORY" title={`${requests.length} consults`} />
        {requests.length === 0 ? (
          <div className="px-5 pb-5">
            <EmptyState title="No consults yet" />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-sm">
              <thead>
                <tr className="border-b border-[var(--border)] text-left">
                  {["Patient", "Type", "Status", "Fee", "Booked", "Completed"].map((h) => (
                    <th key={h} className="label px-5 py-3 font-normal">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {requests.map((r) => {
                  const cs = consultStatusOf(r.status);
                  return (
                    <tr key={r.id} className="border-b border-[var(--border)] last:border-0">
                      <td className="px-5 py-3 text-cream">{r.patientName}</td>
                      <td className="px-5 py-3 text-[var(--text-muted)]">
                        {consultTypeOf(r.type).label}
                      </td>
                      <td className="px-5 py-3">
                        <StatusPill tone={cs.tone}>{cs.label}</StatusPill>
                      </td>
                      <td className="px-5 py-3 font-mono text-cream">{formatINR(r.fee)}</td>
                      <td className="px-5 py-3 font-mono text-xs text-[var(--text-faint)]">
                        {mounted ? shortStamp(r.createdAt) : ""}
                      </td>
                      <td className="px-5 py-3 font-mono text-xs text-[var(--text-faint)]">
                        {mounted ? shortStamp(r.completedAt) : ""}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        {/* ── Reviews ── */}
        <Card className="p-5">
          <CardHeader label="REPUTATION" title={`${reviews.length} reviews`} />
          {reviews.length === 0 ? (
            <EmptyState title="No reviews yet" />
          ) : (
            <ul className="space-y-3">
              {reviews.map((v) => (
                <li key={v.id} className="rounded-xl border border-[var(--border)] p-3">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm font-medium text-cream">{v.patientName}</span>
                    <span className="flex items-center gap-1 text-tan">
                      <Star className="h-3.5 w-3.5 fill-tan" />
                      {v.rating.toFixed(1)}
                    </span>
                  </div>
                  {v.comment && (
                    <p className="mt-1 text-sm text-[var(--text-muted)]">{v.comment}</p>
                  )}
                  <p className="mt-1 font-mono text-[11px] text-[var(--text-faint)]">
                    {mounted ? shortStamp(v.createdAt) : ""}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </Card>

        {/* ── Gigs ── */}
        <Card className="p-5">
          <CardHeader label="SHELF" title={`${gigs.length} gig listings`} />
          {gigs.length === 0 ? (
            <EmptyState title="No gigs published" />
          ) : (
            <ul className="space-y-3">
              {gigs.map((g) => {
                const gs = gigStatusOf(g.status);
                return (
                  <li key={g.id} className="rounded-xl border border-[var(--border)] p-3">
                    <div className="flex items-start justify-between gap-2">
                      <span className="text-sm font-medium text-cream">{g.title}</span>
                      <StatusPill tone={gs.tone}>{gs.label}</StatusPill>
                    </div>
                    <p className="mt-1 text-xs text-[var(--text-muted)]">
                      {consultTypeOf(g.type).label} · {g.durationMinutes} min ·{" "}
                      <span className="font-mono">{formatINR(g.price)}</span>
                    </p>
                    <p className="mt-1 font-mono text-[11px] text-[var(--text-faint)]">
                      {mounted ? shortStamp(g.createdAt) : ""}
                    </p>
                  </li>
                );
              })}
            </ul>
          )}
        </Card>
      </div>

      {/* ── Wallet ── */}
      <Card className="mt-4 overflow-hidden">
        <CardHeader
          label="WALLET"
          title={`${transactions.length} ledger entries`}
          action={
            <span className="font-mono text-sm text-cream">
              {formatINR(earned - paidOut)} balance
            </span>
          }
        />
        {transactions.length === 0 ? (
          <div className="px-5 pb-5">
            <EmptyState title="No transactions yet" />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[620px] text-sm">
              <thead>
                <tr className="border-b border-[var(--border)] text-left">
                  {["Kind", "Patient", "Gross", "Commission", "Net", "When"].map((h) => (
                    <th key={h} className="label px-5 py-3 font-normal">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {transactions.map((t) => (
                  <tr key={t.id} className="border-b border-[var(--border)] last:border-0">
                    <td className="px-5 py-3">
                      <StatusPill tone={t.kind === "earning" ? "ok" : "info"}>
                        {t.kind === "earning" ? "Earning" : "Payout"}
                      </StatusPill>
                    </td>
                    <td className="px-5 py-3 text-[var(--text-muted)]">
                      {t.patientName ?? ", "}
                    </td>
                    <td className="px-5 py-3 font-mono text-[var(--text-muted)]">
                      {formatINR(t.gross)}
                    </td>
                    <td className="px-5 py-3 font-mono text-[var(--text-muted)]">
                      {formatINR(t.commission)}
                    </td>
                    <td
                      className={cn(
                        "px-5 py-3 font-mono",
                        t.kind === "earning" ? "text-status-ok" : "text-cream",
                      )}
                    >
                      {formatINR(t.net)}
                    </td>
                    <td className="px-5 py-3 font-mono text-xs text-[var(--text-faint)]">
                      {mounted ? shortStamp(t.createdAt) : ""}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <DeleteDoctorDialog
        doctor={confirming ? d : null}
        onClose={() => setConfirming(false)}
        onConfirm={deleteDoctor}
        // The page's subject is gone, so stay off a screen that can only 404.
        onDeleted={() => router.push("/ops/doctors")}
      />
    </>
  );
}

function BackLink() {
  return (
    <Link
      href="/ops/doctors"
      className="mb-4 inline-flex items-center gap-1.5 text-sm text-[var(--text-muted)] transition-colors hover:text-cream"
    >
      <ArrowLeft className="h-4 w-4" /> Doctor network
    </Link>
  );
}

function Row({
  icon,
  label,
  children,
}: {
  icon: React.ReactNode;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-start gap-3">
      <span className="mt-0.5 shrink-0 text-[var(--text-faint)]">{icon}</span>
      <div className="min-w-0 flex-1">
        <dt className="text-xs text-[var(--text-faint)]">{label}</dt>
        <dd className="text-sm text-cream">{children}</dd>
      </div>
    </div>
  );
}
