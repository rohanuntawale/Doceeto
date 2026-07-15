import "server-only";
import { read, write } from "@/lib/neo4j/driver";
import { MAP_CENTER } from "@/lib/config";
import type {
  Ambulance,
  ConsultRequest,
  Doctor,
  Order,
  Prescription,
  Review,
  SosEvent,
} from "@/lib/types/domain";

const AVATAR = ["#C15A38", "#C9A876", "#7C8B63", "#E0A890", "#8A6F52"];
const uid = (p: string) => `${p}-${crypto.randomUUID()}`;

type Row = Record<string, any>;

// ── Mappers: Neo4j node props -> domain types ────────────────
const mapDoctor = (n: Row): Doctor => ({
  id: n.id,
  fullName: n.fullName,
  specialty: n.specialty,
  kind: n.kind === "resident" ? "resident" : "practising",
  gender: n.gender === "male" ? "male" : "female",
  experienceYears: Number(n.experienceYears ?? 0),
  languages: Array.isArray(n.languages) ? n.languages : ["English", "Hindi"],
  status: n.status ?? "offline",
  verified: n.verificationStatus === "verified" || !!n.verified,
  verificationStatus: n.verificationStatus ?? (n.verified ? "verified" : "pending"),
  regNo: n.regNo ?? null,
  rating: Number(n.rating ?? 0),
  ratingCount: Number(n.ratingCount ?? 0),
  consultFee: Number(n.consultFee ?? 0),
  homeVisitFee: Number(n.homeVisitFee ?? 0),
  avatarColor: n.avatarColor ?? AVATAR[0],
  lat: Number(n.lat ?? 0),
  lng: Number(n.lng ?? 0),
  lastSeen: n.lastSeen ?? new Date().toISOString(),
});

const mapAmbulance = (n: Row): Ambulance => ({
  id: n.id,
  vehicleNo: n.vehicleNo,
  driverName: n.driverName,
  status: n.status,
  lat: Number(n.lat),
  lng: Number(n.lng),
});

const mapSos = (n: Row): SosEvent => ({
  id: n.id,
  patientId: n.patientId ?? null,
  patientName: n.patientName ?? "Unknown",
  category: n.category,
  status: n.status,
  address: n.address ?? "",
  lat: Number(n.lat),
  lng: Number(n.lng),
  ambulanceId: n.ambulanceId ?? null,
  doctorId: n.doctorId ?? null,
  notes: n.notes ?? null,
  createdAt: n.createdAt,
  resolvedAt: n.resolvedAt ?? null,
});

const mapRequest = (n: Row): ConsultRequest => ({
  id: n.id,
  patientId: n.patientId ?? null,
  patientName: n.patientName ?? "Patient",
  type: n.type,
  status: n.status,
  symptoms: n.symptoms ?? "",
  acuity: n.acuity ?? "routine",
  triageSummary: n.triageSummary ?? null,
  fee: Number(n.fee ?? 0),
  address: n.address ?? "",
  lat: Number(n.lat ?? 0),
  lng: Number(n.lng ?? 0),
  createdAt: n.createdAt,
  acceptedAt: n.acceptedAt ?? null,
  etaMins: n.etaMins ?? null,
  doctorId: n.doctorId ?? null,
});

const mapPrescription = (n: Row): Prescription => ({
  id: n.id,
  requestId: n.requestId,
  patientId: n.patientId ?? null,
  patientName: n.patientName ?? "Patient",
  doctorId: n.doctorId,
  doctorName: n.doctorName ?? "Doctor",
  doctorRegNo: n.doctorRegNo ?? null,
  diagnosis: n.diagnosis ?? "",
  items: n.items ? JSON.parse(n.items) : [],
  advice: n.advice ?? "",
  createdAt: n.createdAt,
});

const mapOrder = (n: Row): Order => ({
  id: n.id,
  patientId: n.patientId ?? null,
  patientName: n.patientName ?? "Patient",
  status: n.status,
  items: n.items ? JSON.parse(n.items) : [],
  total: Number(n.total ?? 0),
  address: n.address ?? "",
  darkStore: n.darkStore ?? "",
  etaMins: Number(n.etaMins ?? 0),
  createdAt: n.createdAt,
});

const mapReview = (n: Row): Review => ({
  id: n.id,
  doctorId: n.doctorId ?? null,
  requestId: n.requestId ?? null,
  patientName: n.patientName ?? "Patient",
  rating: Number(n.rating ?? 0),
  comment: n.comment ?? "",
  createdAt: n.createdAt,
});

// ── Auth ─────────────────────────────────────────────────────
export interface UserRecord {
  id: string;
  email: string;
  passwordHash: string;
  role: "patient" | "doctor" | "ops";
  name: string;
}

export async function findUserByEmail(email: string): Promise<UserRecord | null> {
  const rows = await read<{ u: Row }>(
    `MATCH (u:User {email: $email}) RETURN properties(u) AS u`,
    { email: email.toLowerCase() },
  );
  const u = rows[0]?.u;
  return u ? (u as UserRecord) : null;
}

export async function createPatientUser(input: {
  email: string;
  passwordHash: string;
  name: string;
  address: string;
}): Promise<UserRecord> {
  const id = uid("patient");
  const rows = await write<{ u: Row }>(
    `CREATE (u:User {
       id: $id, email: $email, passwordHash: $passwordHash, role: 'patient',
       name: $name, address: $address, lat: $lat, lng: $lng,
       createdAt: $now
     }) RETURN properties(u) AS u`,
    {
      id,
      email: input.email.toLowerCase(),
      passwordHash: input.passwordHash,
      name: input.name,
      address: input.address,
      lat: MAP_CENTER.lat + 0.02,
      lng: MAP_CENTER.lng - 0.03,
      now: new Date().toISOString(),
    },
  );
  return rows[0].u as UserRecord;
}

export async function createDoctorUser(input: {
  email: string;
  passwordHash: string;
  fullName: string;
  specialty: string;
  kind: string;
  gender: string;
  experienceYears: number;
  regNo?: string | null;
  consultFee: number;
  homeVisitFee: number;
}): Promise<{ user: UserRecord; doctor: Doctor }> {
  const id = uid("doc");
  const fullName = input.fullName.startsWith("Dr.")
    ? input.fullName
    : `Dr. ${input.fullName}`;
  const rows = await write<{ u: Row; d: Row }>(
    `CREATE (u:User {
       id: $id, email: $email, passwordHash: $passwordHash, role: 'doctor',
       name: $fullName, createdAt: $now
     })
     CREATE (d:Doctor {
       id: $id, fullName: $fullName, specialty: $specialty, kind: $kind,
       gender: $gender, experienceYears: $experienceYears,
       languages: $languages, status: 'offline',
       verified: false, verificationStatus: 'pending', regNo: $regNo,
       rating: 0.0, ratingCount: 0,
       consultFee: $consultFee, homeVisitFee: $homeVisitFee,
       avatarColor: $avatarColor, lat: $lat, lng: $lng, lastSeen: $now
     })
     CREATE (u)-[:IS_DOCTOR]->(d)
     RETURN properties(u) AS u, properties(d) AS d`,
    {
      id,
      email: input.email.toLowerCase(),
      passwordHash: input.passwordHash,
      fullName,
      specialty: input.specialty,
      kind: input.kind,
      gender: input.gender,
      experienceYears: input.experienceYears,
      regNo: input.regNo ?? null,
      languages: ["English", "Hindi"],
      consultFee: input.consultFee,
      homeVisitFee: input.homeVisitFee,
      avatarColor: AVATAR[Math.floor(Math.random() * AVATAR.length)],
      lat: MAP_CENTER.lat + (Math.random() - 0.5) * 0.06,
      lng: MAP_CENTER.lng + (Math.random() - 0.5) * 0.06,
      now: new Date().toISOString(),
    },
  );
  return { user: rows[0].u as UserRecord, doctor: mapDoctor(rows[0].d) };
}

/** The public/patient profile fields for "me". */
export async function getPatientProfile(id: string) {
  const rows = await read<{ u: Row }>(
    `MATCH (u:User {id: $id}) RETURN properties(u) AS u`,
    { id },
  );
  const u = rows[0]?.u;
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
  const rows = await read<{ d: Row }>(`MATCH (d:Doctor {id: $id}) RETURN properties(d) AS d`, { id });
  return rows[0]?.d ? mapDoctor(rows[0].d) : null;
}

// ── Reads ────────────────────────────────────────────────────
export const getDoctors = () =>
  read<{ d: Row }>(`MATCH (d:Doctor) RETURN properties(d) AS d`).then((r) => r.map((x) => mapDoctor(x.d)));

export const getAmbulances = () =>
  read<{ a: Row }>(`MATCH (a:Ambulance) RETURN properties(a) AS a`).then((r) =>
    r.map((x) => mapAmbulance(x.a)),
  );

export const getRequests = () =>
  read<{ r: Row }>(`MATCH (r:ConsultRequest) RETURN properties(r) AS r ORDER BY r.createdAt DESC`).then(
    (rows) => rows.map((x) => mapRequest(x.r)),
  );

export const getSosEvents = () =>
  read<{ s: Row }>(`MATCH (s:Sos) RETURN properties(s) AS s ORDER BY s.createdAt DESC`).then((rows) =>
    rows.map((x) => mapSos(x.s)),
  );

export const getOrders = () =>
  read<{ o: Row }>(`MATCH (o:Order) RETURN properties(o) AS o ORDER BY o.createdAt DESC`).then((rows) =>
    rows.map((x) => mapOrder(x.o)),
  );

export const getReviews = () =>
  read<{ v: Row }>(`MATCH (v:Review) RETURN properties(v) AS v ORDER BY v.createdAt DESC`).then((rows) =>
    rows.map((x) => mapReview(x.v)),
  );

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
  const rows = await write<{ s: Row }>(
    `CREATE (s:Sos {
       id: $id, patientId: $patientId, patientName: $patientName,
       category: $category, status: 'open', address: $address,
       lat: $lat, lng: $lng, ambulanceId: null, doctorId: null,
       notes: $notes, createdAt: $now, resolvedAt: null
     }) RETURN properties(s) AS s`,
    { id: uid("sos"), ...input, notes: input.notes ?? "Patient-triggered SOS.", now: new Date().toISOString() },
  );
  return mapSos(rows[0].s);
}

export async function createRequest(input: {
  patientId: string;
  patientName: string;
  type: string;
  symptoms: string;
  acuity?: string;
  triageSummary?: string | null;
  fee: number;
  address: string;
  lat: number;
  lng: number;
  doctorId?: string | null;
}): Promise<ConsultRequest> {
  const rows = await write<{ r: Row }>(
    `CREATE (r:ConsultRequest {
       id: $id, patientId: $patientId, patientName: $patientName, type: $type,
       status: 'pending', symptoms: $symptoms, acuity: $acuity,
       triageSummary: $triageSummary, fee: $fee, address: $address,
       lat: $lat, lng: $lng, doctorId: $doctorId, createdAt: $now,
       acceptedAt: null, etaMins: null
     }) RETURN properties(r) AS r`,
    {
      id: uid("req"),
      patientId: input.patientId,
      patientName: input.patientName,
      type: input.type,
      symptoms: input.symptoms,
      acuity: input.acuity ?? "routine",
      triageSummary: input.triageSummary ?? null,
      fee: input.fee,
      address: input.address,
      lat: input.lat,
      lng: input.lng,
      doctorId: input.doctorId ?? null,
      now: new Date().toISOString(),
    },
  );
  return mapRequest(rows[0].r);
}

export async function createOrder(input: {
  patientId: string;
  patientName: string;
  items: { name: string; qty: number }[];
  total: number;
  address: string;
  darkStore: string;
}): Promise<Order> {
  const rows = await write<{ o: Row }>(
    `CREATE (o:Order {
       id: $id, patientId: $patientId, patientName: $patientName,
       status: 'placed', items: $items, total: $total, address: $address,
       darkStore: $darkStore, etaMins: 10, createdAt: $now
     }) RETURN properties(o) AS o`,
    {
      id: uid("ord"),
      patientId: input.patientId,
      patientName: input.patientName,
      items: JSON.stringify(input.items),
      total: input.total,
      address: input.address,
      darkStore: input.darkStore,
      now: new Date().toISOString(),
    },
  );
  return mapOrder(rows[0].o);
}

export const getPrescriptions = () =>
  read<{ p: Row }>(
    `MATCH (p:Prescription) RETURN properties(p) AS p ORDER BY p.createdAt DESC`,
  ).then((rows) => rows.map((x) => mapPrescription(x.p)));

// ── Doctor mutations ─────────────────────────────────────────
export async function setDoctorStatus(id: string, status: string) {
  // An unverified doctor can never go online.
  await write(
    `MATCH (d:Doctor {id: $id})
     WHERE NOT ($status = 'online' AND coalesce(d.verificationStatus,'pending') <> 'verified')
     SET d.status = $status, d.lastSeen = $now`,
    { id, status, now: new Date().toISOString() },
  );
}

/** Ops verifies (or rejects) a doctor. */
export async function verifyDoctor(id: string, approve: boolean) {
  await write(
    `MATCH (d:Doctor {id: $id})
     SET d.verified = $approve,
         d.verificationStatus = CASE WHEN $approve THEN 'verified' ELSE 'rejected' END`,
    { id, approve },
  );
}

export async function updateDoctor(
  id: string,
  patch: { fullName?: string; specialty?: string; consultFee?: number; homeVisitFee?: number },
) {
  await write(
    `MATCH (d:Doctor {id: $id})
     SET d += {
       fullName: coalesce($fullName, d.fullName),
       specialty: coalesce($specialty, d.specialty),
       consultFee: coalesce($consultFee, d.consultFee),
       homeVisitFee: coalesce($homeVisitFee, d.homeVisitFee)
     }`,
    {
      id,
      fullName: patch.fullName ?? null,
      specialty: patch.specialty ?? null,
      consultFee: patch.consultFee ?? null,
      homeVisitFee: patch.homeVisitFee ?? null,
    },
  );
}

/**
 * Atomic claim. Succeeds only if the request is still pending, is open to
 * this doctor (broadcast or directed to them), AND the doctor is verified.
 * Computes an arrival ETA from the two positions at accept time.
 */
export async function acceptRequest(id: string, doctorId: string): Promise<boolean> {
  const rows = await write<{ r: Row }>(
    `MATCH (r:ConsultRequest {id: $id})
     WHERE r.status = 'pending' AND (r.doctorId IS NULL OR r.doctorId = $doctorId)
     MATCH (d:Doctor {id: $doctorId}) WHERE d.verificationStatus = 'verified'
     WITH r, d, (6371 * 2 * asin(sqrt(
       sin(radians(d.lat - r.lat)/2)^2 +
       cos(radians(r.lat)) * cos(radians(d.lat)) * sin(radians(d.lng - r.lng)/2)^2
     ))) AS km
     SET r.status = 'accepted', r.doctorId = $doctorId, r.acceptedAt = $now,
         r.etaMins = CASE WHEN r.type = 'video' THEN null ELSE toInteger(8 + km/25.0*60) END
     RETURN properties(r) AS r`,
    { id, doctorId, now: new Date().toISOString() },
  );
  return rows.length > 0;
}

/** Only the doctor a directed request was sent to may decline it. */
export async function declineRequest(id: string, doctorId: string) {
  await write(
    `MATCH (r:ConsultRequest {id: $id})
     WHERE r.status = 'pending' AND r.doctorId = $doctorId
     SET r.status = 'declined'`,
    { id, doctorId },
  );
}

// A clinical transition is allowed only for the owning doctor, in the
// expected state, AND while they are still verified (honors mid-visit
// revocation). Shared WHERE fragment.
const OWN_AND_VERIFIED =
  "r.doctorId = $doctorId AND EXISTS { MATCH (d:Doctor {id: $doctorId}) WHERE d.verificationStatus = 'verified' }";

export async function startVisit(id: string, doctorId: string) {
  await write(
    `MATCH (r:ConsultRequest {id: $id})
     WHERE ${OWN_AND_VERIFIED} AND r.status = 'accepted' SET r.status = 'enroute'`,
    { id, doctorId },
  );
}

export async function arriveVisit(id: string, doctorId: string) {
  await write(
    `MATCH (r:ConsultRequest {id: $id})
     WHERE ${OWN_AND_VERIFIED} AND r.status IN ['enroute','accepted']
     SET r.status = 'arrived', r.etaMins = 0`,
    { id, doctorId },
  );
}

export async function completeRequest(id: string, doctorId: string) {
  await write(
    `MATCH (r:ConsultRequest {id: $id})
     WHERE ${OWN_AND_VERIFIED} AND r.status IN ['accepted','enroute','arrived']
     SET r.status = 'completed'`,
    { id, doctorId },
  );
}

/**
 * Doctor issues an e-prescription and completes the visit — in ONE atomic,
 * guarded write. Ownership, active status and verification are all enforced
 * in the same transaction; nothing is created/completed if any guard fails.
 */
export async function createPrescription(input: {
  requestId: string;
  doctorId: string;
  diagnosis: string;
  items: { name: string; dosage: string; duration: string }[];
  advice: string;
}): Promise<Prescription | null> {
  const rows = await write<{ p: Row }>(
    `MATCH (r:ConsultRequest {id: $requestId, doctorId: $doctorId})
     WHERE r.status IN ['accepted','enroute','arrived']
     MATCH (d:Doctor {id: $doctorId}) WHERE d.verificationStatus = 'verified'
     CREATE (p:Prescription {
       id: $id, requestId: $requestId, patientId: r.patientId, patientName: r.patientName,
       doctorId: d.id, doctorName: d.fullName, doctorRegNo: d.regNo,
       diagnosis: $diagnosis, items: $items, advice: $advice, createdAt: $now
     })
     SET r.status = 'completed'
     RETURN properties(p) AS p`,
    {
      id: uid("rx"),
      requestId: input.requestId,
      doctorId: input.doctorId,
      diagnosis: input.diagnosis,
      items: JSON.stringify(input.items),
      advice: input.advice,
      now: new Date().toISOString(),
    },
  );
  return rows[0]?.p ? mapPrescription(rows[0].p) : null;
}

/**
 * Patient rates a completed visit; the doctor's rating recomputes. Only the
 * patient who owns a completed request with this doctor may rate it, and only
 * once — otherwise this is a no-op (blocks review-bombing).
 */
export async function addReview(input: {
  doctorId: string;
  requestId: string | null;
  patientId: string;
  patientName: string;
  rating: number;
  comment: string;
}): Promise<boolean> {
  if (!input.requestId) return false;
  const rows = await write<{ v: Row }>(
    `MATCH (r:ConsultRequest {id: $requestId, patientId: $patientId, doctorId: $doctorId, status: 'completed'})
     WHERE NOT EXISTS { MATCH (:Review {requestId: $requestId}) }
     CREATE (v:Review {
       id: $id, doctorId: $doctorId, requestId: $requestId, patientName: $patientName,
       rating: $rating, comment: $comment, createdAt: $now
     })
     WITH v MATCH (d:Doctor {id: $doctorId})
     SET d.rating = (d.rating * d.ratingCount + $rating) / (d.ratingCount + 1),
         d.ratingCount = d.ratingCount + 1
     RETURN properties(v) AS v`,
    {
      id: uid("rev"),
      doctorId: input.doctorId,
      requestId: input.requestId,
      patientId: input.patientId,
      patientName: input.patientName,
      rating: Math.max(1, Math.min(5, Math.round(input.rating))),
      comment: input.comment,
      now: new Date().toISOString(),
    },
  );
  return rows.length > 0;
}

// ── Ops mutations ────────────────────────────────────────────
export async function assignAmbulance(sosId: string, ambulanceId: string) {
  await write(
    `MATCH (s:Sos {id: $sosId})
     SET s.ambulanceId = $ambulanceId,
         s.status = CASE s.status WHEN 'open' THEN 'assigned' ELSE s.status END
     WITH s MATCH (a:Ambulance {id: $ambulanceId}) SET a.status = 'dispatched'`,
    { sosId, ambulanceId },
  );
}

export async function assignDoctorToSos(sosId: string, doctorId: string) {
  await write(`MATCH (s:Sos {id: $sosId}) SET s.doctorId = $doctorId`, { sosId, doctorId });
}

const SOS_FLOW = ["open", "assigned", "enroute", "resolved"];
export async function advanceSos(sosId: string) {
  const rows = await read<{ s: Row }>(`MATCH (s:Sos {id: $sosId}) RETURN properties(s) AS s`, { sosId });
  const cur = rows[0]?.s?.status;
  if (!cur) return;
  const next = SOS_FLOW[Math.min(SOS_FLOW.indexOf(cur) + 1, SOS_FLOW.length - 1)];
  await write(
    `MATCH (s:Sos {id: $sosId})
     SET s.status = $next,
         s.resolvedAt = CASE $next WHEN 'resolved' THEN $now ELSE s.resolvedAt END`,
    { sosId, next, now: new Date().toISOString() },
  );
}

const ORDER_FLOW = ["placed", "packed", "out_for_delivery", "delivered"];
export async function advanceOrder(orderId: string) {
  const rows = await read<{ o: Row }>(`MATCH (o:Order {id: $orderId}) RETURN properties(o) AS o`, { orderId });
  const cur = rows[0]?.o?.status;
  if (!cur) return;
  const i = ORDER_FLOW.indexOf(cur);
  if (i < 0 || i >= ORDER_FLOW.length - 1) return;
  const next = ORDER_FLOW[i + 1];
  const eta = next === "delivered" ? 0 : Math.max(1, Number(rows[0].o.etaMins ?? 10) - 3);
  await write(`MATCH (o:Order {id: $orderId}) SET o.status = $next, o.etaMins = $eta`, {
    orderId,
    next,
    eta,
  });
}
