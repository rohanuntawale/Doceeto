import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Wake the database. The free Neon tier suspends its compute after a few idle
 * minutes, and the first query afterwards pays a multi-second resume. Sign-in
 * pages fire this on mount, so the wake-up happens while the person is still
 * reading the page (or off picking a Google account) — by the time the OAuth
 * callback needs the database, it's warm. Returns nothing worth caching.
 */
export async function GET() {
  try {
    await db.ping();
  } catch {
    // Waking is best-effort; the real request will surface real errors.
  }
  return NextResponse.json({ ok: true });
}
