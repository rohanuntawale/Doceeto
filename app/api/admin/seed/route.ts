import { NextResponse } from "next/server";
import { runSetup } from "@/lib/db";
import { handleApiError } from "@/lib/api/utils";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * One-time setup: creates constraints, seeds the doctor/ambulance catalog,
 * and the ops login. Guard with a token so it can't be triggered by anyone.
 *   curl -X POST -H "x-setup-token: $SETUP_TOKEN" https://.../api/admin/seed
 */
export async function POST(req: Request) {
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json({ error: "This endpoint is disabled in production." }, { status: 403 });
  }

  const token = req.headers.get("x-setup-token");
  if (!process.env.SETUP_TOKEN || token !== process.env.SETUP_TOKEN) {
    return NextResponse.json({ error: "Forbidden." }, { status: 403 });
  }
  try {
    const result = await runSetup();

    /**
     * `?catalog=1` additionally inserts the twelve demo Nagpur clinics that
     * the landing map pins. Opt-in on purpose — they are fictional doctors
     * flagged VERIFIED, so a deploy hook that runs setup() must never add them
     * by accident. Postgres only; the demo store seeds its own catalog.
     */
    const wantCatalog = new URL(req.url).searchParams.get("catalog") === "1";
    if (wantCatalog && process.env.DATABASE_URL) {
      const { seedClinicCatalog } = await import("@/lib/postgres/repo");
      const catalog = await seedClinicCatalog();
      return NextResponse.json({ ...result, catalog });
    }
    return NextResponse.json(result);
  } catch (err) {
    return handleApiError(err, "Setup failed. Please check server logs.");
  }
}
