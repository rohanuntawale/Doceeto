import { NextResponse } from "next/server";
import { hashPassword } from "@/lib/auth/password";
import { setSession } from "@/lib/auth/session";
import { findUserByEmail, createPatientUser, createDoctorUser } from "@/lib/neo4j/repo";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const email = String(body.email ?? "").trim().toLowerCase();
    const password = String(body.password ?? "");
    if (!email || !password || password.length < 6) {
      return NextResponse.json(
        { error: "Enter an email and a password of at least 6 characters." },
        { status: 400 },
      );
    }
    if (await findUserByEmail(email)) {
      return NextResponse.json(
        { error: "An account with this email already exists." },
        { status: 409 },
      );
    }
    const passwordHash = await hashPassword(password);

    if (body.role === "doctor") {
      const { user, doctor } = await createDoctorUser({
        email,
        passwordHash,
        fullName: String(body.fullName ?? "Doctor"),
        specialty: String(body.specialty ?? "General Physician"),
        kind: body.kind === "resident" ? "resident" : "practising",
        gender: body.gender === "male" ? "male" : "female",
        experienceYears: Number(body.experienceYears ?? 0),
        regNo: body.regNo ? String(body.regNo) : null,
        consultFee: Number(body.consultFee ?? 400),
        homeVisitFee: Number(body.homeVisitFee ?? 900),
      });
      await setSession({ id: user.id, role: "doctor", name: user.name });
      return NextResponse.json({ ok: true, role: "doctor", doctor });
    }

    const user = await createPatientUser({
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
