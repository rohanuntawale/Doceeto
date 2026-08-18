/** Shared by Edge middleware and Node route handlers, so keep this file
 *  free of any server-only or next/headers imports. */

export type SurfaceRole = "patient" | "doctor" | "nurse" | "ops";

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
  nurse: "iyashi_sid_nurse",
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
  "iyashi_session_nurse",
];

/**
 * Holds the in-flight Google sign-in: the state to echo back, the PKCE
 * verifier, and which role the person set out to create. Short-lived, httpOnly,
 * and deleted the moment the callback runs.
 */
export const OAUTH_STATE_COOKIE = "iyashi_oauth";

/**
 * Points at a verified Google identity that has not become an account yet —
 * a doctor part-way through filling in their own practice profile. Holding
 * only an opaque id means the browser cannot alter who it claims to be.
 */
export const PENDING_SIGNUP_COOKIE = "iyashi_pending_signup";

/**
 * Which surface an API call is acting as. Page requests carry the surface in
 * their path; fetches don't, so the client tags them with this header (and
 * `?surface=` for EventSource, which cannot set headers).
 */
export const SURFACE_HEADER = "x-iyashi-surface";
export const SURFACE_PARAM = "surface";

/** Set by the middleware so server components can see the current path. */
export const PATH_HEADER = "x-iyashi-path";

const ROLES: SurfaceRole[] = ["patient", "doctor", "nurse", "ops"];

export const isSurfaceRole = (v: string | null | undefined): v is SurfaceRole =>
  Boolean(v) && ROLES.includes(v as SurfaceRole);

/**
 * The roles that deliver care and therefore share the provider engine: they own
 * a row in the `doctors` registry, appear on the map, take requests, run trips
 * and hold a wallet.
 *
 * Guards should test this rather than `role === "doctor"`, so adding a cadre
 * never silently locks it out of work it is allowed to do. The exception is
 * prescribing, which stays doctor-only — see canPrescribe in lib/nurse.ts.
 */
export const PROVIDER_ROLES = ["doctor", "nurse"] as const;

export type ProviderRole = (typeof PROVIDER_ROLES)[number];

export const isProvider = (v: string | null | undefined): v is ProviderRole =>
  v === "doctor" || v === "nurse";

/** The surface a pathname belongs to — `/doctor/*` is the doctor's, and so on. */
export function surfaceFromPath(pathname: string): SurfaceRole | null {
  if (pathname === "/doctor" || pathname.startsWith("/doctor/")) return "doctor";
  if (pathname === "/nurse" || pathname.startsWith("/nurse/")) return "nurse";
  if (pathname === "/ops" || pathname.startsWith("/ops/")) return "ops";
  if (pathname === "/patient" || pathname.startsWith("/patient/")) return "patient";
  return null;
}

/** Where a signed-in role lives. */
export const homeFor = (role: SurfaceRole): string =>
  role === "ops" ? "/ops" : role === "doctor" ? "/doctor" : role === "nurse" ? "/nurse" : "/patient";

/** Where an unauthenticated visitor to a surface is sent to sign in. */
export const signInFor = (role: SurfaceRole, next?: string): string => {
  if (role === "ops") return "/ops-signin";
  return next ? `/login?next=${encodeURIComponent(next)}` : "/login";
};

/**
 * Where the sign-in switch parks a practitioner's account basics on its way
 * to the profile form.
 *
 * A doctor or nurse types their name, email and password into the switch, but
 * their account is not created until the profile step is submitted — so those
 * three values have to survive one client-side navigation. sessionStorage,
 * not the query string: a password in a URL ends up in history, in the
 * referer header and in every access log along the way. The profile form
 * reads this once and deletes it immediately.
 */
export const SIGNUP_HANDOFF_KEY = "doceeto:signup-handoff";
