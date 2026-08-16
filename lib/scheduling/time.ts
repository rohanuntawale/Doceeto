/**
 * Wall-clock helpers for the appointment grid.
 *
 * Availability is written as plain "HH:MM" times, but the server, the
 * doctor's browser and the patient's browser can all sit in different
 * timezones — and a slot that means three different instants is a
 * double-booking waiting to happen. So every wall-clock ↔ instant
 * conversion in the app goes through ONE fixed scheduling zone, and every
 * slot travels between them as an absolute ISO instant.
 *
 * Pure: safe to import from both client components and server routes.
 */

/** The single zone all appointment wall-clock times are expressed in. */
export const SCHEDULE_TIME_ZONE = "Asia/Kolkata";

const WEEKDAY_KEYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

/** Long day names, indexed the same way (0 = Sunday). */
export const WEEKDAY_LABELS = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];

export interface ZonedParts {
  year: number;
  month: number; // 1-12
  day: number; // 1-31
  hour: number; // 0-23
  minute: number;
  second: number;
  weekday: number; // 0 = Sunday
}

// Intl formatters are expensive to build; each is created once, lazily.
let partsFmt: Intl.DateTimeFormat | null = null;
let timeFmt: Intl.DateTimeFormat | null = null;

function partsFormatter() {
  partsFmt ??= new Intl.DateTimeFormat("en-US", {
    timeZone: SCHEDULE_TIME_ZONE,
    hourCycle: "h23",
    weekday: "short",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
  return partsFmt;
}

/** Break an instant into its wall-clock parts in the scheduling zone. */
export function zonedParts(date: Date): ZonedParts {
  const found = partsFormatter().formatToParts(date);
  const get = (type: string) => found.find((p) => p.type === type)?.value ?? "";
  const weekday = WEEKDAY_KEYS.indexOf(get("weekday"));
  return {
    year: Number(get("year")),
    month: Number(get("month")),
    day: Number(get("day")),
    // h23 still emits "24" for midnight in some ICU builds — fold it back.
    hour: Number(get("hour")) % 24,
    minute: Number(get("minute")),
    second: Number(get("second")),
    weekday: weekday < 0 ? 0 : weekday,
  };
}

/** Minutes the scheduling zone is ahead of UTC at this instant. */
function zoneOffsetMinutes(date: Date): number {
  const p = zonedParts(date);
  const asUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second);
  // Compare on whole seconds — formatToParts has no sub-second resolution.
  return Math.round((asUtc - Math.floor(date.getTime() / 1000) * 1000) / 60000);
}

const KEY_RE = /^(\d{4})-(\d{2})-(\d{2})$/;

/** True for a well-formed "YYYY-MM-DD" calendar key. */
export function isDateKey(value: unknown): value is string {
  return typeof value === "string" && KEY_RE.test(value);
}

/** The calendar date of an instant, in the scheduling zone. */
export function dateKeyOf(date: Date): string {
  const p = zonedParts(date);
  return `${p.year}-${String(p.month).padStart(2, "0")}-${String(p.day).padStart(2, "0")}`;
}

/** Day of the week a calendar key falls on (0 = Sunday). */
export function weekdayOfKey(key: string): number {
  const m = KEY_RE.exec(key);
  if (!m) return 0;
  return new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]))).getUTCDay();
}

/** Shift a calendar key by whole days. Pure calendar arithmetic — no zone. */
export function addDaysToKey(key: string, days: number): string {
  const m = KEY_RE.exec(key);
  if (!m) return key;
  const d = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])));
  d.setUTCDate(d.getUTCDate() + days);
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(
    d.getUTCDate(),
  ).padStart(2, "0")}`;
}

/** Whole days between two calendar keys (b - a). */
export function daysBetweenKeys(a: string, b: string): number {
  const pa = KEY_RE.exec(a);
  const pb = KEY_RE.exec(b);
  if (!pa || !pb) return 0;
  const ta = Date.UTC(Number(pa[1]), Number(pa[2]) - 1, Number(pa[3]));
  const tb = Date.UTC(Number(pb[1]), Number(pb[2]) - 1, Number(pb[3]));
  return Math.round((tb - ta) / 86_400_000);
}

/**
 * The exact instant of a wall-clock time on a calendar day, in the
 * scheduling zone. Resolved twice so a slot that straddles a DST change
 * still lands on the right side of it (a no-op in a zone without DST).
 */
export function instantAt(key: string, minutesOfDay: number): Date | null {
  const m = KEY_RE.exec(key);
  if (!m || !Number.isFinite(minutesOfDay)) return null;
  const wall = Date.UTC(
    Number(m[1]),
    Number(m[2]) - 1,
    Number(m[3]),
    0,
    Math.round(minutesOfDay),
  );
  const first = new Date(wall - zoneOffsetMinutes(new Date(wall)) * 60000);
  const settled = new Date(wall - zoneOffsetMinutes(first) * 60000);
  return Number.isFinite(settled.getTime()) ? settled : null;
}

/** "HH:MM" → minutes past midnight, or null when it isn't a time. */
export function parseHm(value: unknown): number | null {
  if (typeof value !== "string") return null;
  const m = /^(\d{1,2}):(\d{2})$/.exec(value.trim());
  if (!m) return null;
  const h = Number(m[1]);
  const min = Number(m[2]);
  if (h < 0 || h > 23 || min < 0 || min > 59) return null;
  return h * 60 + min;
}

/** Minutes past midnight → "HH:MM". */
export function toHm(minutes: number): string {
  const clamped = Math.max(0, Math.min(1440, Math.round(minutes)));
  const h = Math.floor(clamped / 60);
  const m = clamped % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

/** "9:30 am" for an instant, always read in the scheduling zone. */
export function formatSlotTime(iso: string | Date): string {
  const d = iso instanceof Date ? iso : new Date(iso);
  if (Number.isNaN(d.getTime())) return ", ";
  timeFmt ??= new Intl.DateTimeFormat("en-IN", {
    timeZone: SCHEDULE_TIME_ZONE,
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
  return timeFmt.format(d).toLowerCase();
}

/** "Mon 28 Jul" for a calendar key. */
export function formatDayShort(key: string): string {
  const m = KEY_RE.exec(key);
  if (!m) return key;
  const d = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])));
  return new Intl.DateTimeFormat("en-IN", {
    timeZone: "UTC",
    weekday: "short",
    day: "numeric",
    month: "short",
  }).format(d);
}

/** "Today" / "Tomorrow" / "Mon 28 Jul", relative to the zone's today. */
export function formatDayLabel(key: string, todayKey: string): string {
  const diff = daysBetweenKeys(todayKey, key);
  if (diff === 0) return "Today";
  if (diff === 1) return "Tomorrow";
  return formatDayShort(key);
}

/** "Tomorrow · 9:30 am – 10:00 am" for a booked slot. */
export function formatSlotRange(
  startIso: string,
  endIso?: string | null,
  now: Date = new Date(),
): string {
  const start = new Date(startIso);
  if (Number.isNaN(start.getTime())) return ", ";
  const day = formatDayLabel(dateKeyOf(start), dateKeyOf(now));
  const end = endIso ? new Date(endIso) : null;
  const tail = end && !Number.isNaN(end.getTime()) ? ` – ${formatSlotTime(end)}` : "";
  return `${day} · ${formatSlotTime(start)}${tail}`;
}
