import "server-only";
import fs from "node:fs";
import path from "node:path";
import { sql, one, tx } from "@/lib/postgres/client";
import { MAP_CENTER, COMMISSION_RATE } from "@/lib/config";
import { AVATAR_COLORS, MED_CATALOG } from "@/lib/catalog";
import {
  DomainError,
  PENDING_SIGNUP_TTL_MS,
  SESSION_RENEW_BELOW_MS,
  SESSION_TTL_MS,
  newSessionId,
  newStartCode,
  type Near,
  type PendingSignup,
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
import { MAX_START_CODE_ATTEMPTS, nextTripStage } from "@/lib/scheduling/trip";
import { MAX_ACTIVE_GIGS, normalizeGig, sanitizeGigPatch } from "@/lib/gigs/rules";
import { newRxCode, newShareToken, sanitizeRxDraft, type RxDraft } from "@/lib/prescriptions/rules";
import { ageFrom, type HealthProfile } from "@/lib/health/profile";
import type {
  Ambulance,
  Cadre,
  ConsultRequest,
  Doctor,
  DoctorAvailability,
  DoctorDeletion,
  DoctorDetail,
  Gig,
  GigStatus,
  Order,
  Prescription,
  Review,
  RxItem,
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
export type { Near, PendingSignup, SessionRecord, UserRecord };

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
  cadre: r.cadre === "nurse" ? "nurse" : "doctor",
  skills: Array.isArray(r.skills) ? r.skills : [],
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
  createdAt: r.created_at ? iso(r.created_at) : undefined,
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
  // Which cadre this is for. Legacy rows carry none and mean "doctor".
  targetCadre: r.target_cadre === "nurse" ? "nurse" : "doctor",
  scheduledAt: isoOrNull(r.scheduled_at),
  scheduledEnd: isoOrNull(r.scheduled_end),
  slotMinutes: r.slot_minutes != null ? num(r.slot_minutes) : null,
  gigId: r.gig_id ?? null,
  gigTitle: r.gig_title ?? null,
  broadcast: Boolean(r.broadcast),
  tripStage: r.trip_stage ?? null,
  tripStageAt: isoOrNull(r.trip_stage_at),
  // Carried on the row; /api/data strips it for every reader but the patient.
  startCode: r.start_code ?? null,
  startCodeAttempts: num(r.start_code_attempts, 0),
  startedAt: isoOrNull(r.started_at),
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
  prescriptionId: r.prescription_id ?? null,
});

const mapPrescription = (r: Row): Prescription => ({
  id: r.id,
  code: r.code,
  requestId: r.request_id,
  patientId: r.patient_id ?? null,
  patientName: r.patient_name ?? "Patient",
  patientAge: r.patient_age != null ? num(r.patient_age) : null,
  patientGender: r.patient_gender ?? null,
  patientAllergies: r.patient_allergies ?? null,
  doctorId: r.doctor_id,
  doctorName: r.doctor_name ?? "",
  doctorSpecialty: r.doctor_specialty ?? "",
  doctorQualifications: r.doctor_qualifications ?? null,
  doctorRegistrationNo: r.doctor_registration_no ?? null,
  diagnosis: r.diagnosis ?? "",
  items: (Array.isArray(r.items) ? r.items : []) as RxItem[],
  advice: r.advice ?? "",
  followUpDays: r.follow_up_days != null ? num(r.follow_up_days) : null,
  issuedAt: iso(r.issued_at),
  shareToken: r.share_token,
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

const DOCTOR_COLS = `id, full_name, specialty, cadre, skills, kind, gender, age, experience_years, languages,
  status, verified, rating, consult_fee, home_visit_fee, avatar_color, avatar_url, lat, lng, last_seen,
  qualifications, education, about, registration_no, clinic_address, availability, created_at`;

// ── Lazy self-heal migrations ────────────────────────────────
/**
 * A migration that a live database may still need, run at most once per
 * process and NEVER able to fail the request that triggered it.
 *
 * These exist because setup() only runs on an explicit seed, so a database
 * that predates a column heals itself on first use. Two rules earned the hard
 * way, both of which used to take the whole site down:
 *
 *  • PROBE FIRST. `ALTER TABLE … IF NOT EXISTS` is not free: it takes an
 *    ACCESS EXCLUSIVE lock on the table, and every serverless instance ran a
 *    fistful of them on its first request — against `users` and `sessions`,
 *    the two tables every other in-flight request is reading. It also needs
 *    table ownership and a writable connection, so a read-only endpoint or a
 *    non-owner role made ordinary READS fail. `needed` is a cheap catalog
 *    query; in the normal case (schema already correct) no DDL runs at all.
 *  • NEVER CACHE A FAILURE. The memo used to hold the rejected promise, so a
 *    single transient error meant that instance answered every later request
 *    with the same 500 until it was recycled. A failure clears the memo and is
 *    swallowed: the caller's real query runs, and if the column genuinely is
 *    missing it fails there with a precise message.
 */
function lazyMigration(label: string, needed: () => Promise<boolean>, run: () => Promise<void>) {
  let ready: Promise<void> | null = null;
  return () =>
    (ready ??= (async () => {
      try {
        if (await needed()) await run();
      } catch (err) {
        // Assigned after the first await above, so clearing it here is safe.
        ready = null;
        console.error(`self-heal (${label}) skipped:`, err);
      }
    })());
}

/** Does `table` have `column`? Answers false for a missing table too. */
const hasColumn = async (table: string, column: string): Promise<boolean> => {
  const r = await one<{ present: boolean }>(
    `SELECT EXISTS (
       SELECT 1 FROM pg_attribute
        WHERE attrelid = to_regclass($1) AND attname = $2 AND NOT attisdropped
     ) AS present`,
    [table, column],
  );
  return Boolean(r?.present);
};

/** Is `name` a CHECK constraint that already allows the nurse role? */
const checkAllowsNurse = async (name: string): Promise<boolean> => {
  const r = await one<{ present: boolean }>(
    `SELECT EXISTS (
       SELECT 1 FROM pg_constraint
        WHERE conname = $1 AND pg_get_constraintdef(oid) LIKE '%nurse%'
     ) AS present`,
    [name],
  );
  return Boolean(r?.present);
};

// ── Provider cadre columns ───────────────────────────────────
// Nurses share the doctors table (see the note on `cadre` in schema.sql), and
// the role CHECKs predate them: without widening those, creating a nurse fails
// on the users/sessions constraint rather than on a missing column. Every read
// and write of a provider row goes through this.
const ensureProviderColumns = lazyMigration(
  "provider columns",
  async () =>
    !(
      (await hasColumn("doctors", "cadre")) &&
      (await hasColumn("doctors", "skills")) &&
      (await hasColumn("consult_requests", "target_cadre")) &&
      (await checkAllowsNurse("users_role_check")) &&
      (await checkAllowsNurse("sessions_role_check")) &&
      (await checkAllowsNurse("pending_signups_role_check"))
    ),
  async () => {
    await sql(`ALTER TABLE doctors ADD COLUMN IF NOT EXISTS cadre TEXT NOT NULL DEFAULT 'doctor'`);
    await sql(`ALTER TABLE doctors ADD COLUMN IF NOT EXISTS skills TEXT[] NOT NULL DEFAULT '{}'`);
    await sql(
      `ALTER TABLE consult_requests ADD COLUMN IF NOT EXISTS target_cadre TEXT NOT NULL DEFAULT 'doctor'`,
    );
    await sql(`ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_check`);
    await sql(
      `ALTER TABLE users ADD CONSTRAINT users_role_check CHECK (role IN ('patient','doctor','nurse','ops'))`,
    );
    await sql(`ALTER TABLE sessions DROP CONSTRAINT IF EXISTS sessions_role_check`);
    await sql(
      `ALTER TABLE sessions ADD CONSTRAINT sessions_role_check CHECK (role IN ('patient','doctor','nurse','ops'))`,
    );
    await sql(`ALTER TABLE pending_signups DROP CONSTRAINT IF EXISTS pending_signups_role_check`);
    await sql(
      `ALTER TABLE pending_signups ADD CONSTRAINT pending_signups_role_check CHECK (role IN ('patient','doctor','nurse'))`,
    );
  },
);

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
  let expiresAt = iso(r.expires_at);
  const remaining = new Date(expiresAt).getTime() - Date.now();
  if (remaining <= 0) {
    await deleteSession(id);
    return null;
  }
  // Sliding session: using the app keeps you signed in. Renewed at the
  // halfway mark rather than every request, so the write is rare; only a
  // long-dead session (or an explicit logout) ever ends one.
  if (remaining < SESSION_RENEW_BELOW_MS) {
    const next = new Date(Date.now() + SESSION_TTL_MS);
    await sql(`UPDATE sessions SET expires_at = $2 WHERE id = $1`, [id, next]);
    expiresAt = next.toISOString();
  }
  return {
    id: r.id,
    userId: r.user_id,
    role: r.role,
    name: r.name,
    createdAt: iso(r.created_at),
    expiresAt,
  };
}

export async function deleteSession(id: string): Promise<void> {
  if (!id) return;
  await sql(`DELETE FROM sessions WHERE id = $1`, [id]);
}

export async function deleteSessionsForUser(userId: string): Promise<void> {
  await sql(`DELETE FROM sessions WHERE user_id = $1`, [userId]);
}

/**
 * Doctor ids holding at least one live session — i.e. signed in on some device
 * right now. Half of the "is this doctor really online?" question; the other
 * half is a fresh heartbeat (see lib/presence.ts).
 */
/**
 * Provider ids holding at least one live session. Feeds withRealStatus, which
 * refuses to show anyone as online without one.
 *
 * BOTH cadres count: a nurse's session carries role 'nurse', so filtering on
 * 'doctor' alone would leave every nurse permanently rendered offline — and
 * therefore undiscoverable — no matter what their own toggle said.
 */
export async function signedInDoctorIds(): Promise<string[]> {
  const rows = await sql(
    `SELECT DISTINCT user_id FROM sessions
      WHERE role IN ('doctor','nurse') AND expires_at > now()`,
  );
  return rows.map((r) => String(r.user_id));
}

/** Record that a doctor's cockpit is still open. The heartbeat. */
export async function touchDoctor(doctorId: string): Promise<void> {
  await sql(`UPDATE doctors SET last_seen = now() WHERE id = $1`, [doctorId]);
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

// ── Pending sign-ups (Google, before the profile exists) ─────

export async function createPendingSignup(input: {
  googleId: string;
  email: string;
  name: string;
  avatarUrl?: string | null;
  role: "patient" | "doctor" | "nurse";
}): Promise<PendingSignup> {
  const row: PendingSignup = {
    id: newSessionId(),
    googleId: input.googleId,
    email: input.email.toLowerCase(),
    name: input.name,
    avatarUrl: input.avatarUrl ?? null,
    role: input.role,
    expiresAt: new Date(Date.now() + PENDING_SIGNUP_TTL_MS).toISOString(),
  };
  await sql(
    `INSERT INTO pending_signups (id, google_id, email, name, avatar_url, role, expires_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7)`,
    [row.id, row.googleId, row.email, row.name, row.avatarUrl, row.role, row.expiresAt],
  );
  return row;
}

/** Resolve a pending sign-up id. Expired rows are deleted, never returned. */
export async function getPendingSignup(id: string): Promise<PendingSignup | null> {
  if (!id) return null;
  const r = await one(`SELECT * FROM pending_signups WHERE id = $1`, [id]);
  if (!r) return null;
  if (new Date(iso(r.expires_at)).getTime() <= Date.now()) {
    await deletePendingSignup(id);
    return null;
  }
  return {
    id: r.id,
    googleId: r.google_id,
    email: r.email,
    name: r.name,
    avatarUrl: r.avatar_url ?? null,
    role: r.role,
    expiresAt: iso(r.expires_at),
  };
}

export async function deletePendingSignup(id: string): Promise<void> {
  if (!id) return;
  await sql(`DELETE FROM pending_signups WHERE id = $1`, [id]);
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

/**
 * Create a provider account — a doctor or a nurse.
 *
 * Both cadres get the SAME pair of rows: a `users` login and a `doctors`
 * registry row. That is what lets a nurse appear on the map, take requests,
 * run a trip and hold a wallet without a parallel stack; a nurse stored only
 * as a `users` row would be invisible to every one of those engines.
 *
 * The cadre is also the account role, so the session, the cookie and the
 * surface guard all line up with the registry row.
 */
export async function createProviderUser(input: {
  cadre: Cadre;
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
  /** Nurse home-care services (ids from lib/nurse.ts). Empty for doctors. */
  skills?: string[];
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
  await ensureProviderColumns();
  const isNurseCadre = input.cadre === "nurse";
  const id = uid(isNurseCadre ? "nurse" : "doc");
  // Only doctors carry the honorific — "Dr. Ananya Sharma" on a nurse's card
  // would misrepresent her to the patient opening the door.
  const fullName = isNurseCadre
    ? input.fullName.trim().slice(0, 100) || "Nurse"
    : input.fullName.startsWith("Dr.")
      ? input.fullName
      : `Dr. ${input.fullName}`;

  return tx(async (c) => {
    const u = await c.query(
      `INSERT INTO users (id, email, password_hash, role, name, google_id, avatar_url)
       VALUES ($1, $2, $3, $7, $4, $5, $6)
       RETURNING id, email, password_hash, role, name`,
      [
        id,
        input.email.toLowerCase(),
        input.passwordHash,
        fullName,
        input.googleId ?? null,
        input.avatarUrl ?? null,
        input.cadre,
      ],
    );
    // Deterministic accent, picked by how many doctors exist — matches the
    // other backends so an avatar chip doesn't change colour on migration.
    const { rows: countRows } = await c.query(`SELECT count(*)::int AS n FROM doctors`);
    const color = AVATAR_COLORS[num(countRows[0].n) % AVATAR_COLORS.length];
    const d = await c.query(
      `INSERT INTO doctors (id, full_name, specialty, cadre, skills, kind, gender, age, experience_years,
         languages, status, verified, rating, consult_fee, home_visit_fee, avatar_color, avatar_url,
         lat, lng, last_seen, qualifications, education, about, registration_no, clinic_address)
       VALUES ($1,$2,$3,$21,$22,$4,$5,$6,$7,$8,$9,false,0,$10,$11,$12,$13,$14,$15,now(),$16,$17,$18,$19,$20)
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
        // ALWAYS offline to begin with, photo or no photo. Being online is a
        // promise to answer a patient right now, and a brand-new account has
        // made no such promise — a Google sign-up that arrived with a picture
        // used to be marked live the instant it was created, putting a doctor
        // on the emergency map before they had agreed to be there. Going
        // online stays a deliberate act.
        "offline",
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
        input.cadre,
        input.skills ?? [],
      ],
    );
    return { user: mapUser(u.rows[0]), doctor: mapDoctor(d.rows[0]) };
  });
}

/** Doctor sign-up. Thin wrapper so existing call sites are untouched. */
export async function createDoctorUser(
  input: Omit<Parameters<typeof createProviderUser>[0], "cadre">,
): Promise<{ user: UserRecord; doctor: Doctor }> {
  return createProviderUser({ ...input, cadre: "doctor" });
}

/**
 * Nurse sign-up. The nursing profile maps onto the provider columns rather
 * than a JSONB blob, so nurses are searchable and filterable exactly as
 * doctors are: the patient-facing title goes to `specialty`, the cadre
 * (GNM/ANM/B.Sc) to `qualifications`, the state nursing-council number to
 * `registration_no`, and the home-care services to `skills`.
 */
export async function createNurseUser(input: {
  email: string;
  passwordHash: string | null;
  googleId?: string;
  avatarUrl?: string;
  fullName: string;
  title?: string;
  qualifications?: string;
  registrationNo?: string;
  gender?: string;
  age?: number;
  experienceYears?: number;
  languages?: string[];
  skills?: string[];
  about?: string;
  homeVisitFee?: number;
  lat?: number | null;
  lng?: number | null;
}): Promise<{ user: UserRecord; doctor: Doctor }> {
  return createProviderUser({
    cadre: "nurse",
    email: input.email,
    passwordHash: input.passwordHash,
    googleId: input.googleId,
    avatarUrl: input.avatarUrl,
    fullName: input.fullName,
    specialty: input.title?.trim() || "Home Care Nurse",
    // `kind` is a doctor-only distinction (resident vs practising); nurses take
    // the neutral default so the column stays non-null.
    kind: "practising",
    gender: input.gender === "male" ? "male" : "female",
    age: input.age,
    experienceYears: Number(input.experienceYears) || 0,
    languages: input.languages,
    skills: input.skills,
    qualifications: input.qualifications,
    registrationNo: input.registrationNo,
    about: input.about,
    // Nurses do not take video consults, so there is no consult fee to set.
    consultFee: 0,
    homeVisitFee: Number(input.homeVisitFee) || 0,
    lat: input.lat,
    lng: input.lng,
  });
}

// The postal address a provider navigates to, kept beside the short label the
// patient's own header shows. Ships in schema.sql; this covers databases
// created before it, exactly as ensureChatColumn does.
const ensureAddressFullColumn = lazyMigration(
  "users.address_full",
  async () => !(await hasColumn("users", "address_full")),
  async () => {
    await sql(`ALTER TABLE users ADD COLUMN IF NOT EXISTS address_full TEXT`);
  },
);

export async function getPatientProfile(id: string) {
  await ensureAddressFullColumn();
  const r = await one(
    `SELECT id, name, address, address_full, lat, lng, avatar_url, health_profile FROM users WHERE id = $1`,
    [id],
  );
  if (!r) return null;
  return {
    id: r.id,
    name: r.name,
    address: r.address ?? "",
    addressFull: r.address_full ?? "",
    lat: num(r.lat, MAP_CENTER.lat),
    lng: num(r.lng, MAP_CENTER.lng),
    avatarUrl: r.avatar_url ?? undefined,
    healthProfile: (r.health_profile as HealthProfile | null) ?? undefined,
  };
}

/**
 * Save where the patient IS RIGHT NOW. Called whenever the device reports a
 * meaningfully different position, so every later booking / SOS carries the
 * current address rather than the one typed at sign-up.
 *
 * COALESCE keeps the stored address when the reverse geocode came back empty —
 * a failed lookup must not blank out a good address.
 */
export async function setPatientLocation(
  id: string,
  loc: { lat: number; lng: number; address?: string; addressFull?: string },
): Promise<void> {
  await ensureAddressFullColumn();
  await sql(
    `UPDATE users
        SET lat = $2, lng = $3,
            address = COALESCE($4, address),
            address_full = COALESCE($5, address_full)
      WHERE id = $1 AND role = 'patient'`,
    [
      id,
      loc.lat,
      loc.lng,
      loc.address ? loc.address.slice(0, 200) : null,
      loc.addressFull ? loc.addressFull.slice(0, 200) : null,
    ],
  );
}

/**
 * Save the patient's health profile. The route sanitizes; this writes — and
 * when the weight changed, it also APPENDS to the vitals log, so a history
 * accrues from ordinary profile edits and weight becomes a trend, not a
 * snapshot.
 */
export async function setPatientHealthProfile(
  id: string,
  profile: HealthProfile,
): Promise<void> {
  const prev = await one(
    `SELECT health_profile FROM users WHERE id = $1 AND role = 'patient'`,
    [id],
  );
  if (!prev) return;
  const prevWeight = (prev.health_profile as HealthProfile | null)?.weightKg;

  await sql(`UPDATE users SET health_profile = $2::jsonb WHERE id = $1 AND role = 'patient'`, [
    id,
    JSON.stringify(profile),
  ]);

  if (profile.weightKg !== undefined && profile.weightKg !== prevWeight) {
    await sql(
      `INSERT INTO vitals (id, patient_id, kind, value) VALUES ($1, $2, 'weight', $3)`,
      [uid("vital"), id, profile.weightKg],
    );
  }
}

// ── Symptom-checker chat history ─────────────────────────────
// One JSONB blob per patient (like health_profile). The column ships in
// schema.sql, but setup() only runs on seed — this covers databases created
// before the column existed without requiring a re-seed.
const ensureChatColumn = lazyMigration(
  "users.chat_history",
  async () => !(await hasColumn("users", "chat_history")),
  async () => {
    await sql(`ALTER TABLE users ADD COLUMN IF NOT EXISTS chat_history JSONB`);
  },
);

export async function getChatHistory(patientId: string): Promise<unknown[]> {
  await ensureChatColumn();
  const r = await one(
    `SELECT chat_history FROM users WHERE id = $1 AND role = 'patient'`,
    [patientId],
  );
  return Array.isArray(r?.chat_history) ? (r!.chat_history as unknown[]) : [];
}

export async function setChatHistory(
  patientId: string,
  sessions: unknown[],
): Promise<void> {
  await ensureChatColumn();
  await sql(
    `UPDATE users SET chat_history = $2::jsonb WHERE id = $1 AND role = 'patient'`,
    [patientId, JSON.stringify(sessions)],
  );
}

/** Recent weight measurements, newest first — the doctor brief's trend line. */
export async function getWeightHistory(
  patientId: string,
  limit = 10,
): Promise<{ value: number; recordedAt: string }[]> {
  const rows = await sql(
    `SELECT value, recorded_at FROM vitals
      WHERE patient_id = $1 AND kind = 'weight'
      ORDER BY recorded_at DESC LIMIT $2`,
    [patientId, limit],
  );
  return rows.map((r) => ({ value: num(r.value), recordedAt: iso(r.recorded_at) }));
}

/**
 * Everything a doctor may read about a patient whose consult they ACCEPTED —
 * identity, contactable address, their standing as a patient, and the full
 * health profile. Authorization (does this doctor hold that consult?) is the
 * route's job; this just assembles the brief.
 */
export async function getPatientBrief(patientId: string) {
  const r = await one(
    `SELECT id, name, address, avatar_url, rating, rating_count, health_profile, created_at
       FROM users WHERE id = $1 AND role = 'patient'`,
    [patientId],
  );
  if (!r) return null;
  return {
    id: r.id,
    name: r.name,
    address: r.address ?? "",
    avatarUrl: r.avatar_url ?? undefined,
    rating: r.rating != null ? num(r.rating) : undefined,
    ratingCount: r.rating_count != null ? num(r.rating_count) : undefined,
    healthProfile: (r.health_profile as HealthProfile | null) ?? undefined,
    memberSince: iso(r.created_at),
    weightHistory: await getWeightHistory(patientId),
  };
}

/** Cheapest possible round trip — exists to wake a suspended Neon compute. */
export async function ping(): Promise<void> {
  await sql(`SELECT 1`);
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
  // Both provider cadres carry the photo on their registry row as well as the
  // account: that row is what every patient-facing read returns, and it is
  // also what the "no photo, no roster" rule checks before letting them online.
  if (role === "doctor" || role === "nurse") {
    await sql(`UPDATE doctors SET avatar_url = $2, last_seen = now() WHERE id = $1`, [userId, dataUrl]);
  }
}

export async function getDoctorById(id: string): Promise<Doctor | null> {
  await ensureProviderColumns();
  const r = await one(`SELECT ${DOCTOR_COLS} FROM doctors WHERE id = $1`, [id]);
  return r ? mapDoctor(r) : null;
}

/**
 * The complete ops view of one doctor: profile, the account behind it, and
 * every row that references them. One round of parallel queries rather than a
 * join, because the pieces are independent lists the UI renders separately.
 *
 * Ops-only — the caller must enforce that. This returns the account email and
 * unmasked coordinates, neither of which any patient-facing read may expose.
 */
export async function getDoctorDetail(id: string): Promise<DoctorDetail | null> {
  const doctor = await getDoctorById(id);
  if (!doctor) return null;

  const [acct, reviews, requests, gigs, transactions, sessions] = await Promise.all([
    // A registered doctor's id IS their users.id; seeded catalog doctors have
    // no such row, and `account` stays null for them.
    one(
      `SELECT email, created_at, google_id, password_hash, address, avatar_url
         FROM users WHERE id = $1`,
      [id],
    ),
    getReviews(id),
    // Same projection getRequests uses, so the ops table shows the patient
    // rating and "reviewed" flags exactly as every other surface does.
    sql(
      `SELECT ${REQUEST_COLS} FROM consult_requests r
       LEFT JOIN users u ON u.id = r.patient_id
       WHERE r.doctor_id = $1 ORDER BY r.created_at DESC`,
      [id],
    ),
    getGigs(id),
    sql(`SELECT * FROM transactions WHERE doctor_id = $1 ORDER BY created_at DESC`, [id]),
    one(
      `SELECT count(*)::int AS n FROM sessions WHERE user_id = $1 AND expires_at > now()`,
      [id],
    ),
  ]);

  return {
    doctor,
    account: acct
      ? {
          email: acct.email,
          createdAt: iso(acct.created_at),
          googleLinked: Boolean(acct.google_id),
          hasPassword: Boolean(acct.password_hash),
          address: acct.address ?? undefined,
          avatarUrl: acct.avatar_url ?? undefined,
        }
      : null,
    reviews,
    requests: requests.map((r) => ({
      ...mapRequest(r),
      patientRating: r.patient_rating != null ? num(r.patient_rating) : null,
      patientRatingCount: num(r.patient_rating_count),
      patientRated: Boolean(r.patient_rated),
      reviewed: Boolean(r.reviewed),
    })),
    gigs,
    transactions: transactions.map(mapTransaction),
    activeSessions: num(sessions?.n),
  };
}

/**
 * Ops removes a doctor from the platform.
 *
 * What goes: the profile, their gig shelf, the reviews written about them, and
 * the account itself (sessions cascade off users, so every signed-in device is
 * logged out immediately).
 *
 * What stays: consult_requests and transactions. Patients keep their own
 * consult history, and the money ledger stays auditable — the schema is built
 * for parentless rows precisely so a deleted account cannot erase either.
 *
 * Refuses while a consult is live: deleting mid-visit would strand a patient
 * with a doctor who no longer exists.
 */
export async function deleteDoctor(id: string): Promise<DoctorDeletion> {
  return tx(async (c) => {
    const { rows: docRows } = await c.query(
      `SELECT id, full_name FROM doctors WHERE id = $1 FOR UPDATE`,
      [id],
    );
    if (!docRows[0]) throw new DomainError("That doctor no longer exists.");

    const { rows: live } = await c.query(
      `SELECT count(*)::int AS n FROM consult_requests
        WHERE doctor_id = $1 AND status = 'accepted'`,
      [id],
    );
    if (num(live[0].n) > 0)
      throw new DomainError(
        "This doctor is mid-consult. Wait for it to finish or cancel it first.",
      );

    const kept = await c.query(
      `SELECT
         (SELECT count(*)::int FROM consult_requests WHERE doctor_id = $1) AS requests,
         (SELECT count(*)::int FROM transactions     WHERE doctor_id = $1) AS txns`,
      [id],
    );
    const gigs = await c.query(`DELETE FROM gigs WHERE doctor_id = $1`, [id]);
    const reviews = await c.query(`DELETE FROM reviews WHERE doctor_id = $1`, [id]);
    await c.query(`DELETE FROM doctors WHERE id = $1`, [id]);
    // Sessions cascade from users; a seeded doctor has no account row at all.
    const account = await c.query(`DELETE FROM users WHERE id = $1 AND role = 'doctor'`, [id]);

    return {
      doctorId: id,
      fullName: docRows[0].full_name,
      removedAccount: (account.rowCount ?? 0) > 0,
      removedGigs: gigs.rowCount ?? 0,
      removedReviews: reviews.rowCount ?? 0,
      keptRequests: num(kept.rows[0].requests),
      keptTransactions: num(kept.rows[0].txns),
    };
  });
}

// ── Reads ────────────────────────────────────────────────────
export async function getDoctors(near?: Near): Promise<Doctor[]> {
  await ensureProviderColumns();
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
  await ensureProviderColumns();
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
  /** Which cadre should see this. Ignored when a provider is named — their
   *  own cadre wins, so a request can never be aimed at the wrong inbox. */
  targetCadre?: string;
}): Promise<ConsultRequest> {
  await ensureProviderColumns();
  const doctorId = input.doctorId ?? null;
  const mode = coerceBookingMode(input.mode);

  return tx(async (c) => {
    let slot: ResolvedSlot | null = null;
    let hire: ResolvedHire | null = null;
    let targetCadre: Cadre = input.targetCadre === "nurse" ? "nurse" : "doctor";

    // A named provider settles the cadre themselves — trusting the client here
    // would let a request be addressed to a nurse but tagged for doctors, and
    // it would then be invisible to the only person who could answer it.
    if (doctorId) {
      const who = await c.query(`SELECT cadre FROM doctors WHERE id = $1`, [doctorId]);
      if (who.rows[0]) targetCadre = who.rows[0].cadre === "nurse" ? "nurse" : "doctor";
    }

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
         scheduled_at, scheduled_end, slot_minutes, target_cadre, passed_by)
       VALUES ($1,$2,$3,$4,$5,'pending',$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,'{}')
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
        targetCadre,
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
  /** Set when the basket came off a doctor's prescription. */
  prescriptionId?: string | null;
}): Promise<Order> {
  if (!Array.isArray(input.items) || input.items.length === 0) {
    throw new DomainError("The order has no items.");
  }
  // The insert below names prescription_id, which a database predating
  // prescriptions does not have — the same lazy DDL that creates the table
  // adds the column.
  await ensurePrescriptions();
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
    `INSERT INTO orders (id, patient_id, patient_name, status, items, total, address, dark_store, eta_mins, prescription_id)
     VALUES ($1,$2,$3,'placed',$4::jsonb,$5,$6,$7,10,$8) RETURNING *`,
    [
      uid("ord"),
      input.patientId,
      input.patientName,
      JSON.stringify(items),
      total,
      input.address,
      input.darkStore,
      input.prescriptionId ?? null,
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
  // A nurse's home-care services. Allowlisted against NURSE_SERVICES by the
  // action's sanitizer before it ever reaches here, so a hand-rolled POST
  // cannot invent a capability patients then filter on.
  skills: "skills",
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
    // Skills may legitimately be emptied (a nurse re-picking her services),
    // so only the shape is enforced here, not a minimum.
    if (key === "skills" && !Array.isArray(v)) continue;
    if ((key === "lat" || key === "lng") && typeof v !== "number") continue;
    vals.push(v);
    sets.push(`${col} = $${vals.length}`);
  }
  if (sets.length === 0) return;
  await sql(`UPDATE doctors SET ${sets.join(", ")}, last_seen = now() WHERE id = $1`, vals);
}

/**
 * Ops decision on a provider's credentials.
 *
 * Deliberately NOT reachable through updateDoctor: `verified` is excluded from
 * the provider-editable patch allowlist precisely so a provider can never mark
 * themselves trusted. It matters most for nurses, who are not discoverable at
 * all until this flips — nobody unvetted gets sent into a home.
 */
export async function verifyProvider(id: string, verified: boolean): Promise<boolean> {
  await ensureProviderColumns();
  const r = await one(
    `UPDATE doctors SET verified = $2 WHERE id = $1 RETURNING id`,
    [id, verified],
  );
  return Boolean(r);
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

    // Mint the arrival code here: from this moment there is a doctor-patient
    // pair, and the patient's app can show the digits straight away.
    await c.query(
      `UPDATE consult_requests
       SET status = 'accepted', doctor_id = $2, accepted_at = now(),
           trip_stage = 'accepted', trip_stage_at = now(),
           start_code = $3, start_code_attempts = 0
       WHERE id = $1`,
      [id, doctorId, newStartCode()],
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
    // `in_progress` is NOT walkable: it is reached only by the arrival code
    // (or the patient starting it themselves). Without this guard a doctor
    // could tap their way past the handshake and the code would be theatre.
    if (next === "in_progress") return null;
    await c.query(
      `UPDATE consult_requests SET trip_stage = $2, trip_stage_at = now() WHERE id = $1`,
      [id, next],
    );
    return next;
  });
}

/**
 * The handshake. The doctor submits what the patient read out; the row is
 * locked so two submissions can't both spend an attempt against a stale
 * count, and a wrong guess is recorded whether or not the caller retries.
 *
 * Returns why it failed rather than throwing, so the cockpit can show
 * "3 tries left" instead of a generic error.
 */
export async function verifyStartCode(
  id: string,
  doctorId: string,
  code: string,
): Promise<{ ok: true } | { ok: false; reason: "locked" | "wrong"; attemptsLeft: number }> {
  return tx(async (c) => {
    const rq = await c.query(`SELECT * FROM consult_requests WHERE id = $1 FOR UPDATE`, [id]);
    if (!rq.rows[0]) throw new DomainError("That visit no longer exists.", 404);
    const req = mapRequest(rq.rows[0]);
    if (req.doctorId !== doctorId) throw new DomainError("That isn't your visit.", 403);
    if (req.status !== "accepted") throw new DomainError("That visit isn't in progress.", 409);
    if (req.tripStage === "in_progress") return { ok: true as const }; // already started

    const attempts = req.startCodeAttempts ?? 0;
    if (attempts >= MAX_START_CODE_ATTEMPTS) {
      return { ok: false as const, reason: "locked" as const, attemptsLeft: 0 };
    }

    // A row accepted before this feature shipped has no code; mint one now so
    // the visit isn't stranded, and let this attempt fail against it.
    let expected = req.startCode;
    if (!expected) {
      expected = newStartCode();
      await c.query(`UPDATE consult_requests SET start_code = $2 WHERE id = $1`, [id, expected]);
    }

    if (code !== expected) {
      const used = attempts + 1;
      await c.query(
        `UPDATE consult_requests SET start_code_attempts = $2 WHERE id = $1`,
        [id, used],
      );
      return {
        ok: false as const,
        reason: "wrong" as const,
        attemptsLeft: Math.max(0, MAX_START_CODE_ATTEMPTS - used),
      };
    }

    await c.query(
      `UPDATE consult_requests
         SET trip_stage = 'in_progress', trip_stage_at = now(), started_at = now()
       WHERE id = $1`,
      [id],
    );
    return { ok: true as const };
  });
}

/**
 * Start the consult from the PATIENT's side — the escape hatch for a dead
 * doctor phone, or a patient who would rather tap than read digits aloud.
 * Same proof, opposite direction: only the patient's own session can do it.
 */
export async function startConsultAsPatient(id: string, patientId: string): Promise<void> {
  await tx(async (c) => {
    const rq = await c.query(`SELECT * FROM consult_requests WHERE id = $1 FOR UPDATE`, [id]);
    if (!rq.rows[0]) throw new DomainError("That visit no longer exists.", 404);
    const req = mapRequest(rq.rows[0]);
    if (req.patientId !== patientId) throw new DomainError("That isn't your visit.", 403);
    if (req.status !== "accepted") throw new DomainError("That visit isn't in progress.", 409);
    if (!req.doctorId) throw new DomainError("No doctor has taken this visit yet.", 409);
    if (req.tripStage === "in_progress") return;
    await c.query(
      `UPDATE consult_requests
         SET trip_stage = 'in_progress', trip_stage_at = now(), started_at = now()
       WHERE id = $1`,
      [id],
    );
  });
}

/** New digits, attempts reset — for a locked or forgotten code. Patient only. */
export async function reissueStartCode(id: string, patientId: string): Promise<string> {
  return tx(async (c) => {
    const rq = await c.query(`SELECT * FROM consult_requests WHERE id = $1 FOR UPDATE`, [id]);
    if (!rq.rows[0]) throw new DomainError("That visit no longer exists.", 404);
    const req = mapRequest(rq.rows[0]);
    if (req.patientId !== patientId) throw new DomainError("That isn't your visit.", 403);
    if (req.status !== "accepted") throw new DomainError("That visit isn't in progress.", 409);
    if (req.tripStage === "in_progress") {
      throw new DomainError("This consult has already started.", 409);
    }
    const code = newStartCode();
    await c.query(
      `UPDATE consult_requests SET start_code = $2, start_code_attempts = 0 WHERE id = $1`,
      [id, code],
    );
    return code;
  });
}

/**
 * Close out a visit.
 *
 * Prescribing is deliberately NOT part of this: it goes through
 * issuePrescription, which completes the visit itself. One act, one entry
 * point — see the file-store repo for the full reasoning.
 */
export async function completeRequest(
  id: string,
  opts?: { notes?: string; doctorId?: string },
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

// ── Prescriptions ────────────────────────────────────────────
// The table and the orders.prescription_id link ship in schema.sql, but
// setup() only runs on seed — so a database that has been live since before
// prescriptions existed would answer every read with "relation does not
// exist". This covers it without requiring a re-seed, exactly as
// ensureProviderColumns and ensureChatColumn do. Every prescription read and
// write goes through it, so a live database self-heals on first use.
const ensurePrescriptions = lazyMigration(
  "prescriptions",
  async () =>
    !((await hasColumn("prescriptions", "id")) && (await hasColumn("orders", "prescription_id"))),
  async () => {
    await sql(`CREATE TABLE IF NOT EXISTS prescriptions (
      id                     TEXT PRIMARY KEY,
      code                   TEXT NOT NULL,
      request_id             TEXT NOT NULL,
      patient_id             TEXT,
      patient_name           TEXT NOT NULL DEFAULT 'Patient',
      patient_age            INTEGER,
      patient_gender         TEXT,
      patient_allergies      TEXT,
      doctor_id              TEXT NOT NULL,
      doctor_name            TEXT NOT NULL DEFAULT '',
      doctor_specialty       TEXT NOT NULL DEFAULT '',
      doctor_qualifications  TEXT,
      doctor_registration_no TEXT,
      diagnosis              TEXT NOT NULL DEFAULT '',
      items                  JSONB NOT NULL DEFAULT '[]'::jsonb,
      advice                 TEXT NOT NULL DEFAULT '',
      follow_up_days         INTEGER,
      issued_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
      share_token            TEXT NOT NULL
    )`);
    await sql(`CREATE INDEX IF NOT EXISTS prescriptions_patient_idx ON prescriptions(patient_id, issued_at DESC)`);
    await sql(`CREATE INDEX IF NOT EXISTS prescriptions_doctor_idx ON prescriptions(doctor_id, issued_at DESC)`);
    await sql(`CREATE UNIQUE INDEX IF NOT EXISTS prescriptions_request_uniq ON prescriptions(request_id)`);
    await sql(`CREATE UNIQUE INDEX IF NOT EXISTS prescriptions_token_uniq ON prescriptions(share_token)`);
    await sql(`CREATE UNIQUE INDEX IF NOT EXISTS prescriptions_code_uniq ON prescriptions(code)`);
    await sql(`ALTER TABLE orders ADD COLUMN IF NOT EXISTS prescription_id TEXT`);
  },
);

/**
 * A doctor issues the prescription that closes a consult. The only way a
 * prescription comes into existence — see the file-store repo for why.
 *
 * Runs in a transaction with the consult row locked: the ownership check, the
 * duplicate check and the insert must not interleave, or a double-tapped
 * "Issue" would mint two documents with two codes for one visit. The unique
 * index on request_id is the backstop under that lock.
 */
export async function issuePrescription(input: {
  requestId: string;
  doctorId: string;
  draft: RxDraft;
}): Promise<Prescription> {
  await ensurePrescriptions();
  const rx = await tx(async (c) => {
    const rq = await c.query(`SELECT * FROM consult_requests WHERE id = $1 FOR UPDATE`, [
      input.requestId,
    ]);
    if (!rq.rows[0]) throw new DomainError("That consult no longer exists.", 404);
    const req = mapRequest(rq.rows[0]);
    if (req.doctorId !== input.doctorId)
      throw new DomainError("That consult isn't yours to prescribe for.", 403);
    if (req.status !== "accepted" && req.status !== "completed")
      throw new DomainError("You can only prescribe for a consult you are running.", 409);
    const dupe = await c.query(`SELECT 1 FROM prescriptions WHERE request_id = $1`, [
      input.requestId,
    ]);
    if (dupe.rows.length > 0)
      throw new DomainError("A prescription has already been issued for this consult.", 409);

    const draft = sanitizeRxDraft(input.draft);
    const doc = await c.query(`SELECT * FROM doctors WHERE id = $1`, [input.doctorId]);
    const doctor = doc.rows[0] ? mapDoctor(doc.rows[0]) : null;
    const usr = req.patientId
      ? await c.query(`SELECT health_profile FROM users WHERE id = $1`, [req.patientId])
      : null;
    const profile = (usr?.rows[0]?.health_profile as HealthProfile | null) ?? null;

    const row = await c.query(
      `INSERT INTO prescriptions
         (id, code, request_id, patient_id, patient_name, patient_age, patient_gender,
          patient_allergies, doctor_id, doctor_name, doctor_specialty, doctor_qualifications,
          doctor_registration_no, diagnosis, items, advice, follow_up_days, share_token)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15::jsonb,$16,$17,$18)
       RETURNING *`,
      [
        uid("rx"),
        newRxCode(),
        req.id,
        req.patientId,
        req.patientName,
        ageFrom(profile?.dob) ?? null,
        profile?.gender ?? null,
        profile?.allergies || null,
        input.doctorId,
        doctor?.fullName ?? "Doceeto doctor",
        doctor?.specialty ?? "",
        doctor?.qualifications ?? null,
        doctor?.registrationNo ?? null,
        draft.diagnosis,
        JSON.stringify(draft.items),
        draft.advice,
        draft.followUpDays,
        newShareToken(),
      ],
    );
    return { rx: mapPrescription(row.rows[0]), wasOpen: req.status === "accepted" };
  });

  // Issuing closes the visit when it was still open. Outside the transaction so
  // a rejected prescription never silently ends a consult, and so completion
  // takes its own lock exactly as a plain "Mark complete" would.
  if (rx.wasOpen) {
    await completeRequest(input.requestId, { doctorId: input.doctorId });
  }
  return rx.rx;
}

/** Every prescription, newest first. Callers scope by patient or doctor. */
export async function getPrescriptions(): Promise<Prescription[]> {
  await ensurePrescriptions();
  const rows = await sql(`SELECT * FROM prescriptions ORDER BY issued_at DESC`);
  return rows.map(mapPrescription);
}

/** One prescription by id. */
export async function getPrescriptionById(id: string): Promise<Prescription | null> {
  await ensurePrescriptions();
  const r = await one(`SELECT * FROM prescriptions WHERE id = $1`, [id]);
  return r ? mapPrescription(r) : null;
}

/**
 * The shared-link lookup: the ONLY read that needs no session, because the
 * token IS the credential. Nothing else about the patient is reachable from it.
 */
export async function getPrescriptionByToken(token: string): Promise<Prescription | null> {
  if (!token) return null;
  await ensurePrescriptions();
  const r = await one(`SELECT * FROM prescriptions WHERE share_token = $1`, [token]);
  return r ? mapPrescription(r) : null;
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
