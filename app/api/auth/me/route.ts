import { NextResponse } from "next/server";
import { getRequestSession } from "@/lib/auth/session";
import { db } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Who the CALLING SURFACE is signed in as. The patient app asks and gets the
 * patient; the cockpit asks and gets the doctor — even when both accounts are
 * signed in on the same browser. Answering with the wrong one is what used to
 * make a dashboard flip roles under the user.
 */
export async function GET(req: Request) {
  const session = await getRequestSession(req);
  if (!session) return NextResponse.json({ user: null }, { status: 200 });

  if (session.role === "doctor") {
    const doctor = await db.getDoctorById(session.userId);
    return NextResponse.json({ role: "doctor", doctor });
  }
  if (session.role === "patient") {
    const patient = await db.getPatientProfile(session.userId);
    return NextResponse.json({ role: "patient", patient });
  }
  if (session.role === "nurse") {
    // A nurse IS a provider row, read exactly as a doctor's is — that record
    // carries the coordinates the map needs, the online status, the rating and
    // the verification flag. It is also returned as `doctor` so every shared
    // provider component (the tracker, the map, the request cards) can take it
    // without a second shape to handle.
    const nurse = await db.getDoctorById(session.userId);
    return NextResponse.json({ role: "nurse", nurse, doctor: nurse });
  }
  return NextResponse.json({ role: "ops", name: session.name });
}
