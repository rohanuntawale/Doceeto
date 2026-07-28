/**
 * One-off migration: Neo4j (Aura) → Postgres (Neon / Supabase / any Postgres).
 *
 * Reads every node label the app uses out of the graph and inserts the matching
 * rows, ids unchanged, so nothing has to be remapped afterwards. Idempotent:
 * every insert is ON CONFLICT (id) DO NOTHING, so a re-run tops up rather than
 * duplicating, and a half-finished run can simply be repeated.
 *
 * Usage (both connection strings from the environment — nothing is hardcoded):
 *   NEO4J_URI=neo4j+s://xxxx.databases.neo4j.io \
 *   NEO4J_USER=xxxx NEO4J_PASSWORD=… \
 *   DATABASE_URL=postgres://… \
 *   node scripts/migrate-neo4j-to-postgres.mjs [--dry-run]
 *
 * Sessions are deliberately NOT migrated: they are short-lived and tied to a
 * cookie the browser already holds, so everyone simply signs in again once.
 */
import neo4j from "neo4j-driver";
import pg from "pg";
import fs from "node:fs";
import path from "node:path";

const DRY = process.argv.includes("--dry-run");

const need = (k) => {
  const v = process.env[k];
  if (!v) {
    console.error(`Missing ${k}. See the usage comment at the top of this script.`);
    process.exit(2);
  }
  return v;
};

const NEO4J_URI = need("NEO4J_URI");
const NEO4J_USER = process.env.NEO4J_USER || "neo4j";
const NEO4J_PASSWORD = need("NEO4J_PASSWORD");
const DATABASE_URL = need("DATABASE_URL");

const driver = neo4j.driver(NEO4J_URI, neo4j.auth.basic(NEO4J_USER, NEO4J_PASSWORD), {
  disableLosslessIntegers: true,
});
const pool = new pg.Pool({
  connectionString: DATABASE_URL,
  ssl: /localhost|127\.0\.0\.1/.test(DATABASE_URL) ? undefined : { rejectUnauthorized: false },
  max: 4,
});

/** Read all nodes of a label as plain objects. */
async function nodes(label) {
  const s = driver.session();
  try {
    const res = await s.run(`MATCH (n:${label}) RETURN properties(n) AS n`);
    return res.records.map((r) => r.get("n"));
  } finally {
    await s.close();
  }
}

const str = (v, d = null) => (v == null ? d : String(v));
const int = (v, d = 0) => {
  const n = Number(v);
  return Number.isFinite(n) ? Math.round(n) : d;
};
const flt = (v, d = 0) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : d;
};
const bool = (v) => Boolean(v);
const ts = (v) => (v ? String(v) : null);
const arr = (v) => (Array.isArray(v) ? v.map(String) : []);
/** Neo4j stores nested objects as JSON strings; Postgres wants real JSON. */
const json = (v, fallback) => {
  if (v == null) return fallback;
  if (typeof v === "object") return JSON.stringify(v);
  try {
    JSON.parse(String(v));
    return String(v);
  } catch {
    return fallback;
  }
};

const stats = {};
async function insert(table, cols, rows, values) {
  stats[table] = { read: rows.length, written: 0, skipped: 0 };
  if (rows.length === 0) return;
  const client = await pool.connect();
  try {
    for (const row of rows) {
      const vals = values(row);
      const ph = vals.map((_, i) => `$${i + 1}`).join(", ");
      if (DRY) {
        stats[table].written++;
        continue;
      }
      try {
        const res = await client.query(
          `INSERT INTO ${table} (${cols.join(", ")}) VALUES (${ph})
           ON CONFLICT (id) DO NOTHING`,
          vals,
        );
        if (res.rowCount > 0) stats[table].written++;
        else stats[table].skipped++;
      } catch (err) {
        console.error(`  ! ${table} ${row.id ?? "(no id)"}: ${err.message.split("\n")[0]}`);
        stats[table].skipped++;
      }
    }
  } finally {
    client.release();
  }
}

try {
  // ── Schema first, so a fresh Neon project works in one command ──
  if (!DRY) {
    const ddl = fs.readFileSync(path.join(process.cwd(), "lib", "postgres", "schema.sql"), "utf8");
    await pool.query(ddl);
    console.log("schema applied\n");
  } else {
    console.log("DRY RUN — nothing will be written\n");
  }

  // ── users ────────────────────────────────────────────────────
  await insert(
    "users",
    ["id", "email", "password_hash", "role", "name", "address", "lat", "lng", "rating", "rating_count", "created_at"],
    await nodes("User"),
    (u) => [
      u.id,
      String(u.email).toLowerCase(),
      str(u.passwordHash, ""),
      ["patient", "doctor", "ops"].includes(u.role) ? u.role : "patient",
      str(u.name, "Unnamed"),
      str(u.address),
      u.lat == null ? null : flt(u.lat),
      u.lng == null ? null : flt(u.lng),
      u.rating == null ? null : flt(u.rating),
      u.ratingCount == null ? null : int(u.ratingCount),
      ts(u.createdAt) ?? new Date().toISOString(),
    ],
  );

  // ── doctors ──────────────────────────────────────────────────
  await insert(
    "doctors",
    ["id", "full_name", "specialty", "kind", "gender", "age", "experience_years", "languages",
     "status", "verified", "rating", "consult_fee", "home_visit_fee", "avatar_color",
     "lat", "lng", "last_seen", "qualifications", "education", "about", "registration_no",
     "clinic_address", "availability"],
    await nodes("Doctor"),
    (d) => [
      d.id,
      str(d.fullName, "Doctor"),
      str(d.specialty, "General Physician"),
      d.kind === "resident" ? "resident" : "practising",
      d.gender === "male" ? "male" : "female",
      d.age == null ? null : int(d.age),
      int(d.experienceYears),
      arr(d.languages).length ? arr(d.languages) : ["English", "Hindi"],
      ["online", "offline", "busy"].includes(d.status) ? d.status : "offline",
      bool(d.verified),
      flt(d.rating),
      int(d.consultFee),
      int(d.homeVisitFee),
      str(d.avatarColor, "#8a5a44"),
      flt(d.lat),
      flt(d.lng),
      ts(d.lastSeen) ?? new Date().toISOString(),
      str(d.qualifications),
      str(d.education),
      str(d.about),
      str(d.registrationNo),
      str(d.clinicAddress, ""),
      json(d.availability, null),
    ],
  );

  // ── gigs ─────────────────────────────────────────────────────
  await insert(
    "gigs",
    ["id", "doctor_id", "title", "description", "type", "price", "duration_minutes", "status", "created_at", "updated_at"],
    await nodes("Gig"),
    (g) => [
      g.id,
      g.doctorId,
      str(g.title, ""),
      str(g.description, ""),
      ["video", "home_visit", "clinic"].includes(g.type) ? g.type : "home_visit",
      int(g.price),
      int(g.durationMinutes, 60),
      ["active", "paused", "archived"].includes(g.status) ? g.status : "active",
      ts(g.createdAt) ?? new Date().toISOString(),
      ts(g.updatedAt),
    ],
  );

  // ── ambulances ───────────────────────────────────────────────
  await insert(
    "ambulances",
    ["id", "vehicle_no", "driver_name", "status", "lat", "lng"],
    await nodes("Ambulance"),
    (a) => [
      a.id,
      str(a.vehicleNo, ""),
      str(a.driverName, ""),
      ["free", "dispatched", "busy"].includes(a.status) ? a.status : "free",
      flt(a.lat),
      flt(a.lng),
    ],
  );

  // ── sos events ───────────────────────────────────────────────
  await insert(
    "sos_events",
    ["id", "patient_id", "patient_name", "category", "status", "address", "lat", "lng",
     "ambulance_id", "doctor_id", "notes", "created_at", "resolved_at"],
    await nodes("Sos"),
    (s) => [
      s.id,
      str(s.patientId),
      str(s.patientName, "Unknown"),
      str(s.category, "other"),
      str(s.status, "open"),
      str(s.address, ""),
      flt(s.lat),
      flt(s.lng),
      str(s.ambulanceId),
      str(s.doctorId),
      str(s.notes),
      ts(s.createdAt) ?? new Date().toISOString(),
      ts(s.resolvedAt),
    ],
  );

  // ── consult requests ─────────────────────────────────────────
  await insert(
    "consult_requests",
    ["id", "patient_id", "patient_name", "doctor_id", "type", "status", "symptoms",
     "payment_method", "fee", "address", "lat", "lng", "created_at", "mode", "gig_id",
     "gig_title", "broadcast", "trip_stage", "trip_stage_at", "scheduled_at",
     "scheduled_end", "slot_minutes", "accepted_at", "completed_at", "cancelled_at",
     "cancelled_by", "cancel_reason", "passed_by"],
    await nodes("ConsultRequest"),
    (r) => [
      r.id,
      str(r.patientId),
      str(r.patientName, "Patient"),
      str(r.doctorId),
      ["video", "home_visit", "clinic"].includes(r.type) ? r.type : "video",
      ["pending", "accepted", "declined", "completed", "cancelled"].includes(r.status) ? r.status : "pending",
      str(r.symptoms, ""),
      r.paymentMethod === "cash" ? "cash" : "online",
      int(r.fee),
      str(r.address, ""),
      flt(r.lat),
      flt(r.lng),
      ts(r.createdAt) ?? new Date().toISOString(),
      ["emergency", "scheduled", "gig"].includes(r.mode) ? r.mode : null,
      str(r.gigId),
      str(r.gigTitle),
      bool(r.broadcast),
      ["accepted", "enroute", "arrived", "in_progress"].includes(r.tripStage) ? r.tripStage : null,
      ts(r.tripStageAt),
      ts(r.scheduledAt),
      ts(r.scheduledEnd),
      r.slotMinutes == null ? null : int(r.slotMinutes),
      ts(r.acceptedAt),
      ts(r.completedAt),
      ts(r.cancelledAt),
      ["patient", "doctor"].includes(r.cancelledBy) ? r.cancelledBy : null,
      str(r.cancelReason),
      arr(r.passedBy),
    ],
  );

  // ── orders ───────────────────────────────────────────────────
  await insert(
    "orders",
    ["id", "patient_id", "patient_name", "status", "items", "total", "address", "dark_store", "eta_mins", "created_at"],
    await nodes("Order"),
    (o) => [
      o.id,
      str(o.patientId),
      str(o.patientName, "Patient"),
      str(o.status, "placed"),
      json(o.items, "[]"),
      int(o.total),
      str(o.address, ""),
      str(o.darkStore, ""),
      int(o.etaMins),
      ts(o.createdAt) ?? new Date().toISOString(),
    ],
  );

  // ── reviews (patient -> doctor) ──────────────────────────────
  await insert(
    "reviews",
    ["id", "doctor_id", "request_id", "patient_id", "patient_name", "rating", "comment", "created_at"],
    await nodes("Review"),
    (v) => [
      v.id,
      str(v.doctorId),
      str(v.requestId),
      str(v.patientId),
      str(v.patientName, "Patient"),
      flt(v.rating),
      str(v.comment, ""),
      ts(v.createdAt) ?? new Date().toISOString(),
    ],
  );

  // ── patient reviews (doctor -> patient) ──────────────────────
  await insert(
    "patient_reviews",
    ["id", "request_id", "patient_id", "doctor_id", "doctor_name", "rating", "comment", "created_at"],
    await nodes("PatientReview"),
    (v) => [
      v.id,
      str(v.requestId),
      str(v.patientId),
      str(v.doctorId),
      str(v.doctorName, ""),
      flt(v.rating),
      str(v.comment, ""),
      ts(v.createdAt) ?? new Date().toISOString(),
    ],
  );

  // ── wallet ledger ────────────────────────────────────────────
  await insert(
    "transactions",
    ["id", "doctor_id", "kind", "request_id", "patient_name", "method", "gross", "commission", "net", "created_at"],
    await nodes("Transaction"),
    (t) => [
      t.id,
      str(t.doctorId),
      t.kind === "payout" ? "payout" : "earning",
      str(t.requestId),
      str(t.patientName),
      ["online", "cash"].includes(t.method) ? t.method : null,
      int(t.gross),
      int(t.commission),
      int(t.net),
      ts(t.createdAt) ?? new Date().toISOString(),
    ],
  );

  // ── audit trail (BIGSERIAL id, so no ON CONFLICT path) ───────
  {
    const rows = await nodes("Audit");
    stats.audits = { read: rows.length, written: 0, skipped: 0 };
    if (!DRY) {
      for (const a of rows) {
        try {
          await pool.query(
            `INSERT INTO audits (actor_id, role, action, meta, created_at) VALUES ($1,$2,$3,$4::jsonb,$5)`,
            [str(a.actorId), str(a.role), str(a.action, "unknown"), json(a.meta, "{}"), ts(a.at) ?? ts(a.createdAt) ?? new Date().toISOString()],
          );
          stats.audits.written++;
        } catch (err) {
          console.error(`  ! audits: ${err.message.split("\n")[0]}`);
          stats.audits.skipped++;
        }
      }
    } else {
      stats.audits.written = rows.length;
    }
  }

  // ── report ───────────────────────────────────────────────────
  console.log("table                read  written  skipped");
  let read = 0;
  let written = 0;
  for (const [table, s] of Object.entries(stats)) {
    console.log(`${table.padEnd(20)} ${String(s.read).padStart(4)} ${String(s.written).padStart(8)} ${String(s.skipped).padStart(8)}`);
    read += s.read;
    written += s.written;
  }
  console.log(`\n${read} nodes read, ${written} rows written${DRY ? " (dry run)" : ""}.`);
  console.log("Sessions were not migrated by design — everyone signs in again once.");
} finally {
  await driver.close();
  await pool.end();
}
