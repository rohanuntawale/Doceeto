import { NextResponse } from "next/server";
import { getRequestSession } from "@/lib/auth/session";
import { sanitizeHealthProfile } from "@/lib/health/profile";
import { db } from "@/lib/db";
import { rateLimit, tooMany } from "@/lib/server/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Save the signed-in PATIENT's health profile. Doctors read it later through
 * /api/patient-brief, but only for consults they have accepted — this route is
 * strictly the patient writing about themselves.
 */
export async function POST(req: Request) {
  const session = await getRequestSession(req);
  if (!session) return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  if (session.role !== "patient") {
    return NextResponse.json({ error: "Only patients have a health profile." }, { status: 403 });
  }
  if (!rateLimit(`health-profile:${session.userId}`, 30, 10 * 60_000)) return tooMany();

  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return NextResponse.json({ error: "Malformed request body." }, { status: 400 });
  }

  // Sanitize server-side regardless of what the form sent; out-of-range
  // values are dropped rather than stored wrong.
  const profile = sanitizeHealthProfile(raw);
  profile.updatedAt = new Date().toISOString();

  await db.setPatientHealthProfile(session.userId, profile);
  return NextResponse.json({ ok: true, healthProfile: profile });
}
