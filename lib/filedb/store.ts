import "server-only";
import fs from "node:fs";
import path from "node:path";
import { MAP_CENTER } from "@/lib/config";
import { seedDoctors, seedReviews } from "@/lib/seed-doctors";
import type { PendingSignup, SessionRecord, UserRecord } from "@/lib/db/shared";
import type {
  Ambulance,
  ConsultRequest,
  Doctor,
  Gig,
  Order,
  Prescription,
  Review,
  SosEvent,
  Transaction,
} from "@/lib/types/domain";

/**
 * Zero-setup server backend: one JSON file on disk + an in-memory copy
 * held on globalThis. Because the Next.js server is one long-lived Node
 * process, the in-memory data is shared across ALL requests and clients
 * (every browser/device hits the same server), and it survives browser
 * reloads. The file gives durability across server restarts.
 *
 * This is the "real backend" for local dev / a single Render instance.
 * (It is not suitable for serverless / multi-instance — set DATABASE_URL and
 * use Postgres there.)
 */

export interface StoredUser extends UserRecord {
  address?: string;
  lat?: number;
  lng?: number;
  /** When the account was created, ISO. Optional — accounts written before
   *  this field existed have none, and the ops view renders that as "—". */
  createdAt?: string;
  /** Google's `sub` once this account has been linked to a Google identity. */
  googleId?: string;
  avatarUrl?: string;
  /** Patient health profile (lib/health/profile.ts); absent for providers. */
  healthProfile?: import("@/lib/health/profile").HealthProfile;
  /** Symptom-checker chat history (lib/care/history.ts); patients only. */
  chatHistory?: import("@/lib/care/history").CheckSession[];
  /** The postal address a provider navigates to, beside the short label the
   *  patient's own header shows. Mirrors users.address_full in Postgres. */
  addressFull?: string;
  /** Aggregate rating this patient received from doctors (mutual ratings). */
  rating?: number;
  ratingCount?: number;
}
export interface StoredReview extends Review {
  requestId: string;
  doctorId: string;
}
/** A doctor's rating of a patient after a completed consult. */
export interface StoredPatientReview {
  id: string;
  requestId: string;
  patientId: string;
  doctorId: string;
  doctorName: string;
  rating: number;
  comment: string;
  createdAt: string;
}

export interface FileData {
  /** True once the demo doctor roster has been seeded (first run only). */
  seeded?: boolean;
  users: StoredUser[];
  /** Live sign-ins. The browser holds only each row's opaque id. */
  sessions: SessionRecord[];
  /** Verified Google identities that haven't become accounts yet. */
  pendingSignups: PendingSignup[];
  doctors: Doctor[];
  /** Service packages doctors publish for patients to hire. */
  gigs: Gig[];
  ambulances: Ambulance[];
  sos: SosEvent[];
  requests: ConsultRequest[];
  orders: Order[];
  reviews: StoredReview[];
  patientReviews: StoredPatientReview[];
  transactions: Transaction[];
  consults: Record<string, unknown>[];
  /** Issued prescriptions, newest first. Mirrors the Postgres table. */
  prescriptions: Prescription[];
  audits: Record<string, unknown>[];
  /** Longitudinal vitals log — one row per measurement, never overwritten.
   *  Only weight today; the shape leaves room for BP/glucose later. */
  vitals?: StoredVital[];
}

export interface StoredVital {
  id: string;
  patientId: string;
  kind: "weight";
  value: number;
  recordedAt: string; // ISO
}

const FILE = path.join(process.cwd(), ".data", "iyashi.json");

function empty(): FileData {
  return {
    users: [],
    sessions: [],
    pendingSignups: [],
    doctors: [],
    gigs: [],
    ambulances: [],
    sos: [],
    requests: [],
    orders: [],
    reviews: [],
    patientReviews: [],
    transactions: [],
    consults: [],
    prescriptions: [],
    audits: [],
    vitals: [],
  };
}

const g = globalThis as unknown as { __iyashiFileDb?: FileData };

// ── Hardcoded test accounts ──────────────────────────────────
// Guaranteed to exist on every load — they survive store resets, fresh
// deploys, and a long-lived server whose in-memory copy predates them.
// Both log in with the password "test1234" (bcrypt hash below, converged
// on every check so the documented password always works).
// ⚠ Remove this block before a real public launch.
const TEST_PASSWORD_HASH = "$2b$10$wq6p.lQQ00xR/227k.juJetPb5YH/iQpnl3zXhH0ZQ3PUrt9bJRjy";
const TEST_DOCTOR_EMAIL = "doctor@gmail.com";
const TEST_PATIENT_EMAIL = "patient@gmail.com";
const TEST_NURSE_EMAIL = "nurse@gmail.com";

function ensureTestAccounts(d: FileData): boolean {
  let changed = false;

  let patient = d.users.find((u) => u.email === TEST_PATIENT_EMAIL);
  if (!patient) {
    patient = {
      id: "patient-test-1",
      email: TEST_PATIENT_EMAIL,
      passwordHash: TEST_PASSWORD_HASH,
      role: "patient",
      name: "Riya Sharma",
      address: "Baner, Pune",
      lat: MAP_CENTER.lat,
      lng: MAP_CENTER.lng,
    };
    d.users.push(patient);
    changed = true;
  }
  if (patient && patient.lat === MAP_CENTER.lat && patient.lng === MAP_CENTER.lng) {
    delete patient.lat;
    delete patient.lng;
    changed = true;
  }

  let docUser = d.users.find((u) => u.email === TEST_DOCTOR_EMAIL);
  if (!docUser) {
    docUser = {
      id: "doc-test-1",
      email: TEST_DOCTOR_EMAIL,
      passwordHash: TEST_PASSWORD_HASH,
      role: "doctor",
      name: "Dr. Arjun Mehta",
    };
    d.users.push(docUser);
    changed = true;
  }
  let nurseUser = d.users.find((u) => u.email === TEST_NURSE_EMAIL);
  if (!nurseUser) {
    nurseUser = {
      id: "nurse-test-1",
      email: TEST_NURSE_EMAIL,
      passwordHash: TEST_PASSWORD_HASH,
      role: "nurse",
      name: "Ananya Sharma",
    };
    d.users.push(nurseUser);
    changed = true;
  }
  if (!d.doctors.some((x) => x.id === docUser!.id)) {
    d.doctors.push({
      id: docUser.id,
      fullName: "Dr. Arjun Mehta",
      specialty: "General Physician",
      kind: "practising",
      gender: "male",
      age: 38,
      experienceYears: 12,
      languages: ["English", "Hindi", "Marathi"],
      qualifications: "MBBS, MD (General Medicine)",
      education: "Grant Medical College, Mumbai",
      registrationNo: "MH-45210",
      status: "online",
      verified: false,
      rating: 0,
      consultFee: 500,
      homeVisitFee: 1000,
      clinicAddress: "MG Road, Pune, opposite Central Mall",
      avatarColor: "#5D8A6E",
      lat: MAP_CENTER.lat + 0.01,
      lng: MAP_CENTER.lng + 0.01,
      lastSeen: new Date().toISOString(),
    });
    changed = true;
  }
  // The test nurse needs a PROVIDER row like the test doctor, not just a
  // login: without one she has no coordinates, no wallet and no inbox, and
  // the nurse console renders empty.
  if (!d.doctors.some((x) => x.id === nurseUser!.id)) {
    d.doctors.push({
      id: nurseUser.id,
      fullName: "Ananya Sharma",
      specialty: "Home Care Nurse",
      cadre: "nurse",
      skills: ["wound_dressing", "vitals_sample_collection", "injection_iv"],
      kind: "practising",
      gender: "female",
      age: 29,
      experienceYears: 6,
      languages: ["English", "Hindi", "Marathi"],
      qualifications: "GNM",
      registrationNo: "MNC-11482",
      status: "online",
      verified: true,
      rating: 0,
      consultFee: 0,
      homeVisitFee: 650,
      avatarColor: "#3E826E",
      lat: MAP_CENTER.lat - 0.012,
      lng: MAP_CENTER.lng + 0.008,
      lastSeen: new Date().toISOString(),
    });
    changed = true;
  }

  // Converge the password so "test1234" always works, even if it was
  // changed or the account was created earlier with another hash.
  for (const u of [patient, docUser, nurseUser]) {
    if (u.passwordHash !== TEST_PASSWORD_HASH) {
      u.passwordHash = TEST_PASSWORD_HASH;
      changed = true;
    }
  }
  return changed;
}

/** The shared in-memory data (loaded from disk once per process). */
export function data(): FileData {
  if (g.__iyashiFileDb) {
    // Backfill arrays added in later versions onto a long-lived in-memory
    // object (survives dev hot-reloads) so new fields are never undefined.
    if (!g.__iyashiFileDb.sessions) g.__iyashiFileDb.sessions = [];
    if (!g.__iyashiFileDb.pendingSignups) g.__iyashiFileDb.pendingSignups = [];
    if (!g.__iyashiFileDb.patientReviews) g.__iyashiFileDb.patientReviews = [];
    if (!g.__iyashiFileDb.transactions) g.__iyashiFileDb.transactions = [];
    if (!g.__iyashiFileDb.gigs) g.__iyashiFileDb.gigs = [];
    if (!g.__iyashiFileDb.prescriptions) g.__iyashiFileDb.prescriptions = [];
    // Heal a live server whose in-memory copy predates the test accounts.
    if (ensureTestAccounts(g.__iyashiFileDb)) persist();
    return g.__iyashiFileDb;
  }
  let d = empty();
  try {
    if (fs.existsSync(FILE)) {
      const parsed = JSON.parse(fs.readFileSync(FILE, "utf8"));
      d = { ...empty(), ...parsed };
      // An earlier version wrote prescriptions as untyped stubs (no code, no
      // share token, no doctor snapshot) from inside completeRequest. Those
      // rows cannot render a sheet and cannot be shared, so they are dropped
      // rather than surfaced as broken documents.
      d.prescriptions = (d.prescriptions ?? []).filter(
        (rx) => rx && typeof rx === "object" && "code" in rx && "shareToken" in rx,
      );
    }
  } catch {
    /* corrupt file → start empty */
  }
  // First run: seed a realistic doctor roster + sample reviews so the patient
  // flow (map, list, profile, booking) works out of the box. The `seeded`
  // flag stops us re-seeding after a reset or once real doctors exist.
  if (!d.seeded && d.doctors.length === 0) {
    d.doctors = seedDoctors();
    d.reviews = seedReviews();
    d.seeded = true;
    g.__iyashiFileDb = d;
    persist();
    return d;
  }
  // Top up the roster: a doctor added to the seed list in a later version is
  // appended to an install that was seeded before they existed. Gated on the
  // seed rows still being present, so a deliberate reset stays empty.
  if (d.doctors.some((x) => x.id.startsWith("doc-seed-"))) {
    const have = new Set(d.doctors.map((x) => x.id));
    const added = seedDoctors().filter((s) => !have.has(s.id));
    if (added.length > 0) {
      d.doctors.push(...added);
      const seenReviews = new Set(d.reviews.map((v) => v.id));
      d.reviews.push(
        ...seedReviews().filter(
          (v) => !seenReviews.has(v.id) && added.some((a) => a.id === v.doctorId),
        ),
      );
      g.__iyashiFileDb = d;
      persist();
      return d;
    }
  }
  // Backfill sample reviews for an install seeded before reviews existed.
  if (d.reviews.length === 0 && d.doctors.some((x) => x.id.startsWith("doc-seed-"))) {
    d.reviews = seedReviews();
    g.__iyashiFileDb = d;
    persist();
    return d;
  }
  // Backfill profile detail (qualifications, education, about, reg no.) onto
  // seed doctors that were seeded before those fields existed.
  if (d.doctors.some((x) => x.id.startsWith("doc-seed-") && !x.about)) {
    const seeded = new Map(seedDoctors().map((s) => [s.id, s]));
    d.doctors = d.doctors.map((doc) => {
      const s = doc.id.startsWith("doc-seed-") && !doc.about ? seeded.get(doc.id) : undefined;
      return s
        ? {
            ...doc,
            qualifications: s.qualifications,
            education: s.education,
            about: s.about,
            registrationNo: s.registrationNo,
          }
        : doc;
    });
    g.__iyashiFileDb = d;
    persist();
    return d;
  }
  g.__iyashiFileDb = d;
  if (ensureTestAccounts(d)) persist();
  return d;
}

let timer: ReturnType<typeof setTimeout> | null = null;

/** Debounced write to disk. In-memory data is always current; the file
 *  is only for surviving a server restart. */
export function persist() {
  const d = data();
  if (timer) clearTimeout(timer);
  timer = setTimeout(() => {
    try {
      fs.mkdirSync(path.dirname(FILE), { recursive: true });
      fs.writeFileSync(FILE, JSON.stringify(d, null, 2));
    } catch {
      /* disk error → keep serving from memory */
    }
  }, 80);
}
