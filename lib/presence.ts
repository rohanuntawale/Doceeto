import type { Doctor, DoctorStatus } from "@/lib/types/domain";

/**
 * Whether a doctor is REALLY online.
 *
 * The stored `status` column is a promise, not a fact: a doctor taps "go
 * online", shuts the laptop, and the row says online forever. A patient looking
 * for urgent care would be sent to someone who left hours ago, so online-ness
 * is derived from evidence at read time instead of trusted from the flag.
 *
 * Three things must ALL hold. Each rules out a different way of being absent:
 *
 *   1. They said so          — `status` is online/busy. Nobody is marked
 *                              available against their will.
 *   2. They are signed in    — at least one live session row. Sign out, or let
 *                              the session lapse, and they drop off at once.
 *   3. They are still there  — a heartbeat within PRESENCE_TTL_MS. This is what
 *                              catches the closed laptop, the dead battery and
 *                              the lost connection, none of which send a
 *                              goodbye.
 *
 * Failing any of them reads as `offline`, and offline means undiscoverable —
 * no pin, no list row, no gig teasers.
 */

/** How often a live cockpit reports in. */
export const HEARTBEAT_MS = 30_000;

/**
 * How stale a heartbeat may get before we stop believing it. Three beats plus
 * a margin: one missed beat is a hiccup, three in a row is an absence. Erring
 * longer would keep ghosts on the map; erring shorter would flicker a doctor
 * offline on a slow train.
 */
export const PRESENCE_TTL_MS = 3 * HEARTBEAT_MS + 5_000;

/** Has this cockpit reported in recently enough to believe? */
export function isPresent(lastSeen: string | null | undefined, now = Date.now()): boolean {
  if (!lastSeen) return false;
  const t = new Date(lastSeen).getTime();
  if (!Number.isFinite(t)) return false;
  // A clock skewed into the future would otherwise keep someone online for as
  // long as the skew lasts, so treat anything ahead of now as "just seen".
  return now - t < PRESENCE_TTL_MS;
}

/**
 * The status to SHOW for a doctor, given what we can actually prove.
 *
 * `signedIn` is whether that doctor holds any live session. Callers get it from
 * the store once for the whole page rather than per doctor.
 */
export function effectiveStatus(
  doctor: Pick<Doctor, "status" | "lastSeen">,
  signedIn: boolean,
  now = Date.now(),
): DoctorStatus {
  if (doctor.status === "offline") return "offline";
  if (!signedIn) return "offline";
  if (!isPresent(doctor.lastSeen, now)) return "offline";
  return doctor.status;
}

/** Apply the rule to a doctor row. */
export function withRealStatus<T extends Pick<Doctor, "status" | "lastSeen" | "id">>(
  doctor: T,
  signedInIds: ReadonlySet<string>,
  now = Date.now(),
): T {
  const status = effectiveStatus(doctor, signedInIds.has(doctor.id), now);
  return status === doctor.status ? doctor : { ...doctor, status };
}
