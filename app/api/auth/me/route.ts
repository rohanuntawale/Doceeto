import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { db } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ user: null }, { status: 200 });

  if (session.role === "doctor") {
    const doctor = await db.getDoctorById(session.sub);
    return NextResponse.json({ role: "doctor", doctor });
  }
  if (session.role === "patient") {
    const patient = await db.getPatientProfile(session.sub);
    return NextResponse.json({ role: "patient", patient });
  }
  return NextResponse.json({ role: "ops", name: session.name });
}
