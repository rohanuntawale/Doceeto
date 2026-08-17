import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { authorizeUrl, googleConfigured, redirectUri } from "@/lib/auth/google";
import { OAUTH_STATE_COOKIE } from "@/lib/auth/constants";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const b64url = (b: Buffer) => b.toString("base64url");

function isAllowedMobileReturn(value: string): boolean {
  try {
    const url = new URL(value);
    return (
      (url.protocol === "https:" || url.protocol === "http:") &&
      url.hostname === "localhost"
    ) || (url.protocol === "capacitor:" && url.hostname === "localhost");
  } catch {
    return false;
  }
}

/**
 * Step one of Google sign-in: hand the browser to Google.
 *
 * Two things are stashed in a short-lived cookie for the callback to check:
 *
 *  • state — a random value echoed back by Google. If it doesn't match, the
 *    callback was not started by this browser, which is how a stranger's code
 *    would arrive. CSRF protection, and the reason the cookie is httpOnly.
 *  • the PKCE verifier — the callback proves it started this exchange by
 *    presenting the value behind the challenge sent here. An intercepted `code`
 *    is then useless on its own.
 *
 * The ROLE rides along too. Google says who someone is, never what they are,
 * and a patient account and a doctor account are different things here — so
 * whichever button was pressed decides what gets created.
 */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const raw = url.searchParams.get("role");
  // Both provider cadres onboard through Google; anything else is a patient.
  const role = raw === "doctor" ? "doctor" : raw === "nurse" ? "nurse" : "patient";
  /*
   * Did anyone actually SAY patient, or is that just the fallback?
   *
   * The line above collapses "no role given" and "patient" into the same
   * answer, which is how a first-time visitor pressing a bare "Continue with
   * Google" was silently turned into a patient account without ever being
   * asked. The callback needs to tell the two apart, so record it.
   */
  const roleExplicit = raw === "doctor" || raw === "nurse" || raw === "patient";
  const next = url.searchParams.get("next") ?? "";
  const requestedMobileReturn = url.searchParams.get("mobile_return");
  const mobileReturn = requestedMobileReturn && isAllowedMobileReturn(requestedMobileReturn)
    ? requestedMobileReturn
    : undefined;

  if (!googleConfigured()) {
    const back = new URL("/login", url.origin);
    back.searchParams.set("error", "Google sign-in isn't set up on this deployment.");
    return NextResponse.redirect(back);
  }

  const { randomBytes, createHash } = await import("node:crypto");
  const state = b64url(randomBytes(24));
  const codeVerifier = b64url(randomBytes(48));
  const codeChallenge = b64url(createHash("sha256").update(codeVerifier).digest());

  cookies().set(
    OAUTH_STATE_COOKIE,
    JSON.stringify({ state, codeVerifier, role, roleExplicit, next, mobileReturn }),
    {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax", // must survive Google's cross-site redirect back
      path: "/",
      maxAge: 10 * 60,
    },
  );

  // Forwarded from the sign-in form when the address they typed turned out to
  // be a Google account — Google then opens on that account instead of making
  // them pick it out of a list they just told us about.
  const loginHint = new URL(req.url).searchParams.get("email") ?? undefined;

  return NextResponse.redirect(
    authorizeUrl({ redirectUri: redirectUri(req), state, codeChallenge, loginHint }),
  );
}
