"use client";

/**
 * The doctor's gig surface — one of the two ways they earn (the other is the
 * calendar at /doctor/schedule).
 *
 * Left: hires waiting on an answer, and the live gig if they're on one.
 * Right: the shelf of packages they publish.
 */
import { useMemo, useState } from "react";
import {
  Briefcase,
  Plus,
  Pencil,
  Pause,
  Play,
  Archive,
  Video,
  Home,
  Building2,
  Clock,
} from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { StatusPill } from "@/components/ui/status-pill";
import { EmptyState } from "@/components/ui/empty-state";
import { useToast } from "@/components/ui/toast";
import { RequestCard } from "@/components/zumi/request-card";
import { GigEditorDialog } from "@/components/doctor/gig-editor-dialog";
import { OnGigBanner } from "@/components/doctor/on-gig-banner";
import { useActions, useConsultRequests, useGigs } from "@/lib/hooks/data";
import { useCurrentDoctor } from "@/lib/hooks/use-current-doctor";
import { activeGigHireOf, isOnGig, pendingGigHires } from "@/lib/scheduling/slots";
import { formatGigDuration, MAX_ACTIVE_GIGS } from "@/lib/gigs/rules";
import { gigStatusOf } from "@/lib/labels";
import { formatINR } from "@/lib/utils/format";
import { cn } from "@/lib/utils/cn";
import type { Gig } from "@/lib/types/domain";

const typeIcon = {
  video: <Video className="h-3.5 w-3.5" />,
  home_visit: <Home className="h-3.5 w-3.5" />,
  clinic: <Building2 className="h-3.5 w-3.5" />,
};

export default function DoctorGigsPage() {
  const me = useCurrentDoctor();
  const requests = useConsultRequests();
  const gigs = useGigs();
  const actions = useActions();
  const toast = useToast();

  const [editing, setEditing] = useState<Gig | undefined>(undefined);
  const [open, setOpen] = useState(false);

  const doctorId = me?.id ?? "";
  const pending = useMemo(
    () => (doctorId ? pendingGigHires(requests, doctorId) : []),
    [requests, doctorId],
  );
  const live = doctorId ? activeGigHireOf(requests, doctorId) : undefined;
  const busy = doctorId ? isOnGig(requests, doctorId) : false;
  const activeCount = gigs.filter((g) => g.status === "active").length;

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
      <PageHeader
        kanji="仕"
        label="ZUMI · GIGS"
        title="Your gigs"
        action={
          <Button
            size="sm"
            onClick={() => {
              setEditing(undefined);
              setOpen(true);
            }}
          >
            <Plus className="h-3.5 w-3.5" /> New gig
          </Button>
        }
      />

      {/* The live gig comes first: it is the only thing that unpauses them. */}
      {live && <OnGigBanner request={live} className="mb-5" />}

      <div className="grid gap-5 lg:grid-cols-[1fr_1fr]">
        {/* ── Hires waiting on an answer ──────────────── */}
        <Card>
          <CardHeader
            label="ZUMI · GIG REQUESTS"
            title="Patients who want to hire you"
            action={
              pending.length > 0 ? (
                <span className="rounded-full bg-tan/15 px-2.5 py-1 text-[11px] font-semibold text-tan">
                  {pending.length} waiting
                </span>
              ) : undefined
            }
          />
          {pending.length === 0 ? (
            <div className="p-4">
              <EmptyState
                kanji="仕"
                title="No gig requests yet"
                desc={
                  activeCount === 0
                    ? "Publish a gig on the right and patients can hire you from your profile."
                    : "Your gigs are live on your profile. Hires will land here."
                }
              />
            </div>
          ) : (
            <div className="space-y-3 p-4">
              {pending.map((r) => (
                <RequestCard
                  key={r.id}
                  request={r}
                  note="Chose your gig"
                  canAccept={!busy}
                  blockedReason="Finish your current gig before taking another."
                  onAccept={() =>
                    run("Gig accepted", () => actions.acceptRequest(r.id, doctorId))
                  }
                  onDecline={() =>
                    run("Request declined", () => actions.declineRequest(r.id))
                  }
                />
              ))}
            </div>
          )}
        </Card>

        {/* ── The shelf ───────────────────────────────── */}
        <Card>
          <CardHeader
            label="ZUMI · YOUR SHELF"
            title="What you offer"
            action={
              <span className="text-[11px] font-medium text-[var(--text-faint)]">
                {activeCount}/{MAX_ACTIVE_GIGS} live
              </span>
            }
          />
          {gigs.length === 0 ? (
            <div className="p-4">
              <EmptyState
                kanji="仕"
                title="No gigs yet"
                desc="A gig is a package patients hire outright — say what you do, how long it takes, and what it costs."
              />
            </div>
          ) : (
            <div className="divide-y divide-[var(--border)]">
              {gigs.map((g) => {
                const st = gigStatusOf(g.status);
                const retired = g.status === "archived";
                return (
                  <div key={g.id} className="px-5 py-4">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <p
                          className={cn(
                            "truncate text-sm font-medium text-cream",
                            retired && "line-through opacity-60",
                          )}
                        >
                          {g.title}
                        </p>
                        <p className="mt-0.5 flex items-center gap-1.5 text-xs text-[var(--text-muted)]">
                          <span className="text-salmon">{typeIcon[g.type]}</span>
                          {formatINR(g.price)}
                          <span className="text-[var(--text-faint)]">·</span>
                          <Clock className="h-3 w-3" />
                          {formatGigDuration(g.durationMinutes)}
                        </p>
                        {g.description && (
                          <p className="mt-1.5 line-clamp-2 text-xs leading-relaxed text-[var(--text-faint)]">
                            {g.description}
                          </p>
                        )}
                      </div>
                      <StatusPill tone={st.tone}>{st.label}</StatusPill>
                    </div>

                    <div className="mt-2.5 flex flex-wrap gap-2">
                      {!retired && (
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => {
                            setEditing(g);
                            setOpen(true);
                          }}
                        >
                          <Pencil className="h-3.5 w-3.5" /> Edit
                        </Button>
                      )}
                      {g.status === "active" ? (
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() =>
                            run("Gig paused", () => actions.setGigStatus(g.id, "paused"))
                          }
                        >
                          <Pause className="h-3.5 w-3.5" /> Pause
                        </Button>
                      ) : (
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() =>
                            run("Gig published", () => actions.setGigStatus(g.id, "active"))
                          }
                        >
                          <Play className="h-3.5 w-3.5" /> Publish
                        </Button>
                      )}
                      {!retired && (
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() =>
                            run("Gig archived", () => actions.setGigStatus(g.id, "archived"))
                          }
                        >
                          <Archive className="h-3.5 w-3.5" /> Archive
                        </Button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          <div className="border-t border-[var(--border)] p-4">
            <p className="flex items-start gap-2 text-xs leading-relaxed text-[var(--text-faint)]">
              <Briefcase className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              Pausing keeps a gig for later but hides it from patients. Archiving retires
              it — requests already made against it still reach you.
            </p>
          </div>
        </Card>
      </div>

      <GigEditorDialog gig={editing} open={open} onClose={() => setOpen(false)} />
    </>
  );
}
