import "server-only";
import fs from "node:fs";
import path from "node:path";
import { sql, one, tx } from "@/lib/postgres/client";
import { MAP_CENTER, COMMISSION_RATE } from "@/lib/config";
import { AVATAR_COLORS, MED_CATALOG } from "@/lib/catalog";
import {
  DomainError,
  SESSION_TTL_MS,
  newSessionId,
  type Near,
  type SessionRecord,
  type UserRecord,
} from "@/lib/db/shared";
import { hashPassword } from "@/lib/auth/password";
import { haversineKm } from "@/lib/utils/geo";
import { bookingModeOf, coerceBookingMode } from "@/lib/scheduling/slots";
import {
  assertCanAccept,
  assertCanCancel,
  assertCanHire,
  CANCEL_REASON_MAX,
  reopensOnDoctorCancel,
  resolveScheduledSlot,
  type ResolvedHire,
  type ResolvedSlot,
} from "@/lib/scheduling/booking";
import { nextTripStage } from "@/lib/scheduling/trip";
import { MAX_ACTIVE_GIGS, normalizeGig, sanitizeGigPatch } from "@/lib/gigs/rules";
import type {
  Ambulance,
  ConsultRequest,
  Doctor,
  DoctorAvailability,
  Gig,
  GigStatus,
  Order,
  Review,
  SosEvent,
  Transaction,
} from "@/lib/types/domain";

/**
 * Postgres backend (Neon / Supabase / any Postgres).
 *
 * Same contract as lib/filedb/repo.ts — the API routes call `db.*` and never
 * learn which store is behind it. The booking, gig and trip RULES are not
 * re-implemented here: they live in lib/scheduling/* and lib/gigs/rules and are
 * called from these functions, so all backends enforce them identically.
 *
 * Where a check-then-write must not interleave (claiming a request, booking a
 * slot, hiring a gig), the work runs inside a transaction with the row locked
 * FOR UPDATE — the file store got that for free from being a single process,
 * and Postgres has to be told.
 */

export { DomainError };
export type { Near, SessionRecord, UserRecord };

const uid = (p: string) => `${p}-${crypto.randomUUID()}`;
const nowIso = () => new Date().toISOString();
/** Postgres hands back Date objects; the whole app speaks ISO strings. */
const iso = (v: unknown): string =>
  v instanceof Date ? v.toISOString() : typeof v === "string" ? v : "";
const isoOrNull = (v: unknown): string | null =>
  v == null ? null : iso(v);
const num = (v: unknown, fallback = 0): number => {
  const n = typeof v === "string" ? Number(v) : (v as number);
  return Number.isFinite(n) ? n : fallback;
};

type Row = Record<string, any>;

// ── Mappers: snake_case rows -> domain types ──────────────────
const mapDoctor = (r: Row): Doctor => ({
  id: r.id,
  fullName: r.full_name,
  specialty: r.specialty,
  kind: r.kind === "resident" ? "resident" : "practising",
  gender: r.gender === "male" ? "male" : "female",
  age: r.age != null ? num(r.age) : undefined,
  experienceYears: num(r.experience_years),
  languages: Array.isArray(r.languages) && r.languages.length ? r.languages : ["English", "Hindi"],
  status: r.status ?? "offline",
  verified: Boolean(r.verified),
  rating: num(r.rating),
  consultFee: num(r.consult_fee),
  homeVisitFee: num(r.home_visit_fee),
  avatarColor: r.avatar_color ?? AVATAR_COLORS[0],
  avatarUrl: r.avatar_url ?? undefined,
  lat: num(r.lat),
  lng: num(r.lng),
  lastSeen: iso(r.last_seen),
  qualifications: r.qualifications ?? undefined,
  education: r.education ?? undefined,
  about: r.about ?? undefined,
  registrationNo: r.registration_no ?? undefined,
  clinicAddress: r.clinic_address ?? undefined,
  availability: (r.availability as DoctorAvailability | null) ?? undefined,
});

const mapAmbulance = (r: Row): Ambulance => ({
  id: r.id,
  vehicleNo: r.vehicle_no,
  driverName: r.driver_name,
  status: r.status,
  lat: num(r.lat),
  lng: num(r.lng),
});

const mapSos = (r: Row): SosEvent => ({
  id: r.id,
  patientId: r.patient_id ?? null,
  patientName: r.patient_name ?? "Unknown",
  category: r.category,
  status: r.status,
  address: r.address ?? "",
  lat: num(r.lat),
  lng: num(r.lng),
  ambulanceId: r.ambulance_id ?? null,
  doctorId: r.doctor_id ?? null,
  notes: r.notes ?? null,
  createdAt: iso(r.created_at),
  resolvedAt: isoOrNull(r.resolved_at),
});

const mapRequest = (r: Row): ConsultRequest => ({
  id: r.id,
  patientId: r.patient_id ?? null,
  patientName: r.patient_name ?? "Patient",
  type: r.type,
  status: r.status,
  symptoms: r.symptoms ?? "",
  paymentMethod: r.payment_method === "cash" ? "cash" : "online",
  fee: num(r.fee),
  address: r.address ?? "",
  lat: num(r.lat),
  lng: num(r.lng),
  createdAt: iso(r.created_at),
  // Settle the mode here so nothing downstream has to infer it from rows
  // written before scheduling existed.
  mode: bookingModeOf({ mode: r.mode, scheduledAt: isoOrNull(r.scheduled_at) }),
  scheduledAt: isoOrNull(r.scheduled_at),
  scheduledEnd: isoOrNull(r.scheduled_end),
  slotMinutes: r.slot_minutes != null ? num(r.slot_minutes) : null,
  gigId: r.gig_id ?? null,
  gigTitle: r.gig_title ?? null,
  broadcast: Boolean(r.broadcast),
  tripStage: r.trip_stage ?? null,
  tripStageAt: isoOrNull(r.trip_stage_at),
  acceptedAt: isoOrNull(r.accepted_at),
  completedAt: isoOrNull(r.completed_at),
  cancelledAt: isoOrNull(r.cancelled_at),
  cancelledBy: r.cancelled_by ?? null,
  cancelReason: r.cancel_reason ?? null,
  passedBy: Array.isArray(r.passed_by) ? r.passed_by : [],
  doctorId: r.doctor_id ?? null,
});

const mapGig = (r: Row): Gig => ({
  id: r.id,
  doctorId: r.doctor_id,
  title: r.title ?? "",
  description: r.description ?? "",
  type: r.type ?? "home_visit",
  price: num(r.price),
  durationMinutes: num(r.duration_minutes, 60),
  status: r.status ?? "active",
  createdAt: iso(r.created_at),
  updatedAt: isoOrNull(r.updated_at),
});

const mapOrder = (r: Row): Order => ({
  id: r.id,
  patientId: r.patient_id ?? null,
  patientName: r.patient_name ?? "Patient",
  status: r.status,
  items: Array.isArray(r.items) ? r.items : [],
  total: num(r.total),
  address: r.address ?? "",
  darkStore: r.dark_store ?? "",
  etaMins: num(r.eta_mins),
  createdAt: iso(r.created_at),
});

const mapReview = (r: Row): Review => ({
  id: r.id,
  patientName: r.patient_name ?? "Patient",
  rating: num(r.rating),
  comment: r.comment ?? "",
  createdAt: iso(r.created_at),
});

const mapTransaction = (r: Row): Transaction => ({
  id: r.id,
  doctorId: r.doctor_id,
  kind: r.kind === "payout" ? "payout" : "earning",
  requestId: r.request_id ?? null,
  patientName: r.patient_name ?? null,
  method: r.method ?? null,
  gross: num(r.gross),
  commission: num(r.commission),
  net: num(r.net),
  createdAt: iso(r.created_at),
});

const mapUser = (r: Row): UserRecord => ({
  id: r.id,
  email: r.email,
  passwordHash: r.password_hash,
  role: r.role,
  name: r.name,
});

const DOCTOR_COLS = `id, full_name, specialty, kind, gender, age, experience_years, languages,
  status, verified, rating, consult_fee, home_visit_fee, avatar_color, avatar_url, lat, lng, last_seen,
  qualifications, education, about, registration_no, clinic_address, availability`;

/**
 * Geo filter. A bounding box in SQL narrows the rows, then the exact haversine
 * distance is applied in JS — same numbers the maps use, and no PostGIS needed
 * on a free Neon project.
 */
function boxOf(near: Near) {
  const dLat = near.km / 111;
  const dLng = near.km / (111 * Math.max(0.2, Math.cos((near.lat * Math.PI) / 180)));
  return { minLat: near.lat - dLat, maxLat: near.lat + dLat, minLng: near.lng - dLng, maxLng: near.lng + dLng };
}
const withinKm = <T extends { lat: number; lng: number }>(rows: T[], near?: Near): T[] =>
  near ? rows.filter((r) => haversineKm(r, near) <= near.km) : rows;

// ── Sessions ─────────────────────────────────────────────────
// Rows, not signed cookies: the browser holds only `id`, so the database
// decides who you are and deleting the row ends the session at once.

export async function createSession(input: {
  userId: string;
  role: UserRecord["role"];
  name: string;
}): Promise<SessionRecord> {
  const t = Date.now();
  const session: SessionRecord = {
    id: newSessionId(),
    userId: input.userId,
    role: input.role,
    name: input.name,
    createdAt: new Date(t).toISOString(),
    expiresAt: new Date(t + SESSION_TTL_MS).toISOString(),
  };
  await sql(
    `INSERT INTO sessions (id, user_id, role, name, created_at, expires_at)
     VALUES ($1, $2, $3, $4, $5, $6)`,
    [session.id, session.userId, session.role, session.name, session.createdAt, session.expiresAt],
  );
  return session;
}

export async function getSessionById(id: string): Promise<SessionRecord | null> {
  if (!id) return null;
  const r = await one(
    `SELECT id, user_id, role, name, created_at, expires_at FROM sessions WHERE id = $1`,
    [id],
  );
  if (!r) return null;
  if (new Date(iso(r.expires_at)).getTime() <= Date.now()) {
    await deleteSession(id);
    return null;
  }
  return {
    id: r.id,
    userId: r.user_id,
    role: r.role,
    name: r.name,
    createdAt: iso(r.created_at),
    expiresAt: iso(r.expires_at),
  };
}

export async function deleteSession(id: string): Promise<void> {
  if (!id) return;
  await sql(`DELETE FROM sessions WHERE id = $1`, [id]);
}

export async function deleteSessionsForUser(userId: string): Promise<void> {
  await sql(`DELETE FROM sessions WHERE user_id = $1`, [userId]);
}

export async function purgeExpiredSessions(): Promise<void> {
  await sql(`DELETE FROM sessions WHERE expires_at < now()`);
}

// ── Auth ─────────────────────────────────────────────────────
// ── Hardcoded test accounts ──────────────────────────────────
// Guaranteed to exist before any login lookup — they survive database
// resets and fresh deploys. Both log in with the password "test1234"
// (bcrypt hash below, converged on every check so the documented password
// always works). Mirrors the same block in lib/filedb/store.ts.
// ⚠ Remove this block before a real public launch.
const TEST_PASSWORD_HASH = "$2b$10$wq6p.lQQ00xR/227k.juJetPb5YH/iQpnl3zXhH0ZQ3PUrt9bJRjy";
let testAccountsEnsured = false;

async function ensureTestAccounts(): Promise<void> {
  if (testAccountsEnsured) return;
  try {
    await sql(
      `INSERT INTO users (id, email, password_hash, role, name, address, lat, lng)
       VALUES ('patient-test-1', 'patient@gmail.com', $1, 'patient', 'Riya Sharma', 'Baner, Pune', $2, $3)
       ON CONFLICT (email) DO UPDATE SET password_hash = EXCLUDED.password_hash`,
      [TEST_PASSWORD_HASH, MAP_CENTER.lat, MAP_CENTER.lng],
    );
    // The doctor row must share the user's id, whatever id that account was
    // originally created with — so resolve the id first, then upsert the row.
    const doc = await one<{ id: string }>(
      `INSERT INTO users (id, email, password_hash, role, name)
       VALUES ('doc-test-1', 'doctor@gmail.com', $1, 'doctor', 'Dr. Arjun Mehta')
       ON CONFLICT (email) DO UPDATE SET password_hash = EXCLUDED.password_hash
       RETURNING id`,
      [TEST_PASSWORD_HASH],
    );
    await sql(
      `INSERT INTO doctors (id, full_name, specialty, kind, gender, age, experience_years,
         languages, status, verified, rating, consult_fee, home_visit_fee, avatar_color,
         lat, lng, qualifications, education, registration_no, clinic_address)
       VALUES ($1, 'Dr. Arjun Mehta', 'General Physician', 'practising', 'male', 38, 12,
         $2, 'online', false, 0, 500, 1000, '#5D8A6E',
         $3, $4, 'MBBS, MD (General Medicine)', 'Grant Medical College, Mumbai',
         'MH-45210', 'MG Road, Pune — opposite Central Mall')
       ON CONFLICT (id) DO NOTHING`,
      [doc!.id, ["English", "Hindi", "Marathi"], MAP_CENTER.lat + 0.01, MAP_CENTER.lng + 0.01],
    );
    testAccountsEnsured = true;
  } catch {
    // Table missing (setup not run yet) or transient DB error — retry on the
    // next lookup rather than failing the caller's request.
  }
}

export async function findUserByEmail(email: string): Promise<UserRecord | null> {
  await ensureTestAccounts();
  const r = await one(
    `SELECT id, email, password_hash, role, name FROM users WHERE email = $1`,
    [email.toLowerCase()],
  );
  return r ? mapUser(r) : null;
}

// ── Google sign-in ───────────────────────────────────────────
// Matching is on `sub`, Google's permanent id for the person, not on their
// address — someone who changes their Gmail keeps their account here.

export async function findUserByGoogleId(googleId: string): Promise<UserRecord | null> {
  if (!googleId) return null;
  const r = await one(
    `SELECT id, email, password_hash, role, name FROM users WHERE google_id = $1`,
    [googleId],
  );
  return r ? mapUser(r) : null;
}

/**
 * Attach a Google identity to an account that already exists, so someone who
 * signed up with a password can later use the button. Only ever called after
 * Google reports the address VERIFIED — otherwise anyone able to set an
 * arbitrary email on a Google account could take over a password account.
 */
export async function linkGoogleAccount(
  userId: string,
  googleId: string,
  avatarUrl?: string,
): Promise<void> {
  await sql(
    `UPDATE users
        SET google_id = $2,
            avatar_url = COALESCE($3, avatar_url)
      WHERE id = $1`,
    [userId, googleId, avatarUrl ?? null],
  );
}

export async function createPatientUser(input: {
  email: string;
  /** Null for a Google account — there is no password to store. */
  passwordHash: string | null;
  name: string;
  address: string;
  googleId?: string;
  avatarUrl?: string;
}): Promise<UserRecord> {
  const r = await one(
    `INSERT INTO users (id, email, password_hash, role, name, address, lat, lng, google_id, avatar_url)
     VALUES ($1, $2, $3, 'patient', $4, $5, $6, $7, $8, $9)
     RETURNING id, email, password_hash, role, name`,
    [
      uid("patient"),
      input.email.toLowerCase(),
      input.passwordHash,
      input.name,
      input.address,
      MAP_CENTER.lat,
      MAP_CENTER.lng,
      input.googleId ?? null,
      input.avatarUrl ?? null,
    ],
  );
  return mapUser(r!);
}

export async function createDoctorUser(input: {
  email: string;
  /** Null for a Google account — there is no password to store. */
  passwordHash: string | null;
  googleId?: string;
  avatarUrl?: string;
  fullName: string;
  specialty: string;
  kind: string;
  gender: string;
  age?: number;
  experienceYears: number;
  languages?: string[];
  qualifications?: string;
  education?: string;
  registrationNo?: string;
  about?: string;
  consultFee: number;
  homeVisitFee: number;
  clinicAddress?: string;
  lat?: number | null;
  lng?: number | null;
}): Promise<{ user: UserRecord; doctor: Doctor }> {
  const id = uid("doc");
  const fullName = input.fullName.startsWith("Dr.") ? input.fullName : `Dr. ${input.fullName}`;

  return tx(async (c) => {
    const u = await c.query(
      `INSERT INTO users (id, email, password_hash, role, name, google_id, avatar_url)
       VALUES ($1, $2, $3, 'doctor', $4, $5, $6)
       RETURNING id, email, password_hash, role, name`,
      [
        id,
        input.email.toLowerCase(),
        input.passwordHash,
        fullName,
        input.googleId ?? null,
        input.avatarUrl ?? null,
      ],
    );
    // Deterministic accent, picked by how many doctors exist — matches the
    // other backends so an avatar chip doesn't change colour on migration.
    const { rows: countRows } = await c.query(`SELECT count(*)::int AS n FROM doctors`);
    const color = AVATAR_COLORS[num(countRows[0].n) % AVATAR_COLORS.length];
    const d = await c.query(
      `INSERT INTO doctors (id, full_name, specialty, kind, gender, age, experience_years,
         languages, status, verified, rating, consult_fee, home_visit_fee, avatar_color, avatar_url,
         lat, lng, last_seen, qualifications, education, about, registration_no, clinic_address)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,false,0,$10,$11,$12,$13,$14,$15,now(),$16,$17,$18,$19,$20)
       RETURNING ${DOCTOR_COLS}`,
      [
        id,
        fullName,
        input.specialty,
        input.kind === "resident" ? "resident" : "practising",
        input.gender === "male" ? "male" : "female",
        input.age ?? null,
        Number(input.experienceYears) || 0,
        input.languages?.length ? input.languages : ["English", "Hindi"],
        // A doctor without a profile photo is not shown to patients: they
        // start offline and the photo requirement is enforced when they try
        // to go online. A Google signup brings its picture and starts live.
        input.avatarUrl ? "online" : "offline",
        Number(input.consultFee) || 0,
        Number(input.homeVisitFee) || 0,
        color,
        input.avatarUrl ?? null,
        input.lat ?? MAP_CENTER.lat + (Math.random() - 0.5) * 0.02,
        input.lng ?? MAP_CENTER.lng + (Math.random() - 0.5) * 0.02,
        input.qualifications ?? null,
        input.education ?? null,
        input.about ?? null,
        input.registrationNo ?? null,
        input.clinicAddress?.trim() || "",
      ],
    );
    return { user: mapUser(u.rows[0]), doctor: mapDoctor(d.rows[0]) };
  });
}

export async function getPatientProfile(id: string) {
  const r = await one(`SELECT id, name, address, lat, lng, avatar_url FROM users WHERE id = $1`, [id]);
  if (!r) return null;
  return {
    id: r.id,
    name: r.name,
    address: r.address ?? "",
    lat: num(r.lat, MAP_CENTER.lat),
    lng: num(r.lng, MAP_CENTER.lng),
    avatarUrl: r.avatar_url ?? undefined,
  };
}

/**
 * The one write for profile photos, both roles. The photo lives on the users
 * row (the account) AND, for a doctor, on the doctors row — because every
 * patient-facing read goes through doctors and must not need a join.
 */
export async function setUserAvatar(
  userId: string,
  role: UserRecord["role"],
  dataUrl: string,
): Promise<void> {
  await sql(`UPDATE users SET avatar_url = $2 WHERE id = $1`, [userId, dataUrl]);
  if (role === "doctor") {
    await sql(`UPDATE doctors SET avatar_url = $2, last_seen = now() WHERE id = $1`, [userId, dataUrl]);
  }
}

export async function getDoctorById(id: string): Promise<Doctor | null> {
  const r = await one(`SELECT ${DOCTOR_COLS} FROM doctors WHERE id = $1`, [id]);
  return r ? mapDoctor(r) : null;
}

// ── Reads ────────────────────────────────────────────────────
export async function getDoctors(near?: Near): Promise<Doctor[]> {
  if (!near) {
    const rows = await sql(`SELECT ${DOCTOR_COLS} FROM doctors ORDER BY last_seen DESC`);
    return rows.map(mapDoctor);
  }
  const b = boxOf(near);
  const rows = await sql(
    `SELECT ${DOCTOR_COLS} FROM doctors
     WHERE lat BETWEEN $1 AND $2 AND lng BETWEEN $3 AND $4`,
    [b.minLat, b.maxLat, b.minLng, b.maxLng],
  );
  return withinKm(rows.map(mapDoctor), near).sort(
    (a, z) => haversineKm(a, near) - haversineKm(z, near),
  );
}

export async function getAmbulances(): Promise<Ambulance[]> {
  const rows = await sql(`SELECT id, vehicle_no, driver_name, status, lat, lng FROM ambulances`);
  return rows.map(mapAmbulance);
}

const REQUEST_COLS = `r.*,
  u.rating AS patient_rating, u.rating_count AS patient_rating_count,
  EXISTS (SELECT 1 FROM patient_reviews pv WHERE pv.request_id = r.id) AS patient_rated,
  EXISTS (SELECT 1 FROM reviews  rv WHERE rv.request_id = r.id) AS reviewed`;

export async function getRequests(near?: Near): Promise<ConsultRequest[]> {
  const base = `SELECT ${REQUEST_COLS} FROM consult_requests r
                LEFT JOIN users u ON u.id = r.patient_id`;
  const rows = near
    ? await (async () => {
        const b = boxOf(near);
        return sql(
          `${base} WHERE r.lat BETWEEN $1 AND $2 AND r.lng BETWEEN $3 AND $4
           ORDER BY r.created_at DESC`,
          [b.minLat, b.maxLat, b.minLng, b.maxLng],
        );
      })()
    : await sql(`${base} ORDER BY r.created_at DESC`);

  const mapped = rows.map((r) => ({
    ...mapRequest(r),
    patientRating: r.patient_rating != null ? num(r.patient_rating) : null,
    patientRatingCount: num(r.patient_rating_count),
    patientRated: Boolean(r.patient_rated),
    reviewed: Boolean(r.reviewed),
  }));
  return withinKm(mapped, near);
}

export async function getSosEvents(near?: Near): Promise<SosEvent[]> {
  if (!near) {
    const rows = await sql(`SELECT * FROM sos_events ORDER BY created_at DESC`);
    return rows.map(mapSos);
  }
  const b = boxOf(near);
  const rows = await sql(
    `SELECT * FROM sos_events
     WHERE lat BETWEEN $1 AND $2 AND lng BETWEEN $3 AND $4
     ORDER BY created_at DESC`,
    [b.minLat, b.maxLat, b.minLng, b.maxLng],
  );
  return withinKm(rows.map(mapSos), near);
}

export async function getOrders(): Promise<Order[]> {
  const rows = await sql(`SELECT * FROM orders ORDER BY created_at DESC`);
  return rows.map(mapOrder);
}

export async function getReviews(doctorId?: string): Promise<Review[]> {
  const rows = doctorId
    ? await sql(`SELECT * FROM reviews WHERE doctor_id = $1 ORDER BY created_at DESC`, [doctorId])
    : await sql(`SELECT * FROM reviews ORDER BY created_at DESC`);
  return rows.map(mapReview);
}

export async function getSosById(id: string): Promise<SosEvent | null> {
  const r = await one(`SELECT * FROM sos_events WHERE id = $1`, [id]);
  return r ? mapSos(r) : null;
}

// ── Patient-side creates ─────────────────────────────────────
export async function createSos(input: {
  patientId: string;
  patientName: string;
  category: string;
  address: string;
  lat: number;
  lng: number;
  notes?: string;
}): Promise<SosEvent> {
  const r = await one(
    `INSERT INTO sos_events (id, patient_id, patient_name, category, status, address, lat, lng, notes)
     VALUES ($1,$2,$3,$4,'open',$5,$6,$7,$8) RETURNING *`,
    [
      uid("sos"),
      input.patientId,
      input.patientName,
      input.category,
      input.address,
      input.lat,
      input.lng,
      input.notes ?? "Patient-triggered SOS.",
    ],
  );
  return mapSos(r!);
}

export async function createRequest(input: {
  patientId: string;
  patientName: string;
  type: string;
  symptoms: string;
  paymentMethod?: string;
  fee: number;
  address: string;
  lat: number;
  lng: number;
  doctorId?: string | null;
  mode?: string;
  scheduledAt?: string | null;
  gigId?: string | null;
}): Promise<ConsultRequest> {
  const doctorId = input.doctorId ?? null;
  const mode = coerceBookingMode(input.mode);

  return tx(async (c) => {
    let slot: ResolvedSlot | null = null;
    let hire: ResolvedHire | null = null;

    if (mode === "scheduled" || mode === "gig") {
      if (!doctorId) {
        throw new DomainError(
          mode === "gig" ? "Pick a doctor before hiring a gig." : "Pick a doctor before choosing a time.",
        );
      }
      // Lock the doctor's row for the rest of the transaction: two patients
      // racing for the same slot (or the same gig) serialize here instead of
      // both passing the availability check.
      await c.query(`SELECT id FROM doctors WHERE id = $1 FOR UPDATE`, [doctorId]);
      const dr = await c.query(`SELECT ${DOCTOR_COLS} FROM doctors WHERE id = $1`, [doctorId]);
      const doctor = dr.rows[0] ? mapDoctor(dr.rows[0]) : undefined;
      // Only this doctor's rows matter to either check, and both read the
      // booking rules from lib/scheduling — never duplicated here.
      const ex = await c.query(
        `SELECT * FROM consult_requests WHERE doctor_id = $1 OR doctor_id IS NULL`,
        [doctorId],
      );
      const existing = ex.rows.map(mapRequest);

      if (mode === "scheduled") {
        slot = resolveScheduledSlot({
          doctor,
          startIso: String(input.scheduledAt ?? ""),
          existing,
        });
      } else {
        const g = await c.query(`SELECT * FROM gigs WHERE id = $1`, [input.gigId ?? ""]);
        hire = assertCanHire({
          gig: g.rows[0] ? mapGig(g.rows[0]) : undefined,
          doctor,
          existing,
        });
      }
    }

    const r = await c.query(
      `INSERT INTO consult_requests (
         id, patient_id, patient_name, doctor_id, type, status, symptoms, payment_method,
         fee, address, lat, lng, mode, gig_id, gig_title, broadcast,
         scheduled_at, scheduled_end, slot_minutes, passed_by)
       VALUES ($1,$2,$3,$4,$5,'pending',$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,'{}')
       RETURNING *`,
      [
        uid("req"),
        input.patientId,
        input.patientName,
        doctorId,
        // A gig's visit type comes off the listing, not the request body.
        hire?.type ?? input.type,
        input.symptoms,
        input.paymentMethod === "cash" ? "cash" : "online",
        // Same for the price — the client's fee is ignored for a gig hire.
        hire ? hire.fee : Number(input.fee) || 0,
        input.address,
        input.lat,
        input.lng,
        mode,
        hire?.gigId ?? null,
        hire?.gigTitle ?? null,
        // An urgent request with no named doctor went to the whole pool.
        mode === "emergency" && doctorId === null,
        slot?.scheduledAt ?? null,
        slot?.scheduledEnd ?? null,
        slot?.slotMinutes ?? hire?.durationMinutes ?? null,
      ],
    );
    return mapRequest(r.rows[0]);
  });
}

export async function createOrder(input: {
  patientId: string;
  patientName: string;
  items: { name: string; qty: number }[];
  total: number;
  address: string;
  darkStore: string;
}): Promise<Order> {
  if (!Array.isArray(input.items) || input.items.length === 0) {
    throw new DomainError("The order has no items.");
  }
  // Re-price from the catalog so a caller can never name their own total.
  let total = 0;
  const items = input.items.map((it) => {
    const cat = MED_CATALOG.find((m) => m.name === it.name);
    if (!cat) throw new DomainError(`Unknown item: ${String(it.name).slice(0, 60)}`);
    const qty = Math.min(20, Math.max(1, Math.round(Number(it.qty) || 1)));
    total += cat.price * qty;
    return { name: cat.name, qty };
  });
  const r = await one(
    `INSERT INTO orders (id, patient_id, patient_name, status, items, total, address, dark_store, eta_mins)
     VALUES ($1,$2,$3,'placed',$4::jsonb,$5,$6,$7,10) RETURNING *`,
    [
      uid("ord"),
      input.patientId,
      input.patientName,
      JSON.stringify(items),
      total,
      input.address,
      input.darkStore,
    ],
  );
  return mapOrder(r!);
}

export async function createReview(input: {
  patientId: string;
  patientName: string;
  doctorId: string;
  requestId: string;
  rating: number;
  comment: string;
}): Promise<Review> {
  const rating = Math.min(5, Math.max(1, Math.round(Number(input.rating) || 0)));
  return tx(async (c) => {
    const rq = await c.query(
      `SELECT id, status, patient_id, doctor_id FROM consult_requests WHERE id = $1 FOR UPDATE`,
      [input.requestId],
    );
    const req = rq.rows[0];
    const dup = await c.query(`SELECT 1 FROM reviews WHERE request_id = $1`, [input.requestId]);
    if (
      !req ||
      req.status !== "completed" ||
      req.patient_id !== input.patientId ||
      req.doctor_id !== input.doctorId ||
      dup.rows.length > 0
    ) {
      throw new DomainError("You can only review a consult you completed, once.", 409);
    }
    const rv = await c.query(
      `INSERT INTO reviews (id, doctor_id, request_id, patient_id, patient_name, rating, comment)
       VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
      [
        uid("rev"),
        input.doctorId,
        input.requestId,
        input.patientId,
        input.patientName,
        rating,
        String(input.comment ?? "").slice(0, 600),
      ],
    );
    // Refresh the doctor's aggregate rating from the reviews themselves.
    await c.query(
      `UPDATE doctors SET rating = round(sub.avg::numeric, 1)
       FROM (SELECT avg(rating) AS avg FROM reviews WHERE doctor_id = $1) sub
       WHERE doctors.id = $1`,
      [input.doctorId],
    );
    return mapReview(rv.rows[0]);
  });
}

export async function ratePatient(input: {
  doctorId: string;
  doctorName: string;
  requestId: string;
  rating: number;
  comment: string;
}): Promise<void> {
  const rating = Math.min(5, Math.max(1, Math.round(Number(input.rating) || 0)));
  await tx(async (c) => {
    const rq = await c.query(
      `SELECT id, status, patient_id, doctor_id FROM consult_requests WHERE id = $1 FOR UPDATE`,
      [input.requestId],
    );
    const req = rq.rows[0];
    const dup = await c.query(`SELECT 1 FROM patient_reviews WHERE request_id = $1`, [
      input.requestId,
    ]);
    if (
      !req ||
      req.status !== "completed" ||
      req.doctor_id !== input.doctorId ||
      !req.patient_id ||
      dup.rows.length > 0
    ) {
      throw new DomainError(
        "You can only rate a patient from a consult you completed, once.",
        409,
      );
    }
    await c.query(
      `INSERT INTO patient_reviews (id, request_id, patient_id, doctor_id, doctor_name, rating, comment)
       VALUES ($1,$2,$3,$4,$5,$6,$7)`,
      [
        uid("prev"),
        input.requestId,
        req.patient_id,
        input.doctorId,
        input.doctorName,
        rating,
        String(input.comment ?? "").slice(0, 600),
      ],
    );
    await c.query(
      `UPDATE users SET rating = round(sub.avg::numeric, 1), rating_count = sub.n
       FROM (SELECT avg(rating) AS avg, count(*)::int AS n FROM patient_reviews WHERE patient_id = $1) sub
       WHERE users.id = $1`,
      [req.patient_id],
    );
  });
}

// ── Doctor mutations ─────────────────────────────────────────
export async function setDoctorStatus(id: string, status: string) {
  await sql(`UPDATE doctors SET status = $2, last_seen = now() WHERE id = $1`, [id, status]);
}

const DOCTOR_PATCH_COLS: Record<string, string> = {
  fullName: "full_name",
  specialty: "specialty",
  consultFee: "consult_fee",
  homeVisitFee: "home_visit_fee",
  age: "age",
  experienceYears: "experience_years",
  languages: "languages",
  qualifications: "qualifications",
  education: "education",
  about: "about",
  registrationNo: "registration_no",
  clinicAddress: "clinic_address",
  lat: "lat",
  lng: "lng",
};

export async function updateDoctor(id: string, patch: Record<string, unknown>) {
  const sets: string[] = [];
  const vals: unknown[] = [id];
  for (const [key, col] of Object.entries(DOCTOR_PATCH_COLS)) {
    const v = patch[key];
    if (v === undefined) continue;
    // An empty languages array would wipe a doctor's list; the other backends
    // ignore it, so this one does too.
    if (key === "languages" && (!Array.isArray(v) || v.length === 0)) continue;
    if ((key === "lat" || key === "lng") && typeof v !== "number") continue;
    vals.push(v);
    sets.push(`${col} = $${vals.length}`);
  }
  if (sets.length === 0) return;
  await sql(`UPDATE doctors SET ${sets.join(", ")}, last_seen = now() WHERE id = $1`, vals);
}

export async function acceptRequest(id: string, doctorId: string): Promise<boolean> {
  return tx(async (c) => {
    // Lock the row so two doctors tapping Accept at once cannot both win.
    const rq = await c.query(`SELECT * FROM consult_requests WHERE id = $1 FOR UPDATE`, [id]);
    const req = rq.rows[0] ? mapRequest(rq.rows[0]) : null;
    if (!req || req.status !== "pending") return false;

    const ex = await c.query(
      `SELECT * FROM consult_requests WHERE doctor_id = $1 OR id = $2`,
      [doctorId, id],
    );
    // Throws a 409 with the reason, so the doctor sees why rather than a no-op.
    assertCanAccept(req, ex.rows.map(mapRequest), doctorId);

    await c.query(
      `UPDATE consult_requests
       SET status = 'accepted', doctor_id = $2, accepted_at = now(),
           trip_stage = 'accepted', trip_stage_at = now()
       WHERE id = $1`,
      [id, doctorId],
    );
    // A hired gig leaves the shelf the moment it's accepted: the doctor is
    // committed to this one, so the listing pauses itself instead of inviting
    // a second booking on the same package. Resume it from the shelf later.
    if (req.gigId) {
      await c.query(
        `UPDATE gigs SET status = 'paused', updated_at = now()
         WHERE id = $1 AND doctor_id = $2 AND status = 'active'`,
        [req.gigId, doctorId],
      );
    }
    return true;
  });
}

/** A request this doctor may act on: theirs, unassigned, or a seed row. */
function claimableBy(req: ConsultRequest, doctorId: string): boolean {
  return (
    req.doctorId === doctorId ||
    (req.status === "pending" &&
      (req.doctorId === null || Boolean(req.doctorId?.startsWith("doc-seed-"))))
  );
}

export async function declineRequest(id: string, doctorId?: string, reason?: string) {
  await tx(async (c) => {
    const rq = await c.query(`SELECT * FROM consult_requests WHERE id = $1 FOR UPDATE`, [id]);
    if (!rq.rows[0]) return;
    const req = mapRequest(rq.rows[0]);

    if (doctorId && !claimableBy(req, doctorId)) {
      throw new DomainError("That request isn't yours to decline.", 403);
    }
    // Passing on a broadcast must not kill it for everyone else — the patient
    // asked the network, not this doctor. Record the pass, leave it pending.
    if (doctorId && req.broadcast && req.status === "pending" && req.doctorId === null) {
      await c.query(
        `UPDATE consult_requests
         SET passed_by = (SELECT array_agg(DISTINCT x) FROM unnest(passed_by || $2::text[]) x)
         WHERE id = $1`,
        [id, [doctorId]],
      );
      return;
    }
    await c.query(
      `UPDATE consult_requests SET status = 'declined', cancel_reason = COALESCE($2, cancel_reason)
       WHERE id = $1`,
      [id, reason ?? null],
    );
  });
}

/** Patient or doctor calls off a booking — this is what frees the slot. */
export async function cancelRequest(
  id: string,
  actor: { id: string; role: string },
  opts?: { reason?: string },
) {
  await tx(async (c) => {
    const rq = await c.query(`SELECT * FROM consult_requests WHERE id = $1 FOR UPDATE`, [id]);
    const req = rq.rows[0] ? mapRequest(rq.rows[0]) : undefined;
    assertCanCancel(req, actor, opts);
    const reason = opts?.reason?.trim().slice(0, CANCEL_REASON_MAX) || null;

    // A doctor standing down from a BROADCAST puts it back out to the pool:
    // the patient asked the network, so someone else can still take it.
    if (actor.role === "doctor" && reopensOnDoctorCancel(req!)) {
      await c.query(
        `UPDATE consult_requests
         SET status = 'pending', doctor_id = NULL, accepted_at = NULL,
             trip_stage = NULL, trip_stage_at = NULL, cancel_reason = $2,
             passed_by = (SELECT array_agg(DISTINCT x) FROM unnest(passed_by || $3::text[]) x)
         WHERE id = $1`,
        [id, reason, [actor.id]],
      );
      return;
    }
    await c.query(
      `UPDATE consult_requests
       SET status = 'cancelled', cancelled_at = now(), cancelled_by = $2, cancel_reason = $3
       WHERE id = $1`,
      [id, actor.role === "doctor" ? "doctor" : "patient", reason],
    );
  });
}

export async function setDoctorAvailability(id: string, availability: DoctorAvailability) {
  const r = await one(
    `UPDATE doctors SET availability = $2::jsonb, last_seen = now() WHERE id = $1 RETURNING id`,
    [id, JSON.stringify(availability)],
  );
  if (!r) throw new DomainError("That doctor no longer exists.", 404);
}

// ── Gigs ─────────────────────────────────────────────────────
export async function getGigs(doctorId?: string): Promise<Gig[]> {
  const rows = doctorId
    ? await sql(`SELECT * FROM gigs WHERE doctor_id = $1 ORDER BY created_at DESC`, [doctorId])
    : await sql(`SELECT * FROM gigs ORDER BY created_at DESC`);
  return rows.map(mapGig);
}

export async function getGigById(id: string): Promise<Gig | null> {
  const r = await one(`SELECT * FROM gigs WHERE id = $1`, [id]);
  return r ? mapGig(r) : null;
}

export async function createGig(input: {
  doctorId: string;
  title: string;
  description: string;
  type: string;
  price: number;
  durationMinutes: number;
}): Promise<Gig> {
  const gig = normalizeGig(input, {
    id: uid("gig"),
    doctorId: input.doctorId,
    createdAt: nowIso(),
  });
  if (!gig.title) throw new DomainError("Give the gig a title.", 400);
  if (gig.price <= 0) throw new DomainError("Set a price for the gig.", 400);

  return tx(async (c) => {
    const dr = await c.query(`SELECT id FROM doctors WHERE id = $1 FOR UPDATE`, [input.doctorId]);
    if (!dr.rows[0]) throw new DomainError("That doctor no longer exists.", 404);
    const live = await c.query(
      `SELECT count(*)::int AS n FROM gigs WHERE doctor_id = $1 AND status = 'active'`,
      [input.doctorId],
    );
    if (num(live.rows[0].n) >= MAX_ACTIVE_GIGS) {
      throw new DomainError(
        `You can have ${MAX_ACTIVE_GIGS} live gigs at once. Pause one first.`,
        409,
      );
    }
    const r = await c.query(
      `INSERT INTO gigs (id, doctor_id, title, description, type, price, duration_minutes, status, created_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *`,
      [
        gig.id,
        gig.doctorId,
        gig.title,
        gig.description,
        gig.type,
        gig.price,
        gig.durationMinutes,
        gig.status,
        gig.createdAt,
      ],
    );
    return mapGig(r.rows[0]);
  });
}

const GIG_PATCH_COLS: Record<string, string> = {
  title: "title",
  description: "description",
  type: "type",
  price: "price",
  durationMinutes: "duration_minutes",
  status: "status",
};

export async function updateGig(id: string, doctorId: string, patch: unknown) {
  const clean = sanitizeGigPatch(patch) as Record<string, unknown>;
  await tx(async (c) => {
    const g = await c.query(`SELECT * FROM gigs WHERE id = $1 FOR UPDATE`, [id]);
    if (!g.rows[0]) throw new DomainError("That gig no longer exists.", 404);
    if (g.rows[0].doctor_id !== doctorId) throw new DomainError("That isn't your gig.", 403);

    // Re-publishing counts against the cap the same as creating.
    if (clean.status === "active" && g.rows[0].status !== "active") {
      await assertUnderGigCap(c, doctorId, id);
    }
    const sets: string[] = [];
    const vals: unknown[] = [id];
    for (const [key, col] of Object.entries(GIG_PATCH_COLS)) {
      if (clean[key] === undefined) continue;
      vals.push(clean[key]);
      sets.push(`${col} = $${vals.length}`);
    }
    if (sets.length === 0) return;
    await c.query(`UPDATE gigs SET ${sets.join(", ")}, updated_at = now() WHERE id = $1`, vals);
  });
}

/** Shared cap check for publishing a listing. */
async function assertUnderGigCap(
  c: { query: (t: string, p?: unknown[]) => Promise<{ rows: Row[] }> },
  doctorId: string,
  exceptId: string,
) {
  const live = await c.query(
    `SELECT count(*)::int AS n FROM gigs WHERE doctor_id = $1 AND status = 'active' AND id <> $2`,
    [doctorId, exceptId],
  );
  if (num(live.rows[0].n) >= MAX_ACTIVE_GIGS) {
    throw new DomainError(
      `You can have ${MAX_ACTIVE_GIGS} live gigs at once. Pause one first.`,
      409,
    );
  }
}

/**
 * Publish, pause or retire a listing.
 *
 * Deliberately does NOT touch hires already made against it: a patient who
 * asked yesterday still gets their answer, and the request carries its own
 * `gigTitle` snapshot so it stays readable once the listing is gone.
 */
export async function setGigStatus(id: string, doctorId: string, status: GigStatus) {
  await tx(async (c) => {
    const g = await c.query(`SELECT * FROM gigs WHERE id = $1 FOR UPDATE`, [id]);
    if (!g.rows[0]) throw new DomainError("That gig no longer exists.", 404);
    if (g.rows[0].doctor_id !== doctorId) throw new DomainError("That isn't your gig.", 403);
    if (status === "active" && g.rows[0].status !== "active") {
      await assertUnderGigCap(c, doctorId, id);
    }
    await c.query(`UPDATE gigs SET status = $2, updated_at = now() WHERE id = $1`, [id, status]);
  });
}

/**
 * Remove a listing for good.
 *
 * Unlike archiving, this leaves nothing on the shelf. Hires already ANSWERED
 * against it survive: a request snapshots `gigTitle` at hire time and the
 * gig_id column carries no foreign key, so past visits stay readable. What is
 * refused is deleting a gig somebody is still waiting on — the doctor owes
 * that patient an answer or a visit, and the row is their record of it.
 */
export async function deleteGig(id: string, doctorId: string): Promise<void> {
  await tx(async (c) => {
    const g = await c.query(`SELECT * FROM gigs WHERE id = $1 FOR UPDATE`, [id]);
    if (!g.rows[0]) throw new DomainError("That gig no longer exists.", 404);
    if (g.rows[0].doctor_id !== doctorId) throw new DomainError("That isn't your gig.", 403);

    const owed = await c.query(
      `SELECT 1 FROM consult_requests
       WHERE gig_id = $1 AND status IN ('pending', 'accepted') LIMIT 1`,
      [id],
    );
    if (owed.rows.length > 0) {
      throw new DomainError(
        "Someone is still waiting on this gig. Answer or finish that hire first.",
        409,
      );
    }
    await c.query(`DELETE FROM gigs WHERE id = $1`, [id]);
  });
}

/**
 * Move a visit one step along its rail. Returns the new stage, or null when
 * there is nowhere left to go (the doctor should complete it instead).
 */
export async function advanceTrip(id: string, doctorId: string): Promise<string | null> {
  return tx(async (c) => {
    const rq = await c.query(`SELECT * FROM consult_requests WHERE id = $1 FOR UPDATE`, [id]);
    if (!rq.rows[0]) throw new DomainError("That visit no longer exists.", 404);
    const req = mapRequest(rq.rows[0]);
    if (req.doctorId !== doctorId) throw new DomainError("That isn't your visit.", 403);
    if (req.status !== "accepted") throw new DomainError("That visit isn't in progress.", 409);

    const next = nextTripStage(req);
    if (!next) return null;
    await c.query(
      `UPDATE consult_requests SET trip_stage = $2, trip_stage_at = now() WHERE id = $1`,
      [id, next],
    );
    return next;
  });
}

export async function completeRequest(
  id: string,
  opts?: { notes?: string; prescription?: { name: string; qty: number }[]; doctorId?: string },
) {
  await tx(async (c) => {
    const rq = await c.query(`SELECT * FROM consult_requests WHERE id = $1 FOR UPDATE`, [id]);
    if (!rq.rows[0]) return;
    const req = mapRequest(rq.rows[0]);
    if (req.status !== "accepted" && req.status !== "pending") return;
    // Completing releases the doctor's "in a consult" state (which gates their
    // urgent feed) and credits a wallet — only the doctor on it may close it.
    if (opts?.doctorId && !claimableBy(req, opts.doctorId)) {
      throw new DomainError("That consult isn't yours to complete.", 403);
    }
    await c.query(
      `UPDATE consult_requests SET status = 'completed', completed_at = now() WHERE id = $1`,
      [id],
    );
    // Credit the doctor's wallet once (platform commission + net).
    if (req.doctorId) {
      const already = await c.query(
        `SELECT 1 FROM transactions WHERE kind = 'earning' AND request_id = $1`,
        [id],
      );
      if (already.rows.length === 0) {
        const commission = Math.round(req.fee * COMMISSION_RATE);
        await c.query(
          `INSERT INTO transactions (id, doctor_id, kind, request_id, patient_name, method, gross, commission, net)
           VALUES ($1,$2,'earning',$3,$4,$5,$6,$7,$8)`,
          [
            uid("txn"),
            req.doctorId,
            id,
            req.patientName,
            req.paymentMethod ?? "online",
            req.fee,
            commission,
            req.fee - commission,
          ],
        );
      }
    }
  });
}

// ── Wallet / payments ────────────────────────────────────────
export async function getTransactions(): Promise<Transaction[]> {
  const rows = await sql(`SELECT * FROM transactions ORDER BY created_at DESC`);
  return rows.map(mapTransaction);
}

/** Doctor withdraws their full wallet balance to their bank (instant). */
export async function requestPayout(doctorId: string): Promise<boolean> {
  return tx(async (c) => {
    // Lock the ledger rows so a double-tap cannot withdraw the balance twice.
    const bal = await c.query(
      `SELECT COALESCE(sum(net), 0)::int AS balance FROM transactions WHERE doctor_id = $1 FOR UPDATE`,
      [doctorId],
    );
    const balance = num(bal.rows[0].balance);
    if (balance <= 0) return false;
    await c.query(
      `INSERT INTO transactions (id, doctor_id, kind, request_id, patient_name, method, gross, commission, net)
       VALUES ($1,$2,'payout',NULL,NULL,NULL,0,0,$3)`,
      [uid("txn"), doctorId, -balance],
    );
    return true;
  });
}

// ── Ops mutations ────────────────────────────────────────────
const SOS_FLOW = ["open", "assigned", "enroute", "resolved"];
const ORDER_FLOW = ["placed", "packed", "out_for_delivery", "delivered"];

export async function assignAmbulance(sosId: string, ambulanceId: string) {
  await tx(async (c) => {
    await c.query(
      `UPDATE sos_events
       SET ambulance_id = $2, status = CASE WHEN status = 'open' THEN 'assigned' ELSE status END
       WHERE id = $1`,
      [sosId, ambulanceId],
    );
    await c.query(`UPDATE ambulances SET status = 'dispatched' WHERE id = $1`, [ambulanceId]);
  });
}

export async function assignDoctorToSos(sosId: string, doctorId: string) {
  await sql(`UPDATE sos_events SET doctor_id = $2 WHERE id = $1`, [sosId, doctorId]);
}

export async function setSosCategory(sosId: string, category: string) {
  await sql(`UPDATE sos_events SET category = $2 WHERE id = $1`, [sosId, category]);
}

export async function advanceSos(sosId: string) {
  await tx(async (c) => {
    const s = await c.query(`SELECT status FROM sos_events WHERE id = $1 FOR UPDATE`, [sosId]);
    if (!s.rows[0]) return;
    const i = SOS_FLOW.indexOf(s.rows[0].status);
    const next = SOS_FLOW[Math.min(i + 1, SOS_FLOW.length - 1)];
    await c.query(
      `UPDATE sos_events
       SET status = $2, resolved_at = CASE WHEN $2 = 'resolved' THEN now() ELSE resolved_at END
       WHERE id = $1`,
      [sosId, next],
    );
  });
}

export async function advanceOrder(orderId: string) {
  await tx(async (c) => {
    const o = await c.query(`SELECT status, eta_mins FROM orders WHERE id = $1 FOR UPDATE`, [
      orderId,
    ]);
    if (!o.rows[0]) return;
    const i = ORDER_FLOW.indexOf(o.rows[0].status);
    if (i < 0 || i >= ORDER_FLOW.length - 1) return;
    const next = ORDER_FLOW[i + 1];
    const eta = next === "delivered" ? 0 : Math.max(1, num(o.rows[0].eta_mins) - 3);
    await c.query(`UPDATE orders SET status = $2, eta_mins = $3 WHERE id = $1`, [
      orderId,
      next,
      eta,
    ]);
  });
}

export async function createAmbulance(input: {
  vehicleNo: string;
  driverName: string;
  lat?: number | null;
  lng?: number | null;
}): Promise<Ambulance> {
  if (!input.vehicleNo?.trim() || !input.driverName?.trim()) {
    throw new DomainError("Vehicle number and driver name are required.");
  }
  const r = await one(
    `INSERT INTO ambulances (id, vehicle_no, driver_name, status, lat, lng)
     VALUES ($1,$2,$3,'free',$4,$5) RETURNING *`,
    [
      uid("amb"),
      input.vehicleNo.trim(),
      input.driverName.trim(),
      input.lat ?? MAP_CENTER.lat,
      input.lng ?? MAP_CENTER.lng,
    ],
  );
  return mapAmbulance(r!);
}

const AMBULANCE_PATCH_COLS: Record<string, string> = {
  vehicleNo: "vehicle_no",
  driverName: "driver_name",
  status: "status",
  lat: "lat",
  lng: "lng",
};

export async function updateAmbulance(
  id: string,
  patch: { vehicleNo?: string; driverName?: string; status?: string; lat?: number; lng?: number },
) {
  const sets: string[] = [];
  const vals: unknown[] = [id];
  for (const [key, col] of Object.entries(AMBULANCE_PATCH_COLS)) {
    const v = (patch as Record<string, unknown>)[key];
    if (v === undefined) continue;
    if (key === "status" && !["free", "dispatched", "busy"].includes(String(v))) continue;
    if ((key === "lat" || key === "lng") && typeof v !== "number") continue;
    vals.push(v);
    sets.push(`${col} = $${vals.length}`);
  }
  if (sets.length === 0) return;
  await sql(`UPDATE ambulances SET ${sets.join(", ")} WHERE id = $1`, vals);
}

export async function audit(entry: {
  actorId: string;
  role: string;
  action: string;
  meta?: unknown;
}) {
  await sql(
    `INSERT INTO audits (actor_id, role, action, meta) VALUES ($1,$2,$3,$4::jsonb)`,
    [
      entry.actorId,
      entry.role,
      entry.action,
      JSON.stringify(entry.meta ?? {}).slice(0, 2000),
    ],
  );
}

// ── One-time setup: schema + the ops (admin) login ───────────
export async function setup() {
  // The schema file is the single source of truth and is idempotent, so this
  // is safe to re-run after every deploy.
  const ddl = fs.readFileSync(
    path.join(process.cwd(), "lib", "postgres", "schema.sql"),
    "utf8",
  );
  await sql(ddl);

  const email = (process.env.OPS_EMAIL || "ops@doceeto.health").toLowerCase();
  const password = process.env.OPS_PASSWORD || "iyashi-ops";
  const existing = await one(`SELECT id, password_hash FROM users WHERE email = $1 AND role = 'ops'`, [
    email,
  ]);
  if (existing) {
    // Re-running setup after rotating the env var rotates the login too —
    // without this, OPS_PASSWORD is silently ignored once the user exists.
    const { verifyPassword } = await import("@/lib/auth/password");
    if (existing.password_hash && (await verifyPassword(password, existing.password_hash))) {
      return { ok: true, ops: { email, created: false, rotated: false } };
    }
    await sql(`UPDATE users SET password_hash = $2 WHERE id = $1`, [
      existing.id,
      await hashPassword(password),
    ]);
    return { ok: true, ops: { email, created: false, rotated: true } };
  }
  await sql(
    `INSERT INTO users (id, email, password_hash, role, name) VALUES ($1,$2,$3,'ops','Doceeto Ops')`,
    [uid("ops"), email, await hashPassword(password)],
  );
  return { ok: true, ops: { email, created: true } };
}
