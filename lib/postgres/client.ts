import "server-only";
import { Pool, type PoolClient, type QueryResultRow } from "pg";

/**
 * Server-only Postgres pool singleton (Neon, Supabase, or any Postgres).
 *
 * Held on globalThis because Next's dev server re-evaluates modules on every
 * hot reload — without this, each edit would leak a fresh pool and the
 * connection limit on a free Neon project is reached in minutes.
 */
const g = globalThis as unknown as { __iyashiPgPool?: Pool };

export function getPool(): Pool {
  if (g.__iyashiPgPool) return g.__iyashiPgPool;

  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("Postgres is not configured. Set DATABASE_URL.");
  }
  g.__iyashiPgPool = new Pool({
    connectionString,
    // Neon terminates idle connections itself; keep the local pool small so a
    // serverless deploy doesn't hold more than its share.
    max: Number(process.env.PGPOOL_MAX ?? 5),
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 15_000,
    // Neon requires TLS. `sslmode=require` in the URL is enough for the
    // handshake, but node-postgres still wants an ssl object to enable it.
    ssl: /localhost|127\.0\.0\.1/.test(connectionString)
      ? undefined
      : { rejectUnauthorized: false },
  });
  return g.__iyashiPgPool;
}

/** Run a query and return its rows. */
export async function sql<T extends QueryResultRow = QueryResultRow>(
  text: string,
  params: unknown[] = [],
): Promise<T[]> {
  const res = await getPool().query<T>(text, params);
  return res.rows;
}

/** Run a query and return the first row, or null. */
export async function one<T extends QueryResultRow = QueryResultRow>(
  text: string,
  params: unknown[] = [],
): Promise<T | null> {
  const rows = await sql<T>(text, params);
  return rows[0] ?? null;
}

/**
 * Run several statements in one transaction. Used wherever a write must not be
 * observable half-done — accepting a request while charging the wallet, or
 * booking a slot that another patient is racing for.
 */
export async function tx<T>(fn: (c: PoolClient) => Promise<T>): Promise<T> {
  const client = await getPool().connect();
  try {
    await client.query("BEGIN");
    const out = await fn(client);
    await client.query("COMMIT");
    return out;
  } catch (err) {
    await client.query("ROLLBACK").catch(() => {});
    throw err;
  } finally {
    client.release();
  }
}
