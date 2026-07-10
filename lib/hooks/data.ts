"use client";

/**
 * Unified data hooks. The exported hooks are bound ONCE at module load
 * to either the demo or the live implementation (isDemoMode is a
 * build-time constant from NEXT_PUBLIC_* env), so React always sees a
 * stable hook — no conditional-hook violations. Components import only
 * from here and never care which backend is live.
 */
import { useCallback, useEffect, useMemo, useSyncExternalStore } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { isDemoMode } from "@/lib/config";
import { demoStore } from "@/lib/demo/store";
import { getSupabaseBrowser } from "@/lib/supabase/client";
import {
  mapAmbulance,
  mapDoctor,
  mapOrder,
  mapRequest,
  mapReview,
  mapSos,
} from "@/lib/api/mappers";
import * as live from "@/lib/api/actions";
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
} from "@/lib/types/domain";

const SOS_ORDER: SosStatus[] = ["open", "assigned", "enroute", "resolved"];
const ORDER_ORDER: OrderStatus[] = [
  "placed",
  "packed",
  "out_for_delivery",
  "delivered",
];

// ── Demo primitives ─────────────────────────────────────────
function useDemoState() {
  return useSyncExternalStore(
    demoStore.subscribe,
    demoStore.get,
    demoStore.get,
  );
}

// ── Live primitive: query + realtime invalidation ───────────
function useLiveTable<T>(
  key: string,
  table: string,
  // Rows are untyped Postgres records; mappers in lib/api/mappers narrow them.
  map: (row: Record<string, unknown>) => T,
  order = "created_at",
): T[] {
  const qc = useQueryClient();
  const { data } = useQuery({
    queryKey: [key],
    queryFn: async () => {
      const sb = getSupabaseBrowser();
      if (!sb) return [] as T[];
      const { data, error } = await sb
        .from(table)
        .select("*")
        .order(order, { ascending: false });
      if (error) throw error;
      return (data ?? []).map(map);
    },
  });

  useEffect(() => {
    const sb = getSupabaseBrowser();
    if (!sb) return;
    const channel = sb
      .channel(`rt-${table}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table },
        () => qc.invalidateQueries({ queryKey: [key] }),
      )
      .subscribe();
    return () => {
      sb.removeChannel(channel);
    };
  }, [key, table, qc]);

  return data ?? [];
}

// ── Entity hooks ────────────────────────────────────────────
// Each backend gets a fully-named custom hook (so eslint's
// rules-of-hooks sees unconditional hook calls), and the export is
// bound ONCE to the right one — isDemoMode is a build-time constant,
// so React always sees a stable hook at the call site.

function useSosDemo(): SosEvent[] {
  return useDemoState().sos;
}
function useSosLive(): SosEvent[] {
  return useLiveTable("sos", "sos_events", (r) => mapSos(r));
}
export const useSosEvents = isDemoMode ? useSosDemo : useSosLive;

function useRequestsDemo(): ConsultRequest[] {
  return useDemoState().requests;
}
function useRequestsLive(): ConsultRequest[] {
  return useLiveTable("requests", "consult_requests", (r) => mapRequest(r));
}
export const useConsultRequests = isDemoMode ? useRequestsDemo : useRequestsLive;

function useOrdersDemo(): Order[] {
  return useDemoState().orders;
}
function useOrdersLive(): Order[] {
  return useLiveTable("orders", "orders", (r) => mapOrder(r));
}
export const useOrders = isDemoMode ? useOrdersDemo : useOrdersLive;

function useDoctorsDemo(): Doctor[] {
  return useDemoState().doctors;
}
function useDoctorsLive(): Doctor[] {
  return useLiveTable("doctors", "doctors", (r) => mapDoctor(r));
}
export const useDoctors = isDemoMode ? useDoctorsDemo : useDoctorsLive;

function useAmbulancesDemo(): Ambulance[] {
  return useDemoState().ambulances;
}
function useAmbulancesLive(): Ambulance[] {
  return useLiveTable("ambulances", "ambulances", (r) => mapAmbulance(r));
}
export const useAmbulances = isDemoMode ? useAmbulancesDemo : useAmbulancesLive;

function useReviewsDemo(): Review[] {
  return useDemoState().reviews;
}
function useReviewsLive(): Review[] {
  return useLiveTable("reviews", "reviews", (r) => mapReview(r));
}
export const useReviews = isDemoMode ? useReviewsDemo : useReviewsLive;

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
              (new Date(s.resolvedAt!).getTime() -
                new Date(s.createdAt).getTime()) /
              60000;
            return acc + mins;
          }, 0) / resolved.length
        : 8;

    return {
      activeSos: sos.filter(
        (s) => s.status !== "resolved" && s.status !== "cancelled",
      ).length,
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
  fee: number;
  address: string;
  lat: number;
  lng: number;
  doctorId?: string | null; // the doctor the patient chose
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
  // patient-side creates
  createSos: (input: CreateSosInput) => void;
  createRequest: (input: CreateRequestInput) => void;
  createOrder: (input: CreateOrderInput) => void;
  // profile edits
  updateDoctor: (id: string, patch: Partial<Doctor>) => void;
  // console-side mutations
  setDoctorStatus: (id: string, status: Doctor["status"]) => void;
  acceptRequest: (id: string, doctorId: string) => void;
  declineRequest: (id: string) => void;
  completeRequest: (id: string) => void;
  assignAmbulance: (sosId: string, ambulanceId: string) => void;
  assignDoctorToSos: (sosId: string, doctorId: string) => void;
  advanceSos: (sosId: string, current: SosStatus) => void;
  advanceOrder: (orderId: string, current: OrderStatus) => void;
}

/** Wipe locally-created test data (demo mode only). No-op in live mode. */
export function resetTestData() {
  if (isDemoMode) demoStore.reset();
}

export function useActions(): Actions {
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
        acceptRequest: demoStore.acceptRequest,
        declineRequest: demoStore.declineRequest,
        completeRequest: demoStore.completeRequest,
        assignAmbulance: demoStore.assignAmbulance,
        assignDoctorToSos: demoStore.assignDoctorToSos,
        advanceSos: (id) => demoStore.advanceSos(id),
        advanceOrder: (id) => demoStore.advanceOrder(id),
      };
    }
    return {
      createSos: (input) => void live.liveCreateSos(input),
      createRequest: (input) => void live.liveCreateRequest(input),
      createOrder: (input) => void live.liveCreateOrder(input),
      updateDoctor: (id, patch) => void live.liveUpdateDoctor(id, patch),
      setDoctorStatus: (id, status) => void live.liveSetDoctorStatus(id, status),
      acceptRequest: (id, doctorId) => void live.liveAcceptRequest(id, doctorId),
      declineRequest: (id) => void live.liveDeclineRequest(id),
      completeRequest: (id) => void live.liveCompleteRequest(id),
      assignAmbulance: (sosId, ambId) =>
        void live.liveAssignAmbulance(sosId, ambId),
      assignDoctorToSos: (sosId, docId) =>
        void live.liveAssignDoctorToSos(sosId, docId),
      advanceSos: (id, current) => void live.liveAdvanceSos(id, nextSos(current)),
      advanceOrder: (id, current) =>
        void live.liveAdvanceOrder(id, nextOrder(current)),
    };
  }, [nextSos, nextOrder]);
}
