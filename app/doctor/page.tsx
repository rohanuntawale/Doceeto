"use client";

import { useState } from "react";
import { Inbox, Star, Timer, TrendingUp, Radio } from "lucide-react";
import { StatCard } from "@/components/ui/stat-card";
import { Card, CardHeader } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { OnlineToggle } from "@/components/doctor/online-toggle";
import { RequestCard } from "@/components/zumi/request-card";
import { LiveMap } from "@/components/map/live-map";
import { DoctorConsultTracker } from "@/components/consult/consult-tracker";
import { useToast } from "@/components/ui/toast";
import { useConsultRequests, useActions } from "@/lib/hooks/data";
import { useCurrentDoctor } from "@/lib/hooks/use-current-doctor";
import { useT } from "@/lib/i18n";
import { GlassCard } from "@/components/ui/glass-card";
import { FaqCard, HistoryCard } from "@/components/dashboard/extras";
import { NewsCarousel } from "@/components/dashboard/news-carousel";
import { ProgressRow, GaugeCard, ActivityCard, GoalsCard } from "@/components/dashboard/cards";
import { formatINRCompact } from "@/lib/utils/format";
import { cn } from "@/lib/utils/cn";

export default function DoctorHome() {
  const me = useCurrentDoctor();
  const { t } = useT();
  const requests = useConsultRequests();
  const actions = useActions();
  const toast = useToast();
  const [passed, setPassed] = useState<Set<string>>(new Set());
  const online = me?.status === "online";
  const greetKey =
    new Date().getHours() < 12
      ? "greeting.morning"
      : new Date().getHours() < 17
        ? "greeting.afternoon"
        : "greeting.evening";

  const pending = requests.filter(
    (r) =>
      r.status === "pending" &&
      !passed.has(r.id) &&
      (r.doctorId === null || r.doctorId === me?.id),
  );
  const myCompletedToday = requests.filter(
    (r) => r.status === "completed" && r.doctorId === me?.id,
  );
  const acceptedByMe = requests.filter(
    (r) => r.status === "accepted" && r.doctorId === me?.id,
  );
  // One active consult at a time: gate new accepts while one is in progress.
  const hasActive = acceptedByMe.length > 0;
  const earningsToday = myCompletedToday.reduce((a, r) => a + r.fee, 0);

  const doctorProgress = [
    { label: "Setup", value: me?.about ? 100 : 60 },
    { label: "Verified", value: me?.verified ? 100 : 40, display: me?.verified ? "Done" : "Pending" },
    { label: "Rating", value: me ? Math.round((me.rating || 0) * 20) : 0, display: me?.rating ? me.rating.toFixed(1) : "New" },
    { label: "Response", value: 90, display: "4m" },
  ];
  const earningsWeek = [400, 650, 300, 800, 550, 1200, 700];
  const doctorGoals = [
    { id: "profile", label: "Complete your profile", sub: "Add qualifications & about", done: Boolean(me?.about) },
    { id: "license", label: "Upload your medical license", sub: "Required for verification", done: Boolean(me?.verified) },
    { id: "avail", label: "Set your availability", sub: "Clinic hours & home-visit zone" },
    { id: "bank", label: "Add bank for instant payouts", sub: "Withdraw earnings anytime" },
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

      {/* Put up a gig — go online */}
      <GlassCard className="p-5 lg:col-span-5">
        <div className="flex h-full items-center justify-between gap-4">
          <div>
            <p className="flex items-center gap-1.5 text-sm font-medium text-[var(--text-muted)]">
              <Radio className={cn("h-4 w-4", online ? "text-status-ok" : "text-cream")} />
              Your shift
            </p>
            <p className="mt-0.5 text-xl font-semibold text-cream">
              {online ? "You're online" : "Put up a gig"}
            </p>
            <p className="mt-0.5 text-xs text-[var(--text-faint)]">
              {online
                ? "Requests will come straight to you."
                : "Flip on to appear on the patient map."}
            </p>
          </div>
          <OnlineToggle doctor={me} />
        </div>
      </GlassCard>

      <div className="grid grid-cols-2 gap-3 lg:col-span-7">
        <StatCard
          value={formatINRCompact(earningsToday)}
          label="Earnings today"
          accent
          icon={<TrendingUp className="h-4 w-4" />}
        />
        <StatCard
          value={myCompletedToday.length + acceptedByMe.length}
          label="Consults today"
          icon={<Inbox className="h-4 w-4" />}
        />
        <StatCard
          value={me ? (me.rating > 0 ? me.rating.toFixed(1) : "New") : "New"}
          label="Rating"
          icon={<Star className="h-4 w-4" />}
        />
        <StatCard value="4m" label="Avg response" icon={<Timer className="h-4 w-4" />} />
      </div>

      {/* Progress pills */}
      <div className="lg:col-span-12">
        <ProgressRow items={doctorProgress} />
      </div>

      {/* Live tracking of patients you've accepted (appears when active) */}
      {me && (
        <div className="lg:col-span-12">
          <DoctorConsultTracker doctor={me} />
        </div>
      )}

      {/* Patients around you — live positions of incoming requests */}
      <Card className="overflow-hidden lg:col-span-7">
        <CardHeader label="ZUMI · AROUND YOU" title="Patients near you" action={<MapLegend />} />
        <div className="p-4">
          <LiveMap
            self={me ? { lat: me.lat, lng: me.lng, label: "You (visible to patients)" } : null}
            center={me ? { lat: me.lat, lng: me.lng } : undefined}
            requests={requests.filter(
              (r) =>
                (r.status === "pending" &&
                  (r.doctorId === null || r.doctorId === me?.id)) ||
                (r.status === "accepted" && r.doctorId === me?.id),
            )}
            events={[]}
            height={320}
          />
        </div>
      </Card>

      {/* Incoming requests */}
      <Card className="lg:col-span-5">
        <CardHeader label="ZUMI · INCOMING" title={`Requests (${pending.length})`} />
        <div className="space-y-3 p-4">
          {pending.length === 0 ? (
            <EmptyState
              kanji="頼"
              title="No open requests"
              desc="New consults will appear here the moment they come in."
            />
          ) : (
            pending.map((r) => (
              <RequestCard
                key={r.id}
                request={r}
                canAccept={!hasActive}
                note={r.doctorId === me?.id ? "Chose you" : "Open to nearby doctors"}
                onAccept={async () => {
                  if (!me) return;
                  try {
                    await actions.acceptRequest(r.id, me.id);
                    toast.push({
                      tone: "success",
                      title: "Consult accepted",
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
                onDecline={() => {
                  if (r.doctorId === me?.id) actions.declineRequest(r.id);
                  else setPassed((p) => new Set(p).add(r.id));
                }}
              />
            ))
          )}
        </div>
      </Card>

      {/* Earnings + acceptance + setup goals */}
      <div className="lg:col-span-4">
        <ActivityCard title="Earnings this week" caption="Daily net (₹)" data={earningsWeek} trend={22} />
      </div>
      <div className="lg:col-span-4">
        <GaugeCard title="Acceptance" value={92} caption="of requests" trend={3} spark={[85, 88, 86, 90, 89, 91, 92]} />
      </div>
      <div className="lg:col-span-4">
        <GoalsCard title="Get set up" goals={doctorGoals} />
      </div>

      {/* Recent activity + news + FAQs */}
      <div className="lg:col-span-12">
        <HistoryCard
          title="Recent consults"
          items={myCompletedToday.slice(0, 4).map((r) => ({
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
