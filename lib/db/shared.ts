/** Shared types for the pluggable backends (Neo4j and the file store). */

/** Error the API routes translate to a 4xx instead of a blanket 500. */
export class DomainError extends Error {
  status: number;
  constructor(message: string, status = 400) {
    super(message);
    this.status = status;
  }
}

/** Optional geo filter for the read queries. */
export interface Near {
  lat: number;
  lng: number;
  km: number;
}

export interface UserRecord {
  id: string;
  email: string;
  /** Null when the account was created through Google and has no password. */
  passwordHash: string | null;
  role: "patient" | "doctor" | "ops";
  name: string;
}

/**
 * A signed-in session, stored in the DATABASE rather than encoded into the
 * browser's cookie. The browser only ever holds `id` — an opaque random
 * string that means nothing on its own — so who you are and what role you
 * hold is answered by the database on every request, and deleting the row
 * ends the session immediately.
 */
export interface SessionRecord {
  id: string;
  userId: string;
  role: UserRecord["role"];
  name: string;
  createdAt: string;
  expiresAt: string;
}

/** How long a new session stays valid. */
export const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000;

/** Opaque, unguessable session id — 256 bits of randomness, no claims inside. */
export function newSessionId(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}
