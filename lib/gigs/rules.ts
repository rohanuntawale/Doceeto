/**
 * Gig listing rules: bounds, normalisation and the patch allowlist for the
 * service packages a doctor publishes.
 *
 * Every read of a stored gig goes through normalizeGig() and every write
 * through sanitizeGigPatch(), so no caller ever meets a half-filled listing
 * and a hand-rolled POST can't set fields it doesn't own. Same contract as
 * normalizeAvailability() / sanitizeDoctorPatch() elsewhere.
 *
 * Pure and dependency-free — safe on the client and the server.
 */
import type { ConsultType, Gig, GigStatus } from "@/lib/types/domain";

export const GIG_TITLE_MAX = 80;
export const GIG_DESC_MAX = 600;
export const GIG_PRICE_MAX = 100_000;

/** Durations a doctor can commit to, from a quick call to a 12-hour shift. */
export const GIG_DURATION_CHOICES = [15, 30, 45, 60, 120, 240, 480, 720] as const;

/** Live listings per doctor. Keeps a profile scannable and the roster honest. */
export const MAX_ACTIVE_GIGS = 8;

/**
 * Whether an accepted gig also locks the doctor's appointment calendar.
 *
 * True matches the product decision: while on a gig the doctor is shown as
 * unavailable and nothing new can be booked. It is a constant rather than
 * inline logic because a long gig (a 12-hour shift) blocking a whole fortnight
 * of slots may prove too strict — flipping this to false reopens the slot
 * picker during a gig without touching any other rule. Read only inside
 * bookableState() in lib/scheduling/slots.ts.
 */
export const GIG_LOCKS_APPOINTMENTS = true;

const GIG_STATUSES: GigStatus[] = ["active", "paused", "archived"];
const CONSULT_TYPES: ConsultType[] = ["video", "home_visit", "clinic"];

const text = (value: unknown, max: number) =>
  typeof value === "string" ? value.trim().slice(0, max) : "";

/** Snap any duration onto the nearest supported one, like snapSlotMinutes. */
export function snapGigDuration(value: unknown): number {
  const n = Number(value);
  if (!Number.isFinite(n)) return 60;
  return GIG_DURATION_CHOICES.reduce((best, choice) =>
    Math.abs(choice - n) < Math.abs(best - n) ? choice : best,
  );
}

function price(value: unknown): number {
  const n = Math.round(Number(value));
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(GIG_PRICE_MAX, n));
}

/**
 * Coerce anything — a stored row, an API payload — into a complete gig.
 * `ctx` supplies the fields the client never gets to choose.
 */
export function normalizeGig(
  raw: unknown,
  ctx: { id: string; doctorId: string; createdAt: string; updatedAt?: string | null },
): Gig {
  const src = (raw && typeof raw === "object" ? raw : {}) as Partial<Gig>;
  const type = CONSULT_TYPES.includes(src.type as ConsultType)
    ? (src.type as ConsultType)
    : "home_visit";
  return {
    id: ctx.id,
    doctorId: ctx.doctorId,
    title: text(src.title, GIG_TITLE_MAX),
    description: text(src.description, GIG_DESC_MAX),
    type,
    price: price(src.price),
    durationMinutes: snapGigDuration(src.durationMinutes),
    status: GIG_STATUSES.includes(src.status as GigStatus)
      ? (src.status as GigStatus)
      : "active",
    createdAt: ctx.createdAt,
    updatedAt: ctx.updatedAt ?? null,
  };
}

/**
 * Allowlist for updateGig. Only keys actually present are returned, so a
 * partial edit never blanks a field the form didn't send. `id`, `doctorId` and
 * `createdAt` can never be patched.
 */
export function sanitizeGigPatch(patch: unknown): Partial<Gig> {
  const src = (patch && typeof patch === "object" ? patch : {}) as Record<string, unknown>;
  const out: Partial<Gig> = {};

  if (typeof src.title === "string") {
    const title = text(src.title, GIG_TITLE_MAX);
    if (title) out.title = title;
  }
  if (typeof src.description === "string") out.description = text(src.description, GIG_DESC_MAX);
  if (CONSULT_TYPES.includes(src.type as ConsultType)) out.type = src.type as ConsultType;
  if (src.price !== undefined) out.price = price(src.price);
  if (src.durationMinutes !== undefined) out.durationMinutes = snapGigDuration(src.durationMinutes);
  if (GIG_STATUSES.includes(src.status as GigStatus)) out.status = src.status as GigStatus;

  return out;
}

/** True when the payload has enough to be worth publishing. */
export function isPublishable(gig: Pick<Gig, "title" | "price">): boolean {
  return gig.title.trim().length > 0 && gig.price > 0;
}

export const isActiveGig = (gig: Gig) => gig.status === "active";
export const activeGigs = (gigs: Gig[]) => gigs.filter(isActiveGig);

/** The cheapest active gig's price, for a "from ₹900" teaser. Null if none. */
export function gigFromPrice(gigs: Gig[]): number | null {
  const live = activeGigs(gigs);
  if (live.length === 0) return null;
  return live.reduce((min, g) => (g.price < min ? g.price : min), live[0].price);
}

/** "45 min" / "4 hours" / "1 hour 30 min" — never a bare minute count. */
export function formatGigDuration(mins: number): string {
  const n = Math.max(0, Math.round(Number(mins) || 0));
  if (n < 60) return `${n} min`;
  const hours = Math.floor(n / 60);
  const rest = n % 60;
  const h = `${hours} hour${hours === 1 ? "" : "s"}`;
  return rest === 0 ? h : `${h} ${rest} min`;
}
