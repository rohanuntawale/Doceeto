"use client";

import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { isDemoMode } from "@/lib/config";
import { DEMO_DOCTOR_ID } from "@/lib/demo/seed";
import { useDoctors } from "@/lib/hooks/data";
import type { Doctor } from "@/lib/types/domain";

const DOCTOR_ID_KEY = "iyashi:doctor-id:v1";

/** Remember which demo doctor is "me" (set after registration). */
export function setCurrentDoctorId(id: string) {
  try {
    window.localStorage.setItem(DOCTOR_ID_KEY, id);
  } catch {
    /* ignore */
  }
}

function readStoredDoctorId(): string {
  try {
    return window.localStorage.getItem(DOCTOR_ID_KEY) ?? DEMO_DOCTOR_ID;
  } catch {
    return DEMO_DOCTOR_ID;
  }
}

/** The doctor row representing the signed-in user ("me").
 *  Demo -> the registered/stored doctor (falls back to the seed doctor).
 *  Live -> the doctor returned by /api/auth/me. */
export function useCurrentDoctor(): Doctor | undefined {
  const doctors = useDoctors();
  const [demoId, setDemoId] = useState<string>(DEMO_DOCTOR_ID);

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
    return doctors.find((d) => d.id === demoId) ?? doctors[0];
  }
  // Prefer the freshest copy from the polled doctors list.
  return doctors.find((d) => d.id === liveDoctor?.id) ?? liveDoctor ?? undefined;
}
