"use client";

/**
 * DEMO ENGINE — an in-browser backend that needs no server.
 *
 * It now behaves like a real shared backend for LOCAL testing:
 *   • State is persisted to localStorage (survives refresh).
 *   • Mutations broadcast over a BroadcastChannel, so a request raised
 *     in the PATIENT tab shows up live in the DOCTOR / OPS tabs on the
 *     same browser — patient → doctor actually connects.
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
import type {
  ConsultRequest,
  Doctor,
  Order,
  OrderStatus,
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
  // Infrastructure catalog — present unless SEED_LEVEL is "none".
  const catalog = SEED_LEVEL === "none";
  return {
    doctors: catalog ? [] : seedDoctors(),
    ambulances: catalog ? [] : seedAmbulances(),
    // Activity is empty unless SEED_LEVEL === "full".
    sos: SEED_LEVEL === "full" ? seedSos() : [],
    requests: SEED_LEVEL === "full" ? seedRequests() : [],
    orders: SEED_LEVEL === "full" ? seedOrders() : [],
    reviews: SEED_LEVEL === "full" ? seedReviews() : [],
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
      /* quota / private mode — ignore */
    }
    if (broadcast && channel) channel.postMessage({ type: "state", state });
  }
  listeners.forEach((l) => l());
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

  // ── Doctor onboarding + profile edits ─────────────────────
  registerDoctor(input: {
    fullName: string;
    specialty: string;
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
      status: "online",
      verified: false,
      rating: 0,
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
    /* corrupt payload — fall back to fresh() */
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
    /* BroadcastChannel unsupported — single-tab still works */
  }

  // Emit once so the first paint reflects persisted state.
  listeners.forEach((l) => l());
}
