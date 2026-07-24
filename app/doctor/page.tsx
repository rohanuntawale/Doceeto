"use client";

import { useState } from "react";
import { Inbox, Star, Timer, TrendingUp } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
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
import { formatINRCompact } from "@/lib/utils/format";

export default function DoctorHome() {
  const me = useCurrentDoctor();
  const requests = useConsultRequests();
  const actions = useActions();
  const toast = useToast();
  const [passed, setPassed] = useState<Set<string>>(new Set());

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

  return (
    <>
      <PageHeader
        kanji="助け"
        label="DOCTOR · TODAY"
        title={me ? me.fullName : "Doctor"}
        action={<OnlineToggle doctor={me} />}
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
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

      {/* Live tracking of patients you've accepted (appears when active) */}
      {me && (
        <div className="mt-5">
          <DoctorConsultTracker doctor={me} />
        </div>
      )}

      {/* Patients around you — live positions of incoming requests */}
      <Card className="mt-5 overflow-hidden">
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
      <Card className="mt-5">
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
    </>
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
