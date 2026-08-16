/**
 * Server-side booking rules. Both repos (file store and Neo4j) run every
 * appointment through here, so "is this slot really free?" is answered by
 * one piece of code no matter which backend is live.
 *
 * Every rejection is a DomainError with a message written for the patient,
 * which the /api/actions route turns into a 4xx instead of a blank 500.
 */
import { DomainError } from "@/lib/db/shared";
import type { ConsultRequest, ConsultType, Doctor, Gig } from "@/lib/types/domain";
import {
  availabilityOf,
  beyondHorizon,
  busyIntervals,
  bookingModeOf,
  clashesWithAccepted,
  findSlotOnGrid,
  hasOngoingConsult,
  isOnGig,
  overlaps,
  takesAppointments,
} from "@/lib/scheduling/slots";
import { GIG_LOCKS_APPOINTMENTS } from "@/lib/gigs/rules";

export interface ResolvedSlot {
  scheduledAt: string;
  scheduledEnd: string;
  slotMinutes: number;
}

/**
 * Validate a requested appointment against the doctor's calendar and the
 * bookings already on it. Returns the exact slot to persist, or throws.
 *
 * Callers must run this immediately before writing the row, with no `await`
 * in between: that keeps check-then-insert atomic on the single-threaded
 * file store, and the Neo4j repo adds a guarded CREATE on top for the
 * multi-instance case.
 */
export function resolveScheduledSlot(input: {
  doctor: Doctor | null | undefined;
  startIso: string;
  /** Every request already on this doctor's calendar. */
  existing: ConsultRequest[];
  now?: Date;
}): ResolvedSlot {
  const { doctor, startIso } = input;
  const now = input.now ?? new Date();

  if (!doctor) {
    throw new DomainError("That doctor is no longer on the network.", 404);
  }
  // A doctor on a gig is committed elsewhere. Appointments they had ALREADY
  // confirmed still stand — this only stops new ones being taken on.
  if (GIG_LOCKS_APPOINTMENTS && isOnGig(input.existing, doctor.id, now.getTime())) {
    throw new DomainError(
      `${doctor.fullName} is on a gig right now. Try again once they're free.`,
      409,
    );
  }
  const av = availabilityOf(doctor);
  if (!takesAppointments(av)) {
    throw new DomainError(
      `${doctor.fullName} isn't taking scheduled appointments right now.`,
      409,
    );
  }

  const slot = findSlotOnGrid(av, startIso);
  if (!slot) {
    throw new DomainError("That time isn't on the doctor's schedule. Pick another slot.");
  }
  if (slot.start < now.getTime() + av.leadMinutes * 60000) {
    throw new DomainError(
      av.leadMinutes > 0
        ? `${doctor.fullName} needs ${av.leadMinutes} minutes' notice. Pick a later slot.`
        : "That slot has already passed. Pick a later one.",
    );
  }
  if (beyondHorizon(av, slot.start, now)) {
    throw new DomainError(`You can book up to ${av.horizonDays} days ahead.`);
  }

  const taken = busyIntervals(input.existing, doctor.id).some((b) => overlaps(slot, b));
  if (taken) {
    throw new DomainError("That slot has just been booked. Please pick another time.", 409);
  }

  return {
    scheduledAt: new Date(slot.start).toISOString(),
    scheduledEnd: new Date(slot.end).toISOString(),
    slotMinutes: av.slotMinutes,
  };
}

/**
 * Guard a doctor's accept.
 *
 * Gigs and emergencies keep the one-at-a-time rule; appointments are allowed
 * alongside a live consult but never on top of another appointment the same
 * doctor already accepted.
 *
 * This is also where the "only one active gig per doctor" invariant is
 * enforced on the file store: it runs synchronously, immediately before the
 * mutation, inside a single Node process. The Neo4j repo cannot rely on that,
 * so it repeats the check as a guarded Cypher update.
 */
export function assertCanAccept(
  req: ConsultRequest,
  doctorRequests: ConsultRequest[],
  doctorId: string,
  now: Date = new Date(),
): void {
  const mode = bookingModeOf(req);
  const nowMs = now.getTime();
  const onGig = isOnGig(doctorRequests, doctorId, nowMs);

  if (mode === "gig") {
    if (onGig) {
      throw new DomainError("Finish your current gig before taking another.", 409);
    }
    if (hasOngoingConsult(doctorRequests, doctorId, nowMs)) {
      throw new DomainError("You're in a consult, complete it first.", 409);
    }
    return;
  }
  if (mode === "emergency") {
    if (onGig) {
      throw new DomainError(
        "You're on a gig, complete it to take urgent visits again.",
        409,
      );
    }
    if (hasOngoingConsult(doctorRequests, doctorId, nowMs)) {
      throw new DomainError(
        "You already have a consult in progress, complete it first.",
        409,
      );
    }
    return;
  }
  // Scheduled. Deliberately allowed during a gig: confirming next Tuesday
  // costs nothing now, and appointments already on the calendar are honoured.
  if (clashesWithAccepted(req, doctorRequests, doctorId)) {
    throw new DomainError("You already have an appointment at that time.", 409);
  }
}

/** The terms a gig hire is written with — all resolved from the gig row. */
export interface ResolvedHire {
  gigId: string;
  gigTitle: string;
  type: ConsultType;
  fee: number;
  durationMinutes: number;
}

/**
 * Validate a gig hire and return the terms to persist.
 *
 * The price, visit type and duration come from the stored gig, never from the
 * request body — the same posture as order pricing, where the client's total is
 * discarded and every line re-priced from the catalog. Otherwise a hand-rolled
 * POST could name its own fee and credit the doctor's wallet with it.
 */
export function assertCanHire(input: {
  gig: Gig | null | undefined;
  doctor: Doctor | null | undefined;
  /** Every request already on this doctor's books. */
  existing: ConsultRequest[];
  now?: Date;
}): ResolvedHire {
  const { gig, doctor } = input;
  const now = input.now ?? new Date();

  if (!gig) {
    throw new DomainError("That gig is no longer listed.", 404);
  }
  if (!doctor) {
    throw new DomainError("That doctor is no longer on the network.", 404);
  }
  if (gig.doctorId !== doctor.id) {
    throw new DomainError("That gig belongs to a different doctor.", 400);
  }
  if (gig.status !== "active") {
    throw new DomainError(
      `${doctor.fullName} isn't taking that gig right now.`,
      409,
    );
  }
  // Hiring is blocked while they're occupied. The one-at-a-time invariant is
  // ultimately enforced on accept — several patients may queue a request for
  // the same gig, and only one accept can win.
  if (isOnGig(input.existing, doctor.id, now.getTime())) {
    throw new DomainError(
      `${doctor.fullName} is on a gig right now. Try again once they're free.`,
      409,
    );
  }
  if (hasOngoingConsult(input.existing, doctor.id, now.getTime())) {
    throw new DomainError(
      `${doctor.fullName} is with another patient right now.`,
      409,
    );
  }

  return {
    gigId: gig.id,
    gigTitle: gig.title,
    type: gig.type,
    fee: gig.price,
    durationMinutes: gig.durationMinutes,
  };
}

/** Longest cancellation reason we store, to keep a row bounded. */
export const CANCEL_REASON_MAX = 300;

/**
 * Who is allowed to call off a booking, and while it is in which state.
 *
 * A doctor must say why: they are standing a patient down, often after the
 * patient rearranged their day around it, so the reason travels back to them.
 * A patient cancelling their own booking owes no explanation.
 */
export function assertCanCancel(
  req: ConsultRequest | undefined,
  actor: { id: string; role: string },
  opts?: { reason?: string },
): asserts req is ConsultRequest {
  if (!req) throw new DomainError("That booking no longer exists.", 404);
  const mine =
    (actor.role === "patient" && req.patientId === actor.id) ||
    (actor.role === "doctor" && req.doctorId === actor.id);
  if (!mine) throw new DomainError("That isn't your booking.", 403);
  if (req.status !== "pending" && req.status !== "accepted") {
    throw new DomainError("That booking can no longer be cancelled.", 409);
  }
  if (actor.role === "doctor" && !opts?.reason?.trim()) {
    throw new DomainError("Tell the patient why you're cancelling.", 400);
  }
}

/**
 * Should a doctor's cancellation put the request back out to other doctors?
 *
 * Only for a broadcast: the patient asked the network, not this doctor, so
 * someone else can still take it. A request aimed at one doctor (a gig hire or
 * a booked slot) has nowhere to go and simply ends.
 */
export function reopensOnDoctorCancel(req: ConsultRequest): boolean {
  return Boolean(req.broadcast) && bookingModeOf(req) === "emergency";
}
