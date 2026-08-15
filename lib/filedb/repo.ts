import "server-only";
import { data, persist, type StoredUser } from "@/lib/filedb/store";
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
import { MAP_CENTER, COMMISSION_RATE } from "@/lib/config";
import { AVATAR_COLORS, MED_CATALOG } from "@/lib/catalog";
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
  SosEvent,
  Transaction,
} from "@/lib/types/domain";

export { DomainError };
export type { Near, PendingSignup, SessionRecord, UserRecord };

const uid = (p: string) => `${p}-${crypto.randomUUID()}`;
const now = () => new Date().toISOString();
const km = (a: { lat: number; lng: number }, b: { lat: number; lng: number }) =>
  haversineKm(a, b);

function withinNear<T extends { lat?: number; lng?: number }>(rows: T[], near?: Near): T[] {
  if (!near) return rows;
  return rows.filter(
    (r) =>
      typeof r.lat === "number" &&
      typeof r.lng === "number" &&
      km({ lat: r.lat, lng: r.lng }, near) <= near.km,
  );
}

// ── Sessions ─────────────────────────────────────────────────
// Same contract as the Postgres store: the session lives HERE, the browser
// holds only its opaque id. Kept in step with lib/postgres/repo.ts so switching
// backends changes nothing about how sign-in behaves.

export async function createSession(input: {
  userId: string;
  role: UserRecord["role"];
  name: string;
}): Promise<SessionRecord> {
  const now = Date.now();
  const session: SessionRecord = {
    id: newSessionId(),
    userId: input.userId,
    role: input.role,
    name: input.name,
    createdAt: new Date(now).toISOString(),
    expiresAt: new Date(now + SESSION_TTL_MS).toISOString(),
  };
  data().sessions.push(session);
  persist();
  return session;
}

export async function getSessionById(id: string): Promise<SessionRecord | null> {
  if (!id) return null;
  const found = data().sessions.find((s) => s.id === id);
  if (!found) return null;
  const remaining = new Date(found.expiresAt).getTime() - Date.now();
  if (remaining <= 0) {
    await deleteSession(id);
    return null;
  }
  // Sliding session — mirrors the Postgres store: activity keeps you signed
  // in, renewed at the halfway mark so the write stays rare.
  if (remaining < SESSION_RENEW_BELOW_MS) {
    found.expiresAt = new Date(Date.now() + SESSION_TTL_MS).toISOString();
    persist();
  }
  return found;
}

export async function deleteSession(id: string): Promise<void> {
  const d = data();
  const i = d.sessions.findIndex((s) => s.id === id);
  if (i === -1) return;
  d.sessions.splice(i, 1);
  persist();
}

export async function deleteSessionsForUser(userId: string): Promise<void> {
  const d = data();
  const keep = d.sessions.filter((s) => s.userId !== userId);
  if (keep.length === d.sessions.length) return;
  d.sessions = keep;
  persist();
}

/** Provider ids (either cadre) holding at least one live session. */
export async function signedInDoctorIds(): Promise<string[]> {
  const now = Date.now();
  return Array.from(
    new Set(
      data()
        // Both cadres count — a nurse's session carries role 'nurse', and
        // filtering on 'doctor' alone would render every nurse permanently
        // offline. Mirrors Postgres.
        .sessions.filter(
          (s) =>
            (s.role === "doctor" || s.role === "nurse") &&
            new Date(s.expiresAt).getTime() > now,
        )
        .map((s) => s.userId),
    ),
  );
}

/** Record that a doctor's cockpit is still open. The heartbeat. */
export async function touchDoctor(doctorId: string): Promise<void> {
  const doc = data().doctors.find((d) => d.id === doctorId);
  if (!doc) return;
  doc.lastSeen = now();
  persist();
}

export async function purgeExpiredSessions(): Promise<void> {
  const d = data();
  const now = Date.now();
  const keep = d.sessions.filter((s) => new Date(s.expiresAt).getTime() > now);
  if (keep.length === d.sessions.length) return;
  d.sessions = keep;
  persist();
}

// ── Auth ─────────────────────────────────────────────────────
/** The account behind a session id — see the note in the Postgres repo. */
export async function findUserById(id: string): Promise<UserRecord | null> {
  const u = data().users.find((x) => x.id === id);
  return u ? { id: u.id, email: u.email, passwordHash: u.passwordHash, role: u.role, name: u.name } : null;
}

export async function findUserByEmail(email: string): Promise<UserRecord | null> {
  const u = data().users.find((x) => x.email === email.toLowerCase());
  return u ? { id: u.id, email: u.email, passwordHash: u.passwordHash, role: u.role, name: u.name } : null;
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
  data().pendingSignups.push(row);
  persist();
  return row;
}

export async function getPendingSignup(id: string): Promise<PendingSignup | null> {
  if (!id) return null;
  const found = data().pendingSignups.find((p) => p.id === id);
  if (!found) return null;
  if (new Date(found.expiresAt).getTime() <= Date.now()) {
    await deletePendingSignup(id);
    return null;
  }
  return found;
}

export async function deletePendingSignup(id: string): Promise<void> {
  const d = data();
  const i = d.pendingSignups.findIndex((p) => p.id === id);
  if (i === -1) return;
  d.pendingSignups.splice(i, 1);
  persist();
}

// ── Google sign-in ───────────────────────────────────────────
export async function findUserByGoogleId(googleId: string): Promise<UserRecord | null> {
  if (!googleId) return null;
  const u = data().users.find((x) => x.googleId === googleId);
  return u ? { id: u.id, email: u.email, passwordHash: u.passwordHash, role: u.role, name: u.name } : null;
}

/** Attach a Google identity to an existing account (verified addresses only). */
export async function linkGoogleAccount(
  userId: string,
  googleId: string,
  avatarUrl?: string,
): Promise<void> {
  const u = data().users.find((x) => x.id === userId);
  if (!u) return;
  u.googleId = googleId;
  if (avatarUrl) u.avatarUrl = avatarUrl;
  persist();
}

/**
 * The store's own uniqueness gate, mirroring Postgres's UNIQUE(email): one
 * email is one account, whatever its role. Throws with the same error code pg
 * raises (23505) so the register route's duplicate handling is backend-agnostic.
 */
function assertEmailFree(email: string): void {
  if (data().users.some((x) => x.email === email.toLowerCase())) {
    const err = new Error(`duplicate email: ${email}`) as Error & { code: string };
    err.code = "23505";
    throw err;
  }
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
  assertEmailFree(input.email);
  const u: StoredUser = {
    id: uid("patient"),
    email: input.email.toLowerCase(),
    passwordHash: input.passwordHash,
    googleId: input.googleId,
    avatarUrl: input.avatarUrl,
    role: "patient",
    name: input.name,
    address: input.address,
    // Undefined, not the city centre — parity with the Postgres repo. Stamping
    // MAP_CENTER here made every new account look like it was standing in
    // Nagpur, and nothing downstream could tell that from a real fix.
    lat: undefined,
    lng: undefined,
  };
  data().users.push(u);
  persist();
  return { id: u.id, email: u.email, passwordHash: u.passwordHash, role: u.role, name: u.name };
}

/**
 * Create a provider account — a doctor or a nurse. Mirrors Postgres:
 * both cadres get a `users` login AND a `doctors` registry row, which is what
 * puts a nurse on the map, in the request pool, on a trip and in the ledger.
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
  assertEmailFree(input.email);
  const isNurseCadre = input.cadre === "nurse";
  const id = uid(isNurseCadre ? "nurse" : "doc");
  // Only doctors carry the honorific — see the note in lib/postgres/repo.ts.
  const fullName = isNurseCadre
    ? input.fullName.trim().slice(0, 100) || "Nurse"
    : input.fullName.startsWith("Dr.")
      ? input.fullName
      : `Dr. ${input.fullName}`;
  const user: StoredUser = {
    id,
    email: input.email.toLowerCase(),
    passwordHash: input.passwordHash,
    googleId: input.googleId,
    avatarUrl: input.avatarUrl,
    role: input.cadre,
    name: fullName,
    createdAt: now(),
  };
  const d = data();
  const doctor: Doctor = {
    id,
    fullName,
    specialty: input.specialty,
    cadre: input.cadre,
    skills: input.skills ?? [],
    kind: input.kind === "resident" ? "resident" : "practising",
    gender: input.gender === "male" ? "male" : "female",
    age: input.age,
    experienceYears: Number(input.experienceYears) || 0,
    languages: input.languages?.length ? input.languages : ["English", "Hindi"],
    qualifications: input.qualifications,
    education: input.education,
    registrationNo: input.registrationNo,
    about: input.about,
    avatarUrl: input.avatarUrl,
    // ALWAYS offline to begin with. Being online is a promise to answer a
    // patient right now, and a new account has made no such promise. Mirrors
    // Postgres.
    status: "offline",
    verified: false,
    rating: 0,
    consultFee: Number(input.consultFee) || 0,
    homeVisitFee: Number(input.homeVisitFee) || 0,
    clinicAddress: input.clinicAddress?.trim() || "",
    avatarColor: AVATAR_COLORS[d.doctors.length % AVATAR_COLORS.length],
    lat: input.lat ?? MAP_CENTER.lat + (Math.random() - 0.5) * 0.02,
    lng: input.lng ?? MAP_CENTER.lng + (Math.random() - 0.5) * 0.02,
    lastSeen: now(),
    createdAt: now(),
  };
  d.users.push(user);
  d.doctors.unshift(doctor);
  persist();
  return {
    user: { id, email: user.email, passwordHash: user.passwordHash, role: input.cadre, name: fullName },
    doctor,
  };
}

/** Doctor sign-up. Thin wrapper so existing call sites are untouched. */
export async function createDoctorUser(
  input: Omit<Parameters<typeof createProviderUser>[0], "cadre">,
): Promise<{ user: UserRecord; doctor: Doctor }> {
  return createProviderUser({ ...input, cadre: "doctor" });
}

/**
 * Nurse sign-up. The nursing profile maps onto the provider columns rather
 * than a JSONB blob, so nurses are searchable exactly as doctors are.
 * Mirrors Postgres.
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
    kind: "practising",
    gender: input.gender === "male" ? "male" : "female",
    age: input.age,
    experienceYears: Number(input.experienceYears) || 0,
    languages: input.languages,
    skills: input.skills,
    qualifications: input.qualifications,
    registrationNo: input.registrationNo,
    about: input.about,
    consultFee: 0,
    homeVisitFee: Number(input.homeVisitFee) || 0,
    lat: input.lat,
    lng: input.lng,
  });
}

export async function getPatientProfile(id: string) {
  const u = data().users.find((x) => x.id === id);
  if (!u) return null;
  return {
    id: u.id,
    name: u.name,
    address: u.address ?? "",
    addressFull: u.addressFull ?? "",
    // Null stays null; see the note in lib/postgres/repo.ts. `located` is the
    // only thing that may be trusted to mean "this is where they are".
    lat: typeof u.lat === "number" ? u.lat : null,
    lng: typeof u.lng === "number" ? u.lng : null,
    located: typeof u.lat === "number" && typeof u.lng === "number",
    avatarUrl: u.avatarUrl,
    healthProfile: u.healthProfile,
  };
}

/**
 * Save where the patient IS RIGHT NOW. Called whenever the device reports a
 * meaningfully different position, so every later booking / SOS carries the
 * current address rather than the one typed at sign-up. Mirrors Postgres.
 */
export async function setPatientLocation(
  id: string,
  loc: { lat: number; lng: number; address?: string; addressFull?: string },
): Promise<void> {
  const d = data();
  const u = d.users.find((x) => x.id === id && x.role === "patient");
  if (!u) return;
  u.lat = loc.lat;
  u.lng = loc.lng;
  // An empty reverse-geocode must not erase a good address — only a real
  // string replaces what is stored.
  if (loc.address) u.address = loc.address.slice(0, 200);
  if (loc.addressFull) u.addressFull = loc.addressFull.slice(0, 200);
  persist();
}

/**
 * Save the patient's health profile. The route sanitizes; this writes — and
 * when the weight changed, it also APPENDS to the vitals log (mirroring
 * Postgres), so weight becomes a trend rather than a snapshot.
 */
export async function setPatientHealthProfile(
  id: string,
  profile: HealthProfile,
): Promise<void> {
  const d = data();
  const u = d.users.find((x) => x.id === id && x.role === "patient");
  if (!u) return;
  const prevWeight = u.healthProfile?.weightKg;
  u.healthProfile = profile;
  if (profile.weightKg !== undefined && profile.weightKg !== prevWeight) {
    (d.vitals ??= []).push({
      id: uid("vital"),
      patientId: id,
      kind: "weight",
      value: profile.weightKg,
      recordedAt: now(),
    });
  }
  persist();
}

// ── Symptom-checker chat history (mirrors the Postgres JSONB blob) ──
export async function getChatHistory(patientId: string): Promise<unknown[]> {
  const u = data().users.find((x) => x.id === patientId && x.role === "patient");
  return Array.isArray(u?.chatHistory) ? u!.chatHistory! : [];
}

export async function setChatHistory(
  patientId: string,
  sessions: unknown[],
): Promise<void> {
  const d = data();
  const u = d.users.find((x) => x.id === patientId && x.role === "patient");
  if (!u) return;
  u.chatHistory = sessions as typeof u.chatHistory;
  persist();
}

/** Recent weight measurements, newest first — the doctor brief's trend line. */
export async function getWeightHistory(
  patientId: string,
  limit = 10,
): Promise<{ value: number; recordedAt: string }[]> {
  return (data().vitals ?? [])
    .filter((v) => v.patientId === patientId && v.kind === "weight")
    .sort((a, b) => b.recordedAt.localeCompare(a.recordedAt))
    .slice(0, limit)
    .map((v) => ({ value: v.value, recordedAt: v.recordedAt }));
}

/**
 * Everything a doctor may read about a patient whose consult they ACCEPTED.
 * Mirrors the Postgres brief; authorization stays in the route.
 */
export async function getPatientBrief(patientId: string) {
  const u = data().users.find((x) => x.id === patientId && x.role === "patient");
  if (!u) return null;
  return {
    id: u.id,
    name: u.name,
    address: u.address ?? "",
    avatarUrl: u.avatarUrl,
    rating: u.rating,
    ratingCount: u.ratingCount,
    healthProfile: u.healthProfile,
    memberSince: u.createdAt ?? "",
  };
}

/** Mirrors the Postgres repo's wake-up ping; the file store is always warm. */
export async function ping(): Promise<void> {}

/**
 * The one write for profile photos, both roles. Mirrors Postgres: the photo
 * lives on the user (the account) AND, for a doctor, on the doctor row every
 * patient-facing read goes through.
 */
export async function setUserAvatar(
  userId: string,
  role: UserRecord["role"],
  dataUrl: string,
): Promise<void> {
  const d = data();
  const u = d.users.find((x) => x.id === userId);
  if (u) u.avatarUrl = dataUrl;
  // Both provider cadres carry the photo on their registry row too. Mirrors
  // Postgres — see the note there.
  if (role === "doctor" || role === "nurse") {
    const doc = d.doctors.find((x) => x.id === userId);
    if (doc) doc.avatarUrl = dataUrl;
  }
  persist();
}

export async function getDoctorById(id: string): Promise<Doctor | null> {
  return data().doctors.find((x) => x.id === id) ?? null;
}

/**
 * Complete ops view of one doctor — the file-store twin of the Postgres
 * getDoctorDetail. Ops-only: carries the account email and exact coordinates.
 */
export async function getDoctorDetail(id: string): Promise<DoctorDetail | null> {
  const d = data();
  const doctor = d.doctors.find((x) => x.id === id);
  if (!doctor) return null;

  // A registered doctor's id IS their user id; seeded catalog doctors have no
  // account row, and `account` stays null for them.
  const u = d.users.find((x) => x.id === id && x.role === "doctor");
  const nowMs = Date.now();

  return {
    doctor,
    account: u
      ? {
          email: u.email,
          createdAt: u.createdAt ?? doctor.createdAt ?? doctor.lastSeen,
          googleLinked: Boolean(u.googleId),
          hasPassword: Boolean(u.passwordHash),
          address: u.address,
          avatarUrl: u.avatarUrl,
        }
      : null,
    reviews: await getReviews(id),
    requests: d.requests.filter((r) => r.doctorId === id),
    gigs: d.gigs.filter((g) => g.doctorId === id),
    transactions: d.transactions.filter((t) => t.doctorId === id),
    activeSessions: d.sessions.filter(
      (s) => s.userId === id && Date.parse(s.expiresAt) > nowMs,
    ).length,
  };
}

/**
 * Ops removes a doctor. Same policy as the Postgres store: the profile, gig
 * shelf, reviews and account go (sessions with them, so every signed-in device
 * is logged out); consult history and the money ledger stay. Refuses while a
 * consult is live rather than stranding a patient mid-visit.
 */
export async function deleteDoctor(id: string): Promise<DoctorDeletion> {
  const d = data();
  const doctor = d.doctors.find((x) => x.id === id);
  if (!doctor) throw new DomainError("That doctor no longer exists.");

  if (d.requests.some((r) => r.doctorId === id && r.status === "accepted"))
    throw new DomainError(
      "This doctor is mid-consult. Wait for it to finish or cancel it first.",
    );

  const keptRequests = d.requests.filter((r) => r.doctorId === id).length;
  const keptTransactions = d.transactions.filter((t) => t.doctorId === id).length;
  const removedGigs = d.gigs.filter((g) => g.doctorId === id).length;
  const removedReviews = d.reviews.filter((v) => v.doctorId === id).length;
  const hadAccount = d.users.some((x) => x.id === id && x.role === "doctor");

  d.gigs = d.gigs.filter((g) => g.doctorId !== id);
  d.reviews = d.reviews.filter((v) => v.doctorId !== id);
  d.doctors = d.doctors.filter((x) => x.id !== id);
  d.sessions = d.sessions.filter((s) => s.userId !== id);
  d.users = d.users.filter((x) => !(x.id === id && x.role === "doctor"));
  persist();

  return {
    doctorId: id,
    fullName: doctor.fullName,
    removedAccount: hadAccount,
    removedGigs,
    removedReviews,
    keptRequests,
    keptTransactions,
  };
}

// ── Reads ────────────────────────────────────────────────────
export async function getDoctors(near?: Near): Promise<Doctor[]> {
  let out = withinNear(data().doctors, near);
  if (near) out = [...out].sort((a, b) => km(a, near) - km(b, near));
  return out.map((d) => ({ ...d }));
}
export async function getAmbulances(): Promise<Ambulance[]> {
  return data().ambulances.map((a) => ({ ...a }));
}
export async function getRequests(near?: Near): Promise<ConsultRequest[]> {
  const d = data();
  return withinNear(d.requests, near).map((r) => {
    const patient = r.patientId ? d.users.find((u) => u.id === r.patientId) : undefined;
    return {
      ...r,
      // Rows written before scheduling existed carry no mode — settle it
      // here so nothing downstream has to guess.
      mode: bookingModeOf(r),
      scheduledAt: r.scheduledAt ?? null,
      scheduledEnd: r.scheduledEnd ?? null,
      // Same for the gig and dispatch fields: rows predating them must read as
      // "not a gig, not a broadcast, nobody has passed" rather than undefined.
      gigId: r.gigId ?? null,
      gigTitle: r.gigTitle ?? null,
      broadcast: r.broadcast ?? false,
      tripStage: r.tripStage ?? null,
      passedBy: r.passedBy ?? [],
      patientRating: patient?.rating ?? null,
      patientRatingCount: patient?.ratingCount ?? 0,
      patientRated: d.patientReviews.some((v) => v.requestId === r.id),
      reviewed: d.reviews.some((v) => v.requestId === r.id),
    };
  });
}
export async function getSosEvents(near?: Near): Promise<SosEvent[]> {
  return withinNear(data().sos, near).map((s) => ({ ...s }));
}
export async function getOrders(): Promise<Order[]> {
  return data().orders.map((o) => ({ ...o }));
}
export async function getReviews(doctorId?: string): Promise<Review[]> {
  const rows = doctorId ? data().reviews.filter((v) => v.doctorId === doctorId) : data().reviews;
  return rows.map((v) => ({ id: v.id, patientName: v.patientName, rating: v.rating, comment: v.comment, createdAt: v.createdAt }));
}
export async function getSosById(id: string): Promise<SosEvent | null> {
  return data().sos.find((s) => s.id === id) ?? null;
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
  const d = data();
  const nearestFree = [...d.ambulances]
    .filter((a) => a.status === "free")
    .sort((a, b) => km(a, input) - km(b, input))[0];
  const event = {
    id: uid("sos"),
    patientId: input.patientId,
    patientName: input.patientName,
    category: input.category as SosEvent["category"],
    status: "open" as const,
    address: input.address,
    lat: input.lat,
    lng: input.lng,
    ambulanceId: null,
    doctorId: null,
    notes: input.notes ?? "Patient-triggered SOS.",
    createdAt: now(),
    resolvedAt: null,
    ...(nearestFree ? { suggestedAmbulanceId: nearestFree.id } : {}),
  } as SosEvent;
  d.sos.unshift(event);
  persist();
  return event;
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
   *  own cadre wins. Mirrors Postgres. */
  targetCadre?: string;
}): Promise<ConsultRequest> {
  const d = data();
  const doctorId = input.doctorId ?? null;
  const mode = coerceBookingMode(input.mode);
  // A named provider settles the cadre themselves, so a request can never be
  // addressed to one inbox and tagged for another.
  const named = doctorId ? d.doctors.find((x) => x.id === doctorId) : undefined;
  const targetCadre: Cadre = named
    ? named.cadre === "nurse"
      ? "nurse"
      : "doctor"
    : input.targetCadre === "nurse"
      ? "nurse"
      : "doctor";

  // Resolve the slot or the gig terms and insert with no `await` in between:
  // on the single Node process behind the file store that makes
  // check-then-write atomic, so two patients racing cannot both win.
  let slot: ResolvedSlot | null = null;
  let hire: ResolvedHire | null = null;
  if (mode === "scheduled") {
    if (!doctorId) throw new DomainError("Pick a doctor before choosing a time.");
    slot = resolveScheduledSlot({
      doctor: d.doctors.find((x) => x.id === doctorId),
      startIso: String(input.scheduledAt ?? ""),
      existing: d.requests,
    });
  } else if (mode === "gig") {
    if (!doctorId) throw new DomainError("Pick a doctor before hiring a gig.");
    hire = assertCanHire({
      gig: d.gigs.find((g) => g.id === input.gigId),
      doctor: d.doctors.find((x) => x.id === doctorId),
      existing: d.requests,
    });
  }

  const req: ConsultRequest = {
    id: uid("req"),
    patientId: input.patientId,
    patientName: input.patientName,
    // A gig's visit type comes off the listing, not the request body.
    type: (hire?.type ?? input.type) as ConsultRequest["type"],
    status: "pending",
    symptoms: input.symptoms,
    paymentMethod: input.paymentMethod === "cash" ? "cash" : "online",
    // Same for the price — the client's fee is ignored for a gig hire.
    fee: hire ? hire.fee : Number(input.fee) || 0,
    address: input.address,
    lat: input.lat,
    lng: input.lng,
    createdAt: now(),
    mode,
    targetCadre,
    gigId: hire?.gigId ?? null,
    gigTitle: hire?.gigTitle ?? null,
    // An urgent request with no named doctor went to the whole pool. Recorded
    // now because it decides whether a later cancellation re-offers it.
    broadcast: mode === "emergency" && doctorId === null,
    scheduledAt: slot?.scheduledAt ?? null,
    scheduledEnd: slot?.scheduledEnd ?? null,
    slotMinutes: slot?.slotMinutes ?? hire?.durationMinutes ?? null,
    tripStage: null,
    tripStageAt: null,
    passedBy: [],
    doctorId,
  };
  d.requests.unshift(req);
  persist();
  return req;
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
  let total = 0;
  const items = input.items.map((it) => {
    const cat = MED_CATALOG.find((m) => m.name === it.name);
    if (!cat) throw new DomainError(`Unknown item: ${String(it.name).slice(0, 60)}`);
    const qty = Math.min(20, Math.max(1, Math.round(Number(it.qty) || 1)));
    total += cat.price * qty;
    return { name: cat.name, qty };
  });
  const order: Order = {
    id: uid("ord"),
    patientId: input.patientId,
    patientName: input.patientName,
    status: "placed",
    items,
    total,
    address: input.address,
    darkStore: input.darkStore,
    etaMins: 10,
    createdAt: now(),
    prescriptionId: input.prescriptionId ?? null,
  };
  data().orders.unshift(order);
  persist();
  return order;
}

export async function createReview(input: {
  patientId: string;
  patientName: string;
  doctorId: string;
  requestId: string;
  rating: number;
  comment: string;
}): Promise<Review> {
  const d = data();
  const req = d.requests.find((r) => r.id === input.requestId);
  const already = d.reviews.some((v) => v.requestId === input.requestId);
  if (!req || req.status !== "completed" || req.patientId !== input.patientId || req.doctorId !== input.doctorId || already) {
    throw new DomainError("You can only review a consult you completed, once.", 409);
  }
  const rating = Math.min(5, Math.max(1, Math.round(Number(input.rating) || 0)));
  const review = {
    id: uid("rev"),
    requestId: input.requestId,
    doctorId: input.doctorId,
    patientName: input.patientName,
    rating,
    comment: String(input.comment ?? "").slice(0, 600),
    createdAt: now(),
  };
  d.reviews.unshift(review);
  const mine = d.reviews.filter((v) => v.doctorId === input.doctorId);
  const avg = mine.reduce((a, v) => a + v.rating, 0) / Math.max(1, mine.length);
  const doc = d.doctors.find((x) => x.id === input.doctorId);
  if (doc) doc.rating = Math.round(avg * 10) / 10;
  persist();
  return { id: review.id, patientName: review.patientName, rating: review.rating, comment: review.comment, createdAt: review.createdAt };
}

/** Doctor → patient rating after a completed consult (mutual ratings).
 *  One rating per completed request, by its own doctor. Refreshes the
 *  patient's aggregate rating on their user record. */
export async function ratePatient(input: {
  doctorId: string;
  doctorName: string;
  requestId: string;
  rating: number;
  comment: string;
}): Promise<void> {
  const d = data();
  const req = d.requests.find((r) => r.id === input.requestId);
  const already = d.patientReviews.some((v) => v.requestId === input.requestId);
  if (!req || req.status !== "completed" || req.doctorId !== input.doctorId || !req.patientId || already) {
    throw new DomainError("You can only rate a patient from a consult you completed, once.", 409);
  }
  const rating = Math.min(5, Math.max(1, Math.round(Number(input.rating) || 0)));
  d.patientReviews.unshift({
    id: uid("prev"),
    requestId: input.requestId,
    patientId: req.patientId,
    doctorId: input.doctorId,
    doctorName: input.doctorName,
    rating,
    comment: String(input.comment ?? "").slice(0, 600),
    createdAt: now(),
  });
  const mine = d.patientReviews.filter((v) => v.patientId === req.patientId);
  const avg = mine.reduce((a, v) => a + v.rating, 0) / Math.max(1, mine.length);
  const patient = d.users.find((u) => u.id === req.patientId);
  if (patient) {
    patient.rating = Math.round(avg * 10) / 10;
    patient.ratingCount = mine.length;
  }
  persist();
}

// ── Doctor mutations ─────────────────────────────────────────
export async function setDoctorStatus(id: string, status: string) {
  const doc = data().doctors.find((x) => x.id === id);
  if (doc) {
    doc.status = status as Doctor["status"];
    doc.lastSeen = now();
    persist();
  }
}

export async function updateDoctor(
  id: string,
  patch: {
    fullName?: string;
    specialty?: string;
    /** A nurse's home-care services. Mirrors Postgres — see the note there. */
    skills?: string[];
    consultFee?: number;
    homeVisitFee?: number;
    age?: number;
    experienceYears?: number;
    languages?: string[];
    qualifications?: string;
    education?: string;
    about?: string;
    registrationNo?: string;
    clinicAddress?: string;
    lat?: number;
    lng?: number;
  },
) {
  const doc = data().doctors.find((x) => x.id === id);
  if (!doc) return;
  if (patch.fullName !== undefined) doc.fullName = patch.fullName;
  if (patch.specialty !== undefined) doc.specialty = patch.specialty;
  // Emptying is allowed (re-picking services); only the shape is enforced.
  if (Array.isArray(patch.skills)) doc.skills = patch.skills;
  if (patch.consultFee !== undefined) doc.consultFee = patch.consultFee;
  if (patch.homeVisitFee !== undefined) doc.homeVisitFee = patch.homeVisitFee;
  if (patch.age !== undefined) doc.age = patch.age;
  if (patch.experienceYears !== undefined) doc.experienceYears = patch.experienceYears;
  if (Array.isArray(patch.languages) && patch.languages.length > 0)
    doc.languages = patch.languages;
  if (patch.qualifications !== undefined) doc.qualifications = patch.qualifications;
  if (patch.education !== undefined) doc.education = patch.education;
  if (patch.about !== undefined) doc.about = patch.about;
  if (patch.registrationNo !== undefined) doc.registrationNo = patch.registrationNo;
  if (patch.clinicAddress !== undefined) doc.clinicAddress = patch.clinicAddress;
  if (typeof patch.lat === "number") doc.lat = patch.lat;
  if (typeof patch.lng === "number") doc.lng = patch.lng;
  doc.lastSeen = now();
  persist();
}

/**
 * Ops decision on a provider's credentials. Mirrors Postgres — and, like it,
 * deliberately sits outside updateDoctor so a provider can never mark
 * themselves trusted.
 */
export async function verifyProvider(id: string, verified: boolean): Promise<boolean> {
  const d = data().doctors.find((x) => x.id === id);
  if (!d) return false;
  d.verified = verified;
  persist();
  return true;
}

export async function acceptRequest(id: string, doctorId: string): Promise<boolean> {
  const d = data();
  const req = d.requests.find((r) => r.id === id);
  if (!req || req.status !== "pending") return false;
  // Emergencies stay one-at-a-time; an appointment may be confirmed during a
  // live consult but never on top of another appointment. Throws a 409 with
  // the reason, so the doctor sees why rather than a silent no-op.
  assertCanAccept(req, d.requests, doctorId);
  req.status = "accepted";
  req.doctorId = doctorId;
  req.acceptedAt = now();
  // The trip rail starts the moment someone claims it.
  req.tripStage = "accepted";
  req.tripStageAt = req.acceptedAt;
  // Mint the arrival code: from here the patient's app can show the digits.
  req.startCode = newStartCode();
  req.startCodeAttempts = 0;
  // A hired gig leaves the shelf the moment it's accepted: the doctor is
  // committed to this one, so the listing pauses itself instead of inviting
  // a second booking on the same package. Resume it from the shelf later.
  if (req.gigId) {
    const gig = d.gigs.find((g) => g.id === req.gigId && g.doctorId === doctorId);
    if (gig && gig.status === "active") {
      gig.status = "paused";
      gig.updatedAt = now();
    }
  }
  persist();
  return true;
}

export async function declineRequest(id: string, doctorId?: string, reason?: string) {
  const req = data().requests.find((r) => r.id === id);
  if (!req) return;
  // Declining frees a booked slot and can unblock a doctor's urgent feed, so
  // it has to be theirs to decline: a claimed request, or one still open to
  // them. `doctorId` is optional only for ops/legacy callers.
  if (doctorId && !claimableBy(req, doctorId)) {
    throw new DomainError("That request isn't yours to decline.", 403);
  }
  // Passing on a request that was never directed at THIS doctor must not kill
  // it for everyone else — the patient asked the network, not this doctor.
  // Keeps parity with the Postgres repo; see the longer note there on why the
  // test is "is it mine?" rather than "is the broadcast flag set?".
  if (doctorId && req.status === "pending" && req.doctorId !== doctorId) {
    req.passedBy = [...new Set([...(req.passedBy ?? []), doctorId])];
    persist();
    return;
  }
  req.status = "declined";
  if (reason) req.cancelReason = reason;
  persist();
}

/** A request this doctor may act on: theirs, unassigned, or a seed row. */
function claimableBy(req: ConsultRequest, doctorId: string): boolean {
  return (
    req.doctorId === doctorId ||
    (req.status === "pending" &&
      (req.doctorId === null || Boolean(req.doctorId?.startsWith("doc-seed-"))))
  );
}

/** Patient or doctor calls off a booking — this is what frees the slot. */
export async function cancelRequest(
  id: string,
  actor: { id: string; role: string },
  opts?: { reason?: string },
) {
  const d = data();
  const req = d.requests.find((r) => r.id === id);
  assertCanCancel(req, actor, opts);
  const reason = opts?.reason?.trim().slice(0, CANCEL_REASON_MAX) || null;

  // A doctor standing down from a BROADCAST puts it back out to the pool: the
  // patient asked the network, so someone else can still take it. They're
  // recorded as having passed so it doesn't bounce straight back to them.
  if (actor.role === "doctor" && reopensOnDoctorCancel(req)) {
    req.passedBy = [...new Set([...(req.passedBy ?? []), actor.id])];
    req.status = "pending";
    req.doctorId = null;
    req.acceptedAt = null;
    req.tripStage = null;
    req.tripStageAt = null;
    req.cancelReason = reason;
    persist();
    return;
  }

  req.status = "cancelled";
  req.cancelledAt = now();
  req.cancelledBy = actor.role === "doctor" ? "doctor" : "patient";
  req.cancelReason = reason;
  persist();
}

export async function setDoctorAvailability(id: string, availability: DoctorAvailability) {
  const doc = data().doctors.find((x) => x.id === id);
  if (!doc) throw new DomainError("That doctor no longer exists.", 404);
  doc.availability = availability;
  doc.lastSeen = now();
  persist();
}

// ── Gigs ─────────────────────────────────────────────────────

/**
 * Gig listings, newest first. `doctorId` narrows to one doctor's shelf; the
 * caller (/api/data) decides which statuses that role may see — the repo
 * returns everything so a doctor can manage their own paused rows.
 */
export async function getGigs(doctorId?: string): Promise<Gig[]> {
  const rows = doctorId
    ? data().gigs.filter((g) => g.doctorId === doctorId)
    : [...data().gigs];
  return rows.sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
}

export async function getGigById(id: string): Promise<Gig | null> {
  return data().gigs.find((g) => g.id === id) ?? null;
}

/** A gig this doctor owns, or a 403/404 explaining why not. */
function ownGig(id: string, doctorId: string): Gig {
  const gig = data().gigs.find((g) => g.id === id);
  if (!gig) throw new DomainError("That gig no longer exists.", 404);
  if (gig.doctorId !== doctorId) throw new DomainError("That isn't your gig.", 403);
  return gig;
}

const liveGigCount = (doctorId: string, exceptId?: string) =>
  data().gigs.filter(
    (g) => g.doctorId === doctorId && g.status === "active" && g.id !== exceptId,
  ).length;

export async function createGig(input: {
  doctorId: string;
  title: string;
  description: string;
  type: string;
  price: number;
  durationMinutes: number;
}): Promise<Gig> {
  const d = data();
  if (!d.doctors.some((x) => x.id === input.doctorId)) {
    throw new DomainError("That doctor no longer exists.", 404);
  }
  if (liveGigCount(input.doctorId) >= MAX_ACTIVE_GIGS) {
    throw new DomainError(
      `You can have ${MAX_ACTIVE_GIGS} live gigs at once. Pause one first.`,
      409,
    );
  }
  const gig = normalizeGig(input, {
    id: uid("gig"),
    doctorId: input.doctorId,
    createdAt: now(),
  });
  if (!gig.title) throw new DomainError("Give the gig a title.", 400);
  if (gig.price <= 0) throw new DomainError("Set a price for the gig.", 400);
  d.gigs.unshift(gig);
  persist();
  return gig;
}

export async function updateGig(id: string, doctorId: string, patch: unknown) {
  const gig = ownGig(id, doctorId);
  const clean = sanitizeGigPatch(patch);
  // Re-publishing counts against the cap the same as creating.
  if (clean.status === "active" && gig.status !== "active") {
    if (liveGigCount(doctorId, id) >= MAX_ACTIVE_GIGS) {
      throw new DomainError(
        `You can have ${MAX_ACTIVE_GIGS} live gigs at once. Pause one first.`,
        409,
      );
    }
  }
  Object.assign(gig, clean, { updatedAt: now() });
  persist();
}

/**
 * Publish, pause or retire a listing.
 *
 * Deliberately does NOT touch hires already made against it: a patient who
 * asked yesterday still gets their answer, and the request carries its own
 * `gigTitle` snapshot so it stays readable once the listing is gone.
 */
export async function setGigStatus(id: string, doctorId: string, status: GigStatus) {
  const gig = ownGig(id, doctorId);
  if (status === "active" && gig.status !== "active" && liveGigCount(doctorId, id) >= MAX_ACTIVE_GIGS) {
    throw new DomainError(
      `You can have ${MAX_ACTIVE_GIGS} live gigs at once. Pause one first.`,
      409,
    );
  }
  gig.status = status;
  gig.updatedAt = now();
  persist();
}

/**
 * Remove a listing for good.
 *
 * Unlike archiving, this leaves nothing on the shelf. Hires already ANSWERED
 * against it survive: a request snapshots `gigTitle` at hire time, so past
 * visits stay readable. What is refused is deleting a gig somebody is still
 * waiting on — the doctor owes that patient an answer or a visit.
 */
export async function deleteGig(id: string, doctorId: string): Promise<void> {
  const d = data();
  const gig = ownGig(id, doctorId);
  const owed = d.requests.some(
    (r) => r.gigId === gig.id && (r.status === "pending" || r.status === "accepted"),
  );
  if (owed) {
    throw new DomainError(
      "Someone is still waiting on this gig. Answer or finish that hire first.",
      409,
    );
  }
  d.gigs = d.gigs.filter((g) => g.id !== id);
  persist();
}

/**
 * Move a visit one step along its rail. Returns the new stage, or null when
 * there is nowhere left to go (the doctor should complete it instead).
 */
export async function advanceTrip(id: string, doctorId: string): Promise<string | null> {
  const req = data().requests.find((r) => r.id === id);
  if (!req) throw new DomainError("That visit no longer exists.", 404);
  if (req.doctorId !== doctorId) throw new DomainError("That isn't your visit.", 403);
  if (req.status !== "accepted") {
    throw new DomainError("That visit isn't in progress.", 409);
  }
  const next = nextTripStage(req);
  if (!next) return null;
  // `in_progress` is NOT walkable: it is reached only by the arrival code
  // (or the patient starting it themselves). Mirrors the Postgres guard.
  if (next === "in_progress") return null;
  req.tripStage = next;
  req.tripStageAt = now();
  persist();
  return next;
}

/**
 * The handshake — the doctor submits what the patient read out. Returns why
 * it failed rather than throwing, so the cockpit can show tries remaining.
 * Mirrors the Postgres implementation exactly.
 */
export async function verifyStartCode(
  id: string,
  doctorId: string,
  code: string,
): Promise<{ ok: true } | { ok: false; reason: "locked" | "wrong"; attemptsLeft: number }> {
  const req = data().requests.find((r) => r.id === id);
  if (!req) throw new DomainError("That visit no longer exists.", 404);
  if (req.doctorId !== doctorId) throw new DomainError("That isn't your visit.", 403);
  if (req.status !== "accepted") throw new DomainError("That visit isn't in progress.", 409);
  if (req.tripStage === "in_progress") return { ok: true };

  const attempts = req.startCodeAttempts ?? 0;
  if (attempts >= MAX_START_CODE_ATTEMPTS) {
    return { ok: false, reason: "locked", attemptsLeft: 0 };
  }
  // A row accepted before this feature shipped has no code; mint one now so
  // the visit isn't stranded.
  if (!req.startCode) req.startCode = newStartCode();

  if (code !== req.startCode) {
    req.startCodeAttempts = attempts + 1;
    persist();
    return {
      ok: false,
      reason: "wrong",
      attemptsLeft: Math.max(0, MAX_START_CODE_ATTEMPTS - req.startCodeAttempts),
    };
  }
  req.tripStage = "in_progress";
  req.tripStageAt = now();
  req.startedAt = req.tripStageAt;
  persist();
  return { ok: true };
}

/** Start from the PATIENT's side — the escape hatch. Patient's own visit only. */
export async function startConsultAsPatient(id: string, patientId: string): Promise<void> {
  const req = data().requests.find((r) => r.id === id);
  if (!req) throw new DomainError("That visit no longer exists.", 404);
  if (req.patientId !== patientId) throw new DomainError("That isn't your visit.", 403);
  if (req.status !== "accepted") throw new DomainError("That visit isn't in progress.", 409);
  if (!req.doctorId) throw new DomainError("No doctor has taken this visit yet.", 409);
  if (req.tripStage === "in_progress") return;
  req.tripStage = "in_progress";
  req.tripStageAt = now();
  req.startedAt = req.tripStageAt;
  persist();
}

/** New digits, attempts reset — for a locked or forgotten code. Patient only. */
export async function reissueStartCode(id: string, patientId: string): Promise<string> {
  const req = data().requests.find((r) => r.id === id);
  if (!req) throw new DomainError("That visit no longer exists.", 404);
  if (req.patientId !== patientId) throw new DomainError("That isn't your visit.", 403);
  if (req.status !== "accepted") throw new DomainError("That visit isn't in progress.", 409);
  if (req.tripStage === "in_progress") {
    throw new DomainError("This consult has already started.", 409);
  }
  req.startCode = newStartCode();
  req.startCodeAttempts = 0;
  persist();
  return req.startCode;
}

/**
 * Close out a visit.
 *
 * Prescribing is deliberately NOT part of this: it goes through
 * issuePrescription, which completes the visit itself. One act, one entry
 * point — a consult can never end up completed with a half-written document
 * attached, and there is no second place where a prescription can be born.
 */
export async function completeRequest(
  id: string,
  opts?: { notes?: string; doctorId?: string },
) {
  const d = data();
  const req = d.requests.find((r) => r.id === id);
  if (!req || (req.status !== "accepted" && req.status !== "pending")) return;
  // Completing releases the doctor's "in a consult" state (which gates their
  // urgent feed) and credits a wallet — only the doctor on it may close it.
  if (opts?.doctorId && !claimableBy(req, opts.doctorId)) {
    throw new DomainError("That consult isn't yours to complete.", 403);
  }
  req.status = "completed";
  req.completedAt = now();
  d.consults.push({
    id: uid("con"),
    requestId: req.id,
    doctorId: req.doctorId,
    patientId: req.patientId,
    startedAt: req.createdAt,
    endedAt: now(),
    notes: opts?.notes ?? "",
  });
  // Credit the doctor's wallet once (platform commission + net).
  if (
    req.doctorId &&
    !d.transactions.some((t) => t.kind === "earning" && t.requestId === req.id)
  ) {
    const commission = Math.round(req.fee * COMMISSION_RATE);
    d.transactions.unshift({
      id: uid("txn"),
      doctorId: req.doctorId,
      kind: "earning",
      requestId: req.id,
      patientName: req.patientName,
      method: req.paymentMethod ?? "online",
      gross: req.fee,
      commission,
      net: req.fee - commission,
      createdAt: now(),
    });
  }
  persist();
}

// ── Prescriptions ────────────────────────────────────────────
/**
 * A doctor issues the prescription that closes a consult.
 *
 * This is the ONLY way a prescription comes into existence, and it completes
 * the visit as part of the same act — writing the document and finishing the
 * consult are one thing to the doctor, so they are one thing here. Issuing
 * against an already-completed visit is allowed (a doctor who marked complete
 * and then remembered the antibiotic), which is why completion is conditional
 * rather than assumed.
 *
 * Everything on the document is snapshotted from the doctor and patient rows at
 * this moment — see the Prescription type for why.
 */
export async function issuePrescription(input: {
  requestId: string;
  doctorId: string;
  draft: RxDraft;
}): Promise<Prescription> {
  const d = data();
  const req = d.requests.find((r) => r.id === input.requestId);
  if (!req) throw new DomainError("That consult no longer exists.", 404);
  if (req.doctorId !== input.doctorId)
    throw new DomainError("That consult isn't yours to prescribe for.", 403);
  if (req.status !== "accepted" && req.status !== "completed")
    throw new DomainError("You can only prescribe for a consult you are running.", 409);
  const existing = d.prescriptions.find((rx) => rx.requestId === req.id);
  if (existing) throw new DomainError("A prescription has already been issued for this consult.", 409);

  const draft = sanitizeRxDraft(input.draft);
  const doctor = d.doctors.find((x) => x.id === input.doctorId);
  const patient = req.patientId ? d.users.find((u) => u.id === req.patientId) : undefined;
  const profile = patient?.healthProfile;

  const rx: Prescription = {
    id: uid("rx"),
    code: newRxCode(),
    requestId: req.id,
    patientId: req.patientId ?? null,
    patientName: req.patientName,
    patientAge: ageFrom(profile?.dob) ?? null,
    patientGender: profile?.gender ?? null,
    patientAllergies: profile?.allergies || null,
    doctorId: input.doctorId,
    doctorName: doctor?.fullName ?? "Doceeto doctor",
    doctorSpecialty: doctor?.specialty ?? "",
    doctorQualifications: doctor?.qualifications ?? null,
    doctorRegistrationNo: doctor?.registrationNo ?? null,
    diagnosis: draft.diagnosis,
    items: draft.items,
    advice: draft.advice,
    followUpDays: draft.followUpDays,
    issuedAt: now(),
    shareToken: newShareToken(),
  };
  d.prescriptions.unshift(rx);
  persist();

  // Issuing closes the visit when it was still open. Done after the write so a
  // rejected prescription never silently ends a consult.
  if (req.status === "accepted") {
    await completeRequest(req.id, { doctorId: input.doctorId });
  }
  return rx;
}

/** Every prescription, newest first. Callers scope by patient or doctor. */
export async function getPrescriptions(): Promise<Prescription[]> {
  return [...data().prescriptions].sort((a, b) => (a.issuedAt < b.issuedAt ? 1 : -1));
}

/** One prescription by id. */
export async function getPrescriptionById(id: string): Promise<Prescription | null> {
  return data().prescriptions.find((rx) => rx.id === id) ?? null;
}

/**
 * The shared-link lookup: the ONLY read that needs no session, because the
 * token IS the credential. Nothing else about the patient is reachable from it.
 */
export async function getPrescriptionByToken(token: string): Promise<Prescription | null> {
  if (!token) return null;
  return data().prescriptions.find((rx) => rx.shareToken === token) ?? null;
}

// ── Wallet / payments ────────────────────────────────────────
export async function getTransactions(): Promise<Transaction[]> {
  return [...data().transactions].sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
}

export function walletBalanceOf(doctorId: string): number {
  return data()
    .transactions.filter((t) => t.doctorId === doctorId)
    .reduce((a, t) => a + t.net, 0);
}

/** Doctor withdraws their full wallet balance to their bank (instant). */
export async function requestPayout(doctorId: string): Promise<boolean> {
  const balance = walletBalanceOf(doctorId);
  if (balance <= 0) return false;
  data().transactions.unshift({
    id: uid("txn"),
    doctorId,
    kind: "payout",
    requestId: null,
    patientName: null,
    method: null,
    gross: 0,
    commission: 0,
    net: -balance,
    createdAt: now(),
  });
  persist();
  return true;
}

// ── Ops mutations ────────────────────────────────────────────
const SOS_FLOW = ["open", "assigned", "enroute", "resolved"];
const ORDER_FLOW = ["placed", "packed", "out_for_delivery", "delivered"];

export async function assignAmbulance(sosId: string, ambulanceId: string) {
  const d = data();
  const sos = d.sos.find((s) => s.id === sosId);
  const amb = d.ambulances.find((a) => a.id === ambulanceId);
  if (sos) {
    sos.ambulanceId = ambulanceId;
    if (sos.status === "open") sos.status = "assigned";
  }
  if (amb) amb.status = "dispatched";
  persist();
}

export async function assignDoctorToSos(sosId: string, doctorId: string) {
  const sos = data().sos.find((s) => s.id === sosId);
  if (sos) {
    sos.doctorId = doctorId;
    persist();
  }
}

export async function setSosCategory(sosId: string, category: string) {
  const sos = data().sos.find((s) => s.id === sosId);
  if (sos) {
    sos.category = category as SosEvent["category"];
    persist();
  }
}

export async function advanceSos(sosId: string) {
  const sos = data().sos.find((s) => s.id === sosId);
  if (!sos) return;
  const next = SOS_FLOW[Math.min(SOS_FLOW.indexOf(sos.status) + 1, SOS_FLOW.length - 1)];
  sos.status = next as SosEvent["status"];
  if (next === "resolved") sos.resolvedAt = now();
  persist();
}

export async function advanceOrder(orderId: string) {
  const o = data().orders.find((x) => x.id === orderId);
  if (!o) return;
  const i = ORDER_FLOW.indexOf(o.status);
  if (i < 0 || i >= ORDER_FLOW.length - 1) return;
  const next = ORDER_FLOW[i + 1];
  o.status = next as Order["status"];
  o.etaMins = next === "delivered" ? 0 : Math.max(1, o.etaMins - 3);
  persist();
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
  const amb: Ambulance = {
    id: uid("amb"),
    vehicleNo: input.vehicleNo.trim(),
    driverName: input.driverName.trim(),
    status: "free",
    lat: input.lat ?? MAP_CENTER.lat,
    lng: input.lng ?? MAP_CENTER.lng,
  };
  data().ambulances.unshift(amb);
  persist();
  return amb;
}

export async function updateAmbulance(
  id: string,
  patch: { vehicleNo?: string; driverName?: string; status?: string; lat?: number; lng?: number },
) {
  const amb = data().ambulances.find((a) => a.id === id);
  if (!amb) return;
  if (patch.vehicleNo !== undefined) amb.vehicleNo = patch.vehicleNo;
  if (patch.driverName !== undefined) amb.driverName = patch.driverName;
  if (patch.status && ["free", "dispatched", "busy"].includes(patch.status))
    amb.status = patch.status as Ambulance["status"];
  if (typeof patch.lat === "number") amb.lat = patch.lat;
  if (typeof patch.lng === "number") amb.lng = patch.lng;
  persist();
}

export async function audit(entry: { actorId: string; role: string; action: string; meta?: unknown }) {
  const d = data();
  d.audits.push({
    id: uid("aud"),
    actorId: entry.actorId,
    role: entry.role,
    action: entry.action,
    meta: JSON.stringify(entry.meta ?? {}).slice(0, 2000),
    at: now(),
  });
  if (d.audits.length > 5000) d.audits.splice(0, d.audits.length - 5000);
  persist();
}

// ── One-time setup: ensure the ops (admin) login exists ──────
export async function setup() {
  const email = (process.env.OPS_EMAIL || "ops@doceeto.health").toLowerCase();
  const d = data();
  if (d.users.some((u) => u.email === email)) return { ok: true, ops: { email, created: false } };
  const passwordHash = await hashPassword(process.env.OPS_PASSWORD || "iyashi-ops");
  d.users.push({ id: uid("ops"), email, passwordHash, role: "ops", name: "Doceeto Ops" });
  persist();
  return { ok: true, ops: { email, created: true } };
}
