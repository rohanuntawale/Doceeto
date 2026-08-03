import { NextResponse } from "next/server";
import { getRequestSession } from "@/lib/auth/session";
import { db } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * The patient brief a doctor opens before a consult: identity, address,
 * standing, and the full health profile (measurements, allergies, conditions,
 * medication, history, emergency contact).
 *
 * Gate: the caller must be a DOCTOR holding that consult — accepted or already
 * completed. A pending broadcast is deliberately not enough: until the doctor
 * commits to the visit, they get the symptoms and rating on the request card,
 * not someone's medical record.
 */
export async function GET(req: Request) {
  const session = await getRequestSession(req);
  if (!session) return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  if (session.role !== "doctor") {
    return NextResponse.json({ error: "Only doctors can read a patient brief." }, { status: 403 });
  }

  const requestId = new URL(req.url).searchParams.get("requestId") ?? "";
  if (!requestId) return NextResponse.json({ error: "Which consult?" }, { status: 400 });

  const request = (await db.getRequests()).find((r) => r.id === requestId);
  if (!request || request.doctorId !== session.userId) {
    return NextResponse.json({ error: "That consult isn't yours." }, { status: 404 });
  }
  if (request.status !== "accepted" && request.status !== "completed") {
    return NextResponse.json(
      { error: "Accept the consult to see the patient's details." },
      { status: 403 },
    );
  }
  if (!request.patientId) {
    return NextResponse.json({ error: "This patient has no account on record." }, { status: 404 });
  }

  const brief = await db.getPatientBrief(request.patientId);
  if (!brief) return NextResponse.json({ error: "Patient not found." }, { status: 404 });
  return NextResponse.json({ brief });
}
