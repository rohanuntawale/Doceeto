"use client";

import { useSyncExternalStore } from "react";
import { haversineKm } from "@/lib/utils/geo";

/**
 * The device's CURRENT position, as one shared store.
 *
 * Why a module singleton rather than a hook per consumer: the header, the map
 * and the background sync all have to agree on where the patient is, and the
 * "Set your location" button has to be able to kick the same watch that the
 * background sync is listening to. Several independent watchPosition calls
 * would disagree with each other and prompt the user more than once.
 */

export type GeoStatus =
  | "idle"
  | "locating"
  | "granted"
  | "denied"
  | "unavailable"
  | "unsupported";

export interface DeviceLocation {
  lat: number | null;
  lng: number | null;
  accuracy: number | null;
  status: GeoStatus;
  /** When the current fix arrived (ms). */
  at: number | null;
}

const IDLE: DeviceLocation = {
  lat: null,
  lng: null,
  accuracy: null,
  status: "idle",
  at: null,
};

let state: DeviceLocation = IDLE;
let listeners: Array<() => void> = [];
let watchId: number | null = null;

/**
 * Movement below this is noise from GPS jitter, not the patient going
 * somewhere — publishing it would churn every consumer and every write.
 *
 * A live journey needs the opposite trade. At 40m a provider crossing a
 * neighbourhood publishes a handful of times and the tracker's puck jumps a
 * block at a time; the map cannot animate what it is never told. So a screen
 * that is actively tracking someone calls `holdFineLocation()` to drop the
 * gate to FINE for as long as it is mounted, and everything else keeps the
 * coarse default.
 */
const COARSE_MOVE_METERS = 40;
const FINE_MOVE_METERS = 8;

/** Refcounted: several trackers may be open at once, and the last one to
 *  close is the one that should restore the coarse gate. */
let fineHolders = 0;

/**
 * Ask for fine-grained position updates while a live journey is on screen.
 * Returns the release function — call it on unmount.
 */
export function holdFineLocation(): () => void {
  fineHolders += 1;
  let released = false;
  return () => {
    if (released) return;
    released = true;
    fineHolders = Math.max(0, fineHolders - 1);
  };
}

const minMoveMeters = () => (fineHolders > 0 ? FINE_MOVE_METERS : COARSE_MOVE_METERS);

function set(next: Partial<DeviceLocation>) {
  state = { ...state, ...next };
  listeners.forEach((l) => l());
}

function supported() {
  return typeof navigator !== "undefined" && "geolocation" in navigator;
}

function onPosition(pos: GeolocationPosition, force = false) {
  const { latitude: lat, longitude: lng, accuracy } = pos.coords;
  const moved =
    force ||
    state.lat == null ||
    state.lng == null ||
    haversineKm({ lat: state.lat, lng: state.lng }, { lat, lng }) * 1000 >=
      minMoveMeters();
  if (!moved && state.status === "granted") return;
  set({ lat, lng, accuracy, status: "granted", at: Date.now() });
}

function onError(err: GeolocationPositionError) {
  if (err.code === err.PERMISSION_DENIED) {
    set({ status: "denied" });
    return;
  }
  // A timeout / no-signal keeps whatever fix we already have — losing GPS in a
  // lift should not blank out the address.
  if (state.status !== "granted") set({ status: "unavailable" });
}

/**
 * Start following the device. Idempotent — every consumer may call it on
 * mount, only the first one opens a watch.
 */
export function startDeviceLocation() {
  if (watchId !== null) return;
  if (!supported()) {
    set({ status: "unsupported" });
    return;
  }
  if (state.status === "idle") set({ status: "locating" });

  watchId = navigator.geolocation.watchPosition((p) => onPosition(p), onError, {
    enableHighAccuracy: true,
    maximumAge: 30_000,
    timeout: 25_000,
  });
}

/**
 * Ask for a FRESH fix right now — what the "Set your location" button calls.
 *
 * Two things a background watch cannot do: it re-prompts for permission from a
 * real user gesture (browsers, iOS Safari especially, are far more willing to
 * show the prompt then), and `maximumAge: 0` forces a new reading instead of
 * handing back the cached one the watch already reported.
 */
export function requestDeviceLocation(): Promise<DeviceLocation> {
  if (!supported()) {
    set({ status: "unsupported" });
    return Promise.resolve(state);
  }

  set({ status: state.status === "granted" ? "granted" : "locating" });
  startDeviceLocation();

  return new Promise((resolve) => {
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        // force: an explicit request should publish even a small correction,
        // otherwise pressing the button appears to do nothing.
        onPosition(pos, true);
        resolve(state);
      },
      (err) => {
        onError(err);
        resolve(state);
      },
      { enableHighAccuracy: true, maximumAge: 0, timeout: 20_000 },
    );
  });
}

function subscribe(listener: () => void) {
  listeners.push(listener);
  return () => {
    listeners = listeners.filter((l) => l !== listener);
  };
}

const getSnapshot = () => state;
const getServerSnapshot = () => IDLE;

/** Read the shared device location. Does NOT start the watch on its own —
 *  PatientLocationSync owns that, so a read never triggers a prompt. */
export function useDeviceLocation(): DeviceLocation {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
