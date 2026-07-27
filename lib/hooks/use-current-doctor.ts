"use client";

import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { isDemoMode } from "@/lib/config";
import { useDoctors } from "@/lib/hooks/data";
import { readStoredDoctorId, setCurrentDoctorId } from "@/lib/demo/current-doctor";
import type { Doctor } from "@/lib/types/domain";

// Re-exported so existing callers keep importing it from here.
export { setCurrentDoctorId };

/** The doctor row representing the signed-in user ("me").
 *  Demo -> the doctor registered in this browser (none until you register).
 *  Live -> the doctor returned by /api/auth/me. */
export function useCurrentDoctor(): Doctor | undefined {
  const doctors = useDoctors();
  const [demoId, setDemoId] = useState<string | null>(null);

  useEffect(() => {
    if (isDemoMode) setDemoId(readStoredDoctorId());
  }, []);

  const { data: liveDoctor } = useQuery({
    queryKey: ["me-doctor"],
    enabled: !isDemoMode,
    queryFn: async (): Promise<Doctor | null> => {
      const res = await fetch("/api/auth/me", { cache: "no-store" });
      if (!res.ok) return null;
      const data = await res.json();
      return data.role === "doctor" ? (data.doctor ?? null) : null;
    },
    refetchInterval: 5000,
  });

  if (isDemoMode) {
    // No fallback impersonation: without a registration there is no "me".
    return demoId ? doctors.find((d) => d.id === demoId) : undefined;
  }
  // Prefer the freshest copy from the polled doctors list.
  return doctors.find((d) => d.id === liveDoctor?.id) ?? liveDoctor ?? undefined;
}
