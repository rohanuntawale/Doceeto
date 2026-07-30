"use client";

/**
 * Publish or edit one gig — a service package patients hire outright.
 *
 * Same modal shape and field kit as EditProfileDialog, so the two read as one
 * surface. Bounds come from lib/gigs/rules.ts, which is also what the server
 * normalises against, so nothing accepted here is rejected on save.
 */
import { useEffect, useState } from "react";
import { X, Video, Home, Building2, Info } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Modal, modalPanelCls } from "@/components/ui/modal";
import { useActions } from "@/lib/hooks/data";
import { useToast } from "@/components/ui/toast";
import {
  formatGigDuration,
  GIG_DESC_MAX,
  GIG_DURATION_CHOICES,
  GIG_TITLE_MAX,
} from "@/lib/gigs/rules";
import { formatINR } from "@/lib/utils/format";
import { cn } from "@/lib/utils/cn";
import type { ConsultType, Gig } from "@/lib/types/domain";

const WHERE: { type: ConsultType; label: string; icon: React.ReactNode; help: string }[] = [
  { type: "home_visit", label: "Home", icon: <Home className="h-4 w-4" />, help: "You travel" },
  { type: "clinic", label: "Clinic", icon: <Building2 className="h-4 w-4" />, help: "They travel" },
  { type: "video", label: "Video", icon: <Video className="h-4 w-4" />, help: "No travel" },
];

const EXAMPLES = [
  "Home visit — fever & flu care",
  "Night clinic cover (12h shift)",
  "Post-op wound dressing at home",
];

export function GigEditorDialog({
  gig,
  open,
  onClose,
}: {
  /** Undefined publishes a new gig; a row edits that one in place. */
  gig?: Gig;
  open: boolean;
  onClose: () => void;
}) {
  const { createGig, updateGig } = useActions();
  const toast = useToast();

  const snapshot = () => ({
    title: gig?.title ?? "",
    description: gig?.description ?? "",
    type: (gig?.type ?? "home_visit") as ConsultType,
    price: gig?.price ?? 900,
    durationMinutes: gig?.durationMinutes ?? 45,
  });
  const [form, setForm] = useState(snapshot);
  const [saving, setSaving] = useState(false);

  // Re-sync when the dialog reopens on a different gig.
  useEffect(() => {
    if (open) setForm(snapshot());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, gig?.id]);

  if (!open) return null;

  const valid = form.title.trim().length > 0 && form.price > 0;

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!valid || saving) return;
    setSaving(true);
    try {
      const payload = {
        title: form.title.trim(),
        description: form.description.trim(),
        type: form.type,
        price: Math.round(form.price),
        durationMinutes: form.durationMinutes,
      };
      if (gig) {
        await updateGig(gig.id, payload);
        toast.push({ tone: "success", title: "Gig updated" });
      } else {
        await createGig(payload);
        toast.push({
          tone: "success",
          title: "Gig published",
          desc: "Patients can hire it from your profile now.",
        });
      }
      onClose();
    } catch (err) {
      // The server owns the rules (the live-gig cap, the price bounds) — show
      // exactly what it said rather than a generic failure.
      toast.push({
        tone: "error",
        title: gig ? "Couldn't update that gig" : "Couldn't publish that gig",
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
        onSubmit={save}
        className={modalPanelCls}
      >
        <div className="mb-4 flex items-center justify-between">
          <div>
            <div className="label">DOCEETO · {gig ? "EDIT GIG" : "NEW GIG"}</div>
            <h3 className="font-serif text-xl text-cream">
              {gig ? "Edit your gig" : "Put up a gig"}
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-[var(--text-faint)] transition-colors hover:bg-white/5 hover:text-cream"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="space-y-3">
          <Field label="What are you offering?">
            <input
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              className={inputCls}
              maxLength={GIG_TITLE_MAX}
              placeholder={EXAMPLES[0]}
              autoFocus
            />
          </Field>
          {!gig && (
            <p className="flex items-start gap-1.5 text-[11px] leading-relaxed text-[var(--text-faint)]">
              <Info className="mt-0.5 h-3 w-3 shrink-0" />
              Others offer things like {EXAMPLES.slice(1).join(", ")}.
            </p>
          )}

          <Field label="Where does it happen?">
            {/* Stacks on the narrowest phones — three-up leaves ~60px per
                tile at 320px, too little for the helper line. */}
            <div className="grid grid-cols-1 gap-2 min-[380px]:grid-cols-3">
              {WHERE.map((w) => {
                const active = form.type === w.type;
                return (
                  <button
                    key={w.type}
                    type="button"
                    onClick={() => setForm({ ...form, type: w.type })}
                    className={cn(
                      "flex flex-col items-center gap-1 rounded-lg border px-2 py-2.5 text-center transition-colors",
                      active
                        ? "border-terracotta bg-terracotta/10"
                        : "border-[var(--border)] hover:border-terracotta/40",
                    )}
                  >
                    <span className="text-salmon">{w.icon}</span>
                    <span className="text-xs font-medium text-cream">{w.label}</span>
                    <span className="text-[10px] text-[var(--text-faint)]">{w.help}</span>
                  </button>
                );
              })}
            </div>
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Price (₹)">
              <input
                type="number"
                min={1}
                value={form.price}
                onChange={(e) => setForm({ ...form, price: Number(e.target.value) })}
                className={inputCls}
              />
            </Field>
            <Field label="How long you're committed">
              <select
                value={form.durationMinutes}
                onChange={(e) =>
                  setForm({ ...form, durationMinutes: Number(e.target.value) })
                }
                className={inputCls}
              >
                {GIG_DURATION_CHOICES.map((m) => (
                  <option key={m} value={m}>
                    {formatGigDuration(m)}
                  </option>
                ))}
              </select>
            </Field>
          </div>

          <Field label="What the patient gets">
            <textarea
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              rows={3}
              maxLength={GIG_DESC_MAX}
              className={`${inputCls} resize-none`}
              placeholder="I come to you, examine, and prescribe on the spot. Follow-up call included."
            />
          </Field>

          {/* The one consequence a doctor must understand before publishing. */}
          <p className="flex items-start gap-2 rounded-lg bg-tan/10 p-3 text-xs leading-relaxed text-tan">
            <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            While you&apos;re on a gig you&apos;re marked unavailable — no new bookings or
            urgent requests reach you until you mark it complete. Appointments you&apos;ve
            already confirmed still stand.
          </p>
        </div>

        <div className="mt-5 flex gap-2">
          <Button type="submit" className="flex-1" disabled={!valid || saving}>
            {saving
              ? "Saving…"
              : gig
                ? "Save changes"
                : `Publish for ${formatINR(Math.round(form.price) || 0)}`}
          </Button>
          <Button type="button" variant="ghost" onClick={onClose}>
            Cancel
          </Button>
        </div>
      </form>
    </Modal>
  );
}

const inputCls =
  "w-full rounded-lg border border-[var(--border)] bg-espresso px-3 py-2.5 text-sm text-cream outline-none placeholder:text-[var(--text-faint)] focus:border-terracotta/60";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="label">{label}</span>
      <div className="mt-1.5">{children}</div>
    </label>
  );
}
