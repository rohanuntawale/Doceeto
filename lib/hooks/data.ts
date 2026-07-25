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
import { demoStore } from "@/lib/demo/store";
import type {
  Ambulance,
  ConsultRequest,
  Doctor,
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
const ENTITY_KEYS = ["doctors", "ambulances", "requests", "sos", "orders", "reviews", "transactions"];

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
  const res = await fetch(`/api/data?entity=${entity}`, { cache: "no-store" });
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
function useSosDemo(): SosEvent[] {
  return useDemoState().sos;
}
export const useSosEvents = isDemoMode ? useSosDemo : () => useApiEntity<SosEvent>("sos");

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
  return useDemoState().doctors;
}
export const useDoctors = isDemoMode ? useDoctorsDemo : () => useApiEntity<Doctor>("doctors");

function useAmbulancesDemo(): Ambulance[] {
  return useDemoState().ambulances;
}
export const useAmbulances = isDemoMode
  ? useAmbulancesDemo
  : () => useApiEntity<Ambulance>("ambulances");

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

function useTransactionsDemo(): Transaction[] {
  return useDemoState().transactions;
}
/** A doctor's wallet ledger (server scopes to the signed-in doctor). */
export const useTransactions = isDemoMode
  ? useTransactionsDemo
  : () => useApiEntity<Transaction>("transactions");

// ── Derived ops snapshot ────────────────────────────────────
export function useOpsSnapshot(): OpsSnapshot {
  const sos = useSosEvents();
  const doctors = useDoctors();
  const ambulances = useAmbulances();
  const orders = useOrders();

  return useMemo(() => {
    const resolved = sos.filter((s) => s.status === "resolved" && s.resolvedAt);
    const avg =
      resolved.length > 0
        ? resolved.reduce((acc, s) => {
            const mins =
              (new Date(s.resolvedAt!).getTime() - new Date(s.createdAt).getTime()) /
              60000;
            return acc + mins;
          }, 0) / resolved.length
        : 8;

    return {
      activeSos: sos.filter((s) => s.status !== "resolved" && s.status !== "cancelled")
        .length,
      ambulancesFree: ambulances.filter((a) => a.status === "free").length,
      ambulancesTotal: ambulances.length,
      doctorsOnline: doctors.filter((d) => d.status === "online").length,
      doctorsTotal: doctors.length,
      ordersActive: orders.filter(
        (o) => o.status !== "delivered" && o.status !== "cancelled",
      ).length,
      avgResponseMins: Math.round(avg),
    };
  }, [sos, doctors, ambulances, orders]);
}

// ── Actions (same shape in both modes) ──────────────────────
export interface CreateSosInput {
  patientId: string;
  patientName: string;
  category: SosEvent["category"];
  address: string;
  lat: number;
  lng: number;
  notes?: string;
}
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
  doctorId?: string | null;
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
export interface CreateAmbulanceInput {
  vehicleNo: string;
  driverName: string;
  lat?: number;
  lng?: number;
}

export interface Actions {
  /** Fire an SOS immediately (location goes to doctors first). Returns the
   *  created event so its category can be refined right after. */
  createSos: (input: CreateSosInput) => Promise<SosEvent>;
  /** Refine an already-sent SOS's category (patient, on their own event). */
  categorizeSos: (sosId: string, category: SosEvent["category"]) => Promise<void>;
  createRequest: (input: CreateRequestInput) => void;
  createOrder: (input: CreateOrderInput) => void;
  createReview: (input: CreateReviewInput) => void;
  /** Doctor → patient rating after a completed consult. */
  ratePatient: (input: RatePatientInput) => Promise<void>;
  updateDoctor: (id: string, patch: Partial<Doctor>) => void;
  setDoctorStatus: (id: string, status: Doctor["status"]) => void;
  acceptRequest: (id: string, doctorId: string) => void;
  declineRequest: (id: string) => void;
  completeRequest: (id: string) => void;
  requestPayout: (doctorId: string) => void;
  assignAmbulance: (sosId: string, ambulanceId: string) => void;
  assignDoctorToSos: (sosId: string, doctorId: string) => void;
  advanceSos: (sosId: string, current: SosStatus) => void;
  advanceOrder: (orderId: string, current: OrderStatus) => void;
  createAmbulance: (input: CreateAmbulanceInput) => void;
  updateAmbulance: (id: string, patch: Partial<Ambulance>) => void;
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
  const res = await fetch("/api/actions", {
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
  const nextSos = useCallback((current: SosStatus): SosStatus => {
    const i = SOS_ORDER.indexOf(current);
    return SOS_ORDER[Math.min(i + 1, SOS_ORDER.length - 1)];
  }, []);
  const nextOrder = useCallback((current: OrderStatus): OrderStatus => {
    const i = ORDER_ORDER.indexOf(current);
    return ORDER_ORDER[Math.min(i + 1, ORDER_ORDER.length - 1)];
  }, []);

  return useMemo<Actions>(() => {
    if (isDemoMode) {
      return {
        createSos: async (input) => demoStore.createSosEvent(input),
        categorizeSos: async (sosId, category) => {
          demoStore.setSosCategory(sosId, category);
        },
        createRequest: (input) => void demoStore.createConsultRequest(input),
        createOrder: (input) => void demoStore.createOrder(input),
        createReview: (input) => void demoStore.createReview(input),
        // Demo store has no patient-rating model; no-op keeps the surface identical.
        ratePatient: async () => {},
        createAmbulance: (input) => void demoStore.createAmbulance(input),
        updateAmbulance: demoStore.updateAmbulance,
        updateDoctor: demoStore.updateDoctor,
        setDoctorStatus: demoStore.setDoctorStatus,
        acceptRequest: demoStore.acceptRequest,
        declineRequest: demoStore.declineRequest,
        completeRequest: demoStore.completeRequest,
        requestPayout: demoStore.requestPayout,
        assignAmbulance: demoStore.assignAmbulance,
        assignDoctorToSos: demoStore.assignDoctorToSos,
        advanceSos: (id) => demoStore.advanceSos(id),
        advanceOrder: (id) => demoStore.advanceOrder(id),
      };
    }
    // Live: the server takes patient identity from the session, so the
    // patientId/patientName here are ignored server-side (anti-spoof).
    return {
      createSos: (input) => callAction<SosEvent>(qc, "createSos", { ...input }),
      categorizeSos: (sosId, category) =>
        callAction<void>(qc, "categorizeSos", { sosId, category }),
      createRequest: (input) => callAction(qc, "createRequest", { ...input }),
      createOrder: (input) => callAction(qc, "createOrder", { ...input }),
      createReview: (input) => callAction(qc, "createReview", { ...input }),
      ratePatient: (input) => callAction<void>(qc, "ratePatient", { ...input }),
      createAmbulance: (input) => callAction(qc, "createAmbulance", { ...input }),
      updateAmbulance: (id, patch) => callAction(qc, "updateAmbulance", { id, patch }),
      updateDoctor: (id, patch) => callAction(qc, "updateDoctor", { patch }),
      setDoctorStatus: (_id, status) => callAction(qc, "setDoctorStatus", { status }),
      acceptRequest: (id) => callAction(qc, "acceptRequest", { id }),
      declineRequest: (id) => callAction(qc, "declineRequest", { id }),
      completeRequest: (id) => callAction(qc, "completeRequest", { id }),
      requestPayout: () => callAction(qc, "requestPayout", {}),
      assignAmbulance: (sosId, ambulanceId) =>
        callAction(qc, "assignAmbulance", { sosId, ambulanceId }),
      assignDoctorToSos: (sosId, doctorId) =>
        callAction(qc, "assignDoctorToSos", { sosId, doctorId }),
      advanceSos: (sosId, current) =>
        callAction(qc, "advanceSos", { sosId, next: nextSos(current) }),
      advanceOrder: (orderId, current) =>
        callAction(qc, "advanceOrder", { orderId, next: nextOrder(current) }),
    };
  }, [qc, nextSos, nextOrder]);
}
