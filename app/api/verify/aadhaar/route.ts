import { NextResponse } from "next/server";
import { getRequestSession } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { verifyAadhaarXml } from "@/lib/verify/aadhaar";
import { sanitizeHealthProfile } from "@/lib/health/profile";
import { rateLimit, tooMany } from "@/lib/server/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json({ available: Boolean(process.env.UIDAI_OFFLINE_CERT_PEM), method: "signed-offline-xml" });
}

export async function POST(req: Request) {
  const session = await getRequestSession(req);
  if (session?.role !== "patient") return NextResponse.json({ error: "Sign in as a patient first." }, { status: 401 });
  if (!(await rateLimit(`aadhaar:${session.userId}`, 5, 3600000))) return tooMany();
  const certificate = process.env.UIDAI_OFFLINE_CERT_PEM?.replace(/\\n/g, "\n");
  if (!certificate) return NextResponse.json({ error: "Document verification is not available yet. You can continue with your profile." }, { status: 503 });
  if (Number(req.headers.get("content-length")) > 350_000) return NextResponse.json({ error: "File too large." }, { status: 413 });
  try {
    const text = await req.text();
    if (Buffer.byteLength(text) > 350_000) return NextResponse.json({ error: "File too large." }, { status: 413 });
    let body;
    try {
      body = JSON.parse(text);
    } catch (e) {
      return NextResponse.json({ error: "Invalid JSON response from provider." }, { status: 502 });
    }
    if (body.consent !== true || typeof body.xml !== "string") return NextResponse.json({ error: "Consent and your extracted XML are required." }, { status: 400 });
    const identity = verifyAadhaarXml(body.xml, certificate);
    const existing = await db.getPatientProfile(session.userId);
    const healthProfile = {
      ...existing?.healthProfile,
      ...Object.fromEntries(Object.entries(sanitizeHealthProfile({ dob: identity.dob, gender: identity.gender })).filter(([, value]) => value !== undefined)),
      aadhaarDocument: { name: identity.name, checkedAt: new Date().toISOString(), method: "uidai-offline-xml" as const },
      updatedAt: new Date().toISOString(),
    };
    await db.setPatientHealthProfile(session.userId, healthProfile);
    return NextResponse.json({ ok: true, healthProfile });
  } catch {
    return NextResponse.json({ error: "We could not authenticate this XML with the configured UIDAI certificate. Use a fresh, extracted offline XML from UIDAI." }, { status: 400 });
  }
}
