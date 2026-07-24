import "server-only";
import fs from "node:fs";
import path from "node:path";
import { seedDoctors, seedReviews } from "@/lib/seed-doctors";
import type { UserRecord } from "@/lib/db/shared";
import type {
  Ambulance,
  ConsultRequest,
  Doctor,
  Order,
  Review,
  SosEvent,
} from "@/lib/types/domain";

/**
 * Zero-setup server backend: one JSON file on disk + an in-memory copy
 * held on globalThis. Because the Next.js server is one long-lived Node
 * process, the in-memory data is shared across ALL requests and clients
 * (every browser/device hits the same server), and it survives browser
 * reloads. The file gives durability across server restarts.
 *
 * This is the "real backend" for local dev / a single Render instance.
 * (It is not suitable for serverless / multi-instance — use Neo4j there.)
 */

export interface StoredUser extends UserRecord {
  address?: string;
  lat?: number;
  lng?: number;
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
  doctors: Doctor[];
  ambulances: Ambulance[];
  sos: SosEvent[];
  requests: ConsultRequest[];
  orders: Order[];
  reviews: StoredReview[];
  patientReviews: StoredPatientReview[];
  consults: Record<string, unknown>[];
  prescriptions: Record<string, unknown>[];
  audits: Record<string, unknown>[];
}

const FILE = path.join(process.cwd(), ".data", "iyashi.json");

function empty(): FileData {
  return {
    users: [],
    doctors: [],
    ambulances: [],
    sos: [],
    requests: [],
    orders: [],
    reviews: [],
    patientReviews: [],
    consults: [],
    prescriptions: [],
    audits: [],
  };
}

const g = globalThis as unknown as { __iyashiFileDb?: FileData };

/** The shared in-memory data (loaded from disk once per process). */
export function data(): FileData {
  if (g.__iyashiFileDb) {
    // Backfill arrays added in later versions onto a long-lived in-memory
    // object (survives dev hot-reloads) so new fields are never undefined.
    if (!g.__iyashiFileDb.patientReviews) g.__iyashiFileDb.patientReviews = [];
    return g.__iyashiFileDb;
  }
  let d = empty();
  try {
    if (fs.existsSync(FILE)) {
      const parsed = JSON.parse(fs.readFileSync(FILE, "utf8"));
      d = { ...empty(), ...parsed };
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
