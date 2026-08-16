"use client";

import { useMemo } from "react";
import {
  CalendarDays,
  Clock,
  MapPin,
  Check,
  X as XIcon,
  Video,
  Home,
  Building2,
} from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { StatusPill } from "@/components/ui/status-pill";
import { EmptyState } from "@/components/ui/empty-state";
import { useToast } from "@/components/ui/toast";
import { AvailabilityEditor } from "@/components/doctor/availability-editor";
import { useConsultRequests, useActions } from "@/lib/hooks/data";
import { useCurrentDoctor } from "@/lib/hooks/use-current-doctor";
import { consultStatusOf, consultTypeOf } from "@/lib/labels";
import { formatINR } from "@/lib/utils/format";
import { useMounted } from "@/lib/hooks/use-mounted";
import {
  clashesWithAccepted,
  intervalOf,
  upcomingAppointments,
} from "@/lib/scheduling/slots";
import { dateKeyOf, formatDayLabel, formatSlotTime } from "@/lib/scheduling/time";
import type { ConsultRequest } from "@/lib/types/domain";

const typeIcon = {
  video: <Video className="h-3.5 w-3.5" />,
  home_visit: <Home className="h-3.5 w-3.5" />,
  clinic: <Building2 className="h-3.5 w-3.5" />,
};

export default function SchedulePage() {
  const me = useCurrentDoctor();
  const requests = useConsultRequests();
  const actions = useActions();
  const toast = useToast();
  const mounted = useMounted();

  const doctorId = me?.id ?? "";

  /** Upcoming appointments bucketed by calendar day, soonest first. */
  const byDay = useMemo(() => {
    if (!doctorId) return [];
    const groups = new Map<string, ConsultRequest[]>();
    for (const r of upcomingAppointments(requests, doctorId)) {
      const key = dateKeyOf(new Date(r.scheduledAt!));
      groups.set(key, [...(groups.get(key) ?? []), r]);
    }
    return [...groups.entries()].map(([date, items]) => ({ date, items }));
  }, [requests, doctorId]);

  const toConfirm = byDay.flatMap((g) => g.items).filter((r) => r.status === "pending").length;

  async function run(label: string, fn: () => Promise<void> | void) {
    try {
      await fn();
      toast.push({ tone: "success", title: label });
    } catch (e) {
      toast.push({
        tone: "error",
        title: `Couldn't ${label.toLowerCase()}`,
        desc: e instanceof Error ? e.message : "Please try again.",
      });
    }
  }

  if (!me) return null;

  return (
    <>
      <PageHeader label="DOCEETO · SCHEDULE" title="Your schedule" />

      <div className="grid gap-5 lg:grid-cols-[1fr_1fr]">
        {/* ── Upcoming ────────────────────────────────── */}
        <Card>
          <CardHeader
            label="DOCEETO · UPCOMING"
            title="Booked appointments"
            action={
              toConfirm > 0 ? (
                <span className="rounded-full bg-tan/15 px-2.5 py-1 text-[11px] font-semibold text-tan">
                  {toConfirm} to confirm
                </span>
              ) : undefined
            }
          />
          {byDay.length === 0 ? (
            <div className="p-4">
              <EmptyState
                title="Nothing booked yet"
                desc="Set your weekly hours below and patients can pick a slot."
              />
            </div>
          ) : (
            <div className="divide-y divide-[var(--border)]">
              {byDay.map((group) => (
                <div key={group.date} className="px-5 py-4">
                  <div className="label mb-2.5">
                    {mounted ? formatDayLabel(group.date, dateKeyOf(new Date())) : group.date}
                  </div>
                  <div className="space-y-2.5">
                    {group.items.map((r) => {
                      const st = consultStatusOf(r.status);
                      const iv = intervalOf(r);
                      const clash =
                        r.status === "pending" && clashesWithAccepted(r, requests, doctorId);
                      return (
                        <div
                          key={r.id}
                          className="rounded-lg border border-[var(--border)] bg-espresso p-3"
                        >
                          <div className="flex flex-wrap items-start justify-between gap-2">
                            <div className="min-w-0">
                              <p className="flex items-center gap-2 text-sm font-medium text-cream">
                                <Clock className="h-3.5 w-3.5 text-salmon" />
                                {iv ? formatSlotTime(new Date(iv.start)) : ", "}
                                {iv && (
                                  <span className="text-[var(--text-faint)]">
                                    – {formatSlotTime(new Date(iv.end))}
                                  </span>
                                )}
                              </p>
                              <p className="mt-0.5 truncate text-sm text-cream">
                                {r.patientName}
                              </p>
                              <p className="flex items-center gap-1.5 text-xs text-[var(--text-muted)]">
                                {typeIcon[r.type]}
                                {consultTypeOf(r.type).label} · {formatINR(r.fee)}
                              </p>
                              <p className="mt-0.5 flex items-center gap-1.5 text-xs text-[var(--text-faint)]">
                                <MapPin className="h-3 w-3" /> {r.address}
                              </p>
                            </div>
                            <StatusPill tone={st.tone}>{st.label}</StatusPill>
                          </div>

                          {clash && (
                            <p className="mt-2 text-xs text-status-critical">
                              Clashes with another visit you already confirmed.
                            </p>
                          )}

                          <div className="mt-2.5 flex flex-wrap gap-2">
                            {r.status === "pending" && (
                              <Button
                                size="sm"
                                disabled={clash}
                                onClick={() =>
                                  run("Appointment confirmed", () =>
                                    actions.acceptRequest(r.id, doctorId),
                                  )
                                }
                              >
                                <Check className="h-3.5 w-3.5" /> Confirm
                              </Button>
                            )}
                            {r.status === "accepted" && (
                              <Button
                                size="sm"
                                variant="subtle"
                                onClick={() => {
                                  actions.completeRequest(r.id);
                                  toast.push({ tone: "success", title: "Consult completed" });
                                }}
                              >
                                Mark completed
                              </Button>
                            )}
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() =>
                                run("Appointment cancelled", () => actions.cancelRequest(r.id))
                              }
                            >
                              <XIcon className="h-3.5 w-3.5" /> Cancel
                            </Button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>

        {/* ── Availability ────────────────────────────── */}
        <Card>
          <CardHeader
            label="DOCEETO · AVAILABILITY"
            title="When you can be booked"
            action={<CalendarDays className="h-4 w-4 text-[var(--text-faint)]" />}
          />
          <div className="p-5">
            <AvailabilityEditor doctor={me} />
          </div>
        </Card>
      </div>
    </>
  );
}
