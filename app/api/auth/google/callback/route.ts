import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { exchangeCode, redirectUri } from "@/lib/auth/google";
import { setSession } from "@/lib/auth/session";
import { OAUTH_STATE_COOKIE, homeFor, type SurfaceRole } from "@/lib/auth/constants";
import { db } from "@/lib/db";
import { emitChange } from "@/lib/server/events";
import { clientIp, rateLimit } from "@/lib/server/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Send them back to the sign-in page with something readable. */
function fail(origin: string, message: string) {
  const url = new URL("/login", origin);
  url.searchParams.set("error", message);
  return NextResponse.redirect(url);
}

/**
 * Step two: Google has sent the browser back with a one-time code.
 *
 * Account resolution, in order — this is where the rules live:
 *
 *  1. Known google_id → that account, whatever its email is now.
 *  2. Known email + Google says VERIFIED → link the two, so someone who signed
 *     up with a password can keep using the button from now on. Refused when
 *     unverified, or the address alone would be enough to take the account.
 *  3. Nobody → create the role that was asked for.
 *
 * A mismatch in step 2 is refused rather than smoothed over: an email already
 * registered as a patient cannot become a doctor by arriving through Google.
 */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const origin = url.origin;

  // Same budget as the password route: this path creates accounts too.
  if (!rateLimit(`oauth:ip:${clientIp(req)}`, 20, 10 * 60_000)) {
    return fail(origin, "Too many sign-in attempts. Try again in a few minutes.");
  }

  const jar = cookies();
  const raw = jar.get(OAUTH_STATE_COOKIE)?.value;
  // One shot: whatever happens below, this exchange is over.
  jar.delete(OAUTH_STATE_COOKIE);

  const googleError = url.searchParams.get("error");
  if (googleError) {
    return fail(origin, googleError === "access_denied" ? "Sign-in cancelled." : "Google sign-in failed.");
  }

  if (!raw) return fail(origin, "That sign-in expired. Please try again.");

  let pending: { state: string; codeVerifier: string; role: SurfaceRole; next: string };
  try {
    pending = JSON.parse(raw);
  } catch {
    return fail(origin, "That sign-in expired. Please try again.");
  }

  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  if (!code || !state || state !== pending.state) {
    return fail(origin, "That sign-in could not be verified. Please try again.");
  }

  const role: SurfaceRole = pending.role === "doctor" ? "doctor" : "patient";

  try {
    const identity = await exchangeCode({
      code,
      redirectUri: redirectUri(req),
      codeVerifier: pending.codeVerifier,
    });

    let user = await db.findUserByGoogleId(identity.googleId);

    if (!user) {
      const byEmail = await db.findUserByEmail(identity.email);
      if (byEmail) {
        if (!identity.emailVerified) {
          return fail(origin, "Google hasn't verified that email address, so it can't be used to sign in here.");
        }
        if (byEmail.role !== role) {
          return fail(
            origin,
            `That email is already registered as a ${byEmail.role}. Sign in as a ${byEmail.role} instead.`,
          );
        }
        await db.linkGoogleAccount(byEmail.id, identity.googleId, identity.picture);
        user = byEmail;
      }
    }

    if (!user) {
      if (!identity.emailVerified) {
        return fail(origin, "Google hasn't verified that email address, so it can't be used to sign in here.");
      }
      if (role === "doctor") {
        const created = await db.createDoctorUser({
          email: identity.email,
          passwordHash: null, // Google account: no password to store
          googleId: identity.googleId,
          avatarUrl: identity.picture,
          fullName: identity.name,
          specialty: "General Physician",
          kind: "practising",
          gender: "female",
          experienceYears: 0,
          consultFee: 400,
          homeVisitFee: 900,
          clinicAddress: "",
          lat: null,
          lng: null,
        });
        user = created.user;
        emitChange(["doctors"]); // patients' maps pick the new doctor up live
      } else {
        user = await db.createPatientUser({
          email: identity.email,
          passwordHash: null,
          name: identity.name,
          address: "",
          googleId: identity.googleId,
          avatarUrl: identity.picture,
        });
      }
    }

    if (user.role !== role) {
      return fail(
        origin,
        `That account is a ${user.role}. Use the ${user.role} sign-in.`,
      );
    }

    await setSession({ id: user.id, role: user.role, name: user.name });

    // Honour where they were headed, but only inside their own surface —
    // anything else would bounce off the guard right back to a sign-in page.
    const home = homeFor(user.role);
    const dest = pending.next && pending.next.startsWith(home) ? pending.next : home;
    return NextResponse.redirect(new URL(dest, origin));
  } catch (err) {
    console.error("google sign-in failed:", err);
    return fail(origin, "Could not complete the Google sign-in. Please try again.");
  }
}
