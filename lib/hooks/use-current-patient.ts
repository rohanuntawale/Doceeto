"use client";

import { useCallback, useSyncExternalStore } from "react";
import { MAP_CENTER, isDemoMode } from "@/lib/config";
import { apiFetch } from "@/lib/api/client";

export interface PatientIdentity {
  id: string;
  name: string;
  address: string;
  lat: number;
  lng: number;
  /** Profile photo (a small data-URL, or a Google picture URL). */
  avatarUrl?: string;
  /** Health basics (height, weight, allergies, …) — lib/health/profile.ts. */
  healthProfile?: import("@/lib/health/profile").HealthProfile;
  /** True once real device geolocation has been applied. */
  located?: boolean;
  /**
   * True once the real account has been fetched (or the fetch has failed).
   * Forms MUST wait for this before saving: writing a blank form over a
   * record that simply hadn't arrived yet is silent data loss.
   */
  ready?: boolean;
}

const KEY = "iyashi:patient:v2";

// Neutral defaults — no demo persona. Coordinates fall back to the
// Nagpur map center until the browser reports the real position.
const DEFAULT: PatientIdentity = {
  id: "patient-me",
  name: "Guest",
  address: "Nagpur",
  lat: MAP_CENTER.lat,
  lng: MAP_CENTER.lng,
  located: false,
};

/* Module-level store so ALL mounted consumers (map, SOS, bookings,
   the location-sync component) share one identity and re-render
   together when it changes. */
let current: PatientIdentity = DEFAULT;
let hydrated = false;
let listeners: Array<() => void> = [];

function emit() {
  listeners.forEach((l) => l());
}

function persist() {
  if (!isDemoMode) return; // live identity lives on the server
  try {
    window.localStorage.setItem(KEY, JSON.stringify(current));
  } catch {
    /* ignore */
  }
}

function hydrateOnce() {
  if (hydrated || typeof window === "undefined") return;
  hydrated = true;

  if (!isDemoMode) {
    // Live: pull the real signed-in patient.
    apiFetch("/api/auth/me", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        current =
          data?.role === "patient" && data.patient
            ? { ...DEFAULT, ...data.patient, ready: true }
            : { ...current, ready: true };
        emit();
      })
      .catch(() => {
        // Even a failed fetch settles the question — forms must not hang
        // disabled forever because the network blipped.
        current = { ...current, ready: true };
        emit();
      });
    return;
  }

  // Demo: stable per-browser identity.
  try {
    const raw = window.localStorage.getItem(KEY);
    if (raw) {
      current = { ...DEFAULT, ...JSON.parse(raw), ready: true };
    } else {
      current = { ...DEFAULT, id: `patient-${Date.now().toString(36)}`, ready: true };
      persist();
    }
    emit();
  } catch {
    current = { ...current, ready: true };
    emit();
  }
}

function subscribe(listener: () => void) {
  listeners.push(listener);
  hydrateOnce();
  return () => {
    listeners = listeners.filter((l) => l !== listener);
  };
}

const getSnapshot = () => current;
const getServerSnapshot = () => DEFAULT;

/** Update the shared patient identity (e.g. name from registration,
 *  live lat/lng from geolocation). Safe to call from anywhere. */
export function updatePatient(patch: Partial<PatientIdentity>) {
  current = { ...current, ...patch };
  persist();
  emit();
}

/** The signed-in patient ("me") for the patient app.
 *  Demo -> a stable per-browser identity in localStorage.
 *  Live -> the patient from /api/auth/me (the real account). */
export function useCurrentPatient() {
  const patient = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  const update = useCallback((patch: Partial<PatientIdentity>) => {
    updatePatient(patch);
  }, []);
  return { patient, update };
}
