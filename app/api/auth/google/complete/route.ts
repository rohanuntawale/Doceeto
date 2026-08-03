import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { setSession } from "@/lib/auth/session";
import { PENDING_SIGNUP_COOKIE } from "@/lib/auth/constants";
import { db } from "@/lib/db";
import { emitChange } from "@/lib/server/events";
import { clientIp, rateLimit, tooMany } from "@/lib/server/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Finish a Google doctor sign-up: create the account from the profile THEY
 * filled in.
 *
 * The identity half comes from the pending row (Google already proved the
 * email); the practice half comes from this request. Nothing is defaulted on
 * the doctor's behalf — every field a patient uses to choose a doctor is
 * required here, and rejected rather than guessed. The email and Google id are
 * read from the server-side row, never from the request body, so the browser
 * cannot sign up as somebody else.
 */
export async function POST(req: Request) {
  if (!rateLimit(`oauth-complete:ip:${clientIp(req)}`, 20, 10 * 60_000)) return tooMany();

  const jar = cookies();
  const pendingId = jar.get(PENDING_SIGNUP_COOKIE)?.value;
  if (!pendingId) {
    return NextResponse.json(
      { error: "That sign-up has expired. Please start again with Google." },
      { status: 400 },
    );
  }

  const pending = await db.getPendingSignup(pendingId);
  if (!pending || pending.role !== "doctor") {
    jar.delete(PENDING_SIGNUP_COOKIE);
    return NextResponse.json(
      { error: "That sign-up has expired. Please start again with Google." },
      { status: 400 },
    );
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Malformed request body." }, { status: 400 });
  }

  const str = (v: unknown, cap: number) => (typeof v === "string" ? v.trim().slice(0, cap) : "");
  const fullName = str(body.fullName, 80);
  const specialty = str(body.specialty, 60);
  const qualifications = str(body.qualifications, 200);
  const registrationNo = str(body.registrationNo, 60);
  const gender = body.gender === "male" ? "male" : body.gender === "female" ? "female" : "";
  const kind = body.kind === "resident" ? "resident" : "practising";
  const age = Math.round(Number(body.age));
  const languages = Array.isArray(body.languages)
    ? body.languages.map((l) => String(l).trim()).filter(Boolean).slice(0, 6)
    : [];
  const consultFee = Number(body.consultFee);
  const homeVisitFee = Number(body.homeVisitFee);

  // Each of these is something a patient reads before trusting someone with
  // their care. Refuse rather than invent.
  if (!fullName) return bad("Enter your full name.");
  if (!specialty) return bad("Choose your specialty.");
  if (!gender) return bad("Select your gender.");
  if (!Number.isFinite(age) || age < 18 || age > 100) return bad("Enter your age (18–100).");
  if (languages.length === 0) return bad("List at least one language you consult in.");
  if (!qualifications) return bad("Add your qualifications — patients see these first.");
  if (!registrationNo) return bad("Add your medical registration number.");
  if (!Number.isFinite(consultFee) || consultFee < 0 || consultFee > 100_000) {
    return bad("Set a valid consultation fee.");
  }
  if (!Number.isFinite(homeVisitFee) || homeVisitFee < 0 || homeVisitFee > 100_000) {
    return bad("Set a valid home-visit fee.");
  }

  // Between parking the pending row and this submit, that email could have been
  // registered another way.
  if (await db.findUserByEmail(pending.email)) {
    jar.delete(PENDING_SIGNUP_COOKIE);
    await db.deletePendingSignup(pending.id);
    return NextResponse.json(
      { error: "An account with this email already exists. Sign in instead." },
      { status: 409 },
    );
  }

  try {
    const { user } = await db.createDoctorUser({
      email: pending.email,
      passwordHash: null, // Google account: no password to store
      googleId: pending.googleId,
      avatarUrl: pending.avatarUrl ?? undefined,
      fullName,
      specialty,
      kind,
      gender,
      age,
      experienceYears: Math.max(0, Math.min(70, Math.round(Number(body.experienceYears)) || 0)),
      languages,
      qualifications,
      education: str(body.education, 200),
      registrationNo,
      about: str(body.about, 600),
      consultFee,
      homeVisitFee,
      clinicAddress: str(body.clinicAddress, 160),
      lat: null,
      lng: null,
    });

    await db.deletePendingSignup(pending.id);
    jar.delete(PENDING_SIGNUP_COOKIE);
    await setSession({ id: user.id, role: "doctor", name: user.name });
    emitChange(["doctors"]);

    return NextResponse.json({ ok: true, role: "doctor" });
  } catch (err) {
    console.error("google doctor sign-up failed:", err);
    return NextResponse.json({ error: "Could not create the account." }, { status: 500 });
  }
}

const bad = (msg: string) => NextResponse.json({ error: msg }, { status: 400 });
