"use client";

import { useCallback, useEffect, useState } from "react";
import { MAP_CENTER, isDemoMode } from "@/lib/config";

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

/** The signed-in patient ("me") for the patient app.
 *  Demo -> a stable per-browser identity in localStorage.
 *  Live -> the patient from /api/auth/me (the real account). */
export function useCurrentPatient() {
  const [patient, setPatient] = useState<PatientIdentity>(DEFAULT);

  useEffect(() => {
    if (!isDemoMode) {
      // Live: pull the real signed-in patient.
      fetch("/api/auth/me", { cache: "no-store" })
        .then((r) => (r.ok ? r.json() : null))
        .then((data) => {
          if (data?.role === "patient" && data.patient) {
            setPatient({ ...DEFAULT, ...data.patient });
          }
        })
        .catch(() => {
          /* ignore - keep default */
        });
      return;
    }
    // Demo: stable per-browser id for "my care" filtering.
    try {
      const raw = window.localStorage.getItem(KEY);
      if (raw) {
        setPatient({ ...DEFAULT, ...JSON.parse(raw) });
      } else {
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
      if (isDemoMode) {
        try {
          window.localStorage.setItem(KEY, JSON.stringify(next));
        } catch {
          /* ignore */
        }
      }
      return next;
    });
  }, []);

  return { patient, update };
}
