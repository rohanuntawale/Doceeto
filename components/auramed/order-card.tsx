"use client";

import { MapPin, Store, Clock, ArrowRight } from "lucide-react";
import { StatusPill } from "@/components/ui/status-pill";
import { Button } from "@/components/ui/button";
import { formatINR, timeAgo } from "@/lib/utils/format";
import { orderStatusOf } from "@/lib/labels";
import { useMounted } from "@/lib/hooks/use-mounted";
import { cn } from "@/lib/utils/cn";
import type { Order } from "@/lib/types/domain";

const STEPS = ["Placed", "Packed", "Out", "Delivered"];

export function OrderCard({
  order,
  onAdvance,
}: {
  order: Order;
  onAdvance?: () => void;
}) {
  const mounted = useMounted();
  const st = orderStatusOf(order.status);
  const active = order.status !== "delivered" && order.status !== "cancelled";

  return (
    <div className="rounded-card border border-[var(--border)] bg-espresso-800 p-4 shadow-card">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="font-medium text-cream">{order.patientName}</p>
          <p className="mt-0.5 flex items-center gap-1.5 text-xs text-[var(--text-muted)]">
            <Store className="h-3.5 w-3.5" /> {order.darkStore}
          </p>
        </div>
        <div className="text-right">
          <div className="metric text-lg text-cream">{formatINR(order.total)}</div>
          <StatusPill tone={st.tone} className="mt-1">
            {st.label}
          </StatusPill>
        </div>
      </div>

      {/* progress rail */}
      <div className="mt-3.5 flex items-center gap-1">
        {STEPS.map((label, i) => (
          <div key={label} className="flex-1">
            <div
              className={cn(
                "h-1 rounded-full",
                i <= st.step ? "bg-terracotta" : "bg-white/8",
              )}
            />
            <span
              className={cn(
                "mt-1 block text-[10px]",
                i <= st.step ? "text-salmon" : "text-[var(--text-faint)]",
              )}
            >
              {label}
            </span>
          </div>
        ))}
      </div>

      <div className="mt-3 flex flex-wrap gap-x-1 gap-y-0.5 text-xs text-[var(--text-muted)]">
        {order.items.map((it, i) => (
          <span key={i}>
            {it.name}
            {it.qty > 1 ? ` ×${it.qty}` : ""}
            {i < order.items.length - 1 ? "," : ""}&nbsp;
          </span>
        ))}
      </div>

      <div className="mt-3 flex items-center justify-between">
        <div className="flex items-center gap-3 text-xs text-[var(--text-faint)]">
          <span className="flex items-center gap-1.5">
            <MapPin className="h-3.5 w-3.5" /> {order.address}
          </span>
          {active && (
            <span className="flex items-center gap-1.5 font-mono text-salmon">
              <Clock className="h-3.5 w-3.5" /> {order.etaMins}m ETA
            </span>
          )}
          {!active && (
            <span className="font-mono">
              {mounted ? timeAgo(order.createdAt) : ""}
            </span>
          )}
        </div>
        {active && onAdvance && (
          <Button size="sm" variant="subtle" onClick={onAdvance}>
            Next <ArrowRight className="h-3.5 w-3.5" />
          </Button>
        )}
      </div>
    </div>
  );
}
