/** Shared by Edge middleware and Node route handlers, so keep this file
 *  free of any server-only or next/headers imports. */

export type SurfaceRole = "patient" | "doctor" | "ops";

/**
 * One cookie PER ROLE, each holding nothing but an opaque session id. Two
 * reasons it is shaped this way:
 *
 *  • Per role, so a patient session and a doctor session coexist in one
 *    browser. With a single shared cookie, signing in as the doctor to accept
 *    a gig replaced the patient's session and every open patient tab jumped to
 *    the cockpit — the role appeared to switch by itself.
 *  • Opaque, so identity and role are NOT carried by the browser. The id is a
 *    lookup key for a Session row in the database, which is what actually says
 *    who you are — and deleting that row ends the session at once.
 */
export const SESSION_COOKIES: Record<SurfaceRole, string> = {
  patient: "iyashi_sid_patient",
  doctor: "iyashi_sid_doctor",
  ops: "iyashi_sid_ops",
};

/**
 * Cookies from earlier schemes (one shared cookie, and per-role cookies that
 * held a signed JWT). Cleared on sight — a stale self-describing token must
 * never be honoured now that the database is the authority on roles.
 */
export const RETIRED_COOKIES = [
  "iyashi_session",
  "iyashi_session_patient",
  "iyashi_session_doctor",
  "iyashi_session_ops",
];

/**
 * Which surface an API call is acting as. Page requests carry the surface in
 * their path; fetches don't, so the client tags them with this header (and
 * `?surface=` for EventSource, which cannot set headers).
 */
export const SURFACE_HEADER = "x-iyashi-surface";
export const SURFACE_PARAM = "surface";

/** Set by the middleware so server components can see the current path. */
export const PATH_HEADER = "x-iyashi-path";

const ROLES: SurfaceRole[] = ["patient", "doctor", "ops"];

export const isSurfaceRole = (v: string | null | undefined): v is SurfaceRole =>
  Boolean(v) && ROLES.includes(v as SurfaceRole);

/** The surface a pathname belongs to — `/doctor/*` is the doctor's, and so on. */
export function surfaceFromPath(pathname: string): SurfaceRole | null {
  if (pathname === "/doctor" || pathname.startsWith("/doctor/")) return "doctor";
  if (pathname === "/ops" || pathname.startsWith("/ops/")) return "ops";
  if (pathname === "/patient" || pathname.startsWith("/patient/")) return "patient";
  return null;
}

/** Where a signed-in role lives. */
export const homeFor = (role: SurfaceRole): string =>
  role === "ops" ? "/ops" : role === "doctor" ? "/doctor" : "/patient";

/** Where an unauthenticated visitor to a surface is sent to sign in. */
export const signInFor = (role: SurfaceRole, next?: string): string => {
  if (role === "ops") return "/ops-signin";
  return next ? `/login?next=${encodeURIComponent(next)}` : "/login";
};
