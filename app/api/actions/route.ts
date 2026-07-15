import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import * as repo from "@/lib/neo4j/repo";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Single write endpoint. Every action re-checks the caller's role and
 * ownership server-side, so the browser can never act as someone else.
 */
export async function POST(req: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Not signed in." }, { status: 401 });

  const { action, payload } = await req.json();
  const me = session.sub;
  const role = session.role;

  const needs = (r: string) =>
    NextResponse.json({ error: `Only ${r} can do this.` }, { status: 403 });

  try {
    switch (action) {
      // ── Patient creates (identity is taken from the session) ──
      case "createSos":
        if (role !== "patient") return needs("patients");
        return NextResponse.json(
          await repo.createSos({ ...payload, patientId: me, patientName: session.name }),
        );
      case "createRequest":
        if (role !== "patient") return needs("patients");
        return NextResponse.json(
          await repo.createRequest({ ...payload, patientId: me, patientName: session.name }),
        );
      case "createOrder":
        if (role !== "patient") return needs("patients");
        return NextResponse.json(
          await repo.createOrder({ ...payload, patientId: me, patientName: session.name }),
        );

      // ── Doctor actions (only on their own record) ──
      case "setDoctorStatus":
        if (role !== "doctor") return needs("doctors");
        await repo.setDoctorStatus(me, String(payload.status));
        return NextResponse.json({ ok: true });
      case "updateDoctor":
        if (role !== "doctor") return needs("doctors");
        await repo.updateDoctor(me, payload.patch ?? {});
        return NextResponse.json({ ok: true });
      case "acceptRequest": {
        if (role !== "doctor") return needs("doctors");
        const won = await repo.acceptRequest(String(payload.id), me);
        return NextResponse.json({ ok: won });
      }
      case "declineRequest":
        if (role !== "doctor") return needs("doctors");
        await repo.declineRequest(String(payload.id));
        return NextResponse.json({ ok: true });
      case "startVisit":
        if (role !== "doctor") return needs("doctors");
        await repo.startVisit(String(payload.id));
        return NextResponse.json({ ok: true });
      case "arriveVisit":
        if (role !== "doctor") return needs("doctors");
        await repo.arriveVisit(String(payload.id));
        return NextResponse.json({ ok: true });
      case "completeRequest":
        if (role !== "doctor") return needs("doctors");
        await repo.completeRequest(String(payload.id));
        return NextResponse.json({ ok: true });
      case "createPrescription":
        if (role !== "doctor") return needs("doctors");
        return NextResponse.json(
          await repo.createPrescription({
            requestId: String(payload.requestId),
            doctorId: me,
            diagnosis: String(payload.diagnosis ?? ""),
            items: Array.isArray(payload.items) ? payload.items : [],
            advice: String(payload.advice ?? ""),
          }),
        );
      case "addReview":
        if (role !== "patient") return needs("patients");
        await repo.addReview({
          doctorId: String(payload.doctorId),
          requestId: payload.requestId ? String(payload.requestId) : null,
          patientName: session.name,
          rating: Number(payload.rating ?? 5),
          comment: String(payload.comment ?? ""),
        });
        return NextResponse.json({ ok: true });

      // ── Ops verification ──
      case "verifyDoctor":
        if (role !== "ops") return needs("ops");
        await repo.verifyDoctor(String(payload.id), !!payload.approve);
        return NextResponse.json({ ok: true });

      // ── Ops actions ──
      case "assignAmbulance":
        if (role !== "ops") return needs("ops");
        await repo.assignAmbulance(String(payload.sosId), String(payload.ambulanceId));
        return NextResponse.json({ ok: true });
      case "assignDoctorToSos":
        if (role !== "ops") return needs("ops");
        await repo.assignDoctorToSos(String(payload.sosId), String(payload.doctorId));
        return NextResponse.json({ ok: true });
      case "advanceSos":
        if (role !== "ops") return needs("ops");
        await repo.advanceSos(String(payload.sosId));
        return NextResponse.json({ ok: true });
      case "advanceOrder":
        if (role !== "ops") return needs("ops");
        await repo.advanceOrder(String(payload.orderId));
        return NextResponse.json({ ok: true });

      default:
        return NextResponse.json({ error: "Unknown action." }, { status: 400 });
    }
  } catch (err) {
    console.error("action failed:", err);
    return NextResponse.json({ error: "Action failed." }, { status: 500 });
  }
}
