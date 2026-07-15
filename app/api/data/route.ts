import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import * as repo from "@/lib/neo4j/repo";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Single read endpoint. Authorization is enforced HERE (there is no RLS):
 * each role only receives the rows it is allowed to see.
 */
export async function GET(req: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Not signed in." }, { status: 401 });

  const entity = new URL(req.url).searchParams.get("entity");
  const me = session.sub;
  const role = session.role;

  try {
    switch (entity) {
      case "doctors": {
        const all = await repo.getDoctors();
        // Patients only ever see verified doctors. Ops/doctors see all
        // (ops needs the verification queue).
        if (role === "patient")
          return NextResponse.json(all.filter((d) => d.verified));
        return NextResponse.json(all);
      }

      case "ambulances":
        return NextResponse.json(await repo.getAmbulances());

      case "reviews":
        return NextResponse.json(await repo.getReviews());

      case "prescriptions": {
        const all = await repo.getPrescriptions();
        if (role === "ops") return NextResponse.json(all);
        if (role === "patient")
          return NextResponse.json(all.filter((p) => p.patientId === me));
        return NextResponse.json(all.filter((p) => p.doctorId === me));
      }

      case "requests": {
        const all = await repo.getRequests();
        if (role === "ops") return NextResponse.json(all);
        if (role === "patient")
          return NextResponse.json(all.filter((r) => r.patientId === me));
        // doctor: open broadcasts, directed-to-me, and my own accepted/history
        return NextResponse.json(
          all.filter(
            (r) =>
              (r.status === "pending" && (r.doctorId === null || r.doctorId === me)) ||
              r.doctorId === me,
          ),
        );
      }

      case "sos": {
        const all = await repo.getSosEvents();
        if (role === "ops") return NextResponse.json(all);
        if (role === "patient")
          return NextResponse.json(all.filter((s) => s.patientId === me));
        // doctor: active emergencies they can respond to
        return NextResponse.json(
          all.filter((s) => s.status === "open" || s.status === "assigned"),
        );
      }

      case "orders": {
        const all = await repo.getOrders();
        if (role === "ops") return NextResponse.json(all);
        if (role === "patient")
          return NextResponse.json(all.filter((o) => o.patientId === me));
        return NextResponse.json([]); // doctors don't see orders
      }

      default:
        return NextResponse.json({ error: "Unknown entity." }, { status: 400 });
    }
  } catch (err) {
    console.error("data read failed:", err);
    return NextResponse.json({ error: "Could not load data." }, { status: 500 });
  }
}
