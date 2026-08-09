import { NextResponse } from "next/server";
import { getRequestSession } from "@/lib/auth/session";
import { reverseGeocode } from "@/lib/geo/reverse";
import { db } from "@/lib/db";
import { clientIp, rateLimit, tooMany } from "@/lib/server/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * "I am here now." The patient app posts the device's current position; this
 * names it (reverse geocode) and — when a patient is signed in — stores it on
 * the account, so the address on the dashboard, on a booking and on an SOS is
 * where they ARE, not where they registered.
 *
 * Works without a session too: demo mode still gets the address back, it just
 * has nowhere on the server to save it.
 */
export async function POST(req: Request) {
  const session = await getRequestSession(req);

  // Positions stream in from a watch, so the limit is generous — it exists to
  // keep a stuck client from hammering Nominatim, not to ration normal use.
  const who = session?.userId ?? clientIp(req);
  if (!rateLimit(`locate:${who}`, 60, 10 * 60_000)) return tooMany();

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Malformed request body." }, { status: 400 });
  }

  const { lat, lng } = (body ?? {}) as { lat?: unknown; lng?: unknown };
  const latN = Number(lat);
  const lngN = Number(lng);
  if (
    !Number.isFinite(latN) ||
    !Number.isFinite(lngN) ||
    Math.abs(latN) > 90 ||
    Math.abs(lngN) > 180
  ) {
    return NextResponse.json({ error: "Invalid coordinates." }, { status: 400 });
  }

  const resolved = await reverseGeocode(latN, lngN);

  let saved = false;
  if (session?.role === "patient") {
    await db.setPatientLocation(session.userId, {
      lat: latN,
      lng: lngN,
      address: resolved.short ?? undefined,
      addressFull: resolved.full ?? undefined,
    });
    saved = true;
  }

  // `address` stays the short label the header already renders; `addressFull`
  // is what a provider needs to reach the door.
  return NextResponse.json({
    address: resolved.short,
    addressFull: resolved.full,
    saved,
  });
}
