import { NextResponse } from "next/server";
import { getRequestSession } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { rateLimit, tooMany } from "@/lib/server/rate-limit";
import { sanitizeHealthProfile, type HealthProfile } from "@/lib/health/profile";
import { abhaClient, isAbhaNumber } from "@/lib/verify/abha";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 20;

/**
 * ABHA: send an Aadhaar OTP, complete it, or record a number the patient
 * already has.
 *
 * The Aadhaar number is used for exactly one thing, the OTP exchange with
 * ABDM, and is never written anywhere. What we keep is the ABHA number ABDM
 * returns, plus the verified name/DOB/gender it carries, which is what makes
 * this the "import my details" step rather than another form.
 */
export async function POST(req: Request) {
  const session = await getRequestSession(req);
  if (!session) {
    return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  }
  if (session.role !== "patient") {
    return NextResponse.json(
      { error: "ABHA belongs to a patient account." },
      { status: 403 },
    );
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Malformed request body." }, { status: 400 });
  }

  const action = String(body.action ?? "");
  const abha = abhaClient();

  // ── Record an ABHA the patient already holds ──
  if (action === "link-existing") {
    const num = String(body.abhaNumber ?? "").replace(/[\s-]/g, "");
    if (!isAbhaNumber(num)) {
      return NextResponse.json(
        { error: "An ABHA number is 14 digits." },
        { status: 400 },
      );
    }
    // Self-declared, so it is stored as claimed rather than verified. An OTP
    // run through the branches below is what promotes it.
    await mergeProfile(session.userId, { abhaNumber: num, abhaVerified: false });
    return NextResponse.json({ ok: true, abhaNumber: num, verified: false });
  }

  if (!abha.configured) {
    return NextResponse.json(
      {
        error:
          "ABHA linking is not switched on for this deployment yet. Enter your details by hand for now.",
        unconfigured: true,
      },
      { status: 503 },
    );
  }

  // ── Start the Aadhaar OTP ──
  if (action === "send-otp") {
    // Tighter than most: this reaches UIDAI through ABDM, and a loose limit
    // here is a way to spam somebody else's phone.
    if (!rateLimit(`abha-otp:${session.userId}`, 5, 30 * 60_000)) return tooMany();

    const result = await abha.sendAadhaarOtp(String(body.aadhaar ?? ""));
    if (!result.ok) {
      return NextResponse.json({ error: result.message }, { status: 400 });
    }
    return NextResponse.json({
      ok: true,
      txnId: result.txnId,
      maskedMobile: result.maskedMobile ?? null,
    });
  }

  // ── Complete it, and import what comes back ──
  if (action === "verify-otp") {
    if (!rateLimit(`abha-verify:${session.userId}`, 10, 30 * 60_000)) return tooMany();

    const result = await abha.verifyAadhaarOtp(
      String(body.txnId ?? ""),
      String(body.otp ?? ""),
    );
    if (!result.ok) {
      return NextResponse.json({ error: result.message }, { status: 400 });
    }

    const p = result.profile;
    // ABDM has confirmed this against Aadhaar, so the details it returns are
    // better than anything the patient would type. This is the "import my
    // basic info" step: name, DOB and gender arrive already verified.
    await mergeProfile(session.userId, {
      abhaNumber: p.abhaNumber,
      abhaAddress: p.abhaAddress,
      abhaVerified: true,
      ...(p.dob ? { dob: p.dob } : {}),
      ...(p.gender ? { gender: p.gender } : {}),
    });

    return NextResponse.json({ ok: true, profile: p });
  }

  return NextResponse.json({ error: "Unknown action." }, { status: 400 });
}

/**
 * Patch the ABHA fields into the health profile without disturbing the rest.
 *
 * health_profile is a single jsonb document, so a naive write would drop
 * everything the patient had already filled in. Read, merge, write. The flag
 * is applied AFTER sanitizing, because the sanitizer refuses to take
 * `abhaVerified` from input on purpose (see lib/health/profile.ts).
 */
async function mergeProfile(
  userId: string,
  patch: Partial<HealthProfile> & { abhaVerified?: boolean },
) {
  const current = await db.getPatientProfile(userId);
  const existing = (current?.healthProfile ?? {}) as HealthProfile;
  const merged = sanitizeHealthProfile({ ...existing, ...patch });
  if (patch.abhaVerified !== undefined) merged.abhaVerified = patch.abhaVerified;
  await db.setPatientHealthProfile(userId, merged);
}
