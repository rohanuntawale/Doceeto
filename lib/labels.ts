import type {
  BookingMode,
  ConsultStatus,
  ConsultType,
  DoctorKind,
  DoctorStatus,
  GigStatus,
  OrderStatus,
  SosCategory,
  SosStatus,
  TripStage,
} from "@/lib/types/domain";

type Tone = "critical" | "warn" | "ok" | "idle" | "info";

export const sosCategory: Record<SosCategory, { label: string }> = {
  cardiac: { label: "Cardiac" },
  trauma: { label: "Trauma" },
  respiratory: { label: "Respiratory" },
  stroke: { label: "Stroke" },
  obstetric: { label: "Obstetric" },
  other: { label: "Other" },
};

export const sosStatus: Record<SosStatus, { label: string; tone: Tone }> = {
  open: { label: "Open", tone: "critical" },
  assigned: { label: "Assigned", tone: "warn" },
  enroute: { label: "En route", tone: "info" },
  resolved: { label: "Resolved", tone: "ok" },
  cancelled: { label: "Cancelled", tone: "idle" },
};

export const consultStatus: Record<ConsultStatus, { label: string; tone: Tone }> = {
  pending: { label: "Pending", tone: "warn" },
  accepted: { label: "Accepted", tone: "info" },
  declined: { label: "Declined", tone: "idle" },
  completed: { label: "Completed", tone: "ok" },
  cancelled: { label: "Cancelled", tone: "idle" },
};

export const consultType: Record<ConsultType, { label: string }> = {
  video: { label: "Video consult" },
  home_visit: { label: "Home visit" },
  clinic: { label: "Clinic visit" },
};

export const orderStatus: Record<OrderStatus, { label: string; tone: Tone; step: number }> = {
  placed: { label: "Placed", tone: "warn", step: 0 },
  packed: { label: "Packed", tone: "info", step: 1 },
  out_for_delivery: { label: "Out for delivery", tone: "info", step: 2 },
  delivered: { label: "Delivered", tone: "ok", step: 3 },
  cancelled: { label: "Cancelled", tone: "idle", step: 0 },
};

export const doctorStatus: Record<DoctorStatus, { label: string; tone: Tone }> = {
  online: { label: "Online", tone: "ok" },
  busy: { label: "Busy", tone: "warn" },
  offline: { label: "Offline", tone: "idle" },
};

export const gigStatus: Record<GigStatus, { label: string; tone: Tone }> = {
  active: { label: "Live", tone: "ok" },
  paused: { label: "Paused", tone: "warn" },
  archived: { label: "Archived", tone: "idle" },
};

/** How the patient reached the doctor — shown on request and consult cards. */
export const bookingMode: Record<BookingMode, { label: string; tone: Tone }> = {
  emergency: { label: "Urgent", tone: "critical" },
  scheduled: { label: "Appointment", tone: "info" },
  gig: { label: "Gig", tone: "warn" },
};

/**
 * The Uber-style rail after a request is accepted. `step` mirrors orderStatus
 * so the same progress-rail rendering works for both. "completed" is the
 * consult status, not a trip stage, so it is the rail's implicit final node.
 */
export const tripStage: Record<TripStage, { label: string; tone: Tone; step: number }> = {
  accepted: { label: "Accepted", tone: "info", step: 0 },
  enroute: { label: "On the way", tone: "info", step: 1 },
  arrived: { label: "Arrived", tone: "warn", step: 2 },
  in_progress: { label: "In consult", tone: "ok", step: 3 },
};

export const doctorKind: Record<DoctorKind, { label: string; blurb: string }> = {
  resident: {
    label: "Junior doctor",
    blurb: "Licensed, not in a full-time job yet",
  },
  practising: {
    label: "Practising doctor",
    blurb: "Full-time doctor taking extra visits",
  },
};

// ── Total lookups ────────────────────────────────────────────
/**
 * Read a label by a value that came off the wire. Indexing these maps
 * directly returns `undefined` for anything unexpected — a row written by an
 * older build, an enum added since, or a hand-rolled API call — and the
 * `.label` that follows then takes the whole page down. Every getter falls
 * back instead, so one odd row degrades to a neutral pill.
 */
const of = <T,>(map: Record<string, T>, key: string | null | undefined, fallback: T): T =>
  map[key ?? ""] ?? fallback;

export const sosCategoryOf = (k?: string | null) =>
  of(sosCategory, k, { label: "Other" });
export const sosStatusOf = (k?: string | null) =>
  of(sosStatus, k, { label: "Unknown", tone: "idle" as Tone });
export const consultStatusOf = (k?: string | null) =>
  of(consultStatus, k, { label: "Unknown", tone: "idle" as Tone });
export const consultTypeOf = (k?: string | null) => of(consultType, k, { label: "Consult" });
export const orderStatusOf = (k?: string | null) =>
  of(orderStatus, k, { label: "Unknown", tone: "idle" as Tone, step: 0 });
export const doctorStatusOf = (k?: string | null) =>
  of(doctorStatus, k, { label: "Offline", tone: "idle" as Tone });
export const doctorKindOf = (k?: string | null) =>
  of(doctorKind, k, { label: "Doctor", blurb: "" });
export const gigStatusOf = (k?: string | null) =>
  of(gigStatus, k, { label: "Unknown", tone: "idle" as Tone });
export const bookingModeOfLabel = (k?: string | null) =>
  of(bookingMode, k, { label: "Consult", tone: "idle" as Tone });
export const tripStageOf = (k?: string | null) =>
  of(tripStage, k, { label: "Accepted", tone: "info" as Tone, step: 0 });

// ── Translated labels ────────────────────────────────────────
/**
 * The English maps above are the source of truth for TONE and STEP; this maps
 * each value onto a dictionary key so the same pills read in the patient's
 * language. Kept as a separate layer so ops and doctor consoles — professional
 * tools that stay in English — can keep using the plain getters.
 */
const KEY: Record<string, string> = {
  pending: "st.pending", accepted: "st.accepted", declined: "st.declined",
  completed: "st.completed", cancelled: "st.cancelled",
  video: "st.video", home_visit: "st.home_visit", clinic: "st.clinic",
  online: "st.online", busy: "st.busy", offline: "st.offline",
  active: "st.live", paused: "st.paused", archived: "st.archived",
  emergency: "st.urgent", scheduled: "st.appointment", gig: "st.gig",
  enroute: "st.enroute", arrived: "st.arrived", in_progress: "st.inConsult",
  placed: "st.placed", packed: "st.packed",
  out_for_delivery: "st.outForDelivery", delivered: "st.delivered",
  resident: "kind.resident", practising: "kind.practising",
};

type Translate = (key: string, vars?: Record<string, string>) => string;

/**
 * Wrap any getter so its `.label` comes from the dictionary. Tone/step pass
 * through untouched. Unknown values keep the getter's own neutral fallback,
 * translated where a key exists.
 */
function translated<T extends { label: string }>(
  t: Translate,
  entry: T,
  raw?: string | null,
): T {
  const key = raw ? KEY[raw] : undefined;
  return key ? { ...entry, label: t(key) } : entry;
}

/** Patient-facing label getters, in the active language. */
export function labelsIn(t: Translate) {
  return {
    consultStatus: (k?: string | null) => translated(t, consultStatusOf(k), k),
    consultType: (k?: string | null) => translated(t, consultTypeOf(k), k),
    orderStatus: (k?: string | null) => translated(t, orderStatusOf(k), k),
    doctorStatus: (k?: string | null) => translated(t, doctorStatusOf(k), k),
    gigStatus: (k?: string | null) => translated(t, gigStatusOf(k), k),
    bookingMode: (k?: string | null) => translated(t, bookingModeOfLabel(k), k),
    tripStage: (k?: string | null) => translated(t, tripStageOf(k), k),
    doctorKind: (k?: string | null) => {
      const e = doctorKindOf(k);
      if (k === "resident" || k === "practising") {
        return { label: t(KEY[k]), blurb: t(`kind.${k}Blurb`) };
      }
      return e;
    },
  };
}
