import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { authorizeUrl, googleConfigured, redirectUri } from "@/lib/auth/google";
import { OAUTH_STATE_COOKIE } from "@/lib/auth/constants";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const b64url = (b: Buffer) => b.toString("base64url");

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
  const next = url.searchParams.get("next") ?? "";

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
    JSON.stringify({ state, codeVerifier, role, next }),
    {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax", // must survive Google's cross-site redirect back
      path: "/",
      maxAge: 10 * 60,
    },
  );

  return NextResponse.redirect(
    authorizeUrl({ redirectUri: redirectUri(req), state, codeChallenge }),
  );
}
