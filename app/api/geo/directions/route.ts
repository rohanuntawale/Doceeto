import { NextResponse } from "next/server";
import { getRequestSession } from "@/lib/auth/session";
import { drivingRoute } from "@/lib/geo/directions";
import { clientIp, rateLimit, tooMany } from "@/lib/server/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function coord(v: string | null, max: number): number | null {
  const n = Number(v);
  if (!Number.isFinite(n) || Math.abs(n) > max) return null;
  return n;
}

/**
 * GET /api/geo/directions?from=lat,lng&to=lat,lng
 *
 * The road-following line and ETA the live tracker draws. GET rather than POST
 * so the browser and any CDN in front of us can cache it too — the answer
 * depends only on the two coordinates.
 *
 * The client re-routes rarely by design (on first fix, on drifting off the
 * line, on the destination moving), so the limit below is sized for that
 * rhythm and would catch a client that started re-routing on every GPS ping.
 */
export async function GET(req: Request) {
  const session = await getRequestSession(req);
  const who = session?.userId ?? clientIp(req);
  if (!rateLimit(`directions:${who}`, 40, 10 * 60_000)) return tooMany();

  const url = new URL(req.url);
  const [fromLat, fromLng] = (url.searchParams.get("from") ?? "").split(",");
  const [toLat, toLng] = (url.searchParams.get("to") ?? "").split(",");

  const a = { lat: coord(fromLat, 90), lng: coord(fromLng, 180) };
  const b = { lat: coord(toLat, 90), lng: coord(toLng, 180) };
  if (a.lat === null || a.lng === null || b.lat === null || b.lng === null) {
    return NextResponse.json({ error: "Invalid coordinates." }, { status: 400 });
  }

  const route = await drivingRoute(
    { lat: a.lat, lng: a.lng },
    { lat: b.lat, lng: b.lng },
  );

  // A routing failure is not a request failure: the map draws a straight line
  // and a distance-based ETA instead, so 200 + null is the honest answer.
  return NextResponse.json(
    { route },
    { headers: { "Cache-Control": "private, max-age=60" } },
  );
}
