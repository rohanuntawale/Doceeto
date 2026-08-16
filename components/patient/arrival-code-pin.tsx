"use client";

import { useEffect, useState } from "react";
import { ChevronUp, RefreshCw, ShieldCheck, X } from "lucide-react";
import { useActions, useConsultRequests } from "@/lib/hooks/data";
import { useCurrentPatient } from "@/lib/hooks/use-current-patient";
import { useToast } from "@/components/ui/toast";
import { useT } from "@/lib/i18n";
import { MAX_START_CODE_ATTEMPTS, tripStageOfRequest } from "@/lib/scheduling/trip";
import { cn } from "@/lib/utils/cn";
import type { ConsultRequest } from "@/lib/types/domain";

/**
 * The arrival code, pinned.
 *
 * A stranger is about to knock on your door, and these four digits are how you
 * know it is the right one. That makes the code a credential you hold up, not a
 * receipt you go looking for — so it lives above the dock from the moment a
 * provider accepts until the consult starts, and never inside a card you have
 * to scroll to.
 *
 * The digits are shown rather than hidden behind a tap: it is the patient's own
 * phone, the code is worthless without the provider standing there, and hiding
 * it would recreate exactly the hunt this replaces.
 *
 * Deliberately unlike the provider's keypad — a stamped token, not input boxes —
 * so the two halves of the handshake never look like the same control.
 */
export function ArrivalCodePin() {
  const { patient } = useCurrentPatient();
  const requests = useConsultRequests();
  const [open, setOpen] = useState(false);
  const [dismissedFor, setDismissedFor] = useState<string | null>(null);

  /**
   * The visit this code belongs to. Live from the moment a provider ACCEPTS
   * until the consult actually starts — deliberately not gated on
   * awaitingStartCode(), which for a home visit is only true once they have
   * arrived. Waiting until then would put the code back out of reach for the
   * whole journey, which is the problem this replaces.
   *
   * Newest wins if there are somehow two: the code on screen must never be
   * ambiguous about which visit it opens.
   */
  const req = requests
    .filter(
      (r) =>
        r.patientId === patient?.id &&
        r.status === "accepted" &&
        Boolean(r.startCode) &&
        tripStageOfRequest(r) !== "in_progress",
    )
    .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1))[0];

  // A new visit re-arms the pin: dismissing one code must not hide the next.
  useEffect(() => {
    if (req && dismissedFor && dismissedFor !== req.id) setDismissedFor(null);
  }, [req, dismissedFor]);

  if (!req || dismissedFor === req.id) return null;

  return (
    <>
      <CollapsedPin req={req} onOpen={() => setOpen(true)} />
      {open && <CodeSheet req={req} onClose={() => setOpen(false)} />}
    </>
  );
}

/** The always-there pill. Sits above the dock and clears the safe area. */
function CollapsedPin({ req, onOpen }: { req: ConsultRequest; onOpen: () => void }) {
  const { t } = useT();
  return (
    // Anchored to the left rather than centred: the dock sits centre-bottom and
    // pages float their own call-to-action bottom-right, so the middle is the
    // one place a persistent overlay is guaranteed to collide with something.
    <div
      className="pointer-events-none fixed inset-x-0 z-40 flex justify-start px-3"
      style={{ bottom: "calc(var(--chrome-dock) + 0.75rem)" }}
    >
      <button
        onClick={onOpen}
        aria-label={t("pin.expand")}
        className={cn(
          "pointer-events-auto flex items-center gap-3 rounded-full border border-terracotta/45 bg-espresso-800/95 py-2 pl-3.5 pr-3",
          "shadow-[0_10px_30px_rgba(0,0,0,0.35),0_0_0_1px_rgba(192,105,47,0.12)] backdrop-blur-xl",
          "transition-transform active:scale-[0.98]",
          "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[rgb(var(--c-terracotta))]",
        )}
      >
        <span className="relative flex h-6 w-6 shrink-0 items-center justify-center">
          {/* A slow pulse marks the code as live without demanding attention. */}
          <span className="absolute inset-0 animate-ping rounded-full bg-terracotta/25 [animation-duration:2.6s] motion-reduce:hidden" />
          <ShieldCheck className="relative h-4 w-4 text-salmon" />
        </span>

        <span className="flex flex-col items-start leading-none">
          <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--text-faint)]">
            {t("pin.label")}
          </span>
          <span className="mt-1 font-mono text-lg font-bold tracking-[0.34em] text-cream">
            {req.startCode}
          </span>
        </span>

        <ChevronUp className="h-4 w-4 shrink-0 text-[var(--text-faint)]" />
      </button>
    </div>
  );
}

/** The full card: who is coming, the digits large, and what to do with them. */
function CodeSheet({ req, onClose }: { req: ConsultRequest; onClose: () => void }) {
  const { t } = useT();
  const toast = useToast();
  const { startConsultAsPatient, reissueStartCode } = useActions();
  const [busy, setBusy] = useState<"start" | "reissue" | null>(null);
  const locked = (req.startCodeAttempts ?? 0) >= MAX_START_CODE_ATTEMPTS;

  // Escape closes it, like every other dismissible layer in the app.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  async function run(kind: "start" | "reissue") {
    setBusy(kind);
    try {
      if (kind === "start") {
        await startConsultAsPatient(req.id);
        toast.push({ tone: "success", title: t("code.started") });
        onClose();
      } else {
        await reissueStartCode(req.id);
        toast.push({ tone: "info", title: t("code.newIssued") });
      }
    } catch (e) {
      toast.push({
        tone: "error",
        title: t("common.retry"),
        desc: e instanceof Error ? e.message : undefined,
      });
    } finally {
      setBusy(null);
    }
  }

  return (
    <div
      // Bottom padding clears the floating dock, so the actions are never
      // hidden behind it.
      className="fixed inset-0 z-50 flex items-end justify-center overflow-y-auto bg-black/55 px-3 pb-[calc(var(--chrome-dock)+0.75rem)] pt-3 backdrop-blur-sm sm:items-center sm:pb-3"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={t("code.title")}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="animate-rise w-full max-w-sm rounded-3xl border border-terracotta/35 bg-espresso-800 p-5 shadow-[var(--elev-shadow-strong)]"
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-salmon">
              <ShieldCheck className="h-3.5 w-3.5" /> {t("pin.label")}
            </p>
            <h2 className="mt-1.5 font-serif text-xl leading-tight text-cream">
              {t("pin.heading")}
            </h2>
          </div>
          <button
            onClick={onClose}
            aria-label={t("common.close")}
            className="-mr-1 -mt-1 rounded-lg p-1.5 text-[var(--text-faint)] transition-colors hover:bg-white/5 hover:text-cream"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* The digits as a stamped token, the largest thing on the screen,
            readable at arm's length across a doorway. */}
        <div className="mt-5 flex justify-center gap-2.5">
          {(req.startCode ?? "····").split("").map((d, i) => (
            <span
              key={i}
              className="grid h-[4.5rem] w-14 place-items-center rounded-2xl border border-terracotta/30 bg-espresso font-mono text-[2.5rem] font-bold leading-none text-cream shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]"
            >
              {d}
            </span>
          ))}
        </div>

        <p className="mt-4 text-center text-sm leading-relaxed text-[var(--text-muted)]">
          {t("pin.instruction")}
        </p>
        <p className="mt-1.5 text-center text-xs text-[var(--text-faint)]">
          {t("pin.warning")}
        </p>

        {locked && (
          <p className="mt-3 text-center text-xs text-status-critical">
            {t("code.lockedPatient")}
          </p>
        )}

        <div className="mt-5 flex gap-2">
          <button
            onClick={() => run("start")}
            disabled={busy !== null}
            className="flex-1 rounded-xl bg-primary py-3 text-sm font-semibold text-on-accent transition-transform active:scale-[0.98] disabled:opacity-60"
          >
            {busy === "start" ? t("common.loading") : t("code.startMyself")}
          </button>
          <button
            onClick={() => run("reissue")}
            disabled={busy !== null}
            className="flex items-center justify-center gap-1.5 rounded-xl border border-[var(--border)] px-3.5 py-3 text-sm font-medium text-cream transition-colors hover:bg-white/5 disabled:opacity-60"
          >
            <RefreshCw className={cn("h-3.5 w-3.5", busy === "reissue" && "animate-spin")} />
            {t("code.newCode")}
          </button>
        </div>
      </div>
    </div>
  );
}
