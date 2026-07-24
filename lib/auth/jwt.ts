/**
 * Tiny HS256 JWT using Web Crypto, so the SAME code verifies tokens in
 * both the Edge middleware and Node route handlers with no dependency.
 */

export interface SessionClaims {
  sub: string; // user id
  role: "patient" | "doctor" | "ops";
  name: string;
  iat: number;
  exp: number;
}

const ALG = { name: "HMAC", hash: "SHA-256" };
const WEEK_SECONDS = 60 * 60 * 24 * 7;

function secret(): string {
  return process.env.AUTH_SECRET || "iyashi-dev-secret-change-me";
}

/** Secrets accepted for VERIFICATION. Rotation: move the old secret to
 *  AUTH_SECRET_PREVIOUS, put the new one in AUTH_SECRET — live sessions
 *  keep working for a week while new tokens sign with the new secret. */
function verifySecrets(): string[] {
  const prev = process.env.AUTH_SECRET_PREVIOUS;
  return prev ? [secret(), prev] : [secret()];
}

const enc = new TextEncoder();
const dec = new TextDecoder();

/** Web Crypto's types want a plain ArrayBuffer-backed view. */
const buf = (u: Uint8Array): BufferSource => u as unknown as BufferSource;

function b64urlEncode(bytes: Uint8Array): string {
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function b64urlToBytes(s: string): Uint8Array {
  const pad = s.length % 4 ? 4 - (s.length % 4) : 0;
  const b64 = s.replace(/-/g, "+").replace(/_/g, "/") + "=".repeat(pad);
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

async function key(sec: string = secret()): Promise<CryptoKey> {
  return crypto.subtle.importKey("raw", buf(enc.encode(sec)), ALG, false, [
    "sign",
    "verify",
  ]);
}

/** Sign a session token valid for one week. */
export async function signSession(
  payload: Pick<SessionClaims, "sub" | "role" | "name">,
): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const header = { alg: "HS256", typ: "JWT" };
  const claims: SessionClaims = {
    ...payload,
    iat: now,
    exp: now + WEEK_SECONDS,
  };
  const head = b64urlEncode(enc.encode(JSON.stringify(header)));
  const body = b64urlEncode(enc.encode(JSON.stringify(claims)));
  const data = `${head}.${body}`;
  const sig = await crypto.subtle.sign(ALG, await key(), buf(enc.encode(data)));
  return `${data}.${b64urlEncode(new Uint8Array(sig))}`;
}

/** Verify a token and return its claims, or null if invalid/expired. */
export async function verifySession(token: string): Promise<SessionClaims | null> {
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return null;
    const [head, body, sig] = parts;
    const data = `${head}.${body}`;
    let ok = false;
    for (const sec of verifySecrets()) {
      ok = await crypto.subtle.verify(
        ALG,
        await key(sec),
        buf(b64urlToBytes(sig)),
        buf(enc.encode(data)),
      );
      if (ok) break;
    }
    if (!ok) return null;
    const claims = JSON.parse(dec.decode(b64urlToBytes(body))) as SessionClaims;
    if (!claims.exp || claims.exp < Math.floor(Date.now() / 1000)) return null;
    return claims;
  } catch {
    return null;
  }
}
