import "server-only";
import * as neo4j from "@/lib/neo4j/repo";
import * as filedb from "@/lib/filedb/repo";

/**
 * Backend selector. The API routes talk to `db` and never care which
 * store is behind it:
 *   • NEO4J_URI set  → Neo4j (production, multi-instance, serverless).
 *   • otherwise      → the zero-setup file store (local / single server).
 * Both implement the same interface, so the request page is genuinely
 * server-backed either way.
 */
const useNeo4j = Boolean(process.env.NEO4J_URI);

export const db = (useNeo4j ? neo4j : filedb) as unknown as typeof neo4j;

export { DomainError } from "@/lib/db/shared";
export type { Near, UserRecord } from "@/lib/db/shared";

/** One-time setup for whichever backend is active. */
export async function runSetup() {
  if (useNeo4j) {
    const seed = await import("@/lib/neo4j/seed");
    return seed.runSetup();
  }
  return filedb.setup();
}
