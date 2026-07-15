"use client";

/**
 * DEMO ENGINE - an in-browser backend that needs no server.
 *
 * It now behaves like a real shared backend for LOCAL testing:
 *   • State is persisted to localStorage (survives refresh).
 *   • Mutations broadcast over a BroadcastChannel, so a request raised
 *     in the PATIENT tab shows up live in the DOCTOR / OPS tabs on the
 *     same browser - patient → doctor actually connects.
 *   • There is NO fake auto-generated activity. SOS events, consult
 *     requests and orders are the ones YOU create via the patient app.
 *     (SEED_LEVEL controls the starting catalog; default "catalog" =
 *     doctors/ambulances only, zero activity.)
 *
 * In LIVE mode (Supabase configured) this is never started; hooks use
 * Supabase Realtime for the same cross-client behaviour, cross-device.
 */
import { MAP_CENTER, SEED_LEVEL } from "@/lib/config";
import {
  seedAmbulances,
  seedDoctors,
  seedOrders,
  seedRequests,
  seedReviews,
  seedSos,
} from "@/lib/demo/seed";
import { haversineKm } from "@/lib/utils/geo";
import type {
  ConsultRequest,
  Doctor,
  Order,
  OrderStatus,
  Prescription,
  Review,
  SosEvent,
} from "@/lib/types/domain";

export interface DemoState {
  doctors: Doctor[];
  ambulances: ReturnType<typeof seedAmbulances>;
  sos: SosEvent[];
  requests: ConsultRequest[];
  orders: Order[];
  reviews: Review[];
  prescriptions: Prescription[];
}

/** Rough ETA (mins) for a home/clinic visit from distance. Video = none. */
function etaFor(type: ConsultRequest["type"], km: number): number | null {
  if (type === "video") return null;
  // ~25 km/h effective city speed + 8 min to get ready.
  return Math.max(6, Math.round(8 + (km / 25) * 60));
}

type Listener = () => void;

const ORDER_FLOW: OrderStatus[] = [
  "placed",
  "packed",
  "out_for_delivery",
  "delivered",
];

const STORAGE_KEY = "iyashi:demo-state:v1";
const CHANNEL = "iyashi:demo";

let state: DemoState | null = null;
let listeners: Listener[] = [];
let channel: BroadcastChannel | null = null;
let clientReady = false;
let idSeq = 1000;

function nextId(prefix: string) {
  return `${prefix}-${Date.now().toString(36)}-${++idSeq}`;
}

function fresh(): DemoState {
  // Infrastructure catalog - present unless SEED_LEVEL is "none".
  const catalog = SEED_LEVEL === "none";
  return {
    doctors: catalog ? [] : seedDoctors(),
    ambulances: catalog ? [] : seedAmbulances(),
    // Activity is empty unless SEED_LEVEL === "full".
    sos: SEED_LEVEL === "full" ? seedSos() : [],
    requests: SEED_LEVEL === "full" ? seedRequests() : [],
    orders: SEED_LEVEL === "full" ? seedOrders() : [],
    // Reviews are catalog data (a doctor's reputation exists before you
    // create activity), so keep them unless the store is fully empty.
    reviews: catalog ? [] : seedReviews(),
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
    acuity?: ConsultRequest["acuity"];
    triageSummary?: string | null;
    fee: number;
    address: string;
    lat: number;
    lng: number;
    doctorId?: string | null;
  }): ConsultRequest {
    const req: ConsultRequest = {
      id: nextId("req"),
      patientId: input.patientId,
      patientName: input.patientName,
      type: input.type,
      status: "pending",
      symptoms: input.symptoms,
      acuity: input.acuity ?? "routine",
      triageSummary: input.triageSummary ?? null,
      fee: input.fee,
      address: input.address,
      lat: input.lat,
      lng: input.lng,
      createdAt: new Date().toISOString(),
      acceptedAt: null,
      etaMins: null,
      doctorId: input.doctorId ?? null,
    };
    const s = getState();
    s.requests = [req, ...s.requests];
    commit();
    return req;
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

  // ── Doctor onboarding + profile edits ─────────────────────
  registerDoctor(input: {
    fullName: string;
    specialty: string;
    kind: Doctor["kind"];
    gender: Doctor["gender"];
    experienceYears: number;
    regNo?: string | null;
    consultFee: number;
    homeVisitFee: number;
  }): Doctor {
    const palette = ["#C15A38", "#C9A876", "#7C8B63", "#E0A890", "#8A6F52"];
    const s = getState();
    const doctor: Doctor = {
      id: nextId("doc"),
      fullName: input.fullName.startsWith("Dr.")
        ? input.fullName
        : `Dr. ${input.fullName}`,
      specialty: input.specialty,
      kind: input.kind,
      gender: input.gender,
      experienceYears: input.experienceYears,
      languages: ["English", "Hindi"],
      // New doctors start OFFLINE and UNVERIFIED — they cannot take
      // patients until ops verifies their registration.
      status: "offline",
      verified: false,
      verificationStatus: "pending",
      regNo: input.regNo ?? null,
      rating: 0,
      ratingCount: 0,
      consultFee: input.consultFee,
      homeVisitFee: input.homeVisitFee,
      avatarColor: palette[s.doctors.length % palette.length],
      lat: MAP_CENTER.lat + (Math.random() - 0.5) * 0.06,
      lng: MAP_CENTER.lng + (Math.random() - 0.5) * 0.06,
      lastSeen: new Date().toISOString(),
    };
    s.doctors = [doctor, ...s.doctors];
    commit();
    return doctor;
  },

  /** Ops verifies (or rejects) a doctor's registration. */
  verifyDoctor(id: string, approve: boolean) {
    const s = getState();
    s.doctors = s.doctors.map((d) =>
      d.id === id
        ? {
            ...d,
            verified: approve,
            verificationStatus: approve ? "verified" : "rejected",
          }
        : d,
    );
    commit();
  },

  updateDoctor(id: string, patch: Partial<Doctor>) {
    const s = getState();
    s.doctors = s.doctors.map((d) => (d.id === id ? { ...d, ...patch } : d));
    commit();
  },

  // ── Mutations shared by the consoles ──────────────────────
  setDoctorStatus(id: string, status: Doctor["status"]) {
    const s = getState();
    s.doctors = s.doctors.map((d) => {
      if (d.id !== id) return d;
      // An unverified doctor can never go online.
      if (status === "online" && d.verificationStatus !== "verified") return d;
      return { ...d, status, lastSeen: new Date().toISOString() };
    });
    commit();
  },

  acceptRequest(id: string, doctorId: string) {
    const s = getState();
    // Only the first doctor to accept wins: skip if it is no longer
    // pending (another doctor already claimed it).
    const target = s.requests.find((r) => r.id === id);
    if (!target || target.status !== "pending") return;
    // A request directed at another doctor can't be grabbed.
    if (target.doctorId !== null && target.doctorId !== doctorId) return;
    const doctor = s.doctors.find((d) => d.id === doctorId);
    // Only a verified doctor may accept.
    if (!doctor || doctor.verificationStatus !== "verified") return;
    const km = haversineKm(doctor, target);
    const eta = etaFor(target.type, km);
    s.requests = s.requests.map((r) =>
      r.id === id
        ? {
            ...r,
            status: "accepted",
            doctorId,
            acceptedAt: new Date().toISOString(),
            etaMins: eta,
          }
        : r,
    );
    commit();
  },

  declineRequest(id: string) {
    const s = getState();
    s.requests = s.requests.map((r) =>
      r.id === id ? { ...r, status: "declined" } : r,
    );
    commit();
  },

  /** Doctor sets off for a home/clinic visit. */
  startVisit(id: string) {
    const s = getState();
    s.requests = s.requests.map((r) =>
      r.id === id && r.status === "accepted" ? { ...r, status: "enroute" } : r,
    );
    commit();
  },

  /** Doctor has reached the patient. */
  arriveVisit(id: string) {
    const s = getState();
    s.requests = s.requests.map((r) =>
      r.id === id && (r.status === "enroute" || r.status === "accepted")
        ? { ...r, status: "arrived", etaMins: 0 }
        : r,
    );
    commit();
  },

  completeRequest(id: string) {
    const s = getState();
    s.requests = s.requests.map((r) =>
      r.id === id ? { ...r, status: "completed" } : r,
    );
    commit();
  },

  /** Doctor issues an e-prescription and marks the visit complete. */
  createPrescription(input: {
    requestId: string;
    doctorId: string;
    diagnosis: string;
    items: { name: string; dosage: string; duration: string }[];
    advice: string;
  }): Prescription | null {
    const s = getState();
    const req = s.requests.find((r) => r.id === input.requestId);
    const doc = s.doctors.find((d) => d.id === input.doctorId);
    if (!req || !doc) return null;
    const rx: Prescription = {
      id: nextId("rx"),
      requestId: input.requestId,
      patientId: req.patientId ?? null,
      patientName: req.patientName,
      doctorId: doc.id,
      doctorName: doc.fullName,
      doctorRegNo: doc.regNo,
      diagnosis: input.diagnosis,
      items: input.items,
      advice: input.advice,
      createdAt: new Date().toISOString(),
    };
    s.prescriptions = [rx, ...s.prescriptions];
    s.requests = s.requests.map((r) =>
      r.id === input.requestId ? { ...r, status: "completed" } : r,
    );
    commit();
    return rx;
  },

  /** Patient rates a completed visit; the doctor's rating recomputes.
   *  Only a completed visit with this doctor, and only once. */
  addReview(input: {
    doctorId: string;
    requestId: string | null;
    patientName: string;
    rating: number;
    comment: string;
  }) {
    const s = getState();
    if (input.requestId) {
      // No double-rating.
      if (s.reviews.some((v) => v.requestId === input.requestId)) return;
      const req = s.requests.find((r) => r.id === input.requestId);
      if (!req || req.status !== "completed" || req.doctorId !== input.doctorId) return;
    }
    const review: Review = {
      id: nextId("rev"),
      doctorId: input.doctorId,
      requestId: input.requestId,
      patientName: input.patientName,
      rating: input.rating,
      comment: input.comment,
      createdAt: new Date().toISOString(),
    };
    s.reviews = [review, ...s.reviews];
    s.doctors = s.doctors.map((d) => {
      if (d.id !== input.doctorId) return d;
      const total = d.rating * d.ratingCount + input.rating;
      const count = d.ratingCount + 1;
      return { ...d, rating: total / count, ratingCount: count };
    });
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
      if (parsed && Array.isArray(parsed.doctors)) state = parsed;
    }
  } catch {
    /* corrupt payload - fall back to fresh() */
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
