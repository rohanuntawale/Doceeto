import "server-only";
import { redirect } from "next/navigation";
import { getSession, currentPath } from "@/lib/auth/session";
import { homeFor, signInFor, type SurfaceRole } from "@/lib/auth/constants";
import type { SessionRecord } from "@/lib/db/shared";

const isLiveMode = Boolean(process.env.NEXT_PUBLIC_BACKEND);

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
  if (!isLiveMode) return null; // demo mode has no accounts

  const session = await getSession(surface);
  if (session) return session;

  const next = currentPath() ?? homeFor(surface);
  redirect(signInFor(surface, next));
}
