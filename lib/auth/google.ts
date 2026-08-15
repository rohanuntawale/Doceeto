import "server-only";

/**
 * Google sign-in, hand-rolled on the OAuth 2.0 authorization-code flow.
 *
 * No auth library: sessions here are already rows in our own database
 * (lib/auth/session.ts), and every drop-in brings its own session model that
 * would have to be bridged back to ours. What Google is used for is narrow —
 * proving the person owns an email address — so the exchange below is all we
 * actually need from it.
 */

const AUTH_ENDPOINT = "https://accounts.google.com/o/oauth2/v2/auth";
const TOKEN_ENDPOINT = "https://oauth2.googleapis.com/token";

/**
 * The client id is PUBLIC — it travels in the URL the browser sends to Google,
 * so it lives in NEXT_PUBLIC_GOOGLE_CLIENT_ID and the sign-in buttons can key
 * off it. GOOGLE_CLIENT_ID is accepted too, for a server-only setup.
 */
export const clientId = () =>
  process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID ?? process.env.GOOGLE_CLIENT_ID ?? "";

export const googleConfigured = () =>
  Boolean(clientId() && process.env.GOOGLE_CLIENT_SECRET);

/**
 * The callback Google will send the browser back to. It must match a URI
 * registered on the OAuth client EXACTLY, so it is derived from the incoming
 * request (localhost in dev, the deployed origin in production) rather than
 * from a variable that can drift out of step with what Google was told.
 */
export function redirectUri(req: Request): string {
  const configured = process.env.GOOGLE_REDIRECT_URI;
  if (configured) return configured;
  // Behind Vercel's proxy the request URL is http://…internal; the forwarded
  // headers carry what the browser actually asked for.
  const h = req.headers;
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? new URL(req.url).host;
  const proto = h.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  return `${proto}://${host}/api/auth/google/callback`;
}

/** Where to send the browser to ask Google who they are. */
export function authorizeUrl(input: {
  redirectUri: string;
  state: string;
  codeChallenge: string;
  /**
   * The address the person already typed on the sign-in form, passed to Google
   * as `login_hint` so their picker opens on the right account.
   *
   * Only a convenience, never a claim: Google decides who they actually are,
   * and the callback trusts the verified `sub` from the id token — not this.
   */
  loginHint?: string;
}): string {
  const url = new URL(AUTH_ENDPOINT);
  url.searchParams.set("client_id", clientId());
  url.searchParams.set("redirect_uri", input.redirectUri);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", "openid email profile");
  url.searchParams.set("state", input.state);
  url.searchParams.set("code_challenge", input.codeChallenge);
  url.searchParams.set("code_challenge_method", "S256");
  // Ask every time rather than silently reusing whichever Google account the
  // browser happens to be signed into — this app has separate patient and
  // doctor accounts, and picking the wrong one is a confusing thing to undo.
  url.searchParams.set("prompt", "select_account");
  if (input.loginHint) url.searchParams.set("login_hint", input.loginHint);
  return url.toString();
}

export interface GoogleIdentity {
  /** Google's stable id for this person (the `sub` claim). */
  googleId: string;
  email: string;
  emailVerified: boolean;
  name: string;
  picture?: string;
}

function decodeJwtPayload(token: string): Record<string, unknown> {
  const part = token.split(".")[1];
  if (!part) throw new Error("Malformed id_token.");
  const b64 = part.replace(/-/g, "+").replace(/_/g, "/");
  const pad = b64.length % 4 ? "=".repeat(4 - (b64.length % 4)) : "";
  return JSON.parse(Buffer.from(b64 + pad, "base64").toString("utf8"));
}

/**
 * Trade the one-time code for the person's identity.
 *
 * The id_token's signature is not re-verified, and deliberately so: it is read
 * from the body of a direct server-to-server HTTPS response from Google's token
 * endpoint, authenticated with our client secret. That is the one case the
 * OpenID spec allows skipping it. Never decode an id_token that arrived any
 * other way — for instance straight off a query string.
 */
export async function exchangeCode(input: {
  code: string;
  redirectUri: string;
  codeVerifier: string;
}): Promise<GoogleIdentity> {
  const res = await fetch(TOKEN_ENDPOINT, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code: input.code,
      client_id: clientId(),
      client_secret: process.env.GOOGLE_CLIENT_SECRET ?? "",
      redirect_uri: input.redirectUri,
      grant_type: "authorization_code",
      code_verifier: input.codeVerifier,
    }),
    cache: "no-store",
  });

  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(`Google rejected the sign-in (${res.status}). ${detail.slice(0, 200)}`);
  }

  const body = (await res.json()) as { id_token?: string };
  if (!body.id_token) throw new Error("Google returned no id_token.");

  const claims = decodeJwtPayload(body.id_token);
  const email = String(claims.email ?? "").toLowerCase();
  const sub = String(claims.sub ?? "");
  if (!email || !sub) throw new Error("Google returned an incomplete profile.");

  return {
    googleId: sub,
    email,
    // Google sends this as a boolean or the string "true" depending on the age
    // of the account; an unverified address must not be able to claim an
    // existing password account by matching on email alone.
    emailVerified: claims.email_verified === true || claims.email_verified === "true",
    name: String(claims.name ?? email.split("@")[0]),
    picture: claims.picture ? String(claims.picture) : undefined,
  };
}
