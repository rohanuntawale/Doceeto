import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { getDoctorById, getPatientProfile } from "@/lib/neo4j/repo";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ user: null }, { status: 200 });

  if (session.role === "doctor") {
    const doctor = await getDoctorById(session.sub);
    return NextResponse.json({ role: "doctor", doctor });
  }
  if (session.role === "patient") {
    const patient = await getPatientProfile(session.sub);
    return NextResponse.json({ role: "patient", patient });
  }
  return NextResponse.json({ role: "ops", name: session.name });
}
