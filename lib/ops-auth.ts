"use client";

/**
 * Ops (admin) gate. In LIVE mode the middleware + Supabase auth guard
 * `/ops`. In DEMO mode there's no server session, so we gate the console
 * behind a local passcode flag that the ops sign-in sets.
 */
const KEY = "iyashi:ops-auth:v1";

/** Demo-only passcode for the ops console. Change as you like. */
export const OPS_PASSCODE = "iyashi";

export function setOpsAuthed() {
  try {
    window.localStorage.setItem(KEY, "1");
  } catch {
    /* ignore */
  }
}

export function clearOpsAuthed() {
  try {
    window.localStorage.removeItem(KEY);
  } catch {
    /* ignore */
  }
}

export function readOpsAuthed(): boolean {
  try {
    return window.localStorage.getItem(KEY) === "1";
  } catch {
    return false;
  }
}
