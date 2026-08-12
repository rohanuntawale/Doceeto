"use client";

/**
 * Which doctor "me" refers to in DEMO mode.
 *
 * Demo mode has no session, so the browser remembers the doctor it registered.
 * This lives in its own module because both lib/hooks/data.ts and
 * lib/hooks/use-current-doctor.ts need it, and use-current-doctor already
 * imports data.ts — keeping the key here avoids an import cycle.
 *
 * In LIVE mode none of this is used: the server derives the doctor from the
 * session cookie and ignores any id the client sends.
 */
const DOCTOR_ID_KEY = "iyashi:doctor-id:v1";

/** Remember which demo doctor is "me" (set after registration). */
export function setCurrentDoctorId(id: string) {
  try {
    window.localStorage.setItem(DOCTOR_ID_KEY, id);
  } catch {
    /* private mode / quota — ignore */
  }
}

export function readStoredDoctorId(): string | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage.getItem(DOCTOR_ID_KEY);
  } catch {
    return null;
  }
}

/**
 * Forget the remembered provider. Called on sign-out so a shared or public
 * browser does not keep a clinician identity lying around after they leave —
 * "log out" must actually mean the next person is nobody.
 */
export function clearCurrentDoctorId() {
  try {
    window.localStorage.removeItem(DOCTOR_ID_KEY);
  } catch {
    /* private mode — ignore */
  }
}
