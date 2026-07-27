/**
 * The appointment engine: one place that decides what a doctor's calendar
 * looks like, which slots are free, and which requests a doctor is allowed
 * to see. The patient's picker, the doctor's schedule screen, /api/data and
 * both repos all call these same functions, so a slot can never be free in
 * the UI and taken on the server.
 *
 * Pure and dependency-free — safe on the client and the server.
 */
import type {
  AvailabilityWindow,
  BookingMode,
  ConsultRequest,
  Doctor,
  DoctorAvailability,
} from "@/lib/types/domain";
import {
  addDaysToKey,
  dateKeyOf,
  daysBetweenKeys,
  formatDayLabel,
  instantAt,
  isDateKey,
  parseHm,
  toHm,
  weekdayOfKey,
  WEEKDAY_LABELS,
} from "@/lib/scheduling/time";
import { GIG_LOCKS_APPOINTMENTS } from "@/lib/gigs/rules";

/** Appointment lengths a doctor can choose between. */
export const SLOT_CHOICES = [15, 20, 30, 45, 60] as const;
export const MAX_HORIZON_DAYS = 30;
export const MAX_LEAD_MINUTES = 1440;
/** Windows per doctor, across the whole week. */
export const MAX_WINDOWS = 28;
/** Individual days a doctor can block off at once. */
export const MAX_DAYS_OFF = 60;

/** What a doctor gets before they ever open the schedule editor. */
export const DEFAULT_AVAILABILITY: DoctorAvailability = {
  slotMinutes: 30,
  windows: [1, 2, 3, 4, 5, 6].flatMap((day) => [
    { day, start: "09:00", end: "13:00" },
    { day, start: "17:00", end: "20:00" },
  ]),
  daysOff: [],
  horizonDays: 14,
  leadMinutes: 60,
  acceptsEmergency: true,
};

/** A half-open interval of epoch milliseconds: [start, end). */
export interface Interval {
  start: number;
  end: number;
}

export interface SlotView {
  /** ISO instant the appointment starts. */
  start: string;
  /** ISO instant it ends. */
  end: string;
  /** Another booking already holds this slot. */
  taken: boolean;
  /** Gone — in the past, or inside the doctor's notice period. */
  past: boolean;
}

export interface DayView {
  /** "YYYY-MM-DD" in the scheduling zone. */
  date: string;
  /** "Today" / "Tomorrow" / "Mon 28 Jul". */
  label: string;
  weekday: number;
  slots: SlotView[];
  /** Slots on this day a patient can actually pick. */
  openCount: number;
}

// ── Availability normalisation ───────────────────────────────

const clampInt = (value: unknown, min: number, max: number, fallback: number) => {
  const n = Math.round(Number(value));
  if (!Number.isFinite(n)) return fallback;
  return Math.max(min, Math.min(max, n));
};

/** Snap any slot length onto the nearest supported one. */
function snapSlotMinutes(value: unknown): number {
  const n = Number(value);
  if (!Number.isFinite(n)) return DEFAULT_AVAILABILITY.slotMinutes;
  return SLOT_CHOICES.reduce((best, choice) =>
    Math.abs(choice - n) < Math.abs(best - n) ? choice : best,
  );
}

/**
 * Sort a day's windows and fuse any that touch or overlap. Without this, two
 * overlapping windows would emit the same slot twice and the patient could
 * book "both", which the conflict check would then reject at random.
 */
function mergeWindows(windows: AvailabilityWindow[]): AvailabilityWindow[] {
  const byDay = new Map<number, { start: number; end: number }[]>();
  for (const w of windows) {
    const day = clampInt(w.day, 0, 6, -1);
    const start = parseHm(w.start);
    const end = parseHm(w.end);
    if (day < 0 || start === null || end === null || end <= start) continue;
    const list = byDay.get(day) ?? [];
    list.push({ start, end });
    byDay.set(day, list);
  }
  const out: AvailabilityWindow[] = [];
  for (const day of [...byDay.keys()].sort((a, b) => a - b)) {
    const spans = byDay.get(day)!.sort((a, b) => a.start - b.start);
    let cur = spans[0];
    for (const next of spans.slice(1)) {
      if (next.start <= cur.end) cur = { start: cur.start, end: Math.max(cur.end, next.end) };
      else {
        out.push({ day, start: toHm(cur.start), end: toHm(cur.end) });
        cur = next;
      }
    }
    out.push({ day, start: toHm(cur.start), end: toHm(cur.end) });
  }
  return out.slice(0, MAX_WINDOWS);
}

/**
 * Coerce anything — a stored row, an API payload, undefined — into a
 * complete, sane availability. Every read of `doctor.availability` goes
 * through here so no caller ever meets a half-filled object.
 */
export function normalizeAvailability(raw: unknown): DoctorAvailability {
  const src = (raw && typeof raw === "object" ? raw : {}) as Partial<DoctorAvailability>;
  const hasWindows = Array.isArray(src.windows);
  return {
    slotMinutes: snapSlotMinutes(src.slotMinutes),
    // An explicit empty list means "no scheduled appointments" and is kept;
    // a missing list means the doctor has never touched the editor.
    windows: hasWindows
      ? mergeWindows(src.windows as AvailabilityWindow[])
      : DEFAULT_AVAILABILITY.windows,
    daysOff: Array.isArray(src.daysOff)
      ? [...new Set(src.daysOff.filter(isDateKey))].sort().slice(0, MAX_DAYS_OFF)
      : [],
    horizonDays: clampInt(src.horizonDays, 1, MAX_HORIZON_DAYS, DEFAULT_AVAILABILITY.horizonDays),
    leadMinutes: clampInt(src.leadMinutes, 0, MAX_LEAD_MINUTES, DEFAULT_AVAILABILITY.leadMinutes),
    acceptsEmergency: src.acceptsEmergency !== false,
  };
}

/** A doctor's calendar, always complete. */
export function availabilityOf(doctor?: Doctor | null): DoctorAvailability {
  return normalizeAvailability(doctor?.availability);
}

/** True when the doctor has at least one bookable window in the week. */
export function takesAppointments(av: DoctorAvailability): boolean {
  return av.windows.length > 0;
}

/** Human summary of the weekly windows, e.g. "Mon–Sat · 9:00 am – 1:00 pm". */
export function describeWindows(av: DoctorAvailability): string {
  if (av.windows.length === 0) return "No appointment hours set";
  const days = [...new Set(av.windows.map((w) => w.day))].sort((a, b) => a - b);
  const names = days.map((d) => WEEKDAY_LABELS[d].slice(0, 3)).join(", ");
  return `${names} · ${av.windows.length} window${av.windows.length === 1 ? "" : "s"} · ${av.slotMinutes}-min slots`;
}

// ── Booking-mode helpers ─────────────────────────────────────

/**
 * The mode of a request. Rows written before scheduling existed carry no
 * `mode`, so it is inferred from whether a slot was booked — never read
 * `request.mode` directly.
 *
 * The fallback deliberately only ever yields "scheduled" or "emergency": a
 * legacy row can never be mistaken for a gig, which is always written with an
 * explicit mode.
 */
export function bookingModeOf(
  req: Pick<ConsultRequest, "mode" | "scheduledAt"> | null | undefined,
): BookingMode {
  if (req?.mode === "scheduled" || req?.mode === "emergency" || req?.mode === "gig")
    return req.mode;
  return req?.scheduledAt ? "scheduled" : "emergency";
}

export const isScheduled = (req: Pick<ConsultRequest, "mode" | "scheduledAt">) =>
  bookingModeOf(req) === "scheduled";

/** A hired service package rather than a slot or an urgent call-out. */
export const isGig = (req: Pick<ConsultRequest, "mode" | "scheduledAt">) =>
  bookingModeOf(req) === "gig";

/**
 * Coerce an off-the-wire mode onto the union, defaulting to "emergency".
 * Used by the API route and every repo so an unknown string can never reach a
 * stored row and confuse bookingModeOf() later.
 */
export function coerceBookingMode(value: unknown): BookingMode {
  return value === "scheduled" || value === "gig" ? value : "emergency";
}

/** The slot a scheduled request occupies, or null if it holds none. */
export function intervalOf(
  req: Pick<ConsultRequest, "mode" | "scheduledAt" | "scheduledEnd" | "slotMinutes">,
): Interval | null {
  if (!isScheduled(req) || !req.scheduledAt) return null;
  const start = Date.parse(req.scheduledAt);
  if (!Number.isFinite(start)) return null;
  const parsedEnd = req.scheduledEnd ? Date.parse(req.scheduledEnd) : NaN;
  const end = Number.isFinite(parsedEnd)
    ? parsedEnd
    : start + (Number(req.slotMinutes) || DEFAULT_AVAILABILITY.slotMinutes) * 60000;
  return end > start ? { start, end } : null;
}

export const overlaps = (a: Interval, b: Interval) => a.start < b.end && b.start < a.end;

/** Statuses that still hold a slot. Declined/cancelled/completed release it. */
const HOLDING: ConsultRequest["status"][] = ["pending", "accepted"];

/**
 * Every slot on a doctor's calendar that is already spoken for. Pending
 * counts: two patients must not be offered the same time just because
 * neither has been confirmed yet.
 */
export function busyIntervals(
  requests: ConsultRequest[],
  doctorId: string,
  opts?: { excludeRequestId?: string; statuses?: ConsultRequest["status"][] },
): Interval[] {
  const statuses = opts?.statuses ?? HOLDING;
  const out: Interval[] = [];
  for (const r of requests) {
    if (r.doctorId !== doctorId) continue;
    if (opts?.excludeRequestId && r.id === opts.excludeRequestId) continue;
    if (!statuses.includes(r.status)) continue;
    const iv = intervalOf(r);
    if (iv) out.push(iv);
  }
  return out;
}

// ── The grid ─────────────────────────────────────────────────

/** The raw slot grid for one calendar day — availability only, no bookings. */
export function slotsForDay(av: DoctorAvailability, key: string): Interval[] {
  if (av.daysOff.includes(key)) return [];
  const weekday = weekdayOfKey(key);
  const out: Interval[] = [];
  for (const w of av.windows) {
    if (w.day !== weekday) continue;
    const from = parseHm(w.start);
    const to = parseHm(w.end);
    if (from === null || to === null) continue;
    for (let m = from; m + av.slotMinutes <= to; m += av.slotMinutes) {
      const start = instantAt(key, m);
      if (!start) continue;
      out.push({ start: start.getTime(), end: start.getTime() + av.slotMinutes * 60000 });
    }
  }
  return out.sort((a, b) => a.start - b.start);
}

/**
 * The patient-facing calendar: every day inside the horizon, each slot
 * marked taken (someone booked it) or past (gone, or inside the notice
 * period). Days with no windows at all are dropped.
 */
export function buildSchedule(
  av: DoctorAvailability,
  opts: { now?: Date; busy?: Interval[] } = {},
): DayView[] {
  const now = opts.now ?? new Date();
  const busy = opts.busy ?? [];
  const todayKey = dateKeyOf(now);
  const earliest = now.getTime() + av.leadMinutes * 60000;
  const days: DayView[] = [];

  for (let i = 0; i < av.horizonDays; i++) {
    const key = addDaysToKey(todayKey, i);
    const grid = slotsForDay(av, key);
    if (grid.length === 0) continue;
    const slots = grid.map((iv) => ({
      start: new Date(iv.start).toISOString(),
      end: new Date(iv.end).toISOString(),
      taken: busy.some((b) => overlaps(iv, b)),
      past: iv.start < earliest,
    }));
    days.push({
      date: key,
      label: formatDayLabel(key, todayKey),
      weekday: weekdayOfKey(key),
      slots,
      openCount: slots.filter((s) => !s.taken && !s.past).length,
    });
  }
  return days;
}

/** The grid slot starting exactly at `startIso`, or null if it isn't one. */
export function findSlotOnGrid(av: DoctorAvailability, startIso: string): Interval | null {
  const t = Date.parse(startIso);
  if (!Number.isFinite(t)) return null;
  const key = dateKeyOf(new Date(t));
  return slotsForDay(av, key).find((s) => s.start === t) ?? null;
}

/** How far ahead this doctor accepts bookings, as a calendar key. */
export function horizonKey(av: DoctorAvailability, now: Date = new Date()): string {
  return addDaysToKey(dateKeyOf(now), av.horizonDays - 1);
}

/** True when a slot falls beyond the doctor's booking horizon. */
export function beyondHorizon(
  av: DoctorAvailability,
  startMs: number,
  now: Date = new Date(),
): boolean {
  return daysBetweenKeys(dateKeyOf(now), dateKeyOf(new Date(startMs))) > av.horizonDays - 1;
}

// ── Who is busy right now ────────────────────────────────────

/**
 * Is this consult occupying the doctor at this moment? An accepted
 * emergency always is. An accepted appointment only is while its slot is
 * actually running — tomorrow's 10:00 must not block tonight's emergency.
 */
export function isOngoingConsult(req: ConsultRequest, nowMs: number = Date.now()): boolean {
  if (req.status !== "accepted") return false;
  const iv = intervalOf(req);
  // An accepted row with no readable slot is treated as live: it is claimed
  // and unfinished, so the doctor is on it.
  if (!iv) return true;
  return nowMs >= iv.start && nowMs < iv.end;
}

/** True when the doctor has a consult in progress right now. */
export function hasOngoingConsult(
  requests: ConsultRequest[],
  doctorId: string,
  nowMs: number = Date.now(),
): boolean {
  return requests.some((r) => r.doctorId === doctorId && isOngoingConsult(r, nowMs));
}

/** The doctor's live consult, if any. */
export function ongoingConsultOf(
  requests: ConsultRequest[],
  doctorId: string,
  nowMs: number = Date.now(),
): ConsultRequest | undefined {
  return requests.find((r) => r.doctorId === doctorId && isOngoingConsult(r, nowMs));
}

/**
 * The gig hire occupying this doctor right now, if any.
 *
 * A gig holds no calendar slot, so intervalOf() returns null for it and
 * isOngoingConsult() therefore treats an accepted gig as live indefinitely —
 * until the doctor completes or cancels it. That is exactly the "paused until
 * the gig is done" rule, and it needs no stored flag: complete the row and the
 * doctor is free again, so a crash mid-gig can never strand them.
 */
export function activeGigHireOf(
  requests: ConsultRequest[],
  doctorId: string,
  nowMs: number = Date.now(),
): ConsultRequest | undefined {
  return requests.find(
    (r) => r.doctorId === doctorId && isGig(r) && isOngoingConsult(r, nowMs),
  );
}

/** True while the doctor is committed to a gig. */
export function isOnGig(
  requests: ConsultRequest[],
  doctorId: string,
  nowMs: number = Date.now(),
): boolean {
  return activeGigHireOf(requests, doctorId, nowMs) !== undefined;
}

/** Pending gig hires waiting on this doctor's answer, oldest first. */
export function pendingGigHires(
  requests: ConsultRequest[],
  doctorId: string,
): ConsultRequest[] {
  return requests
    .filter((r) => r.doctorId === doctorId && r.status === "pending" && isGig(r))
    .sort((a, b) => (a.createdAt < b.createdAt ? -1 : 1));
}

/** Everything a patient-facing surface needs to know about one doctor. */
export interface BookableState {
  availability: DoctorAvailability;
  takesAppointments: boolean;
  /** Mid-consult right now (an accepted emergency, a running slot, or a gig). */
  onConsult: boolean;
  /** Committed to a gig — the listing is paused. */
  onGig: boolean;
  activeGigId: string | null;
  /** A "see me now" request makes sense at this moment. */
  emergencyAvailable: boolean;
  /** The slot picker should accept a booking. */
  appointmentsOpen: boolean;
  /** Gig "Hire now" buttons should be live. */
  gigsHireable: boolean;
}

/**
 * One place that answers "what can a patient do with this doctor right now?".
 *
 * The server route and the in-browser demo path both call this, so the flags
 * can't drift between them — they used to be computed separately in
 * app/api/availability/route.ts and lib/hooks/use-schedule.ts.
 */
export function bookableState(
  doctor: Doctor | null | undefined,
  requests: ConsultRequest[],
  now: Date = new Date(),
): BookableState {
  const nowMs = now.getTime();
  const availability = availabilityOf(doctor);
  const doctorId = doctor?.id ?? "";
  const gig = doctorId ? activeGigHireOf(requests, doctorId, nowMs) : undefined;
  const onGig = gig !== undefined;
  const onConsult = doctorId ? hasOngoingConsult(requests, doctorId, nowMs) : false;
  const appointments = takesAppointments(availability);

  return {
    availability,
    takesAppointments: appointments,
    onConsult,
    onGig,
    activeGigId: gig?.gigId ?? null,
    emergencyAvailable:
      availability.acceptsEmergency && doctor?.status === "online" && !onConsult && !onGig,
    // A long gig locking the whole calendar may be too strict; the constant in
    // lib/gigs/rules.ts is the single switch for that product call.
    appointmentsOpen: appointments && !(onGig && GIG_LOCKS_APPOINTMENTS),
    gigsHireable: !onGig && !onConsult,
  };
}

/** Seed doctors are display-only rows with no login — any doctor may claim
 *  a request aimed at one. */
const isSeedDoctor = (id: string | null | undefined) => Boolean(id?.startsWith("doc-seed-"));

/**
 * Whether a doctor may see a request at all. Shared by /api/data (live) and
 * the dashboards (demo), so both consoles hide exactly the same rows.
 *
 * The rule that matters here: while a doctor has a consult in progress, no
 * pending EMERGENCY reaches them — they could not take it anyway, and a
 * queue of unanswerable alerts is worse than silence. Appointments still
 * come through, because confirming next Tuesday costs nothing right now.
 */
export function visibleToDoctor(
  req: ConsultRequest,
  ctx: { doctorId: string; busy: boolean },
): boolean {
  const mine = req.doctorId === ctx.doctorId;
  // Anything already claimed (or finished) is only ever the owner's.
  if (req.status !== "pending") return mine;
  // A gig hire names one doctor and never broadcasts. It stays visible even
  // while they're busy: the patient asked for them specifically, so silently
  // hiding it would leave the request unanswered rather than declined.
  if (isGig(req)) return mine;
  if (isScheduled(req)) return mine || isSeedDoctor(req.doctorId);
  if (ctx.busy) return false;
  // A pass is persisted, so a dismissed broadcast stays gone after a refresh
  // and a doctor who cancelled one isn't immediately re-offered it.
  if (req.passedBy?.includes(ctx.doctorId)) return false;
  return mine || req.doctorId === null || isSeedDoctor(req.doctorId);
}

/** Upcoming appointments for a doctor, soonest first. */
export function upcomingAppointments(
  requests: ConsultRequest[],
  doctorId: string,
  nowMs: number = Date.now(),
): ConsultRequest[] {
  return requests
    .filter((r) => {
      if (r.doctorId !== doctorId) return false;
      if (r.status !== "pending" && r.status !== "accepted") return false;
      const iv = intervalOf(r);
      return iv !== null && iv.end > nowMs;
    })
    .sort((a, b) => (intervalOf(a)!.start - intervalOf(b)!.start));
}

/** Does this request clash with something the doctor has already accepted? */
export function clashesWithAccepted(
  req: ConsultRequest,
  requests: ConsultRequest[],
  doctorId: string,
): boolean {
  const iv = intervalOf(req);
  if (!iv) return false;
  return busyIntervals(requests, doctorId, {
    excludeRequestId: req.id,
    statuses: ["accepted"],
  }).some((b) => overlaps(iv, b));
}
