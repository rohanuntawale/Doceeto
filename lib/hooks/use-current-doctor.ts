"use client";

import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { isDemoMode } from "@/lib/config";
import { DEMO_DOCTOR_ID } from "@/lib/demo/seed";
import { getSupabaseBrowser } from "@/lib/supabase/client";
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
 *  Demo → the registered/stored doctor (falls back to the seed doctor).
 *  Live → doctors row by profile_id. */
export function useCurrentDoctor(): Doctor | undefined {
  const doctors = useDoctors();
  const [demoId, setDemoId] = useState<string>(DEMO_DOCTOR_ID);

  useEffect(() => {
    if (isDemoMode) setDemoId(readStoredDoctorId());
  }, []);

  const { data: liveId } = useQuery({
    queryKey: ["me-doctor-id"],
    enabled: !isDemoMode,
    queryFn: async () => {
      const sb = getSupabaseBrowser();
      if (!sb) return null;
      const {
        data: { user },
      } = await sb.auth.getUser();
      if (!user) return null;
      const { data } = await sb
        .from("doctors")
        .select("id")
        .eq("profile_id", user.id)
        .maybeSingle();
      return data?.id ?? null;
    },
  });

  const id = isDemoMode ? demoId : liveId;
  return doctors.find((d) => d.id === id) ?? doctors[0];
}
