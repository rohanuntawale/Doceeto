/**
 * Prescription rules: the dose notation, the validation, the identifiers.
 *
 * Pure and dependency-free (types only), so the composer in the browser, the
 * action handler on the server and both repos enforce exactly the same shape —
 * same contract as lib/gigs/rules.ts and lib/nurse.ts. A prescription is the
 * one artefact in this app that leaves the platform (printed, shared, taken to
 * a chemist), so what it may contain is decided in one place.
 */
import type { Prescription, RxItem, RxTiming } from "@/lib/types/domain";

/** Hard caps. Everything is trimmed and clamped to these before it is stored. */
export const RX_LIMITS = {
  items: 12,
  name: 90,
  dose: 40,
  notes: 140,
  diagnosis: 200,
  advice: 600,
  durationDays: 180,
  followUpDays: 365,
} as const;

/**
 * The three day-parts an Indian prescription is written against, in the order
 * they are spoken and printed: morning, afternoon, night. The "1-0-1" notation
 * IS this array — one number per part.
 */
export const DAY_PARTS = ["morning", "afternoon", "night"] as const;
export type DayPart = (typeof DAY_PARTS)[number];

/**
 * The schedules a doctor actually writes, as one-tap presets. Free text is
 * still accepted (parseSchedule takes anything shaped like "1-0-1"), but a
 * doctor closing a consult on a phone should not have to type dashes.
 */
export const RX_SCHEDULES: Array<{ value: string; label: string }> = [
  { value: "1-0-0", label: "Morning only" },
  { value: "0-0-1", label: "Night only" },
  { value: "1-0-1", label: "Morning & night" },
  { value: "1-1-1", label: "Three times a day" },
  { value: "0-1-0", label: "Afternoon only" },
  { value: "1-1-0", label: "Morning & afternoon" },
];

export const RX_TIMINGS: Array<{ value: RxTiming; label: string }> = [
  { value: "after_food", label: "After food" },
  { value: "before_food", label: "Before food" },
  { value: "anytime", label: "Any time" },
];

const DEFAULT_SCHEDULE = "1-0-1";

/**
 * "1-0-1" → [1, 0, 1]. Accepts halves ("0.5-0-0.5"), which is how a paediatric
 * or tapering dose is written, and degrades to the default rather than throwing
 * — a malformed schedule must never be able to lose a prescription.
 */
export function parseSchedule(raw: string | null | undefined): number[] {
  const parts = String(raw ?? "")
    .split(/[-/\s]+/)
    .filter(Boolean)
    .slice(0, 3)
    .map((p) => {
      const n = p === "½" ? 0.5 : Number(p);
      return Number.isFinite(n) && n >= 0 && n <= 6 ? n : 0;
    });
  if (parts.length === 0 || parts.every((n) => n === 0)) return [1, 0, 1];
  while (parts.length < 3) parts.push(0);
  return parts;
}

/** Back to the canonical "1-0-1" string, halves rendered as ½. */
export function formatSchedule(raw: string | null | undefined): string {
  return parseSchedule(raw)
    .map((n) => (n === 0.5 ? "½" : String(n)))
    .join("-");
}

/** How many doses fall on one day. */
export const dosesPerDay = (schedule: string | null | undefined): number =>
  parseSchedule(schedule).reduce((a, n) => a + n, 0);

/**
 * How many units one dose is, read off the dose text: "2 tablets" → 2, "1
 * tablet" → 1, "5 ml" → 1 (a measured volume is one dose of one bottle, not
 * five of anything). Anything unparseable is one — under-counting a basket is
 * recoverable, over-counting bills someone for medicine they were never given.
 */
export function unitsPerDose(dose: string | null | undefined): number {
  const text = String(dose ?? "").trim();
  if (/\b(ml|mg|drop|drops|puff|puffs|unit|units|iu)\b/i.test(text)) return 1;
  const m = text.match(/^(\d+(?:\.\d+)?|½)/);
  if (!m) return 1;
  const n = m[1] === "½" ? 0.5 : Number(m[1]);
  return Number.isFinite(n) && n > 0 && n <= 20 ? n : 1;
}

/** Total units of this medicine the whole course needs. */
export function courseUnits(item: Pick<RxItem, "dose" | "schedule" | "durationDays">): number {
  const total = dosesPerDay(item.schedule) * unitsPerDose(item.dose) * Math.max(1, item.durationDays);
  return Math.max(1, Math.ceil(total));
}

/** "Twice a day · 5 days · after food" — the line under a medicine name. */
export function courseSummary(item: RxItem): string {
  const perDay = dosesPerDay(item.schedule);
  // Said in words, because this line exists for the person who cannot read
  // "1-1-1". The notation itself sits under the ledger, where it belongs.
  const times =
    perDay === 1
      ? "Once a day"
      : perDay === 2
        ? "Twice a day"
        : perDay === 3
          ? "Three times a day"
          : perDay === 4
            ? "Four times a day"
            : `${formatSchedule(item.schedule)} a day`;
  const days = item.durationDays === 1 ? "1 day" : `${item.durationDays} days`;
  const timing = RX_TIMINGS.find((x) => x.value === item.timing)?.label;
  return [times, days, timing && timing !== "Any time" ? timing.toLowerCase() : null]
    .filter(Boolean)
    .join(" · ");
}

// ── Sanitizing ───────────────────────────────────────────────
const str = (v: unknown, cap: number) => String(v ?? "").trim().slice(0, cap);
const clamp = (v: unknown, min: number, max: number, fallback: number) => {
  const n = Math.round(Number(v));
  return Number.isFinite(n) ? Math.max(min, Math.min(max, n)) : fallback;
};

/** One medicine line, coerced into range. Returns null when there is no drug. */
export function sanitizeRxItem(raw: unknown): RxItem | null {
  const p = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const name = str(p.name, RX_LIMITS.name);
  if (!name) return null; // a line without a medicine is not a line
  const timing = RX_TIMINGS.some((x) => x.value === p.timing)
    ? (p.timing as RxTiming)
    : "after_food";
  return {
    name,
    dose: str(p.dose, RX_LIMITS.dose) || "1 tablet",
    schedule: formatSchedule(str(p.schedule, 20) || DEFAULT_SCHEDULE),
    durationDays: clamp(p.durationDays, 1, RX_LIMITS.durationDays, 5),
    timing,
    notes: str(p.notes, RX_LIMITS.notes) || undefined,
  };
}

/** What a doctor submits. Everything else on a Prescription is server-derived. */
export interface RxDraft {
  diagnosis: string;
  items: RxItem[];
  advice: string;
  followUpDays: number | null;
}

/**
 * Clean a submitted draft. Throws nothing — the caller decides what an empty
 * result means, because "no medicines" is a legitimate prescription (rest,
 * fluids and a follow-up date is a real outcome) as long as SOMETHING was said.
 */
export function sanitizeRxDraft(raw: unknown): RxDraft {
  const p = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const items = Array.isArray(p.items)
    ? (p.items.map(sanitizeRxItem).filter(Boolean) as RxItem[]).slice(0, RX_LIMITS.items)
    : [];
  const followUp = p.followUpDays == null || p.followUpDays === "" ? null : clamp(p.followUpDays, 1, RX_LIMITS.followUpDays, 0);
  return {
    diagnosis: str(p.diagnosis, RX_LIMITS.diagnosis),
    items,
    advice: str(p.advice, RX_LIMITS.advice),
    followUpDays: followUp && followUp > 0 ? followUp : null,
  };
}

/** True when a draft carries enough to be worth issuing. */
export const draftHasContent = (d: RxDraft) =>
  d.items.length > 0 || Boolean(d.diagnosis) || Boolean(d.advice);

// ── Identifiers ──────────────────────────────────────────────
/**
 * Crockford-ish alphabet: no I, L, O, U, so a code read down a phone line or
 * copied off a printout cannot be confused with 1, 0 or another letter.
 */
const CODE_ALPHABET = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";

/** Random bytes from the GLOBAL Web Crypto — see newStartCode in lib/db/shared. */
function randomChars(n: number, alphabet: string): string {
  const bytes = new Uint8Array(n);
  crypto.getRandomValues(bytes);
  let out = "";
  for (let i = 0; i < n; i++) out += alphabet[bytes[i] % alphabet.length];
  return out;
}

/**
 * The number a patient quotes at a counter: "RX-4KQ9-2NPX". Short enough to
 * read aloud, and it is an INDEX, not a secret — the share token below is what
 * actually guards the document.
 */
export const newRxCode = (): string =>
  `RX-${randomChars(4, CODE_ALPHABET)}-${randomChars(4, CODE_ALPHABET)}`;

/**
 * The unguessable path segment behind /rx/<token>.
 *
 * 32 chars from a 32-symbol alphabet = 160 bits. This is a medical document on
 * a link anyone holding it can open — the same model as a lab report link or a
 * ride receipt — so the token has to be genuinely unguessable rather than
 * merely long. It is minted once at issue and never appears in a list response
 * for anyone but the patient and the prescribing doctor.
 */
export const newShareToken = (): string => randomChars(32, "abcdefghijkmnpqrstuvwxyz23456789");

// ── Sharing ──────────────────────────────────────────────────
/**
 * The prescription as plain text, for WhatsApp and for the clipboard.
 *
 * Deliberately readable without the link: someone forwarding this to a relative
 * who will walk to the chemist should not need the recipient to open anything.
 * The link follows for the printable copy.
 */
export function rxShareText(rx: Prescription, url?: string): string {
  const lines: string[] = [
    `Prescription ${rx.code}`,
    `${rx.patientName} · ${new Date(rx.issuedAt).toLocaleDateString("en-IN", {
      day: "numeric",
      month: "short",
      year: "numeric",
    })}`,
    `${rx.doctorName}${rx.doctorSpecialty ? `, ${rx.doctorSpecialty}` : ""}`,
  ];
  if (rx.diagnosis) lines.push("", `Diagnosis: ${rx.diagnosis}`);
  if (rx.items.length > 0) {
    lines.push("", "Medicines:");
    rx.items.forEach((it, i) => {
      lines.push(`${i + 1}. ${it.name}, ${it.dose}, ${formatSchedule(it.schedule)}, ${courseSummary(it)}`);
      if (it.notes) lines.push(`   ${it.notes}`);
    });
  }
  if (rx.advice) lines.push("", `Advice: ${rx.advice}`);
  if (rx.followUpDays) lines.push("", `Follow up in ${rx.followUpDays} days.`);
  if (url) lines.push("", url);
  return lines.join("\n");
}

/** The wa.me deep link — works in the app, the browser and WhatsApp Web. */
export const whatsappUrl = (text: string) =>
  `https://wa.me/?text=${encodeURIComponent(text)}`;
