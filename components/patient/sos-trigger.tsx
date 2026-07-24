"use client";

import { useState } from "react";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils/cn";
import { useActions } from "@/lib/hooks/data";
import { useToast } from "@/components/ui/toast";
import { sosCategory } from "@/lib/labels";
import type { PatientIdentity } from "@/lib/hooks/use-current-patient";
import type { SosCategory } from "@/lib/types/domain";

const CATEGORIES: SosCategory[] = [
  "cardiac",
  "trauma",
  "respiratory",
  "stroke",
  "obstetric",
  "other",
];

type Phase = "idle" | "sending" | "categorize";

/**
 * Emergency flow: ONE press fires the SOS immediately — the patient's live
 * location + profile reach the nearest doctor first (as an uncategorised
 * "other" alert). Only THEN does the patient pick the type (cardiac, trauma…)
 * which refines the same alert on the doctor's dashboard. Speed first,
 * detail second.
 */
export function SosTrigger({ patient }: { patient: PatientIdentity }) {
  const { createSos, categorizeSos } = useActions();
  const toast = useToast();
  const [phase, setPhase] = useState<Phase>("idle");
  const [sosId, setSosId] = useState<string | null>(null);
  const [picked, setPicked] = useState<SosCategory | null>(null);

  // Step 1 — one press: send location + alert to doctors right away.
  async function sendSos() {
    setPhase("sending");
    try {
      const sos = await createSos({
        patientId: patient.id,
        patientName: patient.name,
        category: "other",
        address: patient.address,
        lat: patient.lat,
        lng: patient.lng,
      });
      setSosId(sos.id);
      setPicked(null);
      setPhase("categorize");
      toast.push({
        tone: "error",
        title: "SOS sent — help is on the way",
        desc: "Your live location was shared with the nearest doctor.",
      });
    } catch (e) {
      setPhase("idle");
      toast.push({
        tone: "error",
        title: "Couldn't send SOS",
        desc: e instanceof Error ? e.message : "Please try again.",
      });
    }
  }

  // Step 2 — refine the type so the doctor knows what to prepare for.
  async function categorize(category: SosCategory) {
    setPicked(category);
    if (sosId) {
      try {
        await categorizeSos(sosId, category);
      } catch {
        /* the SOS is already sent; a failed refine is non-critical */
      }
    }
    toast.push({
      tone: "info",
      title: `Doctor notified: ${sosCategory[category].label}`,
      desc: "They can see the emergency type now.",
    });
  }

  function done() {
    setPhase("idle");
    setSosId(null);
    setPicked(null);
  }

  return (
    <div className="rounded-card border border-terracotta/30 bg-espresso-800 p-6 text-center shadow-card">
      <div className="label mb-4">助け · TASUKE · EMERGENCY</div>

      {phase !== "categorize" ? (
        <>
          <button
            onClick={sendSos}
            disabled={phase === "sending"}
            className="group relative mx-auto grid h-40 w-40 place-items-center rounded-full bg-terracotta text-on-accent shadow-glow animate-pulse-ring transition-transform active:scale-95 disabled:opacity-70"
          >
            <span className="font-serif text-4xl tracking-wide">
              {phase === "sending" ? "…" : "SOS"}
            </span>
          </button>
          <p className="mt-5 text-sm text-[var(--text-muted)]">
            {phase === "sending"
              ? "Sending your live location to the nearest doctor…"
              : "One press sends your live location to the nearest doctor. You'll add the type right after."}
          </p>
        </>
      ) : (
        <div className="animate-fade-up">
          <p className="flex items-center justify-center gap-2 font-serif text-xl text-cream">
            <span className="inline-block h-2 w-2 animate-pulse rounded-full bg-terracotta" />
            Help is on the way
          </p>
          <p className="mt-1 text-xs text-[var(--text-muted)]">
            Add the type so the doctor can prepare — tap one:
          </p>
          <div className="mt-4 grid grid-cols-3 gap-2">
            {CATEGORIES.map((c) => {
              const active = picked === c;
              return (
                <button
                  key={c}
                  onClick={() => categorize(c)}
                  className={cn(
                    "relative flex flex-col items-center gap-1 rounded-lg border p-3 transition-colors",
                    active
                      ? "border-terracotta bg-terracotta/15"
                      : "border-[var(--border)] bg-espresso hover:border-terracotta/50 hover:bg-terracotta/10",
                  )}
                >
                  <span className="font-jp text-lg text-salmon">
                    {sosCategory[c].kanji}
                  </span>
                  <span className="text-xs text-cream">{sosCategory[c].label}</span>
                  {active && (
                    <Check className="absolute right-1 top-1 h-3.5 w-3.5 text-terracotta" />
                  )}
                </button>
              );
            })}
          </div>
          <button
            onClick={done}
            className="mt-4 text-xs text-[var(--text-faint)] transition-colors hover:text-cream"
          >
            {picked ? "Done" : "Skip — let the doctor assess"}
          </button>
        </div>
      )}
    </div>
  );
}
