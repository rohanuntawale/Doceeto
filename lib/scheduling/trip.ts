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

/** Full rail, in order. Completion is a consult status, not a stage. */
export const TRIP_STAGES: TripStage[] = ["accepted", "enroute", "arrived", "in_progress"];

/**
 * A video consult has no journey, so it skips straight from accepted to being
 * in the call. Home and clinic visits walk the whole rail — for a clinic visit
 * it is the patient travelling, but the doctor still marks them arrived.
 */
export function stagesFor(type: ConsultType): TripStage[] {
  return type === "video" ? ["accepted", "in_progress"] : TRIP_STAGES;
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
  // A stage off this type's rail (the type changed after acceptance) restarts
  // from the beginning rather than dead-ending.
  if (i < 0) return rail[0] ?? null;
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
