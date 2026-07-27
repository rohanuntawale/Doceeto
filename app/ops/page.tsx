"use client";

import Link from "next/link";
import { Users, Pill, ArrowUpRight } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { StatCard } from "@/components/ui/stat-card";
import { Card, CardHeader } from "@/components/ui/card";
import { LiveMap } from "@/components/map/live-map";
import { OrderCard } from "@/components/auramed/order-card";
import { EmptyState } from "@/components/ui/empty-state";
import { useOpsSnapshot, useOrders, useDoctors, useActions } from "@/lib/hooks/data";

export default function OpsOverview() {
  const snap = useOpsSnapshot();
  const orders = useOrders();
  const doctors = useDoctors();
  const actions = useActions();

  const activeOrders = orders
    .filter((o) => o.status !== "delivered" && o.status !== "cancelled")
    .slice(0, 4);

  return (
    <>
      <PageHeader kanji="全" label="OPS · COMMAND CENTER" title="City overview" />

      <div className="grid grid-cols-2 gap-3">
        <StatCard
          value={`${snap.doctorsOnline}/${snap.doctorsTotal}`}
          label="Doctors online"
          accent
          icon={<Users className="h-4 w-4" />}
        />
        <StatCard value={snap.ordersActive} label="AuraMed active" icon={<Pill className="h-4 w-4" />} />
      </div>

      <Card className="mt-5 overflow-hidden">
        <CardHeader label="LIVE MAP" title="Nagpur" action={<Legend />} />
        <div className="p-4">
          <LiveMap doctors={doctors} height={380} />
        </div>
      </Card>

      <Card className="mt-5">
        <CardHeader
          label="AURAMED · IN FLIGHT"
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
              <OrderCard key={o.id} order={o} onAdvance={() => actions.advanceOrder(o.id, o.status)} />
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
