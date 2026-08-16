"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Stethoscope, ArrowRight, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { isDemoMode } from "@/lib/config";
import { useMounted } from "@/lib/hooks/use-mounted";
import { useCurrentDoctor, setCurrentDoctorId } from "@/lib/hooks/use-current-doctor";
import { demoStore } from "@/lib/demo/store";

/**
 * The doctor space needs a doctor identity. In live mode the middleware
 * guarantees a doctor session, so we just render. In demo mode a person
 * can open the space before creating a profile — instead of a blank page
 * we show a friendly onboarding step.
 */
export function DoctorGate({ children }: { children: React.ReactNode }) {
  const me = useCurrentDoctor();
  const mounted = useMounted();

  if (!isDemoMode) return <>{children}</>; // live: session-guaranteed
  if (!mounted) {
    return (
      <div className="grid min-h-[60dvh] place-items-center">
        <span className="text-sm text-[var(--text-faint)] animate-pulse">Loading…</span>
      </div>
    );
  }
  if (!me) return <DoctorOnboarding />;
  return <>{children}</>;
}

function DoctorOnboarding() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  function startDemo() {
    setLoading(true);
    const doc = demoStore.registerDoctor({
      fullName: "Dr. Demo",
      specialty: "General Physician",
      kind: "practising",
      gender: "female",
      experienceYears: 6,
      consultFee: 400,
      homeVisitFee: 900,
    });
    setCurrentDoctorId(doc.id);
    // Full navigation so the doctor identity is read fresh on mount.
    window.location.href = "/doctor";
  }

  return (
    <div className="grid min-h-[70dvh] place-items-center px-4">
      <div className="w-full max-w-md rounded-card border border-[var(--border)] bg-espresso-800 p-7 text-center shadow-card">
        <span className="mx-auto grid h-14 w-14 place-items-center rounded-xl bg-white/8 text-salmon ring-1 ring-inset ring-white/12">
          <Stethoscope className="h-6 w-6" />
        </span>
        <h1 className="mt-4 font-serif text-2xl text-cream">Set up your doctor profile</h1>
        <p className="mx-auto mt-2 max-w-sm text-sm text-[var(--text-muted)]">
          Create your profile to start receiving patients near you, home
          visits, clinic visits and video calls.
        </p>

        <div className="mt-6 flex flex-col gap-2.5">
          <Button size="lg" onClick={() => router.push("/?as=doctor")}>
            Register as a doctor <ArrowRight className="h-4 w-4" />
          </Button>
          <Button variant="subtle" size="lg" disabled={loading} onClick={startDemo}>
            <Sparkles className="h-4 w-4" />
            {loading ? "Setting up…" : "Explore with a demo profile"}
          </Button>
        </div>

        <p className="mt-5 flex items-center justify-center gap-1.5 text-xs text-[var(--text-faint)]">
          <Stethoscope className="h-3.5 w-3.5" />
          Already registered? Your profile lives on this device in demo mode.
        </p>
      </div>
    </div>
  );
}
