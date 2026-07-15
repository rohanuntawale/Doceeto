"use client";

import { useState } from "react";
import { ShieldQuestion, Siren, ArrowRight, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { StatusPill } from "@/components/ui/status-pill";
import { cn } from "@/lib/utils/cn";
import { acuity as acuityLabels } from "@/lib/labels";
import {
  RED_FLAGS,
  WARNING_SIGNS,
  runTriage,
  type TriageResult,
} from "@/lib/triage";

export interface TriageOutcome extends TriageResult {
  complaint: string;
}

/** A quick, clinician-safe symptom check that routes the patient to the
 *  right level of care and, on emergencies, pushes them to SOS. */
export function Triage({
  onApply,
  onEmergency,
  onClose,
}: {
  onApply: (o: TriageOutcome) => void;
  onEmergency: () => void;
  onClose: () => void;
}) {
  const [complaint, setComplaint] = useState("");
  const [redFlags, setRedFlags] = useState<string[]>([]);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [result, setResult] = useState<TriageResult | null>(null);

  const toggle = (
    id: string,
    list: string[],
    set: (v: string[]) => void,
  ) => set(list.includes(id) ? list.filter((x) => x !== id) : [...list, id]);

  function check() {
    setResult(runTriage({ complaint, redFlags, warnings }));
  }

  return (
    <div className="glass-strong rounded-card relative p-4">
      <button
        onClick={onClose}
        aria-label="Close"
        className="absolute right-3 top-3 rounded-lg p-1 text-[var(--text-faint)] hover:text-cream"
      >
        <X className="h-4 w-4" />
      </button>
      <div className="mb-3 flex items-center gap-2">
        <span className="grid h-8 w-8 place-items-center rounded-lg bg-terracotta/12 text-salmon ring-1 ring-inset ring-terracotta/20">
          <ShieldQuestion className="h-4 w-4" />
        </span>
        <div>
          <div className="label">Quick check</div>
          <p className="text-sm font-medium text-cream">
            Not sure what you need? Answer a few questions.
          </p>
        </div>
      </div>

      {!result ? (
        <div className="space-y-4">
          <div>
            <label className="label">What&apos;s the main problem?</label>
            <input
              value={complaint}
              onChange={(e) => setComplaint(e.target.value)}
              placeholder="e.g. fever and body ache"
              className="mt-1.5 w-full rounded-lg border border-[var(--border)] bg-espresso px-3 py-2.5 text-sm text-cream outline-none placeholder:text-[var(--text-faint)] focus:border-terracotta/60"
            />
          </div>

          <CheckGroup
            title="Any of these right now?"
            options={RED_FLAGS}
            selected={redFlags}
            onToggle={(id) => toggle(id, redFlags, setRedFlags)}
            danger
          />

          <CheckGroup
            title="Any of these?"
            options={WARNING_SIGNS}
            selected={warnings}
            onToggle={(id) => toggle(id, warnings, setWarnings)}
          />

          <Button className="w-full" onClick={check}>
            Get advice <ArrowRight className="h-4 w-4" />
          </Button>
        </div>
      ) : (
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <StatusPill tone={acuityLabels[result.acuity].tone}>
              {acuityLabels[result.acuity].label}
            </StatusPill>
            <span className="text-xs text-[var(--text-muted)]">
              {acuityLabels[result.acuity].blurb}
            </span>
          </div>
          <p className="text-sm text-cream">{result.advice}</p>
          <p className="text-xs text-[var(--text-faint)]">{result.summary}</p>

          {result.isEmergency ? (
            <Button className="w-full" onClick={onEmergency}>
              <Siren className="h-4 w-4" /> Press SOS now
            </Button>
          ) : (
            <div className="flex gap-2">
              <Button
                className="flex-1"
                onClick={() =>
                  onApply({ ...result, complaint: complaint.trim() || "General health concern" })
                }
              >
                Continue to booking
              </Button>
              <Button variant="ghost" onClick={() => setResult(null)}>
                Back
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function CheckGroup({
  title,
  options,
  selected,
  onToggle,
  danger = false,
}: {
  title: string;
  options: { id: string; text: string }[];
  selected: string[];
  onToggle: (id: string) => void;
  danger?: boolean;
}) {
  return (
    <div>
      <div className="label mb-1.5">{title}</div>
      <div className="flex flex-wrap gap-1.5">
        {options.map((o) => {
          const on = selected.includes(o.id);
          return (
            <button
              key={o.id}
              type="button"
              onClick={() => onToggle(o.id)}
              className={cn(
                "rounded-full border px-3 py-1.5 text-xs transition-colors",
                on
                  ? danger
                    ? "border-status-critical bg-status-critical/15 text-status-critical"
                    : "border-terracotta bg-terracotta/15 text-salmon"
                  : "border-[var(--border)] text-[var(--text-muted)] hover:border-terracotta/40 hover:text-cream",
              )}
            >
              {o.text}
            </button>
          );
        })}
      </div>
    </div>
  );
}
