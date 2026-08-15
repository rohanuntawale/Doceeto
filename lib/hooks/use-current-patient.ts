"use client";

import { useCallback, useSyncExternalStore } from "react";
import { MAP_CENTER, isDemoMode } from "@/lib/config";
import { apiFetch } from "@/lib/api/client";

export interface PatientIdentity {
  id: string;
  name: string;
  /** The short label shown in this app's own header ("Sadar, Nagpur"). */
  address: string;
  /**
   * The full postal address, house number included. This is what travels on a
   * booking, because it is what the provider has to find. Empty until a device
   * fix has been reverse-geocoded.
   */
  addressFull?: string;
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
        if (data?.role === "patient" && data.patient) {
          // A device fix can land before this response does. When it has, the
          // live position WINS — the account row is only ever where the
          // patient last was, and letting it overwrite a current fix is
          // exactly what pinned everyone to their sign-up address.
          const live = current.located
            ? {
                lat: current.lat,
                lng: current.lng,
                address: current.address,
                addressFull: current.addressFull,
              }
            : {};

          /**
           * The account row now stores NULL until the device has actually
           * reported a fix, so `data.patient.lat` may legitimately be absent —
           * and spreading a null straight over the default would hand every
           * consumer `lat: null` to crash on.
           *
           * Strip the nulls, keep the map-centre default underneath as a
           * VIEWPORT, and let `located` carry the truth. Nothing may treat
           * these coordinates as the patient's position unless `located` is
           * true.
           */
          const { lat, lng, ...rest } = data.patient as {
            lat?: number | null;
            lng?: number | null;
            [k: string]: unknown;
          };
          const stored =
            typeof lat === "number" && typeof lng === "number" ? { lat, lng } : {};

          current = {
            ...DEFAULT,
            ...rest,
            ...stored,
            ...live,
            located: current.located || Boolean(data.patient.located),
            ready: true,
          };
        } else {
          current = { ...current, ready: true };
        }
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
      // Same rule as live mode: a fix already applied by the device beats the
      // remembered one.
      const live = current.located
        ? { lat: current.lat, lng: current.lng, address: current.address, located: true }
        : {};
      current = { ...DEFAULT, ...JSON.parse(raw), ...live, ready: true };
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

/**
 * Make sure we know where the patient actually is before sending them help.
 *
 * `patient.lat`/`lng` always hold numbers so a map has somewhere to point, and
 * until the device reports a fix those numbers are the Nagpur map centre. Fine
 * for a viewport, catastrophic in a request body: it is how a home visit for
 * someone in Delhi gets dispatched to Nagpur, and how an SOS sends help to a
 * city the patient has never been to. The failure is silent precisely because
 * the coordinates look real.
 *
 * The request contract requires numbers (consult_requests.lat is NOT NULL), so
 * the answer is not to send nulls — it is to refuse to guess. Any flow that
 * puts a clinician on the road calls this first: if there is no fix yet it asks
 * the browser for one, from inside the user's click, which is also when a
 * permission prompt is most likely to be shown at all.
 *
 * Returns true only when a real position is now known.
 */
export async function ensureLocated(p: {
  // Only this one field matters, and several callers receive a narrowed
  // patient prop rather than the whole identity.
  located?: boolean;
}): Promise<boolean> {
  if (p.located) return true;
  const { requestDeviceLocation } = await import("@/lib/geo/device-location");
  const fix = await requestDeviceLocation();
  return fix.status === "granted" && fix.lat != null && fix.lng != null;
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
