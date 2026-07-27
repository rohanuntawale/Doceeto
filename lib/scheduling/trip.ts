/**
 * The Uber-style progress rail a request walks after a doctor accepts it.
 *
 * The stage only ever advances one step, and the next step is derived here
 * rather than sent by the client — the same posture as advanceSos and
 * advanceOrder, so a replayed or hand-rolled request can't jump a visit
 * straight to "in consult".
 *
 * Pure and dependency-free — safe on the client and the server.
 */
import type { ConsultRequest, ConsultType, TripStage } from "@/lib/types/domain";

/** Every stage a stored row may carry (kept full for legacy rows). */
export const TRIP_STAGES: TripStage[] = ["accepted", "enroute", "arrived", "in_progress"];

/**
 * How close (km) the doctor's live position must be to the visit before the
 * server auto-marks it arrived — the delivery-app pattern: the doctor taps
 * "On the way" once, and arrival is detected from GPS, never from a button.
 */
export const ARRIVE_RADIUS_KM = 0.15;

/**
 * A home visit is the only journey: the doctor taps "On the way" and GPS
 * marks them arrived. Video and clinic visits have no rail at all — the
 * doctor accepts, holds the consult, and marks it complete.
 */
export function stagesFor(type: ConsultType): TripStage[] {
  return type === "home_visit" ? ["accepted", "enroute", "arrived"] : ["accepted"];
}

/** Where a request currently sits. Accepted rows predating stages read as accepted. */
export function tripStageOfRequest(req: Pick<ConsultRequest, "tripStage" | "status">): TripStage | null {
  if (req.status !== "accepted") return null;
  const stage = req.tripStage;
  return stage && TRIP_STAGES.includes(stage) ? stage : "accepted";
}

/**
 * The next stage for this request, or null when it is already at the last one
 * (at which point the only move left is completing the consult).
 */
export function nextTripStage(
  req: Pick<ConsultRequest, "tripStage" | "status" | "type">,
): TripStage | null {
  const current = tripStageOfRequest(req);
  if (!current) return null;
  const rail = stagesFor(req.type);
  const i = rail.indexOf(current);
  // A stage off this type's rail (a legacy row, or the type changed after
  // acceptance) is treated as final — completing is the only move left.
  if (i < 0) return null;
  return rail[i + 1] ?? null;
}

/** True when the only remaining action is to complete the consult. */
export function atFinalStage(
  req: Pick<ConsultRequest, "tripStage" | "status" | "type">,
): boolean {
  return tripStageOfRequest(req) !== null && nextTripStage(req) === null;
}

/** Zero-based position on this request's rail, for a progress indicator. */
export function tripProgress(
  req: Pick<ConsultRequest, "tripStage" | "status" | "type">,
): { step: number; total: number } {
  const rail = stagesFor(req.type);
  const current = tripStageOfRequest(req);
  const i = current ? rail.indexOf(current) : -1;
  return { step: i < 0 ? 0 : i, total: rail.length };
}
