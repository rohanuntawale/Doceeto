"use client";

import type { ReactNode } from "react";
import { MapPin, Video, Home, Building2, Clock } from "lucide-react";
import { StatusPill } from "@/components/ui/status-pill";
import { StarDisplay } from "@/components/ui/star-rating";
import { Button } from "@/components/ui/button";
import { formatINR, timeAgo } from "@/lib/utils/format";
import { consultStatus, consultType } from "@/lib/labels";
import { useMounted } from "@/lib/hooks/use-mounted";
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
  /** Extra content below the card body, e.g. a rating input. */
  footer?: ReactNode;
}) {
  const mounted = useMounted();
  const st = consultStatus[request.status];
  const isPending = request.status === "pending";
  const isAccepted = request.status === "accepted";
  const patientRating = request.patientRating ?? 0;

  return (
    <div className="rounded-card border border-[var(--border)] bg-espresso-800 p-4 shadow-card transition-colors hover:border-white/15">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="grid h-10 w-10 place-items-center rounded-lg bg-white/5 text-salmon">
            {typeIcon[request.type]}
          </span>
          <div>
            <div className="flex items-center gap-2">
              <p className="font-medium text-cream">{request.patientName}</p>
              {patientRating > 0 && (
                <StarDisplay value={patientRating} count={request.patientRatingCount} />
              )}
            </div>
            <p className="text-xs text-[var(--text-muted)]">
              {consultType[request.type].label}
            </p>
            {note && (
              <span className="mt-1 inline-block rounded-full bg-terracotta/12 px-2 py-0.5 text-[10px] font-medium text-salmon ring-1 ring-inset ring-terracotta/20">
                {note}
              </span>
            )}
          </div>
        </div>
        <div className="text-right">
          <div className="metric text-xl text-cream">{formatINR(request.fee)}</div>
          <StatusPill tone={st.tone} className="mt-1">
            {st.label}
          </StatusPill>
        </div>
      </div>

      <p className="mt-3 text-sm text-[var(--text-muted)]">{request.symptoms}</p>

      <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-[var(--text-faint)]">
        <span className="flex items-center gap-1.5">
          <MapPin className="h-3.5 w-3.5" /> {request.address}
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
                title={canAccept ? undefined : "Finish your current consult first"}
              >
                Accept
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
        <p className="mt-2 text-xs text-tan">Finish your current consult to accept another.</p>
      )}

      {footer && <div className="mt-3 border-t border-[var(--border)] pt-3">{footer}</div>}
    </div>
  );
}
