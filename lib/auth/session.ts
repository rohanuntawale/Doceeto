import "server-only";
import { cookies } from "next/headers";
import { signSession, verifySession, type SessionClaims } from "@/lib/auth/jwt";
import { SESSION_COOKIE } from "@/lib/auth/constants";

export { SESSION_COOKIE };

/** Read + verify the current session from the request cookies (server). */
export async function getSession(): Promise<SessionClaims | null> {
  const token = cookies().get(SESSION_COOKIE)?.value;
  if (!token) return null;
  return verifySession(token);
}

/** Issue a session cookie for a user (called from route handlers). */
export async function setSession(user: {
  id: string;
  role: SessionClaims["role"];
  name: string;
}): Promise<void> {
  const token = await signSession({ sub: user.id, role: user.role, name: user.name });
  cookies().set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 7,
  });
}

/** Clear the session cookie (logout). */
export function clearSession(): void {
  cookies().delete(SESSION_COOKIE);
}
