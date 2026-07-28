import "server-only";
import * as postgres from "@/lib/postgres/repo";
import * as filedb from "@/lib/filedb/repo";

/**
 * Backend selector. The API routes talk to `db` and never care which
 * store is behind it:
 *   • DATABASE_URL set → Postgres (Neon / Supabase / any Postgres).
 *   • otherwise        → the zero-setup file store (local, single server).
 * Both implement the same interface, so the request page is genuinely
 * server-backed either way.
 */
const usePostgres = Boolean(process.env.DATABASE_URL);

export const db = (usePostgres ? postgres : filedb) as unknown as typeof postgres;

export { DomainError } from "@/lib/db/shared";
export type { Near, SessionRecord, UserRecord } from "@/lib/db/shared";

/** One-time setup for whichever backend is active. */
export async function runSetup() {
  return usePostgres ? postgres.setup() : filedb.setup();
}
