import "server-only";
import { read, write } from "@/lib/neo4j/driver";
import { hashPassword } from "@/lib/auth/password";
import { seedDoctors, seedAmbulances } from "@/lib/demo/seed";

/** Uniqueness + lookup constraints (idempotent). */
export async function ensureConstraints() {
  const stmts = [
    "CREATE CONSTRAINT user_email IF NOT EXISTS FOR (u:User) REQUIRE u.email IS UNIQUE",
    "CREATE CONSTRAINT user_id IF NOT EXISTS FOR (u:User) REQUIRE u.id IS UNIQUE",
    "CREATE CONSTRAINT doctor_id IF NOT EXISTS FOR (d:Doctor) REQUIRE d.id IS UNIQUE",
    "CREATE CONSTRAINT ambulance_id IF NOT EXISTS FOR (a:Ambulance) REQUIRE a.id IS UNIQUE",
    "CREATE CONSTRAINT sos_id IF NOT EXISTS FOR (s:Sos) REQUIRE s.id IS UNIQUE",
    "CREATE CONSTRAINT request_id IF NOT EXISTS FOR (r:ConsultRequest) REQUIRE r.id IS UNIQUE",
    "CREATE CONSTRAINT order_id IF NOT EXISTS FOR (o:Order) REQUIRE o.id IS UNIQUE",
  ];
  for (const s of stmts) await write(s);
}

/** Seed the doctor + ambulance catalog (idempotent via MERGE on id). */
export async function seedCatalog() {
  for (const d of seedDoctors()) {
    await write(
      `MERGE (n:Doctor {id: $id})
       SET n += {
         fullName: $fullName, specialty: $specialty, kind: $kind, gender: $gender,
         experienceYears: $experienceYears, languages: $languages, status: $status,
         verified: $verified, rating: $rating, consultFee: $consultFee,
         homeVisitFee: $homeVisitFee, avatarColor: $avatarColor, lat: $lat,
         lng: $lng, lastSeen: $lastSeen
       }`,
      { ...d },
    );
  }
  for (const a of seedAmbulances()) {
    await write(
      `MERGE (n:Ambulance {id: $id})
       SET n += { vehicleNo: $vehicleNo, driverName: $driverName, status: $status, lat: $lat, lng: $lng }`,
      { ...a },
    );
  }
}

/** Create the ops/admin login if it does not exist yet. */
export async function ensureOpsUser() {
  const email = (process.env.OPS_EMAIL || "ops@iyashi.health").toLowerCase();
  const exists = await read(`MATCH (u:User {email: $email}) RETURN properties(u) AS u`, { email });
  if (exists.length > 0) return { email, created: false };
  const passwordHash = await hashPassword(process.env.OPS_PASSWORD || "iyashi-ops");
  await write(
    `CREATE (u:User { id: $id, email: $email, passwordHash: $passwordHash, role: 'ops', name: 'Iyashi Ops', createdAt: $now })`,
    { id: `ops-${crypto.randomUUID()}`, email, passwordHash, now: new Date().toISOString() },
  );
  return { email, created: true };
}

export async function runSetup() {
  await ensureConstraints();
  await seedCatalog();
  const ops = await ensureOpsUser();
  return { ok: true, ops };
}
