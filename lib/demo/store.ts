"use client";

/**
 * DEMO ENGINE - an in-browser backend that needs no server.
 *
 * It now behaves like a real shared backend for LOCAL testing:
 *   • State is persisted to localStorage (survives refresh).
 *   • Mutations broadcast over a BroadcastChannel, so a request raised
 *     in the PATIENT tab shows up live in the DOCTOR / OPS tabs on the
 *     same browser - patient → doctor actually connects.
 *   • There is NO demo/seed data at all. The store starts EMPTY; every
 *     doctor, SOS, request and order is created through real product
 *     flows (register / book / SOS).
 *
 * In LIVE mode (Neo4j backend) this is never started; hooks read the
 * /api routes instead.
 */
import { MAP_CENTER, COMMISSION_RATE } from "@/lib/config";
import { AVATAR_COLORS } from "@/lib/demo/seed";
import { seedDoctors } from "@/lib/seed-doctors";
import {
  assertCanAccept,
  assertCanHire,
  reopensOnDoctorCancel,
  resolveScheduledSlot,
  type ResolvedHire,
  type ResolvedSlot,
} from "@/lib/scheduling/booking";
import { coerceBookingMode } from "@/lib/scheduling/slots";
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
  OrderStatus,
  Prescription,
  Review,
  SosEvent,
  Transaction,
} from "@/lib/types/domain";
import {
  newRxCode,
  newShareToken,
  sanitizeRxDraft,
  type RxDraft,
} from "@/lib/prescriptions/rules";

/** Wallet balance for a doctor = sum of every ledger entry's net. */
export function walletBalance(txns: Transaction[], doctorId: string): number {
  return txns.filter((t) => t.doctorId === doctorId).reduce((a, t) => a + t.net, 0);
}

export interface DemoState {
  doctors: Doctor[];
  /** Service packages doctors publish for patients to hire. */
  gigs: Gig[];
  ambulances: Ambulance[];
  sos: SosEvent[];
  requests: ConsultRequest[];
  orders: Order[];
  reviews: Review[];
  transactions: Transaction[];
  /** Prescriptions doctors have issued, newest first. */
  prescriptions: Prescription[];
}

type Listener = () => void;

const ORDER_FLOW: OrderStatus[] = [
  "placed",
  "packed",
  "out_for_delivery",
  "delivered",
];

// v2: pre-seeded demo data removed — old v1 payloads are ignored so
// every browser starts genuinely empty.
// v3: gigs added. Bumped rather than backfilled because a cached v2 payload
// would deserialize with `gigs: undefined` and every read would have to guard.
const STORAGE_KEY = "iyashi:demo-state:v3";
const CHANNEL = "iyashi:demo";
// Set once the demo roster has been seeded, so we never seed over a reset
// or over doctors the user created themselves.
const SEED_KEY = "iyashi:demo-seeded:v1";

let state: DemoState | null = null;
let listeners: Listener[] = [];
let channel: BroadcastChannel | null = null;
let clientReady = false;
let idSeq = 1000;

function nextId(prefix: string) {
  return `${prefix}-${Date.now().toString(36)}-${++idSeq}`;
}

function fresh(): DemoState {
  // Always empty — there is no seeded data anywhere in the app.
  return {
    doctors: [],
    gigs: [],
    ambulances: [],
    sos: [],
    requests: [],
    orders: [],
    reviews: [],
    transactions: [],
    prescriptions: [],
  };
}

function getState(): DemoState {
  if (!state) state = fresh();
  return state;
}

/** Persist + notify subscribers. `broadcast` fans the change out to
 *  other tabs (skipped when we're applying an inbound broadcast). */
function commit(broadcast = true) {
  state = { ...getState() };
  if (typeof window !== "undefined") {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {
      /* quota / private mode - ignore */
    }
    if (broadcast && channel) {
      try {
        channel.postMessage({ type: "state", state });
      } catch {
        /* channel closed or structured-clone failure - ignore */
      }
    }
  }
  // A listener must never break the store: isolate each one.
  listeners.forEach((l) => {
    try {
      l();
    } catch {
      /* a subscriber threw - keep the rest alive */
    }
  });
}

export const demoStore = {
  get: getState,

  subscribe(listener: Listener): () => void {
    listeners.push(listener);
    setupClient();
    return () => {
      listeners = listeners.filter((l) => l !== listener);
    };
  },

  /** Wipe all local test data and start clean. */
  reset() {
    if (typeof window !== "undefined") {
      try {
        window.localStorage.removeItem(STORAGE_KEY);
      } catch {
        /* ignore */
      }
    }
    state = fresh();
    commit();
  },

  // ── Patient-side create actions (the connection to the consoles) ──
  createSosEvent(input: {
    patientId: string;
    patientName: string;
    category: SosEvent["category"];
    address: string;
    lat: number;
    lng: number;
    notes?: string;
  }): SosEvent {
    const event: SosEvent = {
      id: nextId("sos"),
      patientId: input.patientId,
      patientName: input.patientName,
      category: input.category,
      status: "open",
      address: input.address,
      lat: input.lat,
      lng: input.lng,
      ambulanceId: null,
      doctorId: null,
      notes: input.notes ?? "Patient-triggered SOS.",
      createdAt: new Date().toISOString(),
      resolvedAt: null,
    };
    const s = getState();
    s.sos = [event, ...s.sos];
    commit();
    return event;
  },

  createConsultRequest(input: {
    patientId: string;
    patientName: string;
    type: ConsultRequest["type"];
    symptoms: string;
    paymentMethod?: ConsultRequest["paymentMethod"];
    fee: number;
    address: string;
    lat: number;
    lng: number;
    doctorId?: string | null;
    mode?: ConsultRequest["mode"];
    scheduledAt?: string | null;
    gigId?: string | null;
  }): ConsultRequest {
    const s = getState();
    const doctorId = input.doctorId ?? null;
    const mode = coerceBookingMode(input.mode);
    // Same slot and gig rules as the server backends — a demo booking is
    // rejected for exactly the reasons a live one would be.
    let slot: ResolvedSlot | null = null;
    let hire: ResolvedHire | null = null;
    if (mode === "scheduled") {
      if (!doctorId) throw new Error("Pick a doctor before choosing a time.");
      slot = resolveScheduledSlot({
        doctor: s.doctors.find((d) => d.id === doctorId),
        startIso: String(input.scheduledAt ?? ""),
        existing: s.requests,
      });
    } else if (mode === "gig") {
      if (!doctorId) throw new Error("Pick a doctor before hiring a gig.");
      hire = assertCanHire({
        gig: s.gigs.find((g) => g.id === input.gigId),
        doctor: s.doctors.find((d) => d.id === doctorId),
        existing: s.requests,
      });
    }
    const req: ConsultRequest = {
      id: nextId("req"),
      patientId: input.patientId,
      patientName: input.patientName,
      type: hire?.type ?? input.type,
      status: "pending",
      symptoms: input.symptoms,
      paymentMethod: input.paymentMethod ?? "online",
      fee: hire ? hire.fee : input.fee,
      address: input.address,
      lat: input.lat,
      lng: input.lng,
      createdAt: new Date().toISOString(),
      mode,
      gigId: hire?.gigId ?? null,
      gigTitle: hire?.gigTitle ?? null,
      broadcast: mode === "emergency" && doctorId === null,
      scheduledAt: slot?.scheduledAt ?? null,
      scheduledEnd: slot?.scheduledEnd ?? null,
      slotMinutes: slot?.slotMinutes ?? hire?.durationMinutes ?? null,
      tripStage: null,
      tripStageAt: null,
      passedBy: [],
      doctorId,
    };
    s.requests = [req, ...s.requests];
    commit();
    return req;
  },

  /** Patient or doctor calls off a booking, freeing the slot. Ownership is
   *  checked server-side in live mode; the demo store has no sessions, so
   *  only the state check applies here. */
  cancelRequest(id: string, opts?: { reason?: string; byDoctor?: boolean }) {
    const s = getState();
    const req = s.requests.find((r) => r.id === id);
    if (!req) throw new Error("That booking no longer exists.");
    if (req.status !== "pending" && req.status !== "accepted") {
      throw new Error("That booking can no longer be cancelled.");
    }
    const byDoctor = Boolean(opts?.byDoctor);
    const reason = opts?.reason?.trim() || null;
    if (byDoctor && !reason) throw new Error("Tell the patient why you're cancelling.");

    // A doctor standing down from a broadcast puts it back out to the pool.
    const reopen = byDoctor && reopensOnDoctorCancel(req);
    const doctorId = req.doctorId;
    s.requests = s.requests.map((r) => {
      if (r.id !== id) return r;
      if (reopen) {
        return {
          ...r,
          status: "pending" as const,
          doctorId: null,
          acceptedAt: null,
          tripStage: null,
          tripStageAt: null,
          cancelReason: reason,
          passedBy: [...new Set([...(r.passedBy ?? []), ...(doctorId ? [doctorId] : [])])],
        };
      }
      return {
        ...r,
        status: "cancelled" as const,
        cancelledAt: new Date().toISOString(),
        cancelledBy: byDoctor ? ("doctor" as const) : ("patient" as const),
        cancelReason: reason,
      };
    });
    commit();
  },

  setDoctorAvailability(id: string, availability: DoctorAvailability) {
    const s = getState();
    s.doctors = s.doctors.map((d) => (d.id === id ? { ...d, availability } : d));
    commit();
  },

  // ── Gigs ───────────────────────────────────────────────────
  createGig(input: {
    doctorId: string;
    title: string;
    description: string;
    type: ConsultRequest["type"];
    price: number;
    durationMinutes: number;
  }): Gig {
    const s = getState();
    const live = s.gigs.filter((g) => g.doctorId === input.doctorId && g.status === "active");
    if (live.length >= MAX_ACTIVE_GIGS) {
      throw new Error(`You can have ${MAX_ACTIVE_GIGS} live gigs at once. Pause one first.`);
    }
    const gig = normalizeGig(input, {
      id: nextId("gig"),
      doctorId: input.doctorId,
      createdAt: new Date().toISOString(),
    });
    if (!gig.title) throw new Error("Give the gig a title.");
    if (gig.price <= 0) throw new Error("Set a price for the gig.");
    s.gigs = [gig, ...s.gigs];
    commit();
    return gig;
  },

  updateGig(id: string, patch: unknown) {
    const s = getState();
    const clean = sanitizeGigPatch(patch);
    s.gigs = s.gigs.map((g) =>
      g.id === id ? { ...g, ...clean, updatedAt: new Date().toISOString() } : g,
    );
    commit();
  },

  setGigStatus(id: string, status: GigStatus) {
    const s = getState();
    const gig = s.gigs.find((g) => g.id === id);
    if (!gig) throw new Error("That gig no longer exists.");
    if (status === "active" && gig.status !== "active") {
      const live = s.gigs.filter(
        (g) => g.doctorId === gig.doctorId && g.status === "active" && g.id !== id,
      );
      if (live.length >= MAX_ACTIVE_GIGS) {
        throw new Error(`You can have ${MAX_ACTIVE_GIGS} live gigs at once. Pause one first.`);
      }
    }
    s.gigs = s.gigs.map((g) =>
      g.id === id ? { ...g, status, updatedAt: new Date().toISOString() } : g,
    );
    commit();
  },

  /** Remove a listing for good. Refused while a hire is still waiting on it —
   *  answered hires survive, since the request snapshots the gig's title. */
  deleteGig(id: string) {
    const s = getState();
    const gig = s.gigs.find((g) => g.id === id);
    if (!gig) throw new Error("That gig no longer exists.");
    const owed = s.requests.some(
      (r) => r.gigId === id && (r.status === "pending" || r.status === "accepted"),
    );
    if (owed) {
      throw new Error("Someone is still waiting on this gig. Answer or finish that hire first.");
    }
    s.gigs = s.gigs.filter((g) => g.id !== id);
    commit();
  },

  /** Move a visit one step along its rail. Null when there is nowhere left. */
  advanceTrip(id: string): string | null {
    const s = getState();
    const req = s.requests.find((r) => r.id === id);
    if (!req) throw new Error("That visit no longer exists.");
    if (req.status !== "accepted") throw new Error("That visit isn't in progress.");
    const next = nextTripStage(req);
    if (!next) return null;
    s.requests = s.requests.map((r) =>
      r.id === id ? { ...r, tripStage: next, tripStageAt: new Date().toISOString() } : r,
    );
    commit();
    return next;
  },

  createOrder(input: {
    patientId: string;
    patientName: string;
    items: { name: string; qty: number }[];
    total: number;
    address: string;
    darkStore: string;
  }): Order {
    const order: Order = {
      id: nextId("ord"),
      patientId: input.patientId,
      patientName: input.patientName,
      status: "placed",
      items: input.items,
      total: input.total,
      address: input.address,
      darkStore: input.darkStore,
      etaMins: 10,
      createdAt: new Date().toISOString(),
    };
    const s = getState();
    s.orders = [order, ...s.orders];
    commit();
    return order;
  },

  // ── Reviews (one per completed request) ───────────────────
  createReview(input: {
    patientId: string;
    patientName: string;
    doctorId: string;
    requestId: string;
    rating: number;
    comment: string;
  }): Review | null {
    const s = getState();
    const req = s.requests.find((r) => r.id === input.requestId);
    const already = s.reviews.some((v) => (v as Review & { requestId?: string }).requestId === input.requestId);
    if (!req || req.status !== "completed" || req.patientId !== input.patientId || already) {
      return null;
    }
    const review: Review & { requestId: string; doctorId: string } = {
      id: nextId("rev"),
      requestId: input.requestId,
      doctorId: input.doctorId,
      patientName: input.patientName,
      rating: Math.min(5, Math.max(1, Math.round(input.rating))),
      comment: input.comment.slice(0, 600),
      createdAt: new Date().toISOString(),
    };
    s.reviews = [review, ...s.reviews];
    // Refresh the doctor's aggregate rating.
    const mine = s.reviews.filter(
      (v) => (v as Review & { doctorId?: string }).doctorId === input.doctorId,
    );
    const avg = mine.reduce((a, v) => a + v.rating, 0) / Math.max(1, mine.length);
    s.doctors = s.doctors.map((d) =>
      d.id === input.doctorId ? { ...d, rating: Math.round(avg * 10) / 10 } : d,
    );
    commit();
    return review;
  },

  // ── Ambulance CRUD (ops) ──────────────────────────────────
  createAmbulance(input: {
    vehicleNo: string;
    driverName: string;
    lat?: number;
    lng?: number;
  }): Ambulance {
    const s = getState();
    const ambulance: Ambulance = {
      id: nextId("amb"),
      vehicleNo: input.vehicleNo,
      driverName: input.driverName,
      status: "free",
      lat: input.lat ?? MAP_CENTER.lat,
      lng: input.lng ?? MAP_CENTER.lng,
    };
    s.ambulances = [ambulance, ...s.ambulances];
    commit();
    return ambulance;
  },

  updateAmbulance(id: string, patch: Partial<Ambulance>) {
    const s = getState();
    s.ambulances = s.ambulances.map((a) => (a.id === id ? { ...a, ...patch } : a));
    commit();
  },

  // ── Doctor onboarding + profile edits ─────────────────────
  registerDoctor(input: {
    fullName: string;
    specialty: string;
    kind: Doctor["kind"];
    gender: Doctor["gender"];
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
    /** Real device location, when the browser granted it. */
    lat?: number;
    lng?: number;
  }): Doctor {
    const palette = AVATAR_COLORS;
    const s = getState();
    const doctor: Doctor = {
      id: nextId("doc"),
      fullName: input.fullName.startsWith("Dr.")
        ? input.fullName
        : `Dr. ${input.fullName}`,
      specialty: input.specialty,
      kind: input.kind,
      gender: input.gender,
      age: input.age,
      experienceYears: input.experienceYears,
      languages: input.languages?.length ? input.languages : ["English", "Hindi"],
      qualifications: input.qualifications,
      education: input.education,
      registrationNo: input.registrationNo,
      about: input.about,
      status: "online",
      verified: false,
      rating: 0,
      consultFee: input.consultFee,
      homeVisitFee: input.homeVisitFee,
      clinicAddress: input.clinicAddress?.trim() || "",
      avatarColor: palette[s.doctors.length % palette.length],
      // Real location when granted; otherwise near the fallback center
      // until the doctor goes online and their device reports position.
      lat: input.lat ?? MAP_CENTER.lat + (Math.random() - 0.5) * 0.02,
      lng: input.lng ?? MAP_CENTER.lng + (Math.random() - 0.5) * 0.02,
      lastSeen: new Date().toISOString(),
    };
    s.doctors = [doctor, ...s.doctors];
    commit();
    return doctor;
  },

  updateDoctor(id: string, patch: Partial<Doctor>) {
    const s = getState();
    s.doctors = s.doctors.map((d) => (d.id === id ? { ...d, ...patch } : d));
    commit();
  },

  // ── Mutations shared by the consoles ──────────────────────
  setDoctorStatus(id: string, status: Doctor["status"]) {
    const s = getState();
    s.doctors = s.doctors.map((d) =>
      d.id === id ? { ...d, status, lastSeen: new Date().toISOString() } : d,
    );
    commit();
  },

  acceptRequest(id: string, doctorId: string) {
    const s = getState();
    // Only the first doctor to accept wins: skip if it is no longer
    // pending (another doctor already claimed it).
    const target = s.requests.find((r) => r.id === id);
    if (!target || target.status !== "pending") return;
    // Gigs and emergencies stay one-at-a-time; appointments must not
    // double-book. Same guard the servers run, so rejections read identically.
    assertCanAccept(target, s.requests, doctorId);
    const at = new Date().toISOString();
    s.requests = s.requests.map((r) =>
      r.id === id
        ? {
            ...r,
            status: "accepted" as const,
            doctorId,
            acceptedAt: at,
            // The trip rail starts the moment someone claims it.
            tripStage: "accepted" as const,
            tripStageAt: at,
          }
        : r,
    );
    // A hired gig leaves the shelf the moment it's accepted: the doctor is
    // committed to this one, so the listing pauses itself instead of inviting
    // a second booking on the same package. Resume it from the shelf later.
    if (target.gigId) {
      s.gigs = s.gigs.map((g) =>
        g.id === target.gigId && g.doctorId === doctorId && g.status === "active"
          ? { ...g, status: "paused" as const, updatedAt: at }
          : g,
      );
    }
    commit();
  },

  declineRequest(id: string, doctorId?: string) {
    const s = getState();
    const req = s.requests.find((r) => r.id === id);
    if (!req) return;
    // Passing on a broadcast must not kill it for everyone else.
    if (doctorId && req.broadcast && req.status === "pending" && req.doctorId === null) {
      s.requests = s.requests.map((r) =>
        r.id === id
          ? { ...r, passedBy: [...new Set([...(r.passedBy ?? []), doctorId])] }
          : r,
      );
      commit();
      return;
    }
    s.requests = s.requests.map((r) =>
      r.id === id ? { ...r, status: "declined" } : r,
    );
    commit();
  },

  completeRequest(id: string) {
    const s = getState();
    const req = s.requests.find((r) => r.id === id);
    s.requests = s.requests.map((r) =>
      r.id === id ? { ...r, status: "completed", completedAt: new Date().toISOString() } : r,
    );
    // Credit the doctor's wallet once: platform takes a commission, the
    // doctor's net lands in their wallet.
    if (
      req &&
      req.doctorId &&
      !s.transactions.some((t) => t.kind === "earning" && t.requestId === req.id)
    ) {
      const commission = Math.round(req.fee * COMMISSION_RATE);
      s.transactions = [
        {
          id: nextId("txn"),
          doctorId: req.doctorId,
          kind: "earning",
          requestId: req.id,
          patientName: req.patientName,
          method: req.paymentMethod ?? "online",
          gross: req.fee,
          commission,
          net: req.fee - commission,
          createdAt: new Date().toISOString(),
        },
        ...s.transactions,
      ];
    }
    commit();
  },

  /**
   * Doctor issues the prescription that closes a consult.
   *
   * Mirrors the server rule exactly — one prescription per consult, and
   * issuing completes the visit — so the composer behaves identically whether
   * or not a backend is configured. The demo has no accounts, so the doctor
   * snapshot comes off the local doctor row.
   */
  issuePrescription(requestId: string, draft: RxDraft): Prescription {
    const s = getState();
    const req = s.requests.find((r) => r.id === requestId);
    if (!req) throw new Error("That consult no longer exists.");
    if (s.prescriptions.some((rx) => rx.requestId === requestId))
      throw new Error("A prescription has already been issued for this consult.");
    const clean = sanitizeRxDraft(draft);
    const doctor = s.doctors.find((d) => d.id === req.doctorId);
    const rx: Prescription = {
      id: nextId("rx"),
      code: newRxCode(),
      requestId,
      patientId: req.patientId ?? null,
      patientName: req.patientName,
      patientAge: null,
      patientGender: null,
      patientAllergies: null,
      doctorId: req.doctorId ?? "",
      doctorName: doctor?.fullName ?? "Doceeto doctor",
      doctorSpecialty: doctor?.specialty ?? "",
      doctorQualifications: doctor?.qualifications ?? null,
      doctorRegistrationNo: doctor?.registrationNo ?? null,
      diagnosis: clean.diagnosis,
      items: clean.items,
      advice: clean.advice,
      followUpDays: clean.followUpDays,
      issuedAt: new Date().toISOString(),
      shareToken: newShareToken(),
    };
    s.prescriptions = [rx, ...s.prescriptions];
    commit();
    if (req.status === "accepted") demoStore.completeRequest(requestId);
    return rx;
  },

  /** Doctor withdraws their full wallet balance to their bank (instant). */
  requestPayout(doctorId: string) {
    const s = getState();
    const balance = walletBalance(s.transactions, doctorId);
    if (balance <= 0) return;
    s.transactions = [
      {
        id: nextId("txn"),
        doctorId,
        kind: "payout",
        requestId: null,
        patientName: null,
        method: null,
        gross: 0,
        commission: 0,
        net: -balance,
        createdAt: new Date().toISOString(),
      },
      ...s.transactions,
    ];
    commit();
  },

  assignAmbulance(sosId: string, ambulanceId: string) {
    const s = getState();
    s.sos = s.sos.map((e) =>
      e.id === sosId
        ? { ...e, ambulanceId, status: e.status === "open" ? "assigned" : e.status }
        : e,
    );
    s.ambulances = s.ambulances.map((a) =>
      a.id === ambulanceId ? { ...a, status: "dispatched" } : a,
    );
    commit();
  },

  assignDoctorToSos(sosId: string, doctorId: string) {
    const s = getState();
    s.sos = s.sos.map((e) => (e.id === sosId ? { ...e, doctorId } : e));
    commit();
  },

  setSosCategory(sosId: string, category: SosEvent["category"]) {
    const s = getState();
    s.sos = s.sos.map((e) => (e.id === sosId ? { ...e, category } : e));
    commit();
  },

  advanceSos(sosId: string) {
    const order: SosEvent["status"][] = ["open", "assigned", "enroute", "resolved"];
    const s = getState();
    s.sos = s.sos.map((e) => {
      if (e.id !== sosId) return e;
      const i = order.indexOf(e.status);
      const next = order[Math.min(i + 1, order.length - 1)];
      return {
        ...e,
        status: next,
        resolvedAt: next === "resolved" ? new Date().toISOString() : e.resolvedAt,
      };
    });
    commit();
  },

  advanceOrder(orderId: string) {
    const s = getState();
    s.orders = s.orders.map((o) => {
      if (o.id !== orderId) return o;
      const i = ORDER_FLOW.indexOf(o.status);
      if (i < 0 || i >= ORDER_FLOW.length - 1) return o;
      const next = ORDER_FLOW[i + 1];
      return {
        ...o,
        status: next,
        etaMins: next === "delivered" ? 0 : Math.max(1, o.etaMins - 3),
      };
    });
    commit();
  },
};

/** One-time client hydration: load persisted state + open the cross-tab
 *  channel. Runs after mount, so it never causes a hydration mismatch. */
function setupClient() {
  if (clientReady || typeof window === "undefined") return;
  clientReady = true;

  // Load any previously persisted test data.
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as DemoState;
      // Merged over fresh(), not assigned: a payload written before
      // prescriptions existed would otherwise deserialize with
      // `prescriptions: undefined` and every read would have to guard. Merging
      // once here does what bumping STORAGE_KEY used to do, without throwing
      // away the doctors and bookings someone already created.
      if (parsed && Array.isArray(parsed.doctors)) state = { ...fresh(), ...parsed };
    }
  } catch {
    /* corrupt payload - fall back to fresh() */
  }

  // First run (or a legacy empty state): seed a realistic roster of demo
  // doctors so the patient map/list/booking work out of the box. The marker
  // stops us re-seeding after a reset, or once real doctors exist.
  try {
    if (!window.localStorage.getItem(SEED_KEY)) {
      if (!state || state.doctors.length === 0) {
        state = { ...(state ?? fresh()), doctors: seedDoctors() };
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
      }
      window.localStorage.setItem(SEED_KEY, "1");
    }
  } catch {
    // Storage unavailable (private mode): seed in memory for this session.
    if (!state || state.doctors.length === 0) {
      state = { ...(state ?? fresh()), doctors: seedDoctors() };
    }
  }

  // Top up the roster: a doctor added to the seed list in a later version is
  // appended to a browser seeded before they existed. Gated on the seed rows
  // still being present, so a deliberate reset stays empty.
  if (state && state.doctors.some((d) => d.id.startsWith("doc-seed-"))) {
    const have = new Set(state.doctors.map((d) => d.id));
    const added = seedDoctors().filter((d) => !have.has(d.id));
    if (added.length > 0) {
      state = { ...state, doctors: [...state.doctors, ...added] };
      try {
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
      } catch {
        /* storage unavailable — the top-up still applies for this session */
      }
    }
  }

  // Subscribe to updates from other tabs (patient ↔ doctor ↔ ops).
  try {
    channel = new BroadcastChannel(CHANNEL);
    channel.onmessage = (ev: MessageEvent) => {
      if (ev.data?.type === "state" && ev.data.state) {
        state = ev.data.state as DemoState;
        commit(false); // apply locally, don't echo back
      }
    };
  } catch {
    /* BroadcastChannel unsupported - fall back to storage events below */
  }

  // Fallback (and belt-and-braces) cross-tab sync: the `storage` event
  // fires in OTHER tabs when localStorage changes, so even without
  // BroadcastChannel the patient ↔ doctor connection still works.
  try {
    window.addEventListener("storage", (e) => {
      if (e.key !== STORAGE_KEY || !e.newValue) return;
      try {
        const parsed = JSON.parse(e.newValue) as DemoState;
        if (parsed && Array.isArray(parsed.doctors)) {
          state = parsed;
          listeners.forEach((l) => {
            try {
              l();
            } catch {
              /* ignore */
            }
          });
        }
      } catch {
        /* corrupt payload - ignore */
      }
    });
  } catch {
    /* addEventListener unavailable - single-tab still works */
  }

  // Emit once so the first paint reflects persisted state.
  listeners.forEach((l) => l());
}
