import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { setSession } from "@/lib/auth/session";
import { hashPassword } from "@/lib/auth/password";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * DEV-ONLY role switcher — for testing the patient↔doctor pipeline in a
 * single browser. A session cookie can only be one role at a time, so this
 * swaps the session between a persistent "Test Patient" and "Dr. Test
 * Doctor" (created on first use) and redirects into that app.
 *
 * It bypasses password auth by design, so it is DISABLED in production.
 * Middleware doesn't run on /api/*, so the redirect here sets the new
 * session before the guarded page is requested.
 *
 *   /api/dev/switch-role?role=doctor  → become Dr. Test Doctor → /doctor
 *   /api/dev/switch-role?role=patient → become Test Patient   → /patient
 */
const TEST_DOCTOR_EMAIL = "test.doctor@doceeto.local";
const TEST_PATIENT_EMAIL = "test.patient@doceeto.local";

export async function GET(req: Request) {
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json({ error: "Role switch is disabled in production." }, { status: 404 });
  }

  const url = new URL(req.url);
  const role = url.searchParams.get("role") === "doctor" ? "doctor" : "patient";
  const email = role === "doctor" ? TEST_DOCTOR_EMAIL : TEST_PATIENT_EMAIL;

  // Find the persistent test account for this role, or create it once.
  let user = await db.findUserByEmail(email);
  if (!user) {
    const passwordHash = await hashPassword("test-switch-doceeto");
    if (role === "doctor") {
      const created = await db.createDoctorUser({
        email,
        passwordHash,
        fullName: "Dr. Test Doctor",
        specialty: "General Physician",
        kind: "practising",
        gender: "female",
        experienceYears: 6,
        consultFee: 400,
        homeVisitFee: 900,
        lat: null,
        lng: null,
      });
      user = created.user;
    } else {
      user = await db.createPatientUser({
        email,
        passwordHash,
        name: "Test Patient",
        address: "Nagpur",
      });
    }
  }

  await setSession({ id: user.id, role, name: user.name });

  return NextResponse.redirect(new URL(role === "doctor" ? "/doctor" : "/patient", url.origin));
}
