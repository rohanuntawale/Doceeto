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
import { cadreOf } from "@/lib/nurse";
import type {
  Ambulance,
  Cadre,
  ConsultRequest,
  Doctor,
  DoctorAvailability,
  DoctorDeletion,
  DoctorDetail,
  Gig,
  GigStatus,
  Order,
  OpsSnapshot,
  OrderStatus,
  Prescription,
  Review,
  SosEvent,
  SosStatus,
  Transaction,
} from "@/lib/types/domain";
import type { RxDraft } from "@/lib/prescriptions/rules";

const SOS_ORDER: SosStatus[] = ["open", "assigned", "enroute", "resolved"];
const ORDER_ORDER: OrderStatus[] = [
  "placed",
  "packed",
  "out_for_delivery",
  "delivered",
];

const POLL_MS = 4000;
/**
 * Safety net while SSE is connected. Deliberately not minutes: a single dropped
 * frame should cost a few seconds of staleness, not leave the screen looking
 * frozen until someone reloads. Pushes still do the real work — this only
 * bounds how wrong the screen can get when one goes missing.
 */
const POLL_MS_SSE = 10_000;
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
  "prescriptions",
  "availability",
  // Key prefix, not an entity: the ops doctor profile aggregates almost every
  // table, so any write can change what it shows.
  "doctorDetail",
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
  // A 5xx is the server falling over, not an answer of "there are none".
  // Swallowing it as [] caches an empty screen — the doctor list, the map and
  // every count go blank and stay blank until something else invalidates the
  // query. Throwing keeps the last good data on screen and lets the poll retry.
  if (res.status >= 500) throw new Error(`${entity}: ${res.status}`);
  if (!res.ok) return [];
  const data = await res.json();
  return Array.isArray(data) ? (data as T[]) : [];
}

/**
 * Read an entity, optionally scoped.
 *
 * The scope goes in the query KEY as a separate segment rather than being
 * glued into the entity string. React Query matches keys by PREFIX, so
 * `["reviews", {doctorId}]` is invalidated by `invalidateQueries(["reviews"])`
 * while `["reviews&doctorId=…"]` never is — which silently left every scoped
 * list (a provider's own reviews, their gig shelf, the nurse roster) out of
 * the realtime path, updating only on the slow poll.
 */
function useApiEntity<T>(entity: string, scope?: Record<string, string>): T[] {
  const qs = scope ? new URLSearchParams(scope).toString() : "";
  const { data } = useQuery({
    queryKey: scope ? [entity, scope] : [entity],
    queryFn: () => fetchEntity<T>(qs ? `${entity}&${qs}` : entity),
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

function useDoctorsDemo(cadre?: Cadre): Doctor[] {
  const s = useDemoState();
  // /api/data attaches these derived fields on every doctor read, so the demo
  // path has to as well or the search list would silently lose the "on a gig"
  // badge and the gig teasers in demo mode.
  const all = useMemo(
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
  return cadre ? all.filter((d) => cadreOf(d) === cadre) : all;
}
export const useDoctors = isDemoMode
  ? (cadre?: Cadre) => useDoctorsDemo(cadre)
  : (cadre?: Cadre) => useApiEntity<Doctor>("doctors", cadre ? { cadre } : undefined);

/**
 * The nurse roster, for the patient-facing home-care search.
 *
 * Deliberately a separate hook rather than a flag on useDoctors: the doctor
 * list is read in a dozen places and every one of them means DOCTORS. The
 * server defaults `?entity=doctors` to the doctor cadre for the same reason,
 * so nurses can only ever arrive somewhere that asked for them.
 */
function useNursesDemo(): Doctor[] {
  return useDoctorsDemo("nurse");
}

export const useNurses = isDemoMode
  ? useNursesDemo
  : () => useApiEntity<Doctor>("doctors", { cadre: "nurse" });

/**
 * Ops-only deep read of ONE doctor: profile, account, reviews, consults, gigs
 * and wallet in a single call. Separate from useApiEntity because it returns
 * one object keyed by id rather than a list, and because it must surface the
 * server's error (403/404) instead of silently degrading to an empty array —
 * an ops console that shows "nothing here" for a permission failure is worse
 * than one that says so.
 */
export function useDoctorDetail(doctorId: string) {
  const { data, isLoading, error } = useQuery({
    queryKey: ["doctorDetail", doctorId],
    enabled: Boolean(doctorId),
    refetchInterval: () => (sseConnected ? POLL_MS_SSE : POLL_MS),
    queryFn: async (): Promise<DoctorDetail> => {
      const res = await apiFetch(
        `/api/data?entity=doctorDetail&doctorId=${encodeURIComponent(doctorId)}`,
        { cache: "no-store" },
      );
      const body = await res.json().catch(() => ({}));
      if (!res.ok)
        throw new Error(
          typeof body?.error === "string" ? body.error : "Could not load this doctor.",
        );
      return body as DoctorDetail;
    },
  });
  return {
    detail: data ?? null,
    loading: isLoading,
    error: (error as Error | null) ?? null,
  };
}

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
      useApiEntity<Review>("reviews", doctorId ? { doctorId } : undefined);

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
      useApiEntity<Gig>("gigs", doctorId ? { doctorId } : undefined);

function usePrescriptionsDemo(): Prescription[] {
  return useDemoState().prescriptions;
}
/**
 * Prescriptions this account can see: a patient's own, or the ones a doctor
 * wrote. The server does the scoping — there is no "all prescriptions" read to
 * ask for, by design.
 */
export const usePrescriptions = isDemoMode
  ? usePrescriptionsDemo
  : () => useApiEntity<Prescription>("prescriptions");

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
  /** Which cadre should receive this. Ignored when a provider is named — the
   *  server takes the cadre off their row so a request can never be aimed at
   *  an inbox that will never see it. Defaults to doctors. */
  targetCadre?: Cadre;
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
  /** Returns the server promise in live mode so callers can surface a
   *  rejection (e.g. the profile-photo requirement) instead of assuming
   *  success. Demo mode resolves immediately. */
  setDoctorStatus: (id: string, status: Doctor["status"]) => void | Promise<unknown>;
  /** "My cockpit is still open." Drives the real online/offline status. */
  heartbeat: () => Promise<void>;
  /** Doctor's bookable calendar. `id` is used in demo mode only — the live
   *  backend always scopes the write to the signed-in doctor. */
  setAvailability: (id: string, availability: DoctorAvailability) => Promise<void>;
  acceptRequest: (id: string, doctorId: string) => Promise<void>;
  /**
   * Pass on a request. On a broadcast this only hides it from this doctor.
   *
   * Returns a promise so callers can await it and show a real error. It used to
   * be typed `void` while actually returning one, so every rejection became an
   * unhandled promise and a doctor pressing Pass on a request the server
   * refused saw absolutely nothing happen.
   */
  declineRequest: (id: string, reason?: string) => Promise<void>;
  /** Patient or doctor calls off a booking, freeing the slot. A doctor MUST
   *  give a reason — it is shown to the patient — and cancelling a broadcast
   *  puts it back out to other doctors rather than ending it. */
  cancelRequest: (id: string, reason?: string) => Promise<void>;
  completeRequest: (id: string) => void;
  /**
   * Doctor issues the prescription that closes the consult — completing the
   * visit is part of the same act, so this is not called alongside
   * completeRequest. Resolves with the issued document (its code and share
   * token are what the doctor's confirmation shows).
   */
  issuePrescription: (requestId: string, draft: RxDraft) => Promise<Prescription>;
  /** Publish a service package. Rejects with the server's message. */
  createGig: (input: CreateGigInput) => Promise<void>;
  updateGig: (id: string, patch: Partial<Gig>) => Promise<void>;
  setGigStatus: (id: string, status: GigStatus) => Promise<void>;
  /** Remove a listing for good. Rejects while a hire is still waiting on it. */
  deleteGig: (id: string) => Promise<void>;
  /** Move an accepted visit one step along its rail. */
  advanceTrip: (id: string) => Promise<void>;
  /** Doctor submits the 4-digit code the patient read out. Rejects with the
   *  server's message ("3 tries left", "locked") so the UI can show it. */
  verifyStartCode: (id: string, code: string) => Promise<unknown>;
  /** Patient starts the consult themselves — the escape hatch. */
  startConsultAsPatient: (id: string) => Promise<unknown>;
  /** Patient rolls a new code; returns the new digits. */
  reissueStartCode: (id: string) => Promise<{ startCode?: string }>;
  requestPayout: (doctorId: string) => void;
  advanceOrder: (orderId: string, current: OrderStatus) => void;
  /** Ops removes a doctor from the platform. Resolves with what was actually
   *  removed versus kept; rejects with the server's message (e.g. while the
   *  doctor is mid-consult). */
  deleteDoctor: (doctorId: string) => Promise<DoctorDeletion>;
  /** Ops signs off on a provider's credentials. For a nurse this is also the
   *  gate on being discoverable: unverified nurses reach no patient. */
  verifyProvider: (providerId: string, verified: boolean) => Promise<unknown>;
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
        // Demo mode has no sessions and no server to be absent from: the one
        // browser holding the store IS the doctor, so presence is a given.
        heartbeat: async () => {},
        setAvailability: async (id, availability) =>
          demoStore.setDoctorAvailability(id, availability),
        acceptRequest: async (id, doctorId) => demoStore.acceptRequest(id, doctorId),
        declineRequest: async (id) =>
          demoStore.declineRequest(id, currentDoctorId() ?? undefined),
        // The demo store has no session, so "who is cancelling" is inferred
        // from whether a reason was given — the doctor path is the only one
        // that requires one.
        cancelRequest: async (id, reason) =>
          demoStore.cancelRequest(id, { reason, byDoctor: Boolean(reason) }),
        completeRequest: demoStore.completeRequest,
        issuePrescription: async (requestId, draft) =>
          demoStore.issuePrescription(requestId, draft),
        createGig: async (input) => {
          const id = currentDoctorId();
          if (!id) throw new Error("Register as a doctor first.");
          demoStore.createGig({ ...input, doctorId: id });
        },
        updateGig: async (id, patch) => demoStore.updateGig(id, patch),
        setGigStatus: async (id, status) => demoStore.setGigStatus(id, status),
        deleteGig: async (id) => demoStore.deleteGig(id),
        advanceTrip: async (id) => void demoStore.advanceTrip(id),
        // Demo has no server to check a code against; starting is immediate.
        verifyStartCode: async (id) => void demoStore.advanceTrip(id),
        startConsultAsPatient: async (id) => void demoStore.advanceTrip(id),
        reissueStartCode: async () => ({}),
        requestPayout: demoStore.requestPayout,
        advanceOrder: (id) => demoStore.advanceOrder(id),
        // Demo mode has no accounts to remove, so this is refused rather than
        // faked — a delete that silently does nothing is the worst outcome.
        deleteDoctor: async () => {
          throw new Error("Deleting a doctor needs the live backend.");
        },
        verifyProvider: async () => {
          throw new Error("Verifying a provider needs the live backend.");
        },
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
      // Bypasses callAction on purpose: that helper invalidates every query on
      // completion, and a beat every 30s would refetch the whole app forever.
      heartbeat: async () => {
        await apiFetch("/api/actions", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ action: "heartbeat", payload: {} }),
        });
      },
      setAvailability: (_id, availability) =>
        callAction<void>(qc, "setAvailability", { availability }),
      acceptRequest: async (id) => void (await callAction(qc, "acceptRequest", { id })),
      /**
       * Pass, applied to the SHARED request cache rather than to one screen.
       *
       * Both the dashboard and the requests page render from the same
       * `["requests"]` query, so dropping the row here hides it on both at
       * once, and it stays hidden across navigation because the cache outlives
       * the components. Each screen previously kept its own `passed` Set in
       * component state, which is why passing on the dashboard did nothing to
       * the requests list — and why it came straight back the moment you
       * navigated, since that state died with the component.
       *
       * This is only the optimistic half. `callAction` persists the pass in
       * `consult_requests.passed_by` and then invalidates, so the refetch
       * confirms from the database rather than trusting the cache; a passed
       * request is filtered server-side by visibleToProvider() from then on,
       * for every surface. If the write fails we invalidate to pull the truth
       * back and rethrow so the caller can say so.
       */
      declineRequest: async (id, reason) => {
        // setQueriesData, not setQueryData: the map and other views subscribe
        // to scoped variants like ["requests", {near}], and a pass has to
        // remove the row from every one of them.
        qc.setQueriesData<ConsultRequest[]>({ queryKey: ["requests"] }, (list) =>
          Array.isArray(list) ? list.filter((r) => r.id !== id) : list,
        );
        try {
          await callAction(qc, "declineRequest", { id, reason });
        } catch (e) {
          qc.invalidateQueries({ queryKey: ["requests"] });
          throw e;
        }
      },
      cancelRequest: async (id, reason) =>
        void (await callAction(qc, "cancelRequest", { id, reason })),
      completeRequest: (id) => callAction(qc, "completeRequest", { id }),
      issuePrescription: (requestId, draft) =>
        callAction<Prescription>(qc, "issuePrescription", { requestId, draft }),
      // The gig's owner is the session doctor — no id is sent for creation.
      createGig: async (input) => void (await callAction(qc, "createGig", { ...input })),
      updateGig: async (id, patch) => void (await callAction(qc, "updateGig", { id, patch })),
      setGigStatus: async (id, status) =>
        void (await callAction(qc, "setGigStatus", { id, status })),
      deleteGig: async (id) => void (await callAction(qc, "deleteGig", { id })),
      advanceTrip: async (id) => void (await callAction(qc, "advanceTrip", { id })),
      verifyStartCode: (id, code) => callAction(qc, "verifyStartCode", { id, code }),
      startConsultAsPatient: (id) => callAction(qc, "startConsultAsPatient", { id }),
      reissueStartCode: (id) =>
        callAction<{ startCode?: string }>(qc, "reissueStartCode", { id }),
      requestPayout: () => callAction(qc, "requestPayout", {}),
      advanceOrder: (orderId, current) =>
        callAction(qc, "advanceOrder", { orderId, next: nextOrder(current) }),
      deleteDoctor: (doctorId) =>
        callAction<DoctorDeletion>(qc, "deleteDoctor", { doctorId }),
      verifyProvider: (providerId, verified) =>
        callAction(qc, "verifyProvider", { doctorId: providerId, verified }),
    };
  }, [qc, nextOrder]);
}
