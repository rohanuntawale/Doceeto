"use client";

import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { isDemoMode } from "@/lib/config";
import { apiFetch } from "@/lib/api/client";
import { useDoctors } from "@/lib/hooks/data";
import { readStoredDoctorId, setCurrentDoctorId } from "@/lib/demo/current-doctor";
import type { Doctor } from "@/lib/types/domain";

// Re-exported so existing callers keep importing it from here.
export { setCurrentDoctorId };

/**
 * The provider row representing the signed-in user ("me") — a doctor or a
 * nurse, whichever surface is asking.
 *
 * /api/auth/me is resolved against the CALLING SURFACE, so the cockpit gets the
 * doctor and the nurse console gets the nurse even when both are signed in on
 * one browser. Both cadres live in the same registry and are returned under
 * `doctor`, so every shared provider component takes one shape.
 *
 * Demo -> the provider registered in this browser (none until you register).
 * Live -> the provider returned by /api/auth/me.
 */
export function useCurrentProvider(): Doctor | undefined {
  const doctors = useDoctors();
  const [demoId, setDemoId] = useState<string | null>(null);

  useEffect(() => {
    if (isDemoMode) setDemoId(readStoredDoctorId());
  }, []);

  const { data: liveProvider } = useQuery({
    queryKey: ["me-provider"],
    enabled: !isDemoMode,
    queryFn: async (): Promise<Doctor | null> => {
      const res = await apiFetch("/api/auth/me", { cache: "no-store" });
      if (!res.ok) return null;
      const data = await res.json();
      return data.role === "doctor" || data.role === "nurse"
        ? (data.doctor ?? null)
        : null;
    },
    refetchInterval: 5000,
  });

  if (isDemoMode) {
    // No fallback impersonation: without a registration there is no "me".
    return demoId ? doctors.find((d) => d.id === demoId) : undefined;
  }
  // Prefer the freshest copy from the polled providers list.
  return doctors.find((d) => d.id === liveProvider?.id) ?? liveProvider ?? undefined;
}

/** The signed-in provider on the doctor surface. Kept as the name the cockpit
 *  already imports; identical behaviour. */
export const useCurrentDoctor = useCurrentProvider;
