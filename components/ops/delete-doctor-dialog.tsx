"use client";

import { useEffect, useState } from "react";
import { AlertTriangle, Loader2, X } from "lucide-react";
import type { Doctor, DoctorDeletion } from "@/lib/types/domain";

/**
 * Confirmation for removing a doctor from the platform.
 *
 * Deleting an account is irreversible and takes a person's login with it, so
 * this asks the admin to type the doctor's name rather than accepting a single
 * click — the same guard GitHub puts on deleting a repository. It also states
 * plainly what survives the delete (patient consult history, the money ledger),
 * because an admin who assumes "delete" erases everything would be wrong.
 */
export function DeleteDoctorDialog({
  doctor,
  onClose,
  onConfirm,
  onDeleted,
}: {
  doctor: Doctor | null;
  onClose: () => void;
  onConfirm: (doctorId: string) => Promise<DoctorDeletion>;
  /** Called after a successful delete — the doctor profile page uses it to
   *  navigate away, since its subject no longer exists. */
  onDeleted?: (result: DoctorDeletion) => void;
}) {
  const [typed, setTyped] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Reset whenever a different doctor is targeted, so a previous attempt's
  // half-typed name or error never carries over to the next one.
  useEffect(() => {
    setTyped("");
    setError(null);
    setBusy(false);
  }, [doctor?.id]);

  useEffect(() => {
    if (!doctor) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && !busy && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [doctor, busy, onClose]);

  if (!doctor) return null;

  // Match on the bare name so the admin doesn't have to type the "Dr. " prefix.
  const target = doctor.fullName.replace(/^Dr\.\s*/i, "").trim();
  const armed = typed.trim().toLowerCase() === target.toLowerCase() && !busy;

  async function run() {
    if (!armed || !doctor) return;
    setBusy(true);
    setError(null);
    try {
      const result = await onConfirm(doctor.id);
      onDeleted?.(result);
      onClose();
    } catch (err) {
      // The server refuses while a consult is live; show its reason verbatim.
      setError(err instanceof Error ? err.message : "Could not delete this doctor.");
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[80] grid place-items-center px-4">
      <button
        aria-hidden
        onClick={() => !busy && onClose()}
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="delete-doctor-title"
        className="relative w-full max-w-md animate-fade-up rounded-card border border-status-critical/30 bg-espresso-800 p-5 shadow-card"
      >
        <div className="flex items-start gap-3">
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-status-critical/15 text-status-critical">
            <AlertTriangle className="h-5 w-5" />
          </span>
          <div className="min-w-0 flex-1">
            <h2 id="delete-doctor-title" className="font-serif text-xl text-cream">
              Delete {doctor.fullName}?
            </h2>
            <p className="mt-1 text-sm text-[var(--text-muted)]">
              This cannot be undone.
            </p>
          </div>
          <button
            onClick={() => !busy && onClose()}
            aria-label="Close"
            className="text-[var(--text-muted)] transition-colors hover:text-cream"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="mt-4 space-y-2 rounded-xl border border-[var(--border)] p-3 text-sm">
          <p className="text-[var(--text-muted)]">
            <span className="font-medium text-cream">Removed:</span> their profile,
            gig listings, the reviews written about them, and their account, every
            signed-in device is logged out immediately.
          </p>
          <p className="text-[var(--text-muted)]">
            <span className="font-medium text-cream">Kept:</span> past consults, so
            patients keep their own history, and the wallet ledger for audit.
          </p>
        </div>

        <label className="mt-4 block text-sm text-[var(--text-muted)]">
          Type <span className="font-medium text-cream">{target}</span> to confirm
          <input
            value={typed}
            onChange={(e) => setTyped(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && run()}
            disabled={busy}
            autoFocus
            spellCheck={false}
            className="mt-1.5 w-full rounded-xl border border-[var(--border)] bg-espresso px-3 py-2.5 text-sm text-cream outline-none transition-colors focus:border-status-critical/50 disabled:opacity-60"
          />
        </label>

        {error && (
          <p className="mt-3 rounded-xl bg-status-critical/10 p-3 text-sm text-status-critical">
            {error}
          </p>
        )}

        <div className="mt-4 flex gap-2">
          <button
            onClick={() => !busy && onClose()}
            className="flex-1 rounded-xl border border-[var(--border)] px-4 py-2.5 text-sm font-medium text-cream transition-colors hover:bg-white/5"
          >
            Cancel
          </button>
          <button
            onClick={run}
            disabled={!armed}
            className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-status-critical px-4 py-2.5 text-sm font-semibold text-white transition-opacity disabled:cursor-not-allowed disabled:opacity-40"
          >
            {busy && <Loader2 className="h-4 w-4 animate-spin" />}
            {busy ? "Deleting…" : "Delete doctor"}
          </button>
        </div>
      </div>
    </div>
  );
}
