"use client";

import { useState } from "react";
import { StarInput, StarDisplay } from "@/components/ui/star-rating";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { useActions } from "@/lib/hooks/data";
import { useCurrentPatient } from "@/lib/hooks/use-current-patient";
import type { ConsultRequest } from "@/lib/types/domain";

/** Post-consult rating for the patient: pick a star rating and optionally
 *  leave a message for the doctor. One review per completed consult (the
 *  server also enforces this); after submit we show a thank-you. */
export function RateDoctor({
  req,
  doctorName,
}: {
  req: ConsultRequest;
  doctorName?: string;
}) {
  const actions = useActions();
  const toast = useToast();
  const { patient } = useCurrentPatient();
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState("");
  const [done, setDone] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);

  if (done !== null) {
    return (
      <div className="mt-3 flex items-center gap-2 border-t border-[var(--border)] pt-3 text-xs text-[var(--text-muted)]">
        <span className="text-tan">✓</span> Thanks for rating {doctorName ?? "your doctor"}
        <StarDisplay value={done} className="ml-auto" />
      </div>
    );
  }

  const submit = async () => {
    if (!req.doctorId || rating < 1 || busy) return;
    setBusy(true);
    try {
      await actions.createReview({
        patientId: req.patientId ?? patient.id,
        patientName: patient.name,
        doctorId: req.doctorId,
        requestId: req.id,
        rating,
        comment: comment.trim(),
      });
      setDone(rating);
      toast.push({ tone: "success", title: "Thanks for your feedback" });
    } catch (e) {
      toast.push({
        tone: "error",
        title: "Couldn't submit rating",
        desc: e instanceof Error ? e.message : "Please try again.",
      });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mt-3 space-y-2.5 border-t border-[var(--border)] pt-3">
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs text-[var(--text-muted)]">
          How was your consult{doctorName ? ` with ${doctorName}` : ""}?
        </span>
        <StarInput onRate={setRating} disabled={busy} />
      </div>
      <textarea
        value={comment}
        onChange={(e) => setComment(e.target.value)}
        rows={2}
        maxLength={600}
        placeholder="Add a message for your doctor (optional)"
        className="w-full resize-none rounded-lg border border-[var(--border)] bg-espresso px-3 py-2 text-sm text-cream outline-none placeholder:text-[var(--text-faint)] focus:border-terracotta/60"
      />
      <div className="flex justify-end">
        <Button size="sm" onClick={submit} disabled={rating < 1 || busy}>
          {busy ? "Sending…" : "Submit rating"}
        </Button>
      </div>
    </div>
  );
}
