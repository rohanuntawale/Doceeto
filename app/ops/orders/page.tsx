"use client";

import { PageHeader } from "@/components/layout/page-header";
import { StatCard } from "@/components/ui/stat-card";
import { OrderCard } from "@/components/auramed/order-card";
import { EmptyState } from "@/components/ui/empty-state";
import { useToast } from "@/components/ui/toast";
import { useOrders, useActions } from "@/lib/hooks/data";
import { formatINRCompact } from "@/lib/utils/format";

export default function OrdersBoard() {
  const orders = useOrders();
  const actions = useActions();
  const toast = useToast();

  const active = orders.filter(
    (o) => o.status !== "delivered" && o.status !== "cancelled",
  );
  const done = orders.filter((o) => o.status === "delivered");
  const revenue = orders.reduce((a, o) => a + o.total, 0);

  return (
    <>
      <PageHeader kanji="薬" label="MEDICINE · FULFILMENT" title="Medicine orders" />

      <div className="grid grid-cols-3 gap-3">
        <StatCard value={active.length} label="In flight" accent />
        <StatCard value="10m" label="Target ETA" />
        <StatCard value={formatINRCompact(revenue)} label="Order value" />
      </div>

      <section className="mt-6">
        <div className="label mb-3">IN FLIGHT · {active.length}</div>
        {active.length === 0 ? (
          <EmptyState kanji="薬" title="No active deliveries" />
        ) : (
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {active.map((o) => (
              <OrderCard
                key={o.id}
                order={o}
                onAdvance={() => {
                  actions.advanceOrder(o.id, o.status);
                  toast.push({ tone: "info", title: "Order advanced" });
                }}
              />
            ))}
          </div>
        )}
      </section>

      <section className="mt-8">
        <div className="label mb-3">DELIVERED · {done.length}</div>
        {done.length === 0 ? (
          <EmptyState kanji="済" title="Nothing delivered yet" />
        ) : (
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {done.map((o) => (
              <OrderCard key={o.id} order={o} />
            ))}
          </div>
        )}
      </section>
    </>
  );
}
