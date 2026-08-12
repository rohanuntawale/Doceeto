import { NextResponse } from "next/server";
import { getRequestSession, type SessionRecord } from "@/lib/auth/session";
import { SESSION_COOKIES } from "@/lib/auth/constants";
import { db } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Re-issue the surface cookie stamped with the session row's CURRENT expiry.
 * Sessions slide server-side (getSessionById extends the row while it's in
 * use), but the browser would still drop the cookie at its original stamp —
 * silently signing out an active user. Every surface calls /me on load, so
 * refreshing here keeps the cookie in lockstep with the row: nobody is signed
 * out by time while they keep using the app. Only their own logout (or ops
 * deleting the account) ends a session.
 */
function withFreshCookie<T>(body: T, session: SessionRecord): NextResponse {
  const res = NextResponse.json(body);
  res.cookies.set(SESSION_COOKIES[session.role], session.id, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    expires: new Date(session.expiresAt),
  });
  return res;
}

/**
 * Who the CALLING SURFACE is signed in as. The patient app asks and gets the
 * patient; the cockpit asks and gets the doctor — even when both accounts are
 * signed in on the same browser. Answering with the wrong one is what used to
 * make a dashboard flip roles under the user.
 */
export async function GET(req: Request) {
  try {
    const session = await getRequestSession(req);
    if (!session) return NextResponse.json({ user: null }, { status: 200 });

    if (session.role === "doctor") {
      const doctor = await db.getDoctorById(session.userId);
      return withFreshCookie({ role: "doctor", doctor }, session);
    }
    if (session.role === "patient") {
      const patient = await db.getPatientProfile(session.userId);
      return withFreshCookie({ role: "patient", patient }, session);
    }
    if (session.role === "nurse") {
      // A nurse IS a provider row, read exactly as a doctor's is — that record
      // carries the coordinates the map needs, the online status, the rating and
      // the verification flag. It is also returned as `doctor` so every shared
      // provider component (the tracker, the map, the request cards) can take it
      // without a second shape to handle.
      const nurse = await db.getDoctorById(session.userId);
      return withFreshCookie({ role: "nurse", nurse, doctor: nurse }, session);
    }
    return withFreshCookie({ role: "ops", name: session.name }, session);
  } catch (err) {
    // A database blip must not read as "signed out": answering `{user:null}`
    // here would empty every dashboard and bounce the person to /login as if
    // their session had ended. 503 says "ask again" — the clients that poll
    // this endpoint treat a non-ok response as "unknown, keep what you have".
    console.error("auth/me failed:", err);
    return NextResponse.json({ error: "Could not load your account." }, { status: 503 });
  }
}
