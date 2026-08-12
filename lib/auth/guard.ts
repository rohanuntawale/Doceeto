import "server-only";
import { redirect } from "next/navigation";
import { getSession, currentPath } from "@/lib/auth/session";
import { homeFor, signInFor, type SurfaceRole } from "@/lib/auth/constants";
import type { SessionRecord } from "@/lib/db/shared";

/**
 * Surfaces that hold other people's medical data, dispatch a human to a home,
 * or move money. These are NEVER openable without a real session — not in demo
 * mode, not in development, not if an env var goes missing.
 *
 * The old bypass keyed the whole authorization layer on NEXT_PUBLIC_BACKEND.
 * That is a build-time-inlined PUBLIC variable, so a build that simply forgot
 * it shipped a nurse console anyone could walk into by typing /nurse — no
 * credential, no session, just a URL. Demo convenience is not worth a surface
 * that reads patient allergies and accepts home visits.
 */
const PRIVILEGED: ReadonlySet<SurfaceRole> = new Set<SurfaceRole>([
  "doctor",
  "nurse",
  "ops",
]);

const isLiveMode = Boolean(process.env.NEXT_PUBLIC_BACKEND);

/**
 * Whether a surface may be entered without a session.
 *
 * Fails CLOSED: a privileged surface always requires one, and even the patient
 * demo is refused once a database is configured or we are running a production
 * build — the two signals that this is a real deployment rather than someone's
 * laptop.
 */
function demoBypassAllowed(surface: SurfaceRole): boolean {
  if (PRIVILEGED.has(surface)) return false;
  if (isLiveMode) return false;
  if (process.env.NODE_ENV === "production") return false;
  if (process.env.DATABASE_URL) return false;
  return true;
}

/**
 * Gate one surface on ITS OWN database session, from the server, before any of
 * the page renders.
 *
 * This is where authorization for pages actually happens. The middleware only
 * spots a missing cookie; the session id it lets through means nothing until
 * it is resolved against the store, which needs the Node runtime — so the
 * layouts do it. Rendering server-side also means no dashboard is ever painted
 * for the wrong role and then swapped out.
 *
 * A visitor who holds a DIFFERENT role's session is sent to sign in for this
 * one, never silently to their own dashboard: a patient asking for /doctor used
 * to be bounced back to /patient, which is why the two looked identical.
 */
export async function requireSurface(surface: SurfaceRole): Promise<SessionRecord | null> {
  if (demoBypassAllowed(surface)) return null; // patient demo on a dev machine only

  const session = await getSession(surface);
  if (session) return session;

  const next = currentPath() ?? homeFor(surface);
  redirect(signInFor(surface, next));
}
