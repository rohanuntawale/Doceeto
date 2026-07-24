import "server-only";
import { data, persist, type StoredUser } from "@/lib/filedb/store";
import { DomainError, type Near, type UserRecord } from "@/lib/db/shared";
import { MAP_CENTER } from "@/lib/config";
import { AVATAR_COLORS, MED_CATALOG } from "@/lib/catalog";
import { hashPassword } from "@/lib/auth/password";
import { haversineKm } from "@/lib/utils/geo";
import type {
  Ambulance,
  ConsultRequest,
  Doctor,
  Order,
  Review,
  SosEvent,
} from "@/lib/types/domain";

export { DomainError };
export type { Near, UserRecord };

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

// ── Auth ─────────────────────────────────────────────────────
export async function findUserByEmail(email: string): Promise<UserRecord | null> {
  const u = data().users.find((x) => x.email === email.toLowerCase());
  return u ? { id: u.id, email: u.email, passwordHash: u.passwordHash, role: u.role, name: u.name } : null;
}

export async function createPatientUser(input: {
  email: string;
  passwordHash: string;
  name: string;
  address: string;
}): Promise<UserRecord> {
  const u: StoredUser = {
    id: uid("patient"),
    email: input.email.toLowerCase(),
    passwordHash: input.passwordHash,
    role: "patient",
    name: input.name,
    address: input.address,
    lat: MAP_CENTER.lat,
    lng: MAP_CENTER.lng,
  };
  data().users.push(u);
  persist();
  return { id: u.id, email: u.email, passwordHash: u.passwordHash, role: u.role, name: u.name };
}

export async function createDoctorUser(input: {
  email: string;
  passwordHash: string;
  fullName: string;
  specialty: string;
  kind: string;
  gender: string;
  experienceYears: number;
  consultFee: number;
  homeVisitFee: number;
  lat?: number | null;
  lng?: number | null;
}): Promise<{ user: UserRecord; doctor: Doctor }> {
  const id = uid("doc");
  const fullName = input.fullName.startsWith("Dr.") ? input.fullName : `Dr. ${input.fullName}`;
  const user: StoredUser = {
    id,
    email: input.email.toLowerCase(),
    passwordHash: input.passwordHash,
    role: "doctor",
    name: fullName,
  };
  const d = data();
  const doctor: Doctor = {
    id,
    fullName,
    specialty: input.specialty,
    kind: input.kind === "resident" ? "resident" : "practising",
    gender: input.gender === "male" ? "male" : "female",
    experienceYears: Number(input.experienceYears) || 0,
    languages: ["English", "Hindi"],
    status: "online",
    verified: false,
    rating: 0,
    consultFee: Number(input.consultFee) || 0,
    homeVisitFee: Number(input.homeVisitFee) || 0,
    avatarColor: AVATAR_COLORS[d.doctors.length % AVATAR_COLORS.length],
    lat: input.lat ?? MAP_CENTER.lat + (Math.random() - 0.5) * 0.02,
    lng: input.lng ?? MAP_CENTER.lng + (Math.random() - 0.5) * 0.02,
    lastSeen: now(),
  };
  d.users.push(user);
  d.doctors.unshift(doctor);
  persist();
  return { user: { id, email: user.email, passwordHash: user.passwordHash, role: "doctor", name: fullName }, doctor };
}

export async function getPatientProfile(id: string) {
  const u = data().users.find((x) => x.id === id);
  if (!u) return null;
  return {
    id: u.id,
    name: u.name,
    address: u.address ?? "",
    lat: Number(u.lat ?? MAP_CENTER.lat),
    lng: Number(u.lng ?? MAP_CENTER.lng),
  };
}

export async function getDoctorById(id: string): Promise<Doctor | null> {
  return data().doctors.find((x) => x.id === id) ?? null;
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
  fee: number;
  address: string;
  lat: number;
  lng: number;
  doctorId?: string | null;
}): Promise<ConsultRequest> {
  const req: ConsultRequest = {
    id: uid("req"),
    patientId: input.patientId,
    patientName: input.patientName,
    type: input.type as ConsultRequest["type"],
    status: "pending",
    symptoms: input.symptoms,
    fee: Number(input.fee) || 0,
    address: input.address,
    lat: input.lat,
    lng: input.lng,
    createdAt: now(),
    doctorId: input.doctorId ?? null,
  };
  data().requests.unshift(req);
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
    consultFee?: number;
    homeVisitFee?: number;
    experienceYears?: number;
    languages?: string[];
    qualifications?: string;
    education?: string;
    about?: string;
    registrationNo?: string;
    lat?: number;
    lng?: number;
  },
) {
  const doc = data().doctors.find((x) => x.id === id);
  if (!doc) return;
  if (patch.fullName !== undefined) doc.fullName = patch.fullName;
  if (patch.specialty !== undefined) doc.specialty = patch.specialty;
  if (patch.consultFee !== undefined) doc.consultFee = patch.consultFee;
  if (patch.homeVisitFee !== undefined) doc.homeVisitFee = patch.homeVisitFee;
  if (patch.experienceYears !== undefined) doc.experienceYears = patch.experienceYears;
  if (Array.isArray(patch.languages) && patch.languages.length > 0)
    doc.languages = patch.languages;
  if (patch.qualifications !== undefined) doc.qualifications = patch.qualifications;
  if (patch.education !== undefined) doc.education = patch.education;
  if (patch.about !== undefined) doc.about = patch.about;
  if (patch.registrationNo !== undefined) doc.registrationNo = patch.registrationNo;
  if (typeof patch.lat === "number") doc.lat = patch.lat;
  if (typeof patch.lng === "number") doc.lng = patch.lng;
  doc.lastSeen = now();
  persist();
}

export async function acceptRequest(id: string, doctorId: string): Promise<boolean> {
  const d = data();
  // One active consult at a time: a doctor who already holds an accepted
  // request must complete it before taking another.
  if (d.requests.some((r) => r.status === "accepted" && r.doctorId === doctorId)) {
    throw new DomainError("You already have an active consult — complete it first.", 409);
  }
  const req = d.requests.find((r) => r.id === id);
  if (!req || req.status !== "pending") return false;
  req.status = "accepted";
  req.doctorId = doctorId;
  persist();
  return true;
}

export async function declineRequest(id: string) {
  const req = data().requests.find((r) => r.id === id);
  if (req) {
    req.status = "declined";
    persist();
  }
}

export async function completeRequest(
  id: string,
  opts?: { notes?: string; prescription?: { name: string; qty: number }[] },
) {
  const d = data();
  const req = d.requests.find((r) => r.id === id);
  if (!req || (req.status !== "accepted" && req.status !== "pending")) return;
  req.status = "completed";
  const consultId = uid("con");
  d.consults.push({
    id: consultId,
    requestId: req.id,
    doctorId: req.doctorId,
    patientId: req.patientId,
    startedAt: req.createdAt,
    endedAt: now(),
    notes: opts?.notes ?? "",
  });
  if (opts?.prescription && opts.prescription.length > 0) {
    d.prescriptions.push({
      id: uid("rx"),
      consultId,
      doctorId: req.doctorId,
      patientId: req.patientId,
      items: opts.prescription,
      createdAt: now(),
    });
  }
  persist();
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
