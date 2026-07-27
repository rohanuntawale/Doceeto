"use client";

/**
 * "You're on a gig" — the doctor's only route back to being available.
 *
 * While a gig hire is accepted the doctor is paused everywhere: no urgent
 * requests reach them, no new bookings land, and their listing shows as
 * unavailable. Completing this row is what releases all of that, so the banner
 * is deliberately loud and carries the action itself rather than linking away.
 */
import { useState } from "react";
import { Briefcase, Check, Clock, MapPin, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { CancelVisitDialog } from "@/components/doctor/cancel-visit-dialog";
import { useActions } from "@/lib/hooks/data";
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
  const { completeRequest } = useActions();
  const toast = useToast();
  const mounted = useMounted();
  const [cancelling, setCancelling] = useState(false);

  return (
    <div
      className={cn(
        "rounded-card border border-terracotta/40 bg-terracotta/[0.07] p-5 shadow-card",
        className,
      )}
    >
      <div className="flex flex-wrap items-start justify-between gap-4">
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

        <div className="flex shrink-0 gap-2">
          <Button
            onClick={() => {
              completeRequest(request.id);
              toast.push({
                tone: "success",
                title: "Gig completed",
                desc: "You're available again — earnings are in your wallet.",
              });
            }}
          >
            <Check className="h-4 w-4" /> Mark complete
          </Button>
          <Button variant="ghost" onClick={() => setCancelling(true)}>
            <X className="h-4 w-4" /> Cancel
          </Button>
        </div>
      </div>

      <p className="mt-3 border-t border-terracotta/20 pt-3 text-xs leading-relaxed text-tan">
        No new bookings or urgent requests will reach you until this is done.
        Appointments you&apos;ve already confirmed still stand.
      </p>

      <CancelVisitDialog
        request={request}
        open={cancelling}
        onClose={() => setCancelling(false)}
      />
    </div>
  );
}
