import "server-only";
import { read, write } from "@/lib/neo4j/driver";
import { hashPassword } from "@/lib/auth/password";

/** Uniqueness + lookup constraints and indexes (idempotent).
 *  NOTE: this is SCHEMA ONLY. No demo data is ever seeded — doctors,
 *  patients, SOS events, requests and orders all come from real flows. */
export async function ensureConstraints() {
  const stmts = [
    "CREATE CONSTRAINT user_email IF NOT EXISTS FOR (u:User) REQUIRE u.email IS UNIQUE",
    "CREATE CONSTRAINT user_id IF NOT EXISTS FOR (u:User) REQUIRE u.id IS UNIQUE",
    "CREATE CONSTRAINT doctor_id IF NOT EXISTS FOR (d:Doctor) REQUIRE d.id IS UNIQUE",
    "CREATE CONSTRAINT ambulance_id IF NOT EXISTS FOR (a:Ambulance) REQUIRE a.id IS UNIQUE",
    "CREATE CONSTRAINT sos_id IF NOT EXISTS FOR (s:Sos) REQUIRE s.id IS UNIQUE",
    "CREATE CONSTRAINT request_id IF NOT EXISTS FOR (r:ConsultRequest) REQUIRE r.id IS UNIQUE",
    "CREATE CONSTRAINT order_id IF NOT EXISTS FOR (o:Order) REQUIRE o.id IS UNIQUE",
    // Geo: store position as a spatial point alongside lat/lng so
    // nearby-doctor / nearby-SOS queries can use the point index.
    "CREATE POINT INDEX doctor_location IF NOT EXISTS FOR (d:Doctor) ON (d.location)",
    "CREATE POINT INDEX sos_location IF NOT EXISTS FOR (s:Sos) ON (s.location)",
    "CREATE INDEX doctor_status IF NOT EXISTS FOR (d:Doctor) ON (d.status)",
    "CREATE INDEX request_status IF NOT EXISTS FOR (r:ConsultRequest) ON (r.status)",
    "CREATE INDEX sos_status IF NOT EXISTS FOR (s:Sos) ON (s.status)",
  ];
  for (const s of stmts) await write(s);
}

/** Create the ops/admin login if it does not exist yet. */
export async function ensureOpsUser() {
  const email = (process.env.OPS_EMAIL || "ops@doceeto.health").toLowerCase();
  const exists = await read(`MATCH (u:User {email: $email}) RETURN properties(u) AS u`, { email });
  if (exists.length > 0) return { email, created: false };
  const passwordHash = await hashPassword(process.env.OPS_PASSWORD || "iyashi-ops");
  await write(
    `CREATE (u:User { id: $id, email: $email, passwordHash: $passwordHash, role: 'ops', name: 'Doceeto Ops', createdAt: $now })`,
    { id: `ops-${crypto.randomUUID()}`, email, passwordHash, now: new Date().toISOString() },
  );
  return { email, created: true };
}

export async function runSetup() {
  await ensureConstraints();
  const ops = await ensureOpsUser();
  return { ok: true, ops };
}
