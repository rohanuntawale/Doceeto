import "server-only";
import neo4j, { type Driver, type QueryResult } from "neo4j-driver";

/**
 * Server-only Neo4j driver singleton. The Bolt connection is a long-lived
 * TCP socket, so it must never run in the browser. All graph access goes
 * through lib/neo4j/repo.ts, which calls read()/write() here.
 */
let driver: Driver | null = null;

export function getDriver(): Driver {
  if (driver) return driver;
  const uri = process.env.NEO4J_URI;
  const user = process.env.NEO4J_USER;
  const password = process.env.NEO4J_PASSWORD;
  if (!uri || !user || !password) {
    throw new Error(
      "Neo4j is not configured. Set NEO4J_URI, NEO4J_USER and NEO4J_PASSWORD.",
    );
  }
  driver = neo4j.driver(uri, neo4j.auth.basic(user, password), {
    disableLosslessIntegers: true, // return plain JS numbers, not Integer
  });
  return driver;
}

type Params = Record<string, unknown>;

/** Run a read query and return plain row objects. */
export async function read<T = Record<string, unknown>>(
  cypher: string,
  params: Params = {},
): Promise<T[]> {
  const session = getDriver().session({ defaultAccessMode: neo4j.session.READ });
  try {
    const res: QueryResult = await session.run(cypher, params);
    return res.records.map((r) => r.toObject() as T);
  } finally {
    await session.close();
  }
}

/** Run a write query and return plain row objects. */
export async function write<T = Record<string, unknown>>(
  cypher: string,
  params: Params = {},
): Promise<T[]> {
  const session = getDriver().session({ defaultAccessMode: neo4j.session.WRITE });
  try {
    const res: QueryResult = await session.run(cypher, params);
    return res.records.map((r) => r.toObject() as T);
  } finally {
    await session.close();
  }
}
