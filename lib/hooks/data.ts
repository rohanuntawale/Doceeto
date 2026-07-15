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
  Prescription,
  Review,
  SosEvent,
  SosStatus,
} from "@/lib/types/domain";

const SOS_ORDER: SosStatus[] = ["open", "assigned", "enroute", "resolved"];
const ORDER_ORDER: OrderStatus[] = [
  "placed",
  "packed",
  "out_for_delivery",
  "delivered",
];

const POLL_MS = 4000;
const ENTITY_KEYS = [
  "doctors",
  "ambulances",
  "requests",
  "sos",
  "orders",
  "reviews",
  "prescriptions",
];

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
    refetchInterval: POLL_MS,
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

function useReviewsDemo(): Review[] {
  return useDemoState().reviews;
}
export const useReviews = isDemoMode ? useReviewsDemo : () => useApiEntity<Review>("reviews");

function usePrescriptionsDemo(): Prescription[] {
  return useDemoState().prescriptions;
}
export const usePrescriptions = isDemoMode
  ? usePrescriptionsDemo
  : () => useApiEntity<Prescription>("prescriptions");

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
  acuity?: ConsultRequest["acuity"];
  triageSummary?: string | null;
  fee: number;
  address: string;
  lat: number;
  lng: number;
  doctorId?: string | null;
}
export interface CreatePrescriptionInput {
  requestId: string;
  doctorId: string;
  diagnosis: string;
  items: { name: string; dosage: string; duration: string }[];
  advice: string;
}
export interface AddReviewInput {
  doctorId: string;
  requestId: string | null;
  patientName: string;
  rating: number;
  comment: string;
}
export interface CreateOrderInput {
  patientId: string;
  patientName: string;
  items: { name: string; qty: number }[];
  total: number;
  address: string;
  darkStore: string;
}

export interface Actions {
  createSos: (input: CreateSosInput) => void;
  createRequest: (input: CreateRequestInput) => void;
  createOrder: (input: CreateOrderInput) => void;
  updateDoctor: (id: string, patch: Partial<Doctor>) => void;
  setDoctorStatus: (id: string, status: Doctor["status"]) => void;
  verifyDoctor: (id: string, approve: boolean) => void;
  acceptRequest: (id: string, doctorId: string) => void;
  declineRequest: (id: string) => void;
  startVisit: (id: string) => void;
  arriveVisit: (id: string) => void;
  completeRequest: (id: string) => void;
  createPrescription: (input: CreatePrescriptionInput) => void;
  addReview: (input: AddReviewInput) => void;
  assignAmbulance: (sosId: string, ambulanceId: string) => void;
  assignDoctorToSos: (sosId: string, doctorId: string) => void;
  advanceSos: (sosId: string, current: SosStatus) => void;
  advanceOrder: (orderId: string, current: OrderStatus) => void;
}

/** Wipe locally-created test data (demo mode only). No-op in live mode. */
export function resetTestData() {
  if (isDemoMode) demoStore.reset();
}

/** POST an action to the live backend, then refresh the affected data. */
function callAction(qc: QueryClient, action: string, payload: Record<string, unknown>) {
  fetch("/api/actions", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ action, payload }),
  })
    .then(() => ENTITY_KEYS.forEach((k) => qc.invalidateQueries({ queryKey: [k] })))
    .catch((err) => console.error("Iyashi action failed:", err));
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
        createSos: (input) => void demoStore.createSosEvent(input),
        createRequest: (input) => void demoStore.createConsultRequest(input),
        createOrder: (input) => void demoStore.createOrder(input),
        updateDoctor: demoStore.updateDoctor,
        setDoctorStatus: demoStore.setDoctorStatus,
        verifyDoctor: demoStore.verifyDoctor,
        acceptRequest: demoStore.acceptRequest,
        declineRequest: demoStore.declineRequest,
        startVisit: demoStore.startVisit,
        arriveVisit: demoStore.arriveVisit,
        completeRequest: demoStore.completeRequest,
        createPrescription: (input) => void demoStore.createPrescription(input),
        addReview: demoStore.addReview,
        assignAmbulance: demoStore.assignAmbulance,
        assignDoctorToSos: demoStore.assignDoctorToSos,
        advanceSos: (id) => demoStore.advanceSos(id),
        advanceOrder: (id) => demoStore.advanceOrder(id),
      };
    }
    // Live: the server takes patient identity from the session, so the
    // patientId/patientName here are ignored server-side (anti-spoof).
    return {
      createSos: (input) => callAction(qc, "createSos", { ...input }),
      createRequest: (input) => callAction(qc, "createRequest", { ...input }),
      createOrder: (input) => callAction(qc, "createOrder", { ...input }),
      updateDoctor: (id, patch) => callAction(qc, "updateDoctor", { patch }),
      setDoctorStatus: (_id, status) => callAction(qc, "setDoctorStatus", { status }),
      verifyDoctor: (id, approve) => callAction(qc, "verifyDoctor", { id, approve }),
      acceptRequest: (id) => callAction(qc, "acceptRequest", { id }),
      declineRequest: (id) => callAction(qc, "declineRequest", { id }),
      startVisit: (id) => callAction(qc, "startVisit", { id }),
      arriveVisit: (id) => callAction(qc, "arriveVisit", { id }),
      completeRequest: (id) => callAction(qc, "completeRequest", { id }),
      createPrescription: (input) => callAction(qc, "createPrescription", { ...input }),
      addReview: (input) => callAction(qc, "addReview", { ...input }),
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
