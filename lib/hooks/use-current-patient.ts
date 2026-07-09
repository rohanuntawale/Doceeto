"use client";

import { useCallback, useEffect, useState } from "react";
import { MAP_CENTER } from "@/lib/config";

export interface PatientIdentity {
  id: string;
  name: string;
  address: string;
  lat: number;
  lng: number;
}

const KEY = "iyashi:patient:v1";

const DEFAULT: PatientIdentity = {
  id: "patient-me",
  name: "Test Patient",
  address: "Baner, Pune",
  lat: MAP_CENTER.lat + 0.02,
  lng: MAP_CENTER.lng - 0.03,
};

/** The signed-in patient ("me") for the patient app. Persisted in
 *  localStorage so the same identity is used across tabs/refreshes. */
export function useCurrentPatient() {
  const [patient, setPatient] = useState<PatientIdentity>(DEFAULT);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(KEY);
      if (raw) {
        setPatient({ ...DEFAULT, ...JSON.parse(raw) });
      } else {
        // Stable per-browser id for "my care" filtering.
        const seeded = { ...DEFAULT, id: `patient-${Date.now().toString(36)}` };
        window.localStorage.setItem(KEY, JSON.stringify(seeded));
        setPatient(seeded);
      }
    } catch {
      /* ignore */
    }
  }, []);

  const update = useCallback((patch: Partial<PatientIdentity>) => {
    setPatient((prev) => {
      const next = { ...prev, ...patch };
      try {
        window.localStorage.setItem(KEY, JSON.stringify(next));
      } catch {
        /* ignore */
      }
      return next;
    });
  }, []);

  return { patient, update };
}
