import { NextResponse } from "next/server";
import { hashPassword } from "@/lib/auth/password";
import { setSession } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { clientIp, rateLimit, tooMany } from "@/lib/server/rate-limit";
import { emitChange } from "@/lib/server/events";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function POST(req: Request) {
  try {
    // 10 signups / hour per IP — stops bot floods.
    if (!rateLimit(`register:ip:${clientIp(req)}`, 10, 60 * 60_000)) return tooMany();

    const body = await req.json();
    const email = String(body.email ?? "").trim().toLowerCase();
    const password = String(body.password ?? "");

    if (!EMAIL_RE.test(email)) {
      return NextResponse.json({ error: "Enter a valid email address." }, { status: 400 });
    }
    // Password policy: 8+ chars with at least one letter and one number.
    if (password.length < 8 || !/[a-zA-Z]/.test(password) || !/\d/.test(password)) {
      return NextResponse.json(
        { error: "Password must be 8+ characters and include a letter and a number." },
        { status: 400 },
      );
    }
    if (await db.findUserByEmail(email)) {
      return NextResponse.json(
        { error: "An account with this email already exists." },
        { status: 409 },
      );
    }
    const passwordHash = await hashPassword(password);
    const lat = Number.isFinite(Number(body.lat)) ? Number(body.lat) : null;
    const lng = Number.isFinite(Number(body.lng)) ? Number(body.lng) : null;

    if (body.role === "doctor") {
      const { user, doctor } = await db.createDoctorUser({
        email,
        passwordHash,
        fullName: String(body.fullName ?? "Doctor"),
        specialty: String(body.specialty ?? "General Physician"),
        kind: body.kind === "resident" ? "resident" : "practising",
        gender: body.gender === "male" ? "male" : "female",
        experienceYears: Number(body.experienceYears ?? 0),
        consultFee: Number(body.consultFee ?? 400),
        homeVisitFee: Number(body.homeVisitFee ?? 900),
        lat,
        lng,
      });
      await setSession({ id: user.id, role: "doctor", name: user.name });
      emitChange(["doctors"]); // patients' maps pick the new doctor up live
      return NextResponse.json({ ok: true, role: "doctor", doctor });
    }

    const user = await db.createPatientUser({
      email,
      passwordHash,
      name: String(body.name ?? "Patient"),
      address: String(body.address ?? ""),
    });
    await setSession({ id: user.id, role: "patient", name: user.name });
    return NextResponse.json({ ok: true, role: "patient", id: user.id });
  } catch (err) {
    console.error("register failed:", err);
    return NextResponse.json({ error: "Could not create the account." }, { status: 500 });
  }
}
