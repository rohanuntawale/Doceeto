import { NextResponse } from "next/server";
import { getRequestSession } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { isProvider } from "@/lib/auth/constants";
import { hasOngoingConsult, visibleToProvider } from "@/lib/scheduling/slots";
import type { Cadre } from "@/lib/types/domain";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * The patient brief a doctor opens before a consult: identity, address,
 * standing, and the full health profile (measurements, allergies, conditions,
 * medication, history, emergency contact).
 *
 * Gate: the caller must be a DOCTOR holding that consult — accepted or already
 * completed. A pending broadcast is deliberately not enough: until the doctor
 * commits to the visit, they get the symptoms and rating on the request card,
 * not someone's medical record.
 */
export async function GET(req: Request) {
  const session = await getRequestSession(req);
  if (!session) return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  // Nurses read this too: someone doing a dressing at home needs the allergy
  // list every bit as much as a doctor does.
  if (!isProvider(session.role)) {
    return NextResponse.json({ error: "Only providers can read a patient brief." }, { status: 403 });
  }

  const requestId = new URL(req.url).searchParams.get("requestId") ?? "";
  if (!requestId) return NextResponse.json({ error: "Which consult?" }, { status: 400 });

  const all = await db.getRequests();
  const request = all.find((r) => r.id === requestId);
  if (!request) return NextResponse.json({ error: "That consult isn't yours." }, { status: 404 });

  const me = session.userId;
  const mine = request.doctorId === me;
  const held = mine && (request.status === "accepted" || request.status === "completed");

  /**
   * Deciding whether to take a visit IS a clinical judgement — a nurse asked to
   * do a dressing needs to know about a bleeding disorder before saying yes,
   * not after. So a pending request the provider can actually see returns a
   * PREVIEW: the clinical facts, and nothing that identifies where the person
   * lives or who to ring.
   *
   * The full brief still requires holding the visit. Without that split, every
   * provider a broadcast reaches could read a stranger's complete record and
   * contact details without ever accepting anything.
   */
  const busy = hasOngoingConsult(all, me);
  const cadre: Cadre = session.role === "nurse" ? "nurse" : "doctor";
  const canPreview =
    request.status === "pending" && visibleToProvider(request, { doctorId: me, busy, cadre });

  if (!held && !canPreview) {
    return NextResponse.json(
      { error: "That consult isn't yours." },
      { status: mine ? 403 : 404 },
    );
  }
  if (!request.patientId) {
    return NextResponse.json({ error: "This patient has no account on record." }, { status: 404 });
  }

  const brief = await db.getPatientBrief(request.patientId);
  if (!brief) return NextResponse.json({ error: "Patient not found." }, { status: 404 });

  if (held) return NextResponse.json({ brief, preview: false });

  // Preview: clinical only. Address, avatar and the emergency contact are
  // withheld until the visit is actually taken.
  const { emergencyContactName, emergencyContactPhone, ...clinical } =
    brief.healthProfile ?? {};
  return NextResponse.json({
    preview: true,
    brief: {
      ...brief,
      address: "",
      avatarUrl: undefined,
      healthProfile: brief.healthProfile ? clinical : undefined,
    },
  });
}
