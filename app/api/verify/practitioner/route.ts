import { NextResponse } from "next/server";
import { getRequestSession } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { emitChange } from "@/lib/server/events";
import { rateLimit, tooMany } from "@/lib/server/rate-limit";
import {
  COUNCILS,
  practitionerVerifier,
  type Cadre,
  type Council,
} from "@/lib/verify/practitioner";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 20;

/**
 * A doctor or nurse submits their council registration for checking.
 *
 * The verdict comes from lib/verify/practitioner (ABDM's HPR where it is
 * configured, a human review queue otherwise). Two rules matter here:
 *
 *  • The badge is set from the PROVIDER's answer, never from the request. A
 *    practitioner cannot mark themselves verified by posting `verified: true`,
 *    which is why `verified` is written through db.verifyProvider and is
 *    excluded from the ordinary updateDoctor patch path.
 *  • A "pending" answer leaves the badge exactly as it was. Failing to reach
 *    the registry must never quietly un-verify somebody already checked.
 */
export async function POST(req: Request) {
  const session = await getRequestSession(req);
  if (!session) {
    return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  }
  if (session.role !== "doctor" && session.role !== "nurse") {
    return NextResponse.json(
      { error: "Only practitioners have a registration to verify." },
      { status: 403 },
    );
  }
  // Registry lookups cost money and rate limits upstream; a handful per hour
  // is plenty for someone correcting a typo.
  if (!rateLimit(`verify-practitioner:${session.userId}`, 8, 60 * 60_000)) {
    return tooMany();
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Malformed request body." }, { status: 400 });
  }

  const cadre: Cadre = session.role === "nurse" ? "nurse" : "doctor";
  const registrationNo = String(body.registrationNo ?? "").trim();
  const year = String(body.year ?? "").trim().slice(0, 4);
  const requested = String(body.council ?? "").toUpperCase();

  if (!registrationNo) {
    return NextResponse.json(
      { error: "Enter your council registration number." },
      { status: 400 },
    );
  }

  // The council must be one this cadre can actually be registered with, so a
  // nurse cannot be checked against the medical register or vice versa.
  const allowed = COUNCILS[cadre];
  const council = (allowed as string[]).includes(requested)
    ? (requested as Council)
    : allowed[0];

  const doctor = await db.getDoctorById(session.userId);
  if (!doctor) {
    return NextResponse.json(
      { error: "No practitioner profile found for this account." },
      { status: 404 },
    );
  }

  const verifier = practitionerVerifier();
  const result = await verifier.verify({
    cadre,
    registrationNo,
    council,
    name: doctor.fullName || session.name || "",
    year: year || undefined,
  });

  /*
   * Keep the number they submitted, whatever the verdict.
   *
   * Only registrationNo is persisted: updateDoctor writes through an explicit
   * column allowlist (DOCTOR_PATCH_COLS), so council and verdict fields would
   * be accepted here and silently dropped, which is worse than not writing
   * them. A proper audit row (who claimed what, which registry answered, when)
   * needs a migration, and is noted in TODO-DOCEETO.md rather than faked.
   */
  await db.updateDoctor(session.userId, { registrationNo });
  console.info(
    `[verify] ${cadre} ${session.userId} ${council} ${registrationNo} -> ${result.status} via ${result.source}`,
  );

  if (result.status === "verified") {
    await db.verifyProvider(session.userId, true);
    emitChange(["doctors"]);
  } else if (result.status === "rejected" && doctor.verified) {
    // The registry positively says no. That outranks an older badge.
    await db.verifyProvider(session.userId, false);
    emitChange(["doctors"]);
  }

  return NextResponse.json({
    status: result.status,
    message: result.message,
    matchedName: result.matchedName ?? null,
    council,
  });
}
