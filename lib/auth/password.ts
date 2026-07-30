import "server-only";
import bcrypt from "bcryptjs";

/** Hash a plaintext password for storage. */
export function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, 10);
}

/**
 * Check a plaintext password against a stored hash.
 *
 * A null hash means the account has no password (Google sign-in), and must
 * never authenticate — bcrypt.compare against a null would throw, and a caller
 * that swallowed the throw could read it as a pass.
 */
export function verifyPassword(plain: string, hash: string | null): Promise<boolean> {
  if (!hash) return Promise.resolve(false);
  return bcrypt.compare(plain, hash);
}
