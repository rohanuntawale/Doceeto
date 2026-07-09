"use client";

import { useState } from "react";
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

export function SosTrigger({ patient }: { patient: PatientIdentity }) {
  const { createSos } = useActions();
  const toast = useToast();
  const [open, setOpen] = useState(false);

  function fire(category: SosCategory) {
    createSos({
      patientId: patient.id,
      patientName: patient.name,
      category,
      address: patient.address,
      lat: patient.lat,
      lng: patient.lng,
    });
    setOpen(false);
    toast.push({
      tone: "error",
      title: "SOS sent — help is on the way",
      desc: "A dispatcher and nearby doctor have been alerted.",
    });
  }

  return (
    <div className="rounded-card border border-terracotta/30 bg-espresso-800 p-6 text-center shadow-card">
      <div className="label mb-4">助け · TASUKE · EMERGENCY</div>

      {!open ? (
        <>
          <button
            onClick={() => setOpen(true)}
            className="group relative mx-auto grid h-40 w-40 place-items-center rounded-full bg-terracotta text-cream shadow-glow animate-pulse-ring transition-transform active:scale-95"
          >
            <span className="font-serif text-4xl tracking-wide">SOS</span>
          </button>
          <p className="mt-5 text-sm text-[var(--text-muted)]">
            One press sends your live location and profile to the nearest
            ambulance and doctor.
          </p>
        </>
      ) : (
        <div className="animate-fade-up">
          <p className="font-serif text-xl text-cream">What&apos;s the emergency?</p>
          <p className="mt-1 text-xs text-[var(--text-muted)]">
            Tap to dispatch instantly · or cancel
          </p>
          <div className="mt-4 grid grid-cols-3 gap-2">
            {CATEGORIES.map((c) => (
              <button
                key={c}
                onClick={() => fire(c)}
                className={cn(
                  "flex flex-col items-center gap-1 rounded-lg border border-[var(--border)] bg-espresso p-3 transition-colors hover:border-terracotta/50 hover:bg-terracotta/10",
                )}
              >
                <span className="font-jp text-lg text-salmon">
                  {sosCategory[c].kanji}
                </span>
                <span className="text-xs text-cream">{sosCategory[c].label}</span>
              </button>
            ))}
          </div>
          <button
            onClick={() => setOpen(false)}
            className="mt-4 text-xs text-[var(--text-faint)] hover:text-cream"
          >
            Cancel
          </button>
        </div>
      )}
    </div>
  );
}
