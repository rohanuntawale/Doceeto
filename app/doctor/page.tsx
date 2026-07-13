"use client";

import { useMemo, useState } from "react";
import { Inbox, Siren, Star, Timer, TrendingUp } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { StatCard } from "@/components/ui/stat-card";
import { Card, CardHeader } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { OnlineToggle } from "@/components/doctor/online-toggle";
import { RequestCard } from "@/components/zumi/request-card";
import { SosCard } from "@/components/sos/sos-card";
import { useToast } from "@/components/ui/toast";
import {
  useConsultRequests,
  useSosEvents,
  useActions,
} from "@/lib/hooks/data";
import { useCurrentDoctor } from "@/lib/hooks/use-current-doctor";
import { haversineKm } from "@/lib/utils/geo";
import { formatINRCompact } from "@/lib/utils/format";

export default function DoctorHome() {
  const me = useCurrentDoctor();
  const requests = useConsultRequests();
  const sos = useSosEvents();
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

  const earningsToday = myCompletedToday.reduce((a, r) => a + r.fee, 0);

  const nearbySos = useMemo(() => {
    if (!me) return [];
    return sos
      .filter((e) => e.status === "open" || e.status === "assigned")
      .map((e) => ({ e, km: haversineKm(me, e) }))
      .sort((a, b) => a.km - b.km)
      .slice(0, 3);
  }, [sos, me]);

  return (
    <>
      <PageHeader
        kanji="助け"
        label="DOCTOR · TODAY"
        title={me ? me.fullName.replace("Dr. ", "Dr. ") : "Doctor"}
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
        <StatCard
          value="4m"
          label="Avg response"
          icon={<Timer className="h-4 w-4" />}
        />
      </div>

      <div className="mt-5 grid gap-5 lg:grid-cols-2">
        {/* Incoming Zumi requests */}
        <Card>
          <CardHeader
            label="ZUMI · INCOMING"
            title={`Requests (${pending.length})`}
          />
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
                  note={
                    r.doctorId === me?.id
                      ? "Chose you"
                      : "Open to nearby doctors"
                  }
                  onAccept={() => {
                    if (!me) return;
                    actions.acceptRequest(r.id, me.id);
                    toast.push({
                      tone: "success",
                      title: "Consult accepted",
                      desc: `${r.patientName} · ${r.address}`,
                    });
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

        {/* Nearby SOS (Tasuke) */}
        <Card>
          <CardHeader label="TASUKE · NEARBY SOS" title="Golden-minute alerts" />
          <div className="space-y-3 p-4">
            {nearbySos.length === 0 ? (
              <EmptyState
                kanji="助"
                title="No emergencies nearby"
                desc="You'll be alerted if an SOS fires near your location."
              />
            ) : (
              nearbySos.map(({ e, km }) => (
                <div key={e.id}>
                  <div className="mb-1 flex items-center justify-between px-1">
                    <span className="label">{km.toFixed(1)} km away</span>
                    {!e.doctorId && (
                      <button
                        onClick={() => {
                          if (!me) return;
                          actions.assignDoctorToSos(e.id, me.id);
                          toast.push({
                            tone: "success",
                            title: "You're responding",
                            desc: `${e.patientName} · ${e.address}`,
                          });
                        }}
                        className="text-xs font-medium text-terracotta hover:text-salmon"
                      >
                        Respond →
                      </button>
                    )}
                  </div>
                  <SosCard event={e} compact />
                </div>
              ))
            )}
          </div>
        </Card>
      </div>
    </>
  );
}
