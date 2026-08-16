"use client";

import { useState } from "react";
import Link from "next/link";
import {
  Inbox,
  Star,
  Timer,
  TrendingUp,
  Radio,
  Briefcase,
  Plus,
} from "lucide-react";
import { StatCard } from "@/components/ui/stat-card";
import { Card, CardHeader } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { OnlineToggle } from "@/components/doctor/online-toggle";
import { OnGigBanner } from "@/components/doctor/on-gig-banner";
import { RequestCard } from "@/components/zumi/request-card";
import { LiveMap } from "@/components/map/live-map";
import { DoctorConsultTracker } from "@/components/consult/consult-tracker";
import { useToast } from "@/components/ui/toast";
import {
  useConsultRequests,
  useActions,
  useGigs,
  useTransactions,
  useReviews,
} from "@/lib/hooks/data";
import { useCurrentDoctor } from "@/lib/hooks/use-current-doctor";
import { useT } from "@/lib/i18n";
import { GlassCard } from "@/components/ui/glass-card";
import { FaqCard, HistoryCard } from "@/components/dashboard/extras";
import { NewsCarousel } from "@/components/dashboard/news-carousel";
import { GaugeCard, ActivityCard, GoalsCard } from "@/components/dashboard/cards";
import { formatINR, formatINRCompact } from "@/lib/utils/format";
import {
  activeGigHireOf,
  isScheduled,
  ongoingConsultOf,
  pendingGigHires,
  visibleToProvider,
} from "@/lib/scheduling/slots";
import { activeGigs } from "@/lib/gigs/rules";
import { weeklySeries } from "@/lib/health/metrics";
import { cn } from "@/lib/utils/cn";

/** Requests shown on the dashboard before it defers to the full list. */
const INBOX_PREVIEW = 3;

export default function DoctorHome() {
  const me = useCurrentDoctor();
  const { t } = useT();
  const requests = useConsultRequests();
  const txns = useTransactions();
  const gigs = useGigs();
  const reviews = useReviews(me?.id);
  const actions = useActions();
  const toast = useToast();
  // No local "passed" set. The pass now goes to the server and to the shared
  // ["requests"] cache inside useActions().declineRequest, so this screen, the
  // requests page and the map all drop the row together — and it stays dropped
  // after a refresh because it is persisted in passed_by.
  const online = me?.status === "online";
  const greetKey =
    new Date().getHours() < 12
      ? "greeting.morning"
      : new Date().getHours() < 17
        ? "greeting.afternoon"
        : "greeting.evening";

  const doctorId = me?.id ?? "";
  // The consult occupying this doctor right now, if any. A confirmed slot
  // for later today doesn't count — only what's actually running.
  const ongoing = doctorId ? ongoingConsultOf(requests, doctorId) : undefined;
  // A gig is the one kind of occupancy that pauses them outright, so it gets
  // its own banner with the action that releases it.
  const liveGig = doctorId ? activeGigHireOf(requests, doctorId) : undefined;
  const pendingGigs = doctorId ? pendingGigHires(requests, doctorId) : [];
  const liveGigCount = activeGigs(gigs).length;

  // Same rule the server applies: while a consult is in progress, urgent
  // requests are routed elsewhere. Appointments still come through.
  const pending = requests.filter(
    (r) =>
      doctorId &&
      r.status === "pending" &&
      visibleToProvider(r, { doctorId, busy: Boolean(ongoing) }),
  );
  const myCompleted = requests.filter(
    (r) => r.status === "completed" && r.doctorId === me?.id,
  );
  const acceptedByMe = requests.filter(
    (r) => r.status === "accepted" && r.doctorId === me?.id,
  );
  // ── Live metrics, all derived from persisted data ──────────
  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);
  const isToday = (iso?: string | null) =>
    Boolean(iso) && new Date(iso!).getTime() >= startOfToday.getTime();

  const myEarnings = txns.filter((t) => t.doctorId === me?.id && t.kind === "earning");
  // Net, not the gross fee — this is what actually lands in the wallet, so
  // the tile matches the balance on the wallet screen.
  const earningsToday = myEarnings
    .filter((t) => isToday(t.createdAt))
    .reduce((a, t) => a + t.net, 0);
  const completedToday = myCompleted.filter((r) => isToday(r.completedAt));
  const consultsToday = completedToday.length + acceptedByMe.length;

  // createdAt → acceptedAt across every consult this doctor has claimed.
  const responseMins = myCompleted
    .concat(acceptedByMe)
    .filter((r) => r.acceptedAt)
    .map((r) => (new Date(r.acceptedAt!).getTime() - new Date(r.createdAt).getTime()) / 60000)
    .filter((m) => m >= 0);
  const avgResponse =
    responseMins.length > 0
      ? Math.max(1, Math.round(responseMins.reduce((a, m) => a + m, 0) / responseMins.length))
      : null;

  /**
   * Net earnings per day, Sunday → Saturday of the current week, with the
   * trend measured week-to-date against the same slice of last week.
   *
   * The bars used to be a rolling seven days ending today while the card was
   * titled "Earnings this week", and the badge compared TODAY against the
   * average of the six days before it — so every morning opened at "↓ 100%"
   * and climbed back as the day went on. See lib/health/metrics.ts.
   */
  const earnings = weeklySeries(
    myEarnings.map((t) => ({ at: Date.parse(t.createdAt), value: t.net })),
  );
  // Acceptance: of the requests this doctor actually answered, how many they
  // took. Was hard-coded to 92% with an invented sparkline — a made-up figure
  // on a real dashboard is worse than no figure.
  const answered = requests.filter(
    (r) => r.doctorId === me?.id && r.status !== "pending" && r.status !== "cancelled",
  );
  const acceptance =
    answered.length > 0
      ? Math.round(
          (answered.filter((r) => r.status !== "declined").length / answered.length) * 100,
        )
      : 0;

  const doctorGoals = [
    { id: "profile", label: "Complete your profile", sub: "Add qualifications & about", done: Boolean(me?.about), href: "/doctor/profile" },
    { id: "license", label: "Upload your medical license", sub: "Required for verification", done: Boolean(me?.verified), href: "/doctor/profile" },
    {
      id: "avail",
      label: "Set your availability",
      sub: "Weekly hours patients can book",
      done: Boolean(me?.availability),
      href: "/doctor/schedule",
    },
    { id: "bank", label: "Add bank for instant payouts", sub: "Withdraw earnings anytime", href: "/doctor/earnings" },
    { id: "online", label: "Go online to receive gigs", done: online },
  ];

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-12 lg:gap-5">
      {/* Greeting */}
      <header className="flex flex-wrap items-end justify-between gap-4 lg:col-span-12">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--text-faint)]">
            Doctor space
          </p>
          <h1 className="mt-1 text-3xl font-bold tracking-tight text-cream lg:text-4xl">
            {t(greetKey)},{" "}
            <span className="text-[rgb(var(--c-terracotta))]">{me ? me.fullName : "Doctor"}</span>
          </h1>
          <p className="mt-1.5 text-sm text-[var(--text-muted)]">
            {online
              ? "You're online and visible to patients nearby."
              : "Go online to start receiving gigs near you."}
          </p>
        </div>
      </header>

      {/* A live gig outranks everything: completing it is what unpauses them. */}
      {liveGig && <OnGigBanner request={liveGig} className="lg:col-span-12" />}

      {/* Your shift, go online. The card states the status, so the toggle
          is just the switch: nesting its full panel here overflowed the
          card and said "you're online" twice. */}
      <GlassCard className="p-5 lg:col-span-5">
        <div className="flex h-full items-center justify-between gap-4">
          <div className="min-w-0">
            <p className="flex items-center gap-1.5 text-sm font-medium text-[var(--text-muted)]">
              <Radio className={cn("h-4 w-4 shrink-0", online ? "text-status-ok" : "text-cream")} />
              Your shift
            </p>
            <p className="mt-0.5 text-xl font-semibold text-cream">
              {online ? "You're online" : "You're offline"}
            </p>
            <p className="mt-0.5 text-xs text-[var(--text-faint)]">
              {online
                ? "Requests will come straight to you."
                : "Flip on to appear on the patient map."}
            </p>
          </div>
          <OnlineToggle doctor={me} variant="inline" />
        </div>
      </GlassCard>

      {/* The gig shelf, the other half of how a doctor earns. */}
      <GlassCard className="p-5 lg:col-span-7">
        <div className="flex h-full flex-wrap items-center justify-between gap-4">
          <div className="min-w-0">
            <p className="flex items-center gap-1.5 text-sm font-medium text-[var(--text-muted)]">
              <Briefcase className="h-4 w-4 text-cream" />
              Your gigs
            </p>
            <p className="mt-0.5 text-xl font-semibold text-cream">
              {liveGigCount === 0
                ? "Put up a gig"
                : `${liveGigCount} package${liveGigCount === 1 ? "" : "s"} live`}
            </p>
            <p className="mt-0.5 text-xs text-[var(--text-faint)]">
              {liveGigCount === 0
                ? "Name what you do, set your price, and patients hire you directly."
                : pendingGigs.length > 0
                  ? `${pendingGigs.length} patient${pendingGigs.length === 1 ? "" : "s"} waiting to hire you.`
                  : "Live on your profile for patients to hire."}
            </p>
          </div>
          <Link
            href="/doctor/gigs"
            className="flex shrink-0 items-center gap-2 rounded-2xl bg-primary px-4 py-2.5 text-sm font-semibold text-on-accent transition-transform active:scale-[0.98]"
          >
            {liveGigCount === 0 ? (
              <>
                <Plus className="h-4 w-4" /> Create one
              </>
            ) : (
              <>
                Manage
                {pendingGigs.length > 0 && (
                  <span className="rounded-full bg-black/20 px-1.5 py-0.5 text-[11px]">
                    {pendingGigs.length}
                  </span>
                )}
              </>
            )}
          </Link>
        </div>
      </GlassCard>

      {/* KPI strip. Four across the full width rather than a 2×2 block that
          left half a row empty beside it and stood twice as tall. */}
      <div className="grid grid-cols-2 gap-3 lg:col-span-12 lg:grid-cols-4">
        <StatCard
          dense
          value={formatINRCompact(earningsToday)}
          label="Earnings today"
          sub="Net, after platform fee"
          accent
          icon={<TrendingUp className="h-3.5 w-3.5" />}
          href="/doctor/earnings"
        />
        <StatCard
          dense
          value={consultsToday}
          label="Consults today"
          sub={
            acceptedByMe.length > 0
              ? `${completedToday.length} done · ${acceptedByMe.length} in progress`
              : `${completedToday.length} completed`
          }
          icon={<Inbox className="h-3.5 w-3.5" />}
          href="/doctor/consults"
        />
        <StatCard
          dense
          value={me ? (me.rating > 0 ? me.rating.toFixed(1) : "New") : "New"}
          label="Rating"
          sub={
            reviews.length > 0
              ? `From ${reviews.length} review${reviews.length > 1 ? "s" : ""}`
              : "No reviews yet"
          }
          icon={<Star className="h-3.5 w-3.5" />}
          href="/doctor/profile#reviews"
        />
        <StatCard
          dense
          value={avgResponse === null ? ", " : `${avgResponse}m`}
          label="Avg response"
          sub={
            responseMins.length > 0
              ? `Across ${responseMins.length} consult${responseMins.length > 1 ? "s" : ""}`
              : "No consults accepted yet"
          }
          icon={<Timer className="h-3.5 w-3.5" />}
          href="/doctor/consults"
        />
      </div>

      {/* Live tracking of patients you've accepted (appears when active) */}
      {me && (
        <div className="lg:col-span-12">
          <DoctorConsultTracker doctor={me} />
        </div>
      )}

      {/* Patients around you, live positions of incoming requests */}
      <Card className="overflow-hidden lg:col-span-7">
        <CardHeader label="DOCEETO · AROUND YOU" title="Patients near you" action={<MapLegend />} />
        <div className="p-4">
          <LiveMap
            self={me ? { lat: me.lat, lng: me.lng, label: "You (visible to patients)" } : null}
            center={me ? { lat: me.lat, lng: me.lng } : undefined}
            // The map mirrors the inbox — a request hidden from the list
            // must not still be a pin on the map.
            requests={[...pending, ...acceptedByMe]}
            height={320}
          />
        </div>
      </Card>

      {/* Incoming requests, a preview, not the whole queue. The full list
          lives on Gigs; letting it run long here pushed everything below it
          off the screen on a busy day. */}
      <Card className="flex flex-col lg:col-span-5">
        <CardHeader label="DOCEETO · INCOMING" title={`Requests (${pending.length})`} />
        <div className="max-h-[24rem] flex-1 space-y-3 overflow-y-auto p-4">
          {pending.length === 0 ? (
            <EmptyState
              title="No open requests"
              desc="New consults will appear here the moment they come in."
              action={
                <Link
                  href="/doctor/requests"
                  className="rounded-full border border-[var(--border)] px-4 py-2 text-sm font-medium text-cream transition-colors hover:bg-white/5"
                >
                  Open the full inbox
                </Link>
              }
            />
          ) : (
            pending.slice(0, INBOX_PREVIEW).map((r) => (
              <RequestCard
                key={r.id}
                request={r}
                note={r.doctorId === me?.id ? "Chose you" : "Open to nearby doctors"}
                onAccept={async () => {
                  if (!me) return;
                  try {
                    await actions.acceptRequest(r.id, me.id);
                    toast.push({
                      tone: "success",
                      title: isScheduled(r) ? "Appointment confirmed" : "Consult accepted",
                      desc: `${r.patientName} · ${r.address}`,
                    });
                  } catch (e) {
                    toast.push({
                      tone: "error",
                      title: "Couldn't accept",
                      desc: e instanceof Error ? e.message : "Please try again.",
                    });
                  }
                }}
                /**
                 * Always tell the server. This used to persist the pass ONLY
                 * for a request already assigned to this doctor, and for
                 * anything else — every broadcast, which is most of the
                 * inbox — it just added the id to local state and never called
                 * the backend at all. So the card vanished from this one screen
                 * and nowhere else: still on /doctor/requests, still on the
                 * map, and back in full on the next refresh.
                 */
                onDecline={async () => {
                  try {
                    await actions.declineRequest(r.id);
                  } catch (e) {
                    toast.push({
                      tone: "error",
                      title: "Couldn't pass on that request",
                      desc: e instanceof Error ? e.message : "Please try again.",
                    });
                  }
                }}
              />
            ))
          )}
        </div>
        {pending.length > INBOX_PREVIEW && (
          <Link
            href="/doctor/requests"
            className="border-t border-[var(--border)] px-4 py-3 text-center text-xs font-medium text-[var(--text-muted)] transition-colors hover:text-cream"
          >
            View all {pending.length} requests
          </Link>
        )}
      </Card>

      {/* Earnings + acceptance + setup goals */}
      <div className="lg:col-span-4">
        <ActivityCard
          title="Earnings this week"
          caption="Daily net (₹), tap a day to read it"
          data={earnings.data}
          // null means "nothing to compare against" — the badge hides rather
          // than asserting a measured 0%.
          trend={earnings.trend ?? undefined}
          href="/doctor/earnings"
          hrefLabel="Open your wallet"
          formatValue={formatINR}
        />
      </div>
      <div className="lg:col-span-4">
        <GaugeCard
          title="Acceptance"
          value={acceptance}
          caption={answered.length > 0 ? `of ${answered.length} answered` : "nothing answered yet"}
        />
      </div>
      <div className="lg:col-span-4">
        <GoalsCard title="Get set up" goals={doctorGoals} />
      </div>

      {/* Recent activity + news + FAQs */}
      <div className="lg:col-span-12">
        <HistoryCard
          title="Recent consults"
          items={myCompleted.slice(0, 4).map((r) => ({
            id: r.id,
            title: r.patientName,
            sub: `${formatINRCompact(r.fee)} · completed`,
            color: "#7C8B5E",
          }))}
          href="/doctor/consults"
          emptyText="Completed visits will show here"
        />
      </div>
      <div className="lg:col-span-6">
        <NewsCarousel role="doctor" />
      </div>
      <div className="lg:col-span-6">
        <FaqCard role="doctor" />
      </div>
    </div>
  );
}

function MapLegend() {
  return (
    <div className="hidden items-center gap-3 text-[11px] text-[var(--text-muted)] sm:flex">
      <LegendDot className="bg-[rgb(var(--c-cream))]" label="Patient" />
      <LegendDot className="bg-tan" label="You" />
    </div>
  );
}

function LegendDot({ className, label }: { className: string; label: string }) {
  return (
    <span className="flex items-center gap-1.5">
      <span className={`h-2 w-2 rounded-full ${className}`} />
      {label}
    </span>
  );
}
