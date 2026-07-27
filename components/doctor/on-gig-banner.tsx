"use client";

/**
 * "You're on a gig" — the doctor's only route back to being available.
 *
 * While a gig hire is accepted the doctor is paused everywhere: no urgent
 * requests reach them, no new bookings land, and their listing is hidden from
 * patients. The banner carries the visit's whole journey — the same
 * Accepted → On the way → Arrived → In consult rail as the consult tracker —
 * and completing the final step is what releases all of that.
 */
import { Briefcase, Clock, MapPin } from "lucide-react";
import { TripRail, TripControls } from "@/components/consult/consult-tracker";
import { useMounted } from "@/lib/hooks/use-mounted";
import { formatGigDuration } from "@/lib/gigs/rules";
import { formatINR, timeAgo } from "@/lib/utils/format";
import { cn } from "@/lib/utils/cn";
import type { ConsultRequest } from "@/lib/types/domain";

export function OnGigBanner({
  request,
  className,
}: {
  request: ConsultRequest;
  className?: string;
}) {
  const mounted = useMounted();

  return (
    <div
      className={cn(
        "rounded-card border border-terracotta/40 bg-terracotta/[0.07] p-5 shadow-card",
        className,
      )}
    >
      <div className="flex min-w-0 items-start gap-3">
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-terracotta/15 text-salmon">
          <Briefcase className="h-5 w-5" />
        </span>
        <div className="min-w-0">
          <div className="label text-salmon">ON A GIG · YOU&apos;RE PAUSED</div>
          <p className="mt-0.5 truncate text-lg font-semibold text-cream">
            {request.gigTitle || "Hired package"}
          </p>
          <p className="mt-0.5 text-sm text-[var(--text-muted)]">
            {request.patientName} · {formatINR(request.fee)}
            {request.slotMinutes ? ` · ${formatGigDuration(request.slotMinutes)}` : ""}
          </p>
          <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-[var(--text-faint)]">
            {request.address && (
              <span className="flex items-center gap-1.5">
                <MapPin className="h-3 w-3" /> {request.address}
              </span>
            )}
            {request.acceptedAt && (
              <span className="flex items-center gap-1.5 font-mono">
                <Clock className="h-3 w-3" />
                {mounted ? `started ${timeAgo(request.acceptedAt)}` : ""}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* The journey + its controls — advance a step, complete, or cancel. */}
      <div className="mt-4 overflow-hidden rounded-lg border border-[var(--border)] bg-espresso-800">
        <TripRail req={request} />
        <TripControls req={request} />
      </div>

      <p className="mt-3 border-t border-terracotta/20 pt-3 text-xs leading-relaxed text-tan">
        No new bookings or urgent requests will reach you until this is done.
        Appointments you&apos;ve already confirmed still stand.
      </p>
    </div>
  );
}
