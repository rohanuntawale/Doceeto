import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { exchangeCode, redirectUri } from "@/lib/auth/google";
import { setSession } from "@/lib/auth/session";
import {
  OAUTH_STATE_COOKIE,
  PENDING_SIGNUP_COOKIE,
  homeFor,
  type SurfaceRole,
} from "@/lib/auth/constants";
import { db } from "@/lib/db";
import { clientIp, rateLimit } from "@/lib/server/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
// A cold start here stacks Google's token exchange on top of a possibly
// suspended Neon compute; the platform default (10s on some plans) can kill
// the exchange mid-flight, which the user experiences as a dead button.
export const maxDuration = 30;

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
        /*
         * NO ACCOUNT YET — on purpose.
         *
         * Google proves who someone is; it says nothing about their specialty,
         * qualifications, registration number or fees. Filling those in on
         * their behalf would put invented credentials in front of patients
         * choosing who to trust with their care. So the verified identity is
         * parked here and the doctor is sent to the same profile form the
         * password sign-up uses; the account exists only once they submit it.
         * Abandon it and the pending row simply expires.
         */
        const pending = await db.createPendingSignup({
          googleId: identity.googleId,
          email: identity.email,
          name: identity.name,
          avatarUrl: identity.picture ?? null,
          role: "doctor",
        });
        cookies().set(PENDING_SIGNUP_COOKIE, pending.id, {
          httpOnly: true,
          secure: process.env.NODE_ENV === "production",
          sameSite: "lax",
          path: "/",
          expires: new Date(pending.expiresAt),
        });
        // The name is a prefill only — a convenience so they don't retype it.
        // Identity is read from the pending row server-side, never from this.
        const to = new URL("/?google=doctor", origin);
        to.searchParams.set("name", identity.name);
        return NextResponse.redirect(to);
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
