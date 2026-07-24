import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { db as repo, type Near } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Parse ?near=lat,lng&km=10 into a geo filter (bounded to 100 km). */
function parseNear(params: URLSearchParams): Near | undefined {
  const near = params.get("near");
  if (!near) return undefined;
  const [latS, lngS] = near.split(",");
  const lat = Number(latS);
  const lng = Number(lngS);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return undefined;
  const km = Math.min(100, Math.max(0.2, Number(params.get("km")) || 10));
  return { lat, lng, km };
}

/**
 * Single read endpoint. Authorization is enforced HERE (there is no RLS):
 * each role only receives the rows — and the coordinates — it is allowed
 * to see. Supports geo filtering: ?entity=doctors&near=21.14,79.08&km=10
 */
export async function GET(req: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Not signed in." }, { status: 401 });

  const params = new URL(req.url).searchParams;
  const entity = params.get("entity");
  const near = parseNear(params);
  const me = session.sub;
  const role = session.role;

  try {
    switch (entity) {
      case "doctors": {
        const all = await repo.getDoctors(near);
        if (role === "ops") return NextResponse.json(all);
        // A doctor's live position is public ONLY while they're not
        // offline; hide stale coordinates from patients/doctors.
        return NextResponse.json(
          all.map((d) =>
            d.status === "offline" ? { ...d, lat: 0, lng: 0 } : d,
          ),
        );
      }

      case "ambulances": {
        // Fleet positions are operational data — ops only.
        if (role !== "ops") return NextResponse.json([]);
        return NextResponse.json(await repo.getAmbulances());
      }

      case "reviews":
        return NextResponse.json(
          await repo.getReviews(params.get("doctorId") ?? undefined),
        );

      case "requests": {
        const all = await repo.getRequests(near);
        if (role === "ops") return NextResponse.json(all);
        if (role === "patient")
          return NextResponse.json(all.filter((r) => r.patientId === me));
        // doctor: open broadcasts, directed-to-me, requests aimed at a
        // display-only seed doctor (claimable by any online doctor since
        // seed rows have no account), and my own accepted/history.
        return NextResponse.json(
          all.filter(
            (r) =>
              (r.status === "pending" &&
                (r.doctorId === null ||
                  r.doctorId === me ||
                  r.doctorId?.startsWith("doc-seed-"))) ||
              r.doctorId === me,
          ),
        );
      }

      case "sos": {
        const all = await repo.getSosEvents(near);
        if (role === "ops") return NextResponse.json(all);
        if (role === "patient")
          return NextResponse.json(all.filter((s) => s.patientId === me));
        // doctor: active emergencies they can respond to + their own.
        return NextResponse.json(
          all.filter(
            (s) => s.status === "open" || s.status === "assigned" || s.doctorId === me,
          ),
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
