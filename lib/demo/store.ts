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
import { MAP_CENTER } from "@/lib/config";
import { AVATAR_COLORS } from "@/lib/demo/seed";
import { seedDoctors } from "@/lib/seed-doctors";
import type {
  Ambulance,
  ConsultRequest,
  Doctor,
  Order,
  OrderStatus,
  Review,
  SosEvent,
} from "@/lib/types/domain";

export interface DemoState {
  doctors: Doctor[];
  ambulances: Ambulance[];
  sos: SosEvent[];
  requests: ConsultRequest[];
  orders: Order[];
  reviews: Review[];
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
const STORAGE_KEY = "iyashi:demo-state:v2";
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
    ambulances: [],
    sos: [],
    requests: [],
    orders: [],
    reviews: [],
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
      fee: input.fee,
      address: input.address,
      lat: input.lat,
      lng: input.lng,
      createdAt: new Date().toISOString(),
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
    experienceYears: number;
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
      experienceYears: input.experienceYears,
      languages: ["English", "Hindi"],
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
    s.requests = s.requests.map((r) =>
      r.id === id ? { ...r, status: "accepted", doctorId } : r,
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

  completeRequest(id: string) {
    const s = getState();
    s.requests = s.requests.map((r) =>
      r.id === id ? { ...r, status: "completed" } : r,
    );
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
      if (parsed && Array.isArray(parsed.doctors)) state = parsed;
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
