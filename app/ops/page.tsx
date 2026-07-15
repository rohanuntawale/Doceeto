"use client";

import Link from "next/link";
import { Siren, Truck, Users, Pill, ArrowUpRight } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { StatCard } from "@/components/ui/stat-card";
import { Card, CardHeader } from "@/components/ui/card";
import { LiveMap } from "@/components/map/live-map";
import { SosCard } from "@/components/sos/sos-card";
import { OrderCard } from "@/components/auramed/order-card";
import { EmptyState } from "@/components/ui/empty-state";
import {
  useOpsSnapshot,
  useSosEvents,
  useOrders,
  useAmbulances,
  useDoctors,
  useActions,
} from "@/lib/hooks/data";

export default function OpsOverview() {
  const snap = useOpsSnapshot();
  const sos = useSosEvents();
  const orders = useOrders();
  const ambulances = useAmbulances();
  const doctors = useDoctors();
  const actions = useActions();

  const activeSos = sos
    .filter((e) => e.status !== "resolved" && e.status !== "cancelled")
    .slice(0, 3);
  const activeOrders = orders
    .filter((o) => o.status !== "delivered" && o.status !== "cancelled")
    .slice(0, 2);

  return (
    <>
      <PageHeader
        kanji="全"
        label="OPS · COMMAND CENTER"
        title="City overview"
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard value={snap.activeSos} label="Active SOS" accent icon={<Siren className="h-4 w-4" />} sub={`${snap.avgResponseMins}m avg response`} />
        <StatCard value={`${snap.ambulancesFree}/${snap.ambulancesTotal}`} label="Ambulances free" icon={<Truck className="h-4 w-4" />} />
        <StatCard value={`${snap.doctorsOnline}/${snap.doctorsTotal}`} label="Doctors online" icon={<Users className="h-4 w-4" />} />
        <StatCard value={snap.ordersActive} label="AuraMed active" icon={<Pill className="h-4 w-4" />} />
      </div>

      <div className="mt-5 grid gap-5 lg:grid-cols-[1.4fr_1fr]">
        <Card className="overflow-hidden">
          <CardHeader
            label="LIVE MAP"
            title="Pune"
            action={<Legend />}
          />
          <div className="p-4">
            <LiveMap
              events={sos}
              ambulances={ambulances}
              doctors={doctors}
              height={380}
            />
          </div>
        </Card>

        <Card>
          <CardHeader
            label="ACTIVE EMERGENCIES"
            title="Emergencies"
            action={
              <Link href="/ops/sos" className="flex items-center gap-1 text-xs text-salmon hover:underline">
                Dispatch board <ArrowUpRight className="h-3.5 w-3.5" />
              </Link>
            }
          />
          <div className="space-y-3 p-4">
            {activeSos.length === 0 ? (
              <EmptyState kanji="助" title="No active emergencies" />
            ) : (
              activeSos.map((e) => (
                <SosCard
                  key={e.id}
                  event={e}
                  ambulances={ambulances}
                  doctors={doctors}
                  compact
                  onAssignAmbulance={(id) => actions.assignAmbulance(e.id, id)}
                  onAssignDoctor={(id) => actions.assignDoctorToSos(e.id, id)}
                />
              ))
            )}
          </div>
        </Card>
      </div>

      <Card className="mt-5">
        <CardHeader
          label="MEDICINE · IN TRANSIT"
          title="Medicine deliveries"
          action={
            <Link href="/ops/orders" className="flex items-center gap-1 text-xs text-salmon hover:underline">
              All orders <ArrowUpRight className="h-3.5 w-3.5" />
            </Link>
          }
        />
        <div className="grid gap-3 p-4 md:grid-cols-2">
          {activeOrders.length === 0 ? (
            <EmptyState kanji="薬" title="No active deliveries" />
          ) : (
            activeOrders.map((o) => (
              <OrderCard
                key={o.id}
                order={o}
                onAdvance={() => actions.advanceOrder(o.id, o.status)}
              />
            ))
          )}
        </div>
      </Card>
    </>
  );
}

function Legend() {
  return (
    <div className="hidden items-center gap-3 text-[11px] text-[var(--text-muted)] sm:flex">
      <Dot color="#C15A38" label="SOS" />
      <Dot color="#7C8B63" label="Ambulance" />
      <Dot color="#C9A876" label="Doctor" />
    </div>
  );
}

function Dot({ color, label }: { color: string; label: string }) {
  return (
    <span className="flex items-center gap-1.5">
      <span className="h-2 w-2 rounded-full" style={{ background: color }} />
      {label}
    </span>
  );
}
