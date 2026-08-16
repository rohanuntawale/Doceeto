import { NextResponse } from "next/server";
import { getRequestSession } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { emitChange } from "@/lib/server/events";
import { rateLimit, tooMany } from "@/lib/server/rate-limit";
import { isProvider } from "@/lib/auth/constants";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Set the signed-in user's profile photo (patient, doctor or nurse).
 *
 * The photo arrives as a small data-URL: the client crops and downscales to a
 * 256px JPEG before sending, so a "photo" is a few tens of KB riding in the
 * row it belongs to — no object storage, no orphaned files, and it deploys
 * anywhere the database does. The cap below is the server's own guarantee of
 * that, not a courtesy: without it this route would accept a 10MB original.
 */
const DATA_URL_RE = /^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/;
const MAX_LENGTH = 300_000; // ~220KB decoded, far above what the client sends

export async function POST(req: Request) {
  const session = await getRequestSession(req);
  if (!session) return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  // Nurses need this as much as doctors do — more, in fact: a photo is the
  // precondition for going online, so refusing it here would deadlock them off
  // the platform entirely.
  if (session.role !== "patient" && !isProvider(session.role)) {
    return NextResponse.json({ error: "Only patients and providers have profile photos." }, { status: 403 });
  }

  if (!rateLimit(`avatar:${session.userId}`, 10, 10 * 60_000)) return tooMany();

  let dataUrl: string;
  try {
    const body = await req.json();
    dataUrl = String(body.dataUrl ?? "");
  } catch {
    return NextResponse.json({ error: "Malformed request body." }, { status: 400 });
  }

  if (!DATA_URL_RE.test(dataUrl)) {
    return NextResponse.json({ error: "Send the photo as a JPEG, PNG or WebP image." }, { status: 400 });
  }
  if (dataUrl.length > MAX_LENGTH) {
    return NextResponse.json({ error: "That photo is too large. Try a smaller one." }, { status: 400 });
  }

  await db.setUserAvatar(session.userId, session.role, dataUrl);

  // Providers wear their photo in public — every patient list should refresh.
  if (isProvider(session.role)) emitChange(["doctors"]);

  return NextResponse.json({ ok: true, avatarUrl: dataUrl });
}
