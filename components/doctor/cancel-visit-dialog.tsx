"use client";

/**
 * A doctor standing a patient down. The reason is required and travels back to
 * the patient — they have usually rearranged their day around this, so
 * "cancelled" with no explanation is not good enough.
 *
 * For a broadcast the server re-pools the request instead of ending it, so
 * another doctor can still take it; the copy says so.
 */
import { useEffect, useState } from "react";
import { X, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Modal, modalPanelCls } from "@/components/ui/modal";
import { useToast } from "@/components/ui/toast";
import { useActions } from "@/lib/hooks/data";
import { CANCEL_REASON_MAX } from "@/lib/scheduling/booking";
import { reopensOnDoctorCancel } from "@/lib/scheduling/booking";
import { cn } from "@/lib/utils/cn";
import type { ConsultRequest } from "@/lib/types/domain";

/** Common reasons, so the usual case is one tap rather than a paragraph. */
const PRESETS = [
  "An emergency came up",
  "Running too far behind",
  "Too far to reach in time",
  "Not the right specialty for this",
];

export function CancelVisitDialog({
  request,
  open,
  onClose,
}: {
  request: ConsultRequest;
  open: boolean;
  onClose: () => void;
}) {
  const { cancelRequest } = useActions();
  const toast = useToast();
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) setReason("");
  }, [open]);

  if (!open) return null;

  const reopens = reopensOnDoctorCancel(request);
  const valid = reason.trim().length > 0;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!valid || saving) return;
    setSaving(true);
    try {
      await cancelRequest(request.id, reason.trim());
      toast.push({
        tone: "success",
        title: "Visit cancelled",
        desc: reopens
          ? "It's back with other doctors nearby."
          : `${request.patientName} has been told why.`,
      });
      onClose();
    } catch (err) {
      toast.push({
        tone: "error",
        title: "Couldn't cancel that",
        desc: err instanceof Error ? err.message : "Please try again.",
      });
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal open={open} onClose={onClose}>
      <form
        onClick={(e) => e.stopPropagation()}
        onSubmit={submit}
        className={cn(modalPanelCls, "max-w-md")}
      >
        <div className="mb-4 flex items-center justify-between">
          <div>
            <div className="label">ZUMI · CANCEL</div>
            <h3 className="font-serif text-xl text-cream">Cancel this visit</h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-[var(--text-faint)] transition-colors hover:bg-white/5 hover:text-cream"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <p className="flex items-start gap-2 rounded-lg bg-status-critical/10 p-3 text-xs leading-relaxed text-salmon">
          <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          {request.patientName} is expecting you.{" "}
          {reopens
            ? "Because they asked the network rather than you specifically, this goes back out to other doctors nearby."
            : "They'll be told you cancelled, and why."}
        </p>

        <div className="mt-4">
          <span className="label">Why are you cancelling?</span>
          <div className="mt-2 flex flex-wrap gap-2">
            {PRESETS.map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => setReason(p)}
                className={cn(
                  "rounded-full border px-3 py-1.5 text-xs transition-colors",
                  reason === p
                    ? "border-terracotta bg-terracotta/10 text-cream"
                    : "border-[var(--border)] text-[var(--text-muted)] hover:border-terracotta/40",
                )}
              >
                {p}
              </button>
            ))}
          </div>
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            rows={2}
            maxLength={CANCEL_REASON_MAX}
            placeholder="Or write your own…"
            className="mt-2 w-full resize-none rounded-lg border border-[var(--border)] bg-espresso px-3 py-2.5 text-sm text-cream outline-none placeholder:text-[var(--text-faint)] focus:border-terracotta/60"
          />
        </div>

        <div className="mt-5 flex gap-2">
          <Button type="submit" variant="danger" className="flex-1" disabled={!valid || saving}>
            {saving ? "Cancelling…" : "Cancel the visit"}
          </Button>
          <Button type="button" variant="ghost" onClick={onClose}>
            Keep it
          </Button>
        </div>
      </form>
    </Modal>
  );
}
