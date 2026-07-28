import "server-only";
import { cookies, headers } from "next/headers";
import { db } from "@/lib/db";
import type { SessionRecord } from "@/lib/db/shared";
import {
  PATH_HEADER,
  RETIRED_COOKIES,
  SESSION_COOKIES,
  SURFACE_HEADER,
  SURFACE_PARAM,
  isSurfaceRole,
  surfaceFromPath,
  type SurfaceRole,
} from "@/lib/auth/constants";

export type { SessionRecord };

/**
 * Sessions live in the DATABASE. The cookie is a bare lookup key, so every
 * check here is a real read against the store — a deleted or expired row stops
 * working immediately, and nothing about identity or role can be forged or
 * replayed from the browser.
 *
 * `surface` is what keeps roles apart: the cockpit asks for the doctor session
 * and the patient app for the patient session, so neither can be answered with
 * the other's login even when both are signed in on one browser.
 */
export async function getSession(
  surface?: SurfaceRole | null,
): Promise<SessionRecord | null> {
  const jar = cookies();

  const lookup = async (role: SurfaceRole) => {
    const sid = jar.get(SESSION_COOKIES[role])?.value;
    if (!sid) return null;
    const session = await db.getSessionById(sid);
    // The row's own role is authoritative; a cookie sitting in the wrong slot
    // (hand-edited, or left over from a rename) buys nothing.
    return session && session.role === role ? session : null;
  };

  if (surface) return lookup(surface);

  for (const role of ["patient", "doctor", "ops"] as const) {
    const session = await lookup(role);
    if (session) return session;
  }
  return null;
}

/**
 * The surface a request is acting as: the header the client attaches, the
 * `?surface=` param for EventSource, else the page it was fired from.
 */
export function surfaceOf(req: Request): SurfaceRole | null {
  const header = req.headers.get(SURFACE_HEADER);
  if (isSurfaceRole(header)) return header;

  const param = new URL(req.url).searchParams.get(SURFACE_PARAM);
  if (isSurfaceRole(param)) return param;

  const referer = req.headers.get("referer");
  if (referer) {
    try {
      return surfaceFromPath(new URL(referer).pathname);
    } catch {
      /* unparseable referer — fall through */
    }
  }
  return null;
}

/** Session for the surface this request speaks for. */
export async function getRequestSession(req: Request): Promise<SessionRecord | null> {
  return getSession(surfaceOf(req));
}

/** The path being rendered, published by the middleware for server components. */
export function currentPath(): string | null {
  return headers().get(PATH_HEADER);
}

/** Session for the surface of the page currently being rendered. */
export async function getPageSession(surface: SurfaceRole): Promise<SessionRecord | null> {
  return getSession(surface);
}

/** Start a session: a row in the database, its id handed to the browser. */
export async function setSession(user: {
  id: string;
  role: SurfaceRole;
  name: string;
}): Promise<SessionRecord> {
  const session = await db.createSession({
    userId: user.id,
    role: user.role,
    name: user.name,
  });
  const jar = cookies();
  jar.set(SESSION_COOKIES[user.role], session.id, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    expires: new Date(session.expiresAt),
  });
  // Never leave a self-describing token behind to be honoured later.
  for (const name of RETIRED_COOKIES) jar.delete(name);
  return session;
}

/**
 * Sign out of ONE surface: the row goes, so the session is dead server-side
 * rather than merely forgotten by this browser. Leaving the cockpit must not
 * end the patient session, which is why the role is scoped — `undefined`
 * clears every surface ("sign out everywhere").
 */
export async function clearSession(role?: SurfaceRole): Promise<void> {
  const jar = cookies();
  const roles = role ? [role] : (["patient", "doctor", "ops"] as const);
  for (const r of roles) {
    const name = SESSION_COOKIES[r];
    const sid = jar.get(name)?.value;
    if (sid) await db.deleteSession(sid);
    jar.delete(name);
  }
  for (const name of RETIRED_COOKIES) jar.delete(name);
}
