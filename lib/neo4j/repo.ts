import "server-only";
import { read, write } from "@/lib/neo4j/driver";
import { MAP_CENTER, COMMISSION_RATE } from "@/lib/config";
import { AVATAR_COLORS, MED_CATALOG } from "@/lib/catalog";
import { DomainError, type Near, type UserRecord } from "@/lib/db/shared";
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

export { DomainError };
export type { Near, UserRecord };

const AVATAR = AVATAR_COLORS;
const uid = (p: string) => `${p}-${crypto.randomUUID()}`;

/** Cypher fragment: distance in meters from $nlat/$nlng to node `v`. */
const DIST = (v: string) =>
  `point.distance(point({latitude: ${v}.lat, longitude: ${v}.lng}), point({latitude: $nlat, longitude: $nlng}))`;

type Row = Record<string, any>;

/** Neo4j properties are flat, so nested objects travel as JSON strings. */
function parseJson<T>(raw: unknown): T | undefined {
  if (typeof raw !== "string" || raw.length === 0) return undefined;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return undefined;
  }
}

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
  verified: !!n.verified,
  rating: Number(n.rating ?? 0),
  consultFee: Number(n.consultFee ?? 0),
  homeVisitFee: Number(n.homeVisitFee ?? 0),
  avatarColor: n.avatarColor ?? AVATAR[0],
  lat: Number(n.lat ?? 0),
  lng: Number(n.lng ?? 0),
  lastSeen: n.lastSeen ?? new Date().toISOString(),
  // Patient-facing profile detail (optional; fallbacks live in lib/utils/doctor).
  qualifications: n.qualifications ?? undefined,
  education: n.education ?? undefined,
  about: n.about ?? undefined,
  registrationNo: n.registrationNo ?? undefined,
  clinicAddress: n.clinicAddress ?? undefined,
  availability: parseJson<DoctorAvailability>(n.availability),
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
  paymentMethod: n.paymentMethod === "cash" ? "cash" : "online",
  fee: Number(n.fee ?? 0),
  address: n.address ?? "",
  lat: Number(n.lat ?? 0),
  lng: Number(n.lng ?? 0),
  createdAt: n.createdAt,
  // Settle the mode here so nothing downstream has to infer it from rows
  // written before scheduling existed.
  mode: bookingModeOf({ mode: n.mode, scheduledAt: n.scheduledAt ?? null }),
  scheduledAt: n.scheduledAt ?? null,
  scheduledEnd: n.scheduledEnd ?? null,
  slotMinutes: n.slotMinutes != null ? Number(n.slotMinutes) : null,
  gigId: n.gigId ?? null,
  gigTitle: n.gigTitle ?? null,
  broadcast: !!n.broadcast,
  tripStage: n.tripStage ?? null,
  tripStageAt: n.tripStageAt ?? null,
  acceptedAt: n.acceptedAt ?? null,
  completedAt: n.completedAt ?? null,
  cancelledAt: n.cancelledAt ?? null,
  cancelledBy: n.cancelledBy ?? null,
  cancelReason: n.cancelReason ?? null,
  passedBy: Array.isArray(n.passedBy) ? n.passedBy : [],
  doctorId: n.doctorId ?? null,
});

const mapGig = (n: Row): Gig => ({
  id: n.id,
  doctorId: n.doctorId,
  title: n.title ?? "",
  description: n.description ?? "",
  type: n.type ?? "home_visit",
  price: Number(n.price ?? 0),
  durationMinutes: Number(n.durationMinutes ?? 60),
  status: n.status ?? "active",
  createdAt: n.createdAt,
  updatedAt: n.updatedAt ?? null,
});

const mapTransaction = (n: Row): Transaction => ({
  id: n.id,
  doctorId: n.doctorId,
  kind: n.kind === "payout" ? "payout" : "earning",
  requestId: n.requestId ?? null,
  patientName: n.patientName ?? null,
  method: n.method ?? null,
  gross: Number(n.gross ?? 0),
  commission: Number(n.commission ?? 0),
  net: Number(n.net ?? 0),
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
  patientName: n.patientName ?? "Patient",
  rating: Number(n.rating ?? 0),
  comment: n.comment ?? "",
  createdAt: n.createdAt,
});

// ── Auth ─────────────────────────────────────────────────────
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
  consultFee: number;
  homeVisitFee: number;
  clinicAddress?: string;
  /** Real device location at signup (nullable → falls back near center). */
  lat?: number | null;
  lng?: number | null;
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
       languages: $languages, status: 'online', verified: false, rating: 0.0,
       consultFee: $consultFee, homeVisitFee: $homeVisitFee,
       clinicAddress: $clinicAddress,
       avatarColor: $avatarColor, lat: $lat, lng: $lng,
       location: point({latitude: $lat, longitude: $lng}), lastSeen: $now
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
      languages: ["English", "Hindi"],
      consultFee: input.consultFee,
      homeVisitFee: input.homeVisitFee,
      clinicAddress: input.clinicAddress?.trim() || "",
      avatarColor: AVATAR[Math.floor(Math.random() * AVATAR.length)],
      // Real GPS when granted; otherwise near the fallback center until
      // the cockpit's location publisher reports the true position.
      lat: input.lat ?? MAP_CENTER.lat + (Math.random() - 0.5) * 0.02,
      lng: input.lng ?? MAP_CENTER.lng + (Math.random() - 0.5) * 0.02,
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

// ── Reads (optionally geo-filtered with `near`) ──────────────
const nearParams = (near: Near) => ({
  nlat: near.lat,
  nlng: near.lng,
  meters: Math.max(0.1, near.km) * 1000,
});

export const getDoctors = (near?: Near) =>
  (near
    ? read<{ d: Row }>(
        `MATCH (d:Doctor)
         WHERE d.lat IS NOT NULL AND d.lng IS NOT NULL AND ${DIST("d")} < $meters
         RETURN properties(d) AS d ORDER BY ${DIST("d")} ASC LIMIT 100`,
        nearParams(near),
      )
    : read<{ d: Row }>(`MATCH (d:Doctor) RETURN properties(d) AS d`)
  ).then((r) => r.map((x) => mapDoctor(x.d)));

export const getAmbulances = () =>
  read<{ a: Row }>(`MATCH (a:Ambulance) RETURN properties(a) AS a`).then((r) =>
    r.map((x) => mapAmbulance(x.a)),
  );

/** Attach mutual-rating context: the patient's aggregate rating and
 *  whether this consult has already been rated by the doctor. */
const RATING_CTX = `
  OPTIONAL MATCH (p:User {id: r.patientId})
  RETURN properties(r) AS r,
         p.rating AS patientRating,
         p.ratingCount AS patientRatingCount,
         EXISTS { MATCH (:PatientReview {requestId: r.id}) } AS patientRated,
         EXISTS { MATCH (:Review {requestId: r.id}) } AS reviewed`;

const mapRequestWithRating = (x: Row): ConsultRequest => ({
  ...mapRequest(x.r),
  patientRating: x.patientRating != null ? Number(x.patientRating) : null,
  patientRatingCount: Number(x.patientRatingCount ?? 0),
  patientRated: !!x.patientRated,
  reviewed: !!x.reviewed,
});

export const getRequests = (near?: Near) =>
  (near
    ? read<Row>(
        `MATCH (r:ConsultRequest)
         WHERE r.lat IS NOT NULL AND r.lng IS NOT NULL AND ${DIST("r")} < $meters
         WITH r ORDER BY r.createdAt DESC LIMIT 200
         ${RATING_CTX}`,
        nearParams(near),
      )
    : read<Row>(
        `MATCH (r:ConsultRequest)
         WITH r ORDER BY r.createdAt DESC
         ${RATING_CTX}`,
      )
  ).then((rows) => rows.map(mapRequestWithRating));

export const getSosEvents = (near?: Near) =>
  (near
    ? read<{ s: Row }>(
        `MATCH (s:Sos)
         WHERE s.lat IS NOT NULL AND s.lng IS NOT NULL AND ${DIST("s")} < $meters
         RETURN properties(s) AS s ORDER BY s.createdAt DESC LIMIT 200`,
        nearParams(near),
      )
    : read<{ s: Row }>(`MATCH (s:Sos) RETURN properties(s) AS s ORDER BY s.createdAt DESC`)
  ).then((rows) => rows.map((x) => mapSos(x.s)));

export const getOrders = () =>
  read<{ o: Row }>(`MATCH (o:Order) RETURN properties(o) AS o ORDER BY o.createdAt DESC`).then((rows) =>
    rows.map((x) => mapOrder(x.o)),
  );

export const getReviews = (doctorId?: string) =>
  (doctorId
    ? read<{ v: Row }>(
        `MATCH (v:Review {doctorId: $doctorId}) RETURN properties(v) AS v ORDER BY v.createdAt DESC`,
        { doctorId },
      )
    : read<{ v: Row }>(`MATCH (v:Review) RETURN properties(v) AS v ORDER BY v.createdAt DESC`)
  ).then((rows) => rows.map((x) => mapReview(x.v)));

export async function getSosById(id: string): Promise<SosEvent | null> {
  const rows = await read<{ s: Row }>(`MATCH (s:Sos {id: $id}) RETURN properties(s) AS s`, { id });
  return rows[0]?.s ? mapSos(rows[0].s) : null;
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
  const id = uid("sos");
  const now = new Date().toISOString();
  const rows = await write<{ s: Row }>(
    `CREATE (s:Sos {
       id: $id, patientId: $patientId, patientName: $patientName,
       category: $category, status: 'open', address: $address,
       lat: $lat, lng: $lng, location: point({latitude: $lat, longitude: $lng}),
       ambulanceId: null, doctorId: null,
       notes: $notes, createdAt: $now, resolvedAt: null
     }) RETURN properties(s) AS s`,
    { id, ...input, notes: input.notes ?? "Patient-triggered SOS.", now },
  );

  // Fan-out (best effort): alert the nearest online doctors and suggest
  // the nearest free ambulance so dispatch starts pre-computed.
  try {
    await write(
      `MATCH (s:Sos {id: $id})
       MATCH (d:Doctor)
       WHERE d.status = 'online' AND d.lat IS NOT NULL AND d.lng IS NOT NULL
       WITH s, d,
            point.distance(point({latitude: s.lat, longitude: s.lng}),
                           point({latitude: d.lat, longitude: d.lng})) AS dist
       WHERE dist < $radius
       WITH s, d, dist ORDER BY dist ASC LIMIT 5
       MERGE (s)-[n:NOTIFIES]->(d)
       SET n.at = $now, n.distanceMeters = round(dist)`,
      { id, now, radius: 15_000 },
    );
    await write(
      `MATCH (s:Sos {id: $id})
       MATCH (a:Ambulance {status: 'free'})
       WHERE a.lat IS NOT NULL AND a.lng IS NOT NULL
       WITH s, a,
            point.distance(point({latitude: s.lat, longitude: s.lng}),
                           point({latitude: a.lat, longitude: a.lng})) AS dist
       ORDER BY dist ASC LIMIT 1
       SET s.suggestedAmbulanceId = a.id`,
      { id },
    );
  } catch (err) {
    console.error("sos fan-out failed (non-fatal):", err);
  }

  return mapSos(rows[0].s);
}

/** Every request already sitting on one doctor's calendar. */
async function requestsForDoctor(doctorId: string): Promise<ConsultRequest[]> {
  const rows = await read<{ r: Row }>(
    `MATCH (r:ConsultRequest {doctorId: $doctorId}) RETURN properties(r) AS r`,
    { doctorId },
  );
  return rows.map((x) => mapRequest(x.r));
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

  let slot: ResolvedSlot | null = null;
  let hire: ResolvedHire | null = null;
  if (mode === "scheduled") {
    if (!doctorId) throw new DomainError("Pick a doctor before choosing a time.");
    slot = resolveScheduledSlot({
      doctor: await getDoctorById(doctorId),
      startIso: String(input.scheduledAt ?? ""),
      existing: await requestsForDoctor(doctorId),
    });
  } else if (mode === "gig") {
    if (!doctorId) throw new DomainError("Pick a doctor before hiring a gig.");
    hire = assertCanHire({
      gig: await getGigById(String(input.gigId ?? "")),
      doctor: await getDoctorById(doctorId),
      existing: await requestsForDoctor(doctorId),
    });
  }

  // The check above can go stale between the read and the write on a
  // multi-instance deployment, so the CREATE itself refuses to run when the
  // slot has been taken in the meantime. Nothing gets written twice.
  //
  // A gig needs no equivalent guard here: several patients queueing a request
  // for the same gig is fine and wanted. The one-at-a-time invariant is
  // enforced on ACCEPT, where only one doctor's claim can win.
  const rows = await write<{ r: Row }>(
    `WITH $scheduledAt AS slot
     WHERE slot IS NULL OR NOT EXISTS {
       MATCH (x:ConsultRequest)
       WHERE x.doctorId = $doctorId AND x.scheduledAt = slot
         AND x.status IN ['pending', 'accepted']
     }
     CREATE (r:ConsultRequest {
       id: $id, patientId: $patientId, patientName: $patientName, type: $type,
       status: 'pending', symptoms: $symptoms, paymentMethod: $paymentMethod,
       fee: $fee, address: $address,
       lat: $lat, lng: $lng, location: point({latitude: $lat, longitude: $lng}),
       doctorId: $doctorId, mode: $mode, scheduledAt: $scheduledAt,
       scheduledEnd: $scheduledEnd, slotMinutes: $slotMinutes,
       gigId: $gigId, gigTitle: $gigTitle, broadcast: $broadcast,
       tripStage: null, tripStageAt: null, passedBy: [],
       createdAt: $now
     }) RETURN properties(r) AS r`,
    {
      id: uid("req"),
      patientId: input.patientId,
      patientName: input.patientName,
      // A gig's visit type and price come off the listing, never the body.
      type: hire?.type ?? input.type,
      symptoms: input.symptoms,
      fee: hire ? hire.fee : input.fee,
      address: input.address,
      lat: input.lat,
      lng: input.lng,
      paymentMethod: input.paymentMethod === "cash" ? "cash" : "online",
      doctorId,
      mode,
      scheduledAt: slot?.scheduledAt ?? null,
      scheduledEnd: slot?.scheduledEnd ?? null,
      slotMinutes: slot?.slotMinutes ?? hire?.durationMinutes ?? null,
      gigId: hire?.gigId ?? null,
      gigTitle: hire?.gigTitle ?? null,
      broadcast: mode === "emergency" && doctorId === null,
      now: new Date().toISOString(),
    },
  );
  if (!rows[0]) {
    throw new DomainError("That slot has just been booked. Please pick another time.", 409);
  }
  return mapRequest(rows[0].r);
}

export async function createOrder(input: {
  patientId: string;
  patientName: string;
  items: { name: string; qty: number }[];
  total: number; // ignored — the server prices from the catalog
  address: string;
  darkStore: string;
}): Promise<Order> {
  // Server-side pricing: never trust a client total.
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
      items: JSON.stringify(items),
      total,
      address: input.address,
      darkStore: input.darkStore,
      now: new Date().toISOString(),
    },
  );
  return mapOrder(rows[0].o);
}

// ── Doctor mutations ─────────────────────────────────────────
export async function setDoctorStatus(id: string, status: string) {
  await write(
    `MATCH (d:Doctor {id: $id}) SET d.status = $status, d.lastSeen = $now`,
    { id, status, now: new Date().toISOString() },
  );
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
    clinicAddress?: string;
    /** Live device position from the cockpit's location publisher. */
    lat?: number;
    lng?: number;
  },
) {
  const hasGeo = typeof patch.lat === "number" && typeof patch.lng === "number";
  const languages =
    Array.isArray(patch.languages) && patch.languages.length > 0 ? patch.languages : null;
  await write(
    `MATCH (d:Doctor {id: $id})
     SET d += {
       fullName: coalesce($fullName, d.fullName),
       specialty: coalesce($specialty, d.specialty),
       consultFee: coalesce($consultFee, d.consultFee),
       homeVisitFee: coalesce($homeVisitFee, d.homeVisitFee),
       experienceYears: coalesce($experienceYears, d.experienceYears),
       languages: coalesce($languages, d.languages),
       qualifications: coalesce($qualifications, d.qualifications),
       education: coalesce($education, d.education),
       about: coalesce($about, d.about),
       registrationNo: coalesce($registrationNo, d.registrationNo),
       clinicAddress: coalesce($clinicAddress, d.clinicAddress),
       lat: coalesce($lat, d.lat),
       lng: coalesce($lng, d.lng)
     }
     SET d.lastSeen = $now
     FOREACH (_ IN CASE WHEN $hasGeo THEN [1] ELSE [] END |
       SET d.location = point({latitude: $lat, longitude: $lng}))`,
    {
      id,
      fullName: patch.fullName ?? null,
      specialty: patch.specialty ?? null,
      consultFee: patch.consultFee ?? null,
      homeVisitFee: patch.homeVisitFee ?? null,
      experienceYears: patch.experienceYears ?? null,
      languages,
      qualifications: patch.qualifications ?? null,
      education: patch.education ?? null,
      about: patch.about ?? null,
      registrationNo: patch.registrationNo ?? null,
      clinicAddress: patch.clinicAddress ?? null,
      lat: hasGeo ? patch.lat : null,
      lng: hasGeo ? patch.lng : null,
      hasGeo,
      now: new Date().toISOString(),
    },
  );
}

/**
 * Atomic claim: only succeeds while the request is still pending. An
 * emergency also needs the doctor to be free; an appointment only needs its
 * slot to be clear of what they have already accepted.
 *
 * This is where the "one active gig per doctor" invariant is really enforced.
 * `assertCanAccept` below can go stale between the read and the write on a
 * multi-instance deployment, so the SET refuses to run when the doctor has
 * picked up a gig in the meantime — the second claim finds no row and reports
 * a 409 rather than quietly double-booking them.
 */
export async function acceptRequest(id: string, doctorId: string): Promise<boolean> {
  const found = await read<{ r: Row }>(
    `MATCH (r:ConsultRequest {id: $id}) RETURN properties(r) AS r`,
    { id },
  );
  const req = found[0]?.r ? mapRequest(found[0].r) : null;
  if (!req || req.status !== "pending") return false;
  assertCanAccept(req, await requestsForDoctor(doctorId), doctorId);

  const now = new Date().toISOString();
  const rows = await write<{ r: Row }>(
    `MATCH (r:ConsultRequest {id: $id})
     WHERE r.status = 'pending'
       AND NOT EXISTS {
         MATCH (x:ConsultRequest)
         WHERE x.doctorId = $doctorId AND x.mode = 'gig' AND x.status = 'accepted'
       }
     SET r.status = 'accepted', r.doctorId = $doctorId, r.acceptedAt = $now,
         r.tripStage = 'accepted', r.tripStageAt = $now
     RETURN properties(r) AS r`,
    { id, doctorId, now },
  );
  if (rows.length === 0) {
    // Distinguish "lost the race" (caller turns a false into a 409 about
    // another doctor) from "you're already on a gig", which is about you.
    const mine = await requestsForDoctor(doctorId);
    if (mine.some((r) => r.status === "accepted" && r.mode === "gig")) {
      throw new DomainError("Finish your current gig before taking another.", 409);
    }
    return false;
  }
  return true;
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
  // Declining frees a booked slot and can unblock a doctor's urgent feed, so
  // it has to be theirs to decline.
  if (doctorId) {
    const found = await read<{ r: Row }>(
      `MATCH (r:ConsultRequest {id: $id}) RETURN properties(r) AS r`,
      { id },
    );
    const req = found[0]?.r ? mapRequest(found[0].r) : null;
    if (!req) return;
    if (!claimableBy(req, doctorId)) {
      throw new DomainError("That request isn't yours to decline.", 403);
    }
    // Passing on a broadcast must not kill it for everyone else — record the
    // pass and leave it pending for another doctor.
    if (req.broadcast && req.status === "pending" && req.doctorId === null) {
      await write(
        `MATCH (r:ConsultRequest {id: $id})
         SET r.passedBy = [x IN coalesce(r.passedBy, []) WHERE x <> $doctorId] + $doctorId`,
        { id, doctorId },
      );
      return;
    }
  }
  await write(
    `MATCH (r:ConsultRequest {id: $id})
     SET r.status = 'declined', r.cancelReason = $reason`,
    { id, reason: reason ?? null },
  );
}

/** Patient or doctor calls off a booking — this is what frees the slot. */
export async function cancelRequest(
  id: string,
  actor: { id: string; role: string },
  opts?: { reason?: string },
) {
  const found = await read<{ r: Row }>(
    `MATCH (r:ConsultRequest {id: $id}) RETURN properties(r) AS r`,
    { id },
  );
  const req = found[0]?.r ? mapRequest(found[0].r) : undefined;
  assertCanCancel(req, actor, opts);
  const reason = opts?.reason?.trim().slice(0, CANCEL_REASON_MAX) || null;

  // A doctor standing down from a BROADCAST puts it back out to the pool.
  if (actor.role === "doctor" && reopensOnDoctorCancel(req)) {
    await write(
      `MATCH (r:ConsultRequest {id: $id})
       WHERE r.status = 'accepted'
       SET r.status = 'pending', r.doctorId = null, r.acceptedAt = null,
           r.tripStage = null, r.tripStageAt = null, r.cancelReason = $reason,
           r.passedBy = [x IN coalesce(r.passedBy, []) WHERE x <> $doctorId] + $doctorId`,
      { id, reason, doctorId: actor.id },
    );
    return;
  }

  await write(
    `MATCH (r:ConsultRequest {id: $id})
     WHERE r.status IN ['pending', 'accepted']
     SET r.status = 'cancelled', r.cancelledAt = $now,
         r.cancelledBy = $by, r.cancelReason = $reason`,
    {
      id,
      now: new Date().toISOString(),
      by: actor.role === "doctor" ? "doctor" : "patient",
      reason,
    },
  );
}

/** Move a visit one step along its rail. Null when there is nowhere left. */
export async function advanceTrip(id: string, doctorId: string): Promise<string | null> {
  const found = await read<{ r: Row }>(
    `MATCH (r:ConsultRequest {id: $id}) RETURN properties(r) AS r`,
    { id },
  );
  const req = found[0]?.r ? mapRequest(found[0].r) : null;
  if (!req) throw new DomainError("That visit no longer exists.", 404);
  if (req.doctorId !== doctorId) throw new DomainError("That isn't your visit.", 403);
  if (req.status !== "accepted") throw new DomainError("That visit isn't in progress.", 409);

  const next = nextTripStage(req);
  if (!next) return null;
  await write(
    `MATCH (r:ConsultRequest {id: $id})
     WHERE r.status = 'accepted'
     SET r.tripStage = $next, r.tripStageAt = $now`,
    { id, next, now: new Date().toISOString() },
  );
  return next;
}

// ── Gigs ─────────────────────────────────────────────────────

export async function getGigs(doctorId?: string): Promise<Gig[]> {
  const rows = doctorId
    ? await read<{ g: Row }>(
        `MATCH (g:Gig {doctorId: $doctorId}) RETURN properties(g) AS g
         ORDER BY g.createdAt DESC LIMIT 100`,
        { doctorId },
      )
    : await read<{ g: Row }>(
        `MATCH (g:Gig) RETURN properties(g) AS g ORDER BY g.createdAt DESC LIMIT 200`,
      );
  return rows.map((x) => mapGig(x.g));
}

export async function getGigById(id: string): Promise<Gig | null> {
  const rows = await read<{ g: Row }>(
    `MATCH (g:Gig {id: $id}) RETURN properties(g) AS g`,
    { id },
  );
  return rows[0]?.g ? mapGig(rows[0].g) : null;
}

const liveGigCount = async (doctorId: string, exceptId?: string) => {
  const rows = await read<{ n: number }>(
    `MATCH (g:Gig {doctorId: $doctorId, status: 'active'})
     WHERE g.id <> coalesce($exceptId, '')
     RETURN count(g) AS n`,
    { doctorId, exceptId: exceptId ?? null },
  );
  return Number(rows[0]?.n ?? 0);
};

export async function createGig(input: {
  doctorId: string;
  title: string;
  description: string;
  type: string;
  price: number;
  durationMinutes: number;
}): Promise<Gig> {
  if (!(await getDoctorById(input.doctorId))) {
    throw new DomainError("That doctor no longer exists.", 404);
  }
  if ((await liveGigCount(input.doctorId)) >= MAX_ACTIVE_GIGS) {
    throw new DomainError(
      `You can have ${MAX_ACTIVE_GIGS} live gigs at once. Pause one first.`,
      409,
    );
  }
  const gig = normalizeGig(input, {
    id: uid("gig"),
    doctorId: input.doctorId,
    createdAt: new Date().toISOString(),
  });
  if (!gig.title) throw new DomainError("Give the gig a title.", 400);
  if (gig.price <= 0) throw new DomainError("Set a price for the gig.", 400);

  // OFFERS makes the doctor's shelf traversable; the flat doctorId keeps the
  // simple lookups above index-friendly.
  const rows = await write<{ g: Row }>(
    `MATCH (d:Doctor {id: $doctorId})
     CREATE (g:Gig {
       id: $id, doctorId: $doctorId, title: $title, description: $description,
       type: $type, price: $price, durationMinutes: $durationMinutes,
       status: $status, createdAt: $createdAt, updatedAt: null
     })
     MERGE (d)-[:OFFERS]->(g)
     RETURN properties(g) AS g`,
    { ...gig },
  );
  if (!rows[0]) throw new DomainError("Could not publish that gig.", 500);
  return mapGig(rows[0].g);
}

/** A gig this doctor owns, or a 403/404 explaining why not. */
async function ownGig(id: string, doctorId: string): Promise<Gig> {
  const gig = await getGigById(id);
  if (!gig) throw new DomainError("That gig no longer exists.", 404);
  if (gig.doctorId !== doctorId) throw new DomainError("That isn't your gig.", 403);
  return gig;
}

export async function updateGig(id: string, doctorId: string, patch: unknown) {
  const gig = await ownGig(id, doctorId);
  const clean = sanitizeGigPatch(patch);
  if (Object.keys(clean).length === 0) return;
  if (
    clean.status === "active" &&
    gig.status !== "active" &&
    (await liveGigCount(doctorId, id)) >= MAX_ACTIVE_GIGS
  ) {
    throw new DomainError(
      `You can have ${MAX_ACTIVE_GIGS} live gigs at once. Pause one first.`,
      409,
    );
  }
  // Only the keys the allowlist passed are written, so a partial edit never
  // blanks a field the form didn't send.
  const sets = Object.keys(clean)
    .map((k) => `g.${k} = $${k}`)
    .join(", ");
  await write(
    `MATCH (g:Gig {id: $id}) SET ${sets}, g.updatedAt = $now`,
    { ...clean, id, now: new Date().toISOString() },
  );
}

/**
 * Publish, pause or retire a listing. Deliberately does NOT touch hires
 * already made against it — the request carries its own gigTitle snapshot.
 */
export async function setGigStatus(id: string, doctorId: string, status: GigStatus) {
  const gig = await ownGig(id, doctorId);
  if (
    status === "active" &&
    gig.status !== "active" &&
    (await liveGigCount(doctorId, id)) >= MAX_ACTIVE_GIGS
  ) {
    throw new DomainError(
      `You can have ${MAX_ACTIVE_GIGS} live gigs at once. Pause one first.`,
      409,
    );
  }
  await write(
    `MATCH (g:Gig {id: $id}) SET g.status = $status, g.updatedAt = $now`,
    { id, status, now: new Date().toISOString() },
  );
}

export async function setDoctorAvailability(id: string, availability: DoctorAvailability) {
  const rows = await write<{ id: string }>(
    `MATCH (d:Doctor {id: $id})
     SET d.availability = $availability, d.lastSeen = $now
     RETURN d.id AS id`,
    { id, availability: JSON.stringify(availability), now: new Date().toISOString() },
  );
  if (!rows[0]) throw new DomainError("That doctor no longer exists.", 404);
}

export async function completeRequest(
  id: string,
  opts?: { notes?: string; prescription?: { name: string; qty: number }[]; doctorId?: string },
) {
  const now = new Date().toISOString();
  // Completing releases the doctor's "in a consult" state (which gates their
  // urgent feed) and credits a wallet — only the doctor on it may close it.
  if (opts?.doctorId) {
    const found = await read<{ r: Row }>(
      `MATCH (r:ConsultRequest {id: $id}) RETURN properties(r) AS r`,
      { id },
    );
    const req = found[0]?.r ? mapRequest(found[0].r) : null;
    if (!req) return;
    if (!claimableBy(req, opts.doctorId)) {
      throw new DomainError("That consult isn't yours to complete.", 403);
    }
  }
  // Flip the request and persist a Consult record of what happened.
  const rows = await write<{ r: Row }>(
    `MATCH (r:ConsultRequest {id: $id})
     WHERE r.status IN ['accepted', 'pending']
     SET r.status = 'completed', r.completedAt = $now
     CREATE (c:Consult {
       id: $cid, requestId: r.id, doctorId: r.doctorId, patientId: r.patientId,
       startedAt: r.createdAt, endedAt: $now, notes: $notes
     })
     CREATE (r)-[:RESULTED_IN]->(c)
     RETURN properties(r) AS r`,
    { id, cid: uid("con"), now, notes: opts?.notes ?? "" },
  );
  if (!rows[0]) return;
  const r = rows[0].r;

  // Credit the doctor's wallet once: platform commission + net.
  if (r.doctorId) {
    const gross = Number(r.fee ?? 0);
    const commission = Math.round(gross * COMMISSION_RATE);
    await write(
      `MATCH (req:ConsultRequest {id: $id})
       WHERE NOT EXISTS { MATCH (:Transaction {requestId: $id, kind: 'earning'}) }
       CREATE (:Transaction {
         id: $txnId, doctorId: $doctorId, kind: 'earning', requestId: $id,
         patientName: $patientName, method: $method, gross: $gross,
         commission: $commission, net: $net, createdAt: $now
       })`,
      {
        id,
        txnId: uid("txn"),
        doctorId: r.doctorId,
        patientName: r.patientName ?? null,
        method: r.paymentMethod ?? "online",
        gross,
        commission,
        net: gross - commission,
        now,
      },
    );
  }

  // Optional prescription → its own node, ready for AuraMed to fulfil.
  if (opts?.prescription && opts.prescription.length > 0) {
    await write(
      `MATCH (r:ConsultRequest {id: $id})-[:RESULTED_IN]->(c:Consult)
       CREATE (rx:Prescription {
         id: $rxid, consultId: c.id, doctorId: r.doctorId,
         patientId: r.patientId, items: $items, createdAt: $now
       })
       CREATE (c)-[:PRESCRIBED]->(rx)`,
      { id, rxid: uid("rx"), items: JSON.stringify(opts.prescription), now },
    );
  }
}

// ── Wallet / payments ────────────────────────────────────────
export async function getTransactions(): Promise<Transaction[]> {
  const rows = await read<{ t: Row }>(
    `MATCH (t:Transaction) RETURN properties(t) AS t ORDER BY t.createdAt DESC`,
  );
  return rows.map((x) => mapTransaction(x.t));
}

/** Doctor withdraws their full wallet balance to their bank (instant). */
export async function requestPayout(doctorId: string): Promise<boolean> {
  const bal = await read<{ bal: number }>(
    `MATCH (t:Transaction {doctorId: $doctorId}) RETURN coalesce(sum(t.net), 0) AS bal`,
    { doctorId },
  );
  const balance = Number(bal[0]?.bal ?? 0);
  if (balance <= 0) return false;
  await write(
    `CREATE (t:Transaction {
       id: $id, doctorId: $doctorId, kind: 'payout', requestId: null,
       patientName: null, method: null, gross: 0, commission: 0,
       net: $net, createdAt: $now
     })`,
    { id: uid("txn"), doctorId, net: -balance, now: new Date().toISOString() },
  );
  return true;
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

export async function setSosCategory(sosId: string, category: string) {
  await write(`MATCH (s:Sos {id: $sosId}) SET s.category = $category`, { sosId, category });
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

// ── Reviews ──────────────────────────────────────────────────
/** One review per completed request, only by its own patient for its
 *  own doctor. Also refreshes the doctor's aggregate rating. */
export async function createReview(input: {
  patientId: string;
  patientName: string;
  doctorId: string;
  requestId: string;
  rating: number;
  comment: string;
}): Promise<Review | null> {
  const rating = Math.min(5, Math.max(1, Math.round(Number(input.rating) || 0)));
  const rows = await write<{ v: Row }>(
    `MATCH (r:ConsultRequest {id: $requestId})
     WHERE r.status = 'completed'
       AND r.patientId = $patientId
       AND r.doctorId = $doctorId
       AND NOT EXISTS { MATCH (:Review {requestId: $requestId}) }
     CREATE (v:Review {
       id: $id, requestId: $requestId, doctorId: $doctorId,
       patientId: $patientId, patientName: $patientName,
       rating: $rating, comment: $comment, createdAt: $now
     })
     RETURN properties(v) AS v`,
    {
      ...input,
      rating,
      comment: String(input.comment ?? "").slice(0, 600),
      id: uid("rev"),
      now: new Date().toISOString(),
    },
  );
  if (!rows[0]) {
    throw new DomainError("You can only review a consult you completed, once.", 409);
  }
  await write(
    `MATCH (v:Review {doctorId: $doctorId})
     WITH avg(v.rating) AS avgRating
     MATCH (d:Doctor {id: $doctorId})
     SET d.rating = round(avgRating * 10) / 10.0`,
    { doctorId: input.doctorId },
  );
  return mapReview(rows[0].v);
}

/** Doctor → patient rating after a completed consult (mutual ratings).
 *  One rating per completed request, by its own doctor. Refreshes the
 *  patient's aggregate rating on their User node. */
export async function ratePatient(input: {
  doctorId: string;
  doctorName: string;
  requestId: string;
  rating: number;
  comment: string;
}): Promise<void> {
  const rating = Math.min(5, Math.max(1, Math.round(Number(input.rating) || 0)));
  const rows = await write<{ v: Row }>(
    `MATCH (r:ConsultRequest {id: $requestId})
     WHERE r.status = 'completed'
       AND r.doctorId = $doctorId
       AND r.patientId IS NOT NULL
       AND NOT EXISTS { MATCH (:PatientReview {requestId: $requestId}) }
     CREATE (v:PatientReview {
       id: $id, requestId: $requestId, patientId: r.patientId,
       doctorId: $doctorId, doctorName: $doctorName,
       rating: $rating, comment: $comment, createdAt: $now
     })
     RETURN properties(v) AS v`,
    {
      requestId: input.requestId,
      doctorId: input.doctorId,
      doctorName: input.doctorName,
      rating,
      comment: String(input.comment ?? "").slice(0, 600),
      id: uid("prev"),
      now: new Date().toISOString(),
    },
  );
  if (!rows[0]) {
    throw new DomainError("You can only rate a patient from a consult you completed, once.", 409);
  }
  await write(
    `MATCH (v:PatientReview {patientId: $patientId})
     WITH avg(v.rating) AS avgRating, count(v) AS c
     MATCH (p:User {id: $patientId})
     SET p.rating = round(avgRating * 10) / 10.0, p.ratingCount = c`,
    { patientId: rows[0].v.patientId },
  );
}

// ── Ambulance CRUD (ops) ─────────────────────────────────────
export async function createAmbulance(input: {
  vehicleNo: string;
  driverName: string;
  lat?: number | null;
  lng?: number | null;
}): Promise<Ambulance> {
  if (!input.vehicleNo?.trim() || !input.driverName?.trim()) {
    throw new DomainError("Vehicle number and driver name are required.");
  }
  const rows = await write<{ a: Row }>(
    `CREATE (a:Ambulance {
       id: $id, vehicleNo: $vehicleNo, driverName: $driverName,
       status: 'free', lat: $lat, lng: $lng
     }) RETURN properties(a) AS a`,
    {
      id: uid("amb"),
      vehicleNo: input.vehicleNo.trim(),
      driverName: input.driverName.trim(),
      lat: input.lat ?? MAP_CENTER.lat,
      lng: input.lng ?? MAP_CENTER.lng,
    },
  );
  return mapAmbulance(rows[0].a);
}

export async function updateAmbulance(
  id: string,
  patch: {
    vehicleNo?: string;
    driverName?: string;
    status?: string;
    lat?: number;
    lng?: number;
  },
) {
  const status =
    patch.status && ["free", "dispatched", "busy"].includes(patch.status)
      ? patch.status
      : null;
  await write(
    `MATCH (a:Ambulance {id: $id})
     SET a += {
       vehicleNo: coalesce($vehicleNo, a.vehicleNo),
       driverName: coalesce($driverName, a.driverName),
       status: coalesce($status, a.status),
       lat: coalesce($lat, a.lat),
       lng: coalesce($lng, a.lng)
     }`,
    {
      id,
      vehicleNo: patch.vehicleNo ?? null,
      driverName: patch.driverName ?? null,
      status,
      lat: typeof patch.lat === "number" ? patch.lat : null,
      lng: typeof patch.lng === "number" ? patch.lng : null,
    },
  );
}

// ── Audit trail ──────────────────────────────────────────────
/** Cheap append-only audit node per write. Fire-and-forget. */
export async function audit(entry: {
  actorId: string;
  role: string;
  action: string;
  meta?: unknown;
}) {
  try {
    await write(
      `CREATE (:Audit {
         id: $id, actorId: $actorId, role: $role, action: $action,
         meta: $meta, at: $now
       })`,
      {
        id: uid("aud"),
        actorId: entry.actorId,
        role: entry.role,
        action: entry.action,
        meta: JSON.stringify(entry.meta ?? {}).slice(0, 2000),
        now: new Date().toISOString(),
      },
    );
  } catch (err) {
    console.error("audit write failed (non-fatal):", err);
  }
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
