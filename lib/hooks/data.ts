"use client";

/**
 * Unified data hooks. Exported hooks bind ONCE at module load to either
 * the demo engine (in-browser store) or the live backend (Neo4j via the
 * /api routes), chosen by the build-time isDemoMode constant. Components
 * import only from here and never care which backend is live.
 *
 * Live mode has no realtime feed (Neo4j is not Postgres), so reads poll
 * on a short interval and every mutation invalidates the matching query.
 */
import { useCallback, useMemo, useSyncExternalStore } from "react";
import { useQuery, useQueryClient, type QueryClient } from "@tanstack/react-query";
import { isDemoMode } from "@/lib/config";
import { apiFetch } from "@/lib/api/client";
import { demoStore } from "@/lib/demo/store";
import { readStoredDoctorId as currentDoctorId } from "@/lib/demo/current-doctor";
import { hasOngoingConsult, isOnGig } from "@/lib/scheduling/slots";
import { activeGigs, gigFromPrice } from "@/lib/gigs/rules";
import type {
  Ambulance,
  ConsultRequest,
  Doctor,
  DoctorAvailability,
  Gig,
  GigStatus,
  Order,
  OpsSnapshot,
  OrderStatus,
  Review,
  SosEvent,
  SosStatus,
  Transaction,
} from "@/lib/types/domain";

const SOS_ORDER: SosStatus[] = ["open", "assigned", "enroute", "resolved"];
const ORDER_ORDER: OrderStatus[] = [
  "placed",
  "packed",
  "out_for_delivery",
  "delivered",
];

const POLL_MS = 4000;
const POLL_MS_SSE = 30_000; // slow safety-net poll while SSE is connected
// Invalidated after every write. "availability" is a key prefix rather than
// an entity — a new booking changes which slots a doctor has left.
const ENTITY_KEYS = [
  "doctors",
  "ambulances",
  "requests",
  "sos",
  "orders",
  "reviews",
  "transactions",
  "gigs",
  "availability",
];

// Flipped by the RealtimeBridge when /api/stream is connected — polling
// then backs off to a slow safety net and SSE events drive refreshes.
let sseConnected = false;
export function setSseConnected(v: boolean) {
  sseConnected = v;
}

// ── Demo primitive ──────────────────────────────────────────
function useDemoState() {
  return useSyncExternalStore(demoStore.subscribe, demoStore.get, demoStore.get);
}

// ── Live primitive: fetch an entity from /api/data with polling ──
async function fetchEntity<T>(entity: string): Promise<T[]> {
  const res = await apiFetch(`/api/data?entity=${entity}`, { cache: "no-store" });
  if (!res.ok) return [];
  const data = await res.json();
  return Array.isArray(data) ? (data as T[]) : [];
}

function useApiEntity<T>(entity: string): T[] {
  const { data } = useQuery({
    queryKey: [entity],
    queryFn: () => fetchEntity<T>(entity),
    refetchInterval: () => (sseConnected ? POLL_MS_SSE : POLL_MS),
    refetchOnWindowFocus: true,
  });
  return data ?? [];
}

// ── Entity hooks (bound once to the active backend) ─────────
function useRequestsDemo(): ConsultRequest[] {
  return useDemoState().requests;
}
export const useConsultRequests = isDemoMode
  ? useRequestsDemo
  : () => useApiEntity<ConsultRequest>("requests");

function useOrdersDemo(): Order[] {
  return useDemoState().orders;
}
export const useOrders = isDemoMode ? useOrdersDemo : () => useApiEntity<Order>("orders");

function useDoctorsDemo(): Doctor[] {
  const s = useDemoState();
  // /api/data attaches these derived fields on every doctor read, so the demo
  // path has to as well or the search list would silently lose the "on a gig"
  // badge and the gig teasers in demo mode.
  return useMemo(
    () =>
      s.doctors.map((d) => {
        const live = activeGigs(s.gigs.filter((g) => g.doctorId === d.id));
        return {
          ...d,
          onGig: isOnGig(s.requests, d.id),
          onConsult: hasOngoingConsult(s.requests, d.id),
          gigCount: live.length,
          gigFromPrice: gigFromPrice(live),
        };
      }),
    [s.doctors, s.gigs, s.requests],
  );
}
export const useDoctors = isDemoMode ? useDoctorsDemo : () => useApiEntity<Doctor>("doctors");

function useReviewsDemo(doctorId?: string): Review[] {
  const all = useDemoState().reviews;
  return doctorId
    ? all.filter((r) => (r as Review & { doctorId?: string }).doctorId === doctorId)
    : all;
}
/** Reviews, optionally scoped to one doctor (server filters via ?doctorId=). */
export const useReviews = isDemoMode
  ? (doctorId?: string) => useReviewsDemo(doctorId)
  : (doctorId?: string) =>
      useApiEntity<Review>(doctorId ? `reviews&doctorId=${encodeURIComponent(doctorId)}` : "reviews");

function useGigsDemo(doctorId?: string): Gig[] {
  const s = useDemoState();
  if (!doctorId) return s.gigs;
  // Patient view of one doctor's shelf: nothing is hireable while that
  // doctor is committed to a gig or offline — same rules the live
  // /api/data applies. Offline takes the whole shelf off the platform.
  const doc = s.doctors.find((d) => d.id === doctorId);
  if (!doc || doc.status === "offline") return [];
  if (isOnGig(s.requests, doctorId)) return [];
  return s.gigs.filter((g) => g.doctorId === doctorId);
}
/**
 * Gig listings. Pass a doctorId to read one doctor's shelf — the server then
 * returns only their ACTIVE gigs, which is what a patient should see. Called
 * with no argument by a signed-in doctor it returns their own gigs in every
 * status, so they can manage paused and archived ones.
 */
export const useGigs = isDemoMode
  ? (doctorId?: string) => useGigsDemo(doctorId)
  : (doctorId?: string) =>
      useApiEntity<Gig>(doctorId ? `gigs&doctorId=${encodeURIComponent(doctorId)}` : "gigs");

function useTransactionsDemo(): Transaction[] {
  return useDemoState().transactions;
}
/** A doctor's wallet ledger (server scopes to the signed-in doctor). */
export const useTransactions = isDemoMode
  ? useTransactionsDemo
  : () => useApiEntity<Transaction>("transactions");

// ── Derived ops snapshot ────────────────────────────────────
export function useOpsSnapshot(): OpsSnapshot {
  const doctors = useDoctors();
  const orders = useOrders();

  return useMemo(
    () => ({
      doctorsOnline: doctors.filter((d) => d.status === "online").length,
      doctorsTotal: doctors.length,
      ordersActive: orders.filter(
        (o) => o.status !== "delivered" && o.status !== "cancelled",
      ).length,
    }),
    [doctors, orders],
  );
}

// ── Actions (same shape in both modes) ──────────────────────
export interface CreateRequestInput {
  patientId: string;
  patientName: string;
  type: ConsultRequest["type"];
  symptoms: string;
  paymentMethod?: ConsultRequest["paymentMethod"];
  fee: number;
  address: string;
  lat: number;
  lng: number;
  /** Null broadcasts an urgent request to every free doctor in range. */
  doctorId?: string | null;
  /** "emergency" (now), "scheduled" (a slot) or "gig". Defaults to emergency. */
  mode?: ConsultRequest["mode"];
  /** ISO start of the chosen slot — required when mode is "scheduled". */
  scheduledAt?: string | null;
  /** Which gig is being hired — required when mode is "gig". The price, visit
   *  type and duration are read off that gig server-side, so `fee` and `type`
   *  are ignored for a gig hire. */
  gigId?: string | null;
}
export interface CreateGigInput {
  title: string;
  description: string;
  type: ConsultRequest["type"];
  price: number;
  durationMinutes: number;
}
export interface CreateOrderInput {
  patientId: string;
  patientName: string;
  items: { name: string; qty: number }[];
  total: number;
  address: string;
  darkStore: string;
}

export interface CreateReviewInput {
  patientId: string;
  patientName: string;
  doctorId: string;
  requestId: string;
  rating: number;
  comment: string;
}
export interface RatePatientInput {
  requestId: string;
  rating: number;
  comment?: string;
}
export interface Actions {
  /** Rejects with the server's message — always `await` it and surface that. */
  createRequest: (input: CreateRequestInput) => Promise<void>;
  createOrder: (input: CreateOrderInput) => void;
  createReview: (input: CreateReviewInput) => void;
  /** Doctor → patient rating after a completed consult. */
  ratePatient: (input: RatePatientInput) => Promise<void>;
  updateDoctor: (id: string, patch: Partial<Doctor>) => void;
  setDoctorStatus: (id: string, status: Doctor["status"]) => void;
  /** Doctor's bookable calendar. `id` is used in demo mode only — the live
   *  backend always scopes the write to the signed-in doctor. */
  setAvailability: (id: string, availability: DoctorAvailability) => Promise<void>;
  acceptRequest: (id: string, doctorId: string) => Promise<void>;
  /** Pass on a request. On a broadcast this only hides it from this doctor. */
  declineRequest: (id: string, reason?: string) => void;
  /** Patient or doctor calls off a booking, freeing the slot. A doctor MUST
   *  give a reason — it is shown to the patient — and cancelling a broadcast
   *  puts it back out to other doctors rather than ending it. */
  cancelRequest: (id: string, reason?: string) => Promise<void>;
  completeRequest: (id: string) => void;
  /** Publish a service package. Rejects with the server's message. */
  createGig: (input: CreateGigInput) => Promise<void>;
  updateGig: (id: string, patch: Partial<Gig>) => Promise<void>;
  setGigStatus: (id: string, status: GigStatus) => Promise<void>;
  /** Remove a listing for good. Rejects while a hire is still waiting on it. */
  deleteGig: (id: string) => Promise<void>;
  /** Move an accepted visit one step along its rail. */
  advanceTrip: (id: string) => Promise<void>;
  requestPayout: (doctorId: string) => void;
  advanceOrder: (orderId: string, current: OrderStatus) => void;
}

/** Wipe locally-created test data (demo mode only). No-op in live mode. */
export function resetTestData() {
  if (isDemoMode) demoStore.reset();
}

/** POST an action to the live backend and refresh the affected data. Unlike
 *  a fire-and-forget call, this SURFACES server rejections (400/403/409/500):
 *  the returned promise rejects with the server's error message so callers can
 *  `await` it and show a real error toast instead of a false "success". */
async function callAction<T = Record<string, unknown>>(
  qc: QueryClient,
  action: string,
  payload: Record<string, unknown>,
): Promise<T> {
  const res = await apiFetch("/api/actions", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ action, payload }),
  });
  const body = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  // Refresh regardless — a rejected write may still have touched related state.
  ENTITY_KEYS.forEach((k) => qc.invalidateQueries({ queryKey: [k] }));
  if (!res.ok) {
    const msg = typeof body.error === "string" ? body.error : "Action failed.";
    console.error("Doceeto action failed:", action, msg);
    throw new Error(msg);
  }
  return body as unknown as T;
}

export function useActions(): Actions {
  const qc = useQueryClient();
  const nextOrder = useCallback((current: OrderStatus): OrderStatus => {
    const i = ORDER_ORDER.indexOf(current);
    return ORDER_ORDER[Math.min(i + 1, ORDER_ORDER.length - 1)];
  }, []);

  return useMemo<Actions>(() => {
    if (isDemoMode) {
      return {
        // async so a rejected slot surfaces the same way it does live: the
        // store throws, the promise rejects, the caller's catch runs.
        createRequest: async (input) => void demoStore.createConsultRequest(input),
        createOrder: (input) => void demoStore.createOrder(input),
        createReview: (input) => void demoStore.createReview(input),
        // Demo store has no patient-rating model; no-op keeps the surface identical.
        ratePatient: async () => {},
        updateDoctor: demoStore.updateDoctor,
        setDoctorStatus: demoStore.setDoctorStatus,
        setAvailability: async (id, availability) =>
          demoStore.setDoctorAvailability(id, availability),
        acceptRequest: async (id, doctorId) => demoStore.acceptRequest(id, doctorId),
        declineRequest: (id) => demoStore.declineRequest(id, currentDoctorId() ?? undefined),
        // The demo store has no session, so "who is cancelling" is inferred
        // from whether a reason was given — the doctor path is the only one
        // that requires one.
        cancelRequest: async (id, reason) =>
          demoStore.cancelRequest(id, { reason, byDoctor: Boolean(reason) }),
        completeRequest: demoStore.completeRequest,
        createGig: async (input) => {
          const id = currentDoctorId();
          if (!id) throw new Error("Register as a doctor first.");
          demoStore.createGig({ ...input, doctorId: id });
        },
        updateGig: async (id, patch) => demoStore.updateGig(id, patch),
        setGigStatus: async (id, status) => demoStore.setGigStatus(id, status),
        deleteGig: async (id) => demoStore.deleteGig(id),
        advanceTrip: async (id) => void demoStore.advanceTrip(id),
        requestPayout: demoStore.requestPayout,
        advanceOrder: (id) => demoStore.advanceOrder(id),
      };
    }
    // Live: the server takes patient identity from the session, so the
    // patientId/patientName here are ignored server-side (anti-spoof).
    return {
      createRequest: async (input) => void (await callAction(qc, "createRequest", { ...input })),
      createOrder: (input) => callAction(qc, "createOrder", { ...input }),
      createReview: (input) => callAction(qc, "createReview", { ...input }),
      ratePatient: (input) => callAction<void>(qc, "ratePatient", { ...input }),
      updateDoctor: (id, patch) => callAction(qc, "updateDoctor", { patch }),
      setDoctorStatus: (_id, status) => callAction(qc, "setDoctorStatus", { status }),
      setAvailability: (_id, availability) =>
        callAction<void>(qc, "setAvailability", { availability }),
      acceptRequest: async (id) => void (await callAction(qc, "acceptRequest", { id })),
      declineRequest: (id, reason) => callAction(qc, "declineRequest", { id, reason }),
      cancelRequest: async (id, reason) =>
        void (await callAction(qc, "cancelRequest", { id, reason })),
      completeRequest: (id) => callAction(qc, "completeRequest", { id }),
      // The gig's owner is the session doctor — no id is sent for creation.
      createGig: async (input) => void (await callAction(qc, "createGig", { ...input })),
      updateGig: async (id, patch) => void (await callAction(qc, "updateGig", { id, patch })),
      setGigStatus: async (id, status) =>
        void (await callAction(qc, "setGigStatus", { id, status })),
      deleteGig: async (id) => void (await callAction(qc, "deleteGig", { id })),
      advanceTrip: async (id) => void (await callAction(qc, "advanceTrip", { id })),
      requestPayout: () => callAction(qc, "requestPayout", {}),
      advanceOrder: (orderId, current) =>
        callAction(qc, "advanceOrder", { orderId, next: nextOrder(current) }),
    };
  }, [qc, nextOrder]);
}
