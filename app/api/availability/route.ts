import { NextResponse } from "next/server";
import { getRequestSession } from "@/lib/auth/session";
import { db as repo } from "@/lib/db";
import { bookableState, buildSchedule, busyIntervals } from "@/lib/scheduling/slots";
import { activeGigs } from "@/lib/gigs/rules";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * One doctor's bookable calendar.
 *
 * This endpoint exists because a patient cannot compute it themselves: they
 * only ever receive their OWN requests from /api/data, so they have no way
 * of knowing which slots other patients hold. The grid is cut here, with the
 * bookings folded in, and the same functions re-validate the chosen slot on
 * the way back in — the picker can never offer a slot the write would reject.
 *
 * GET /api/availability?doctorId=doc-123
 */
export async function GET(req: Request) {
  const session = await getRequestSession(req);
  if (!session) return NextResponse.json({ error: "Not signed in." }, { status: 401 });

  const doctorId = new URL(req.url).searchParams.get("doctorId");
  if (!doctorId) return NextResponse.json({ error: "Which doctor?" }, { status: 400 });

  try {
    const doctor = await repo.getDoctorById(doctorId);
    if (!doctor) {
      return NextResponse.json({ error: "That doctor is no longer on the network." }, { status: 404 });
    }

    // Every request in the system, so slots held by OTHER patients are
    // counted. Only the derived busy intervals leave the server — no other
    // patient's details are exposed.
    const all = await repo.getRequests();
    // One function owns every "can this be booked?" flag, so this route and
    // the client's demo path can no longer disagree about the same doctor.
    const state = bookableState(doctor, all);
    const days = buildSchedule(state.availability, {
      busy: busyIntervals(all, doctorId),
    });
    // The count decides whether the patient's profile leads with gigs or falls
    // back to the slot picker, so it travels with the rest of the flags.
    const gigCount = activeGigs(await repo.getGigs(doctorId)).length;

    return NextResponse.json({
      doctorId,
      days,
      gigCount,
      doctorStatus: doctor.status,
      ...state,
    });
  } catch (err) {
    console.error("availability read failed:", err);
    return NextResponse.json({ error: "Could not load the schedule." }, { status: 500 });
  }
}
