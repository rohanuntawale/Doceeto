"use client";

import type { ReactNode } from "react";
import { MapPin, Video, Home, Building2, Clock, CalendarDays, Zap, Briefcase } from "lucide-react";
import { StatusPill } from "@/components/ui/status-pill";
import { StarDisplay } from "@/components/ui/star-rating";
import { Button } from "@/components/ui/button";
import { formatINR, timeAgo } from "@/lib/utils/format";
import { consultStatusOf, consultTypeOf } from "@/lib/labels";
import { useMounted } from "@/lib/hooks/use-mounted";
import { isGig, isScheduled } from "@/lib/scheduling/slots";
import { formatSlotRange } from "@/lib/scheduling/time";
import { formatGigDuration } from "@/lib/gigs/rules";
import type { ConsultRequest } from "@/lib/types/domain";

const typeIcon = {
  video: <Video className="h-4 w-4" />,
  home_visit: <Home className="h-4 w-4" />,
  clinic: <Building2 className="h-4 w-4" />,
};

export function RequestCard({
  request,
  note,
  onAccept,
  onDecline,
  onComplete,
  canAccept = true,
  blockedReason,
  footer,
}: {
  request: ConsultRequest;
  /** Small badge, e.g. "Open to nearby doctors" or "Chose you". */
  note?: string;
  onAccept?: () => void;
  onDecline?: () => void;
  onComplete?: () => void;
  /** When false, Accept is disabled (doctor already has an active consult). */
  canAccept?: boolean;
  /** Shown in place of the generic line when Accept is blocked. */
  blockedReason?: string;
  /** Extra content below the card body, e.g. a rating input. */
  footer?: ReactNode;
}) {
  const mounted = useMounted();
  const st = consultStatusOf(request.status);
  const isPending = request.status === "pending";
  const isAccepted = request.status === "accepted";
  const patientRating = request.patientRating ?? 0;
  const booked = isScheduled(request);
  const gig = isGig(request);

  return (
    <div className="rounded-card border border-[var(--border)] bg-espresso-800 p-4 shadow-card transition-colors hover:border-white/15">
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 flex-1 items-center gap-3">
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-white/5 text-salmon">
            {typeIcon[request.type]}
          </span>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <p className="truncate font-medium text-cream">{request.patientName}</p>
              {patientRating > 0 && (
                <StarDisplay value={patientRating} count={request.patientRatingCount} />
              )}
            </div>
            <p className="text-xs text-[var(--text-muted)]">
              {consultTypeOf(request.type).label}
            </p>
            {note && (
              <span className="mt-1 inline-block rounded-full bg-terracotta/12 px-2 py-0.5 text-[10px] font-medium text-salmon ring-1 ring-inset ring-terracotta/20">
                {note}
              </span>
            )}
          </div>
        </div>
        <div className="shrink-0 text-right">
          <div className="metric text-xl text-cream">{formatINR(request.fee)}</div>
          <StatusPill tone={st.tone} className="mt-1">
            {st.label}
          </StatusPill>
        </div>
      </div>

      {/* How they reached you, and when — the first thing a doctor triages on. */}
      <div
        className={`mt-3 flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium ${
          gig
            ? "bg-status-warn/12 text-tan"
            : booked
              ? "bg-terracotta/10 text-salmon"
              : "bg-tan/12 text-tan"
        }`}
      >
        {gig ? (
          <>
            <Briefcase className="h-3.5 w-3.5 shrink-0" />
            <span className="truncate">
              Gig · {request.gigTitle || "hired package"}
              {request.slotMinutes
                ? ` · ${formatGigDuration(request.slotMinutes)}`
                : ""}
            </span>
          </>
        ) : booked ? (
          <>
            <CalendarDays className="h-3.5 w-3.5 shrink-0" />
            {mounted && request.scheduledAt
              ? formatSlotRange(request.scheduledAt, request.scheduledEnd)
              : "Booked appointment"}
          </>
        ) : (
          <>
            <Zap className="h-3.5 w-3.5 shrink-0" />
            Urgent · wants to be seen now
          </>
        )}
      </div>

      <p className="mt-3 text-sm text-[var(--text-muted)]">{request.symptoms}</p>

      <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-[var(--text-faint)]">
        <span className="flex min-w-0 items-center gap-1.5">
          <MapPin className="h-3.5 w-3.5 shrink-0" />
          <span className="truncate">{request.address}</span>
        </span>
        <span className="flex items-center gap-1.5 font-mono">
          <Clock className="h-3.5 w-3.5" />
          {mounted ? timeAgo(request.createdAt) : ""}
        </span>
      </div>

      {(isPending || isAccepted) && (
        <div className="mt-3 flex gap-2">
          {isPending && (
            <>
              <Button
                size="sm"
                className="flex-1"
                onClick={onAccept}
                disabled={!canAccept}
                title={canAccept ? undefined : blockedReason}
              >
                {gig ? "Take this gig" : booked ? "Confirm" : "Accept"}
              </Button>
              <Button size="sm" variant="ghost" onClick={onDecline}>
                Pass
              </Button>
            </>
          )}
          {isAccepted && (
            <Button size="sm" variant="subtle" className="flex-1" onClick={onComplete}>
              Mark completed
            </Button>
          )}
        </div>
      )}

      {isPending && !canAccept && (
        <p className="mt-2 text-xs text-tan">
          {blockedReason ?? "Finish your current consult to accept another."}
        </p>
      )}

      {footer && <div className="mt-3 border-t border-[var(--border)] pt-3">{footer}</div>}
    </div>
  );
}
