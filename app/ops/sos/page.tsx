"use client";

import { PageHeader } from "@/components/layout/page-header";
import { Card, CardHeader } from "@/components/ui/card";
import { StatCard } from "@/components/ui/stat-card";
import { LiveMap } from "@/components/map/live-map";
import { SosCard } from "@/components/sos/sos-card";
import { EmptyState } from "@/components/ui/empty-state";
import { useToast } from "@/components/ui/toast";
import {
  useSosEvents,
  useAmbulances,
  useDoctors,
  useActions,
} from "@/lib/hooks/data";

export default function SosBoard() {
  const sos = useSosEvents();
  const ambulances = useAmbulances();
  const doctors = useDoctors();
  const actions = useActions();
  const toast = useToast();

  const open = sos.filter((e) => e.status === "open");
  const active = sos.filter(
    (e) => e.status === "assigned" || e.status === "enroute",
  );
  const resolved = sos.filter((e) => e.status === "resolved");

  const handlers = (id: string) => ({
    ambulances,
    doctors,
    onAssignAmbulance: (aid: string) => {
      actions.assignAmbulance(id, aid);
      toast.push({ tone: "success", title: "Ambulance dispatched" });
    },
    onAssignDoctor: (did: string) => {
      actions.assignDoctorToSos(id, did);
      toast.push({ tone: "info", title: "Doctor assigned" });
    },
  });

  return (
    <>
      <PageHeader kanji="助け" label="TASUKE · DISPATCH" title="SOS command" />

      <div className="grid grid-cols-3 gap-3">
        <StatCard value={open.length} label="Open" accent />
        <StatCard value={active.length} label="In progress" />
        <StatCard value={ambulances.filter((a) => a.status === "free").length} label="Ambulances free" />
      </div>

      <Card className="mt-5 overflow-hidden">
        <CardHeader label="LIVE MAP" title="Active emergencies" />
        <div className="p-4">
          <LiveMap events={sos} ambulances={ambulances} doctors={doctors} height={320} />
        </div>
      </Card>

      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        <Column title="OPEN" count={open.length} kanji="急">
          {open.length === 0 ? (
            <EmptyState kanji="助" title="No open SOS" />
          ) : (
            open.map((e) => (
              <SosCard
                key={e.id}
                event={e}
                {...handlers(e.id)}
                onAdvance={() => actions.advanceSos(e.id, e.status)}
              />
            ))
          )}
        </Column>

        <Column title="IN PROGRESS" count={active.length} kanji="進">
          {active.length === 0 ? (
            <EmptyState kanji="進" title="Nothing in transit" />
          ) : (
            active.map((e) => (
              <SosCard
                key={e.id}
                event={e}
                {...handlers(e.id)}
                onAdvance={() => actions.advanceSos(e.id, e.status)}
              />
            ))
          )}
        </Column>

        <Column title="RESOLVED" count={resolved.length} kanji="済">
          {resolved.length === 0 ? (
            <EmptyState kanji="済" title="None resolved yet" />
          ) : (
            resolved.map((e) => <SosCard key={e.id} event={e} compact />)
          )}
        </Column>
      </div>
    </>
  );
}

function Column({
  title,
  count,
  kanji,
  children,
}: {
  title: string;
  count: number;
  kanji: string;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-3">
      <div className="flex items-center gap-2">
        <span className="font-jp text-sm text-salmon">{kanji}</span>
        <span className="label">
          {title} · {count}
        </span>
      </div>
      {children}
    </section>
  );
}
