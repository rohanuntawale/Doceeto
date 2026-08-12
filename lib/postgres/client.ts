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
  const pool = new Pool({
    connectionString,
    // Neon terminates idle connections itself; keep the local pool small so a
    // serverless deploy doesn't hold more than its share.
    max: Number(process.env.PGPOOL_MAX ?? 5),
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 15_000,
    // Keeps the socket from being dropped silently by the platform while the
    // client still believes it is usable.
    keepAlive: true,
    // Neon requires TLS. `sslmode=require` in the URL is enough for the
    // handshake, but node-postgres still wants an ssl object to enable it.
    ssl: /localhost|127\.0\.0\.1/.test(connectionString)
      ? undefined
      : { rejectUnauthorized: false },
  });
  // MUST be present. An idle pooled client that Neon kills (compute suspend,
  // idle timeout) emits 'error' on the pool with no request to attach it to —
  // and an EventEmitter 'error' with no listener is an uncaught exception,
  // which takes the whole server process down and 500s every request in
  // flight. Swallowing it here just retires that one client.
  pool.on("error", (err) => console.error("pg idle client error (ignored):", err.message));

  g.__iyashiPgPool = pool;
  return pool;
}

/**
 * A dead pooled connection fails the query it was handed, not the one that
 * killed it: Neon suspends the compute or drops an idle socket, and the next
 * caller pays for it. These are the errors that mean "this connection is gone"
 * rather than "your SQL is wrong".
 */
const DEAD_CONNECTION = /connection terminated|terminating connection|ECONNRESET|EPIPE|socket hang up|Client has encountered a connection error/i;
const isDeadConnection = (err: unknown): boolean => {
  const e = err as { code?: string; message?: string };
  return (
    ["57P01", "57P02", "57P03", "08000", "08003", "08006", "08P01"].includes(e?.code ?? "") ||
    DEAD_CONNECTION.test(e?.message ?? "")
  );
};

/** Only a read may be replayed — a write could have committed before the socket died. */
const isReadOnly = (text: string) => /^\s*(?:--[^\n]*\n|\s)*(?:select|with)\b/i.test(text);

/** Run a query and return its rows. */
export async function sql<T extends QueryResultRow = QueryResultRow>(
  text: string,
  params: unknown[] = [],
): Promise<T[]> {
  try {
    const res = await getPool().query<T>(text, params);
    return res.rows;
  } catch (err) {
    // Retry once on a corpse connection, but only for reads: the pool hands
    // back a live one and the request succeeds instead of 500ing on a
    // suspended-compute wake-up.
    if (!isDeadConnection(err) || !isReadOnly(text)) throw err;
    const res = await getPool().query<T>(text, params);
    return res.rows;
  }
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
