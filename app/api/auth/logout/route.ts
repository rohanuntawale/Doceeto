import { NextResponse } from "next/server";
import { clearSession, surfaceOf } from "@/lib/auth/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Sign out of the calling surface only. Leaving the cockpit shouldn't also end
 * the patient session in the same browser — that coupling is what made the two
 * roles feel like one switchable account. `?all=1` ends every session.
 *
 * This DELETES the session row, so the session is dead server-side rather than
 * just forgotten by this browser.
 */
export async function POST(req: Request) {
  const all = new URL(req.url).searchParams.get("all") === "1";
  await clearSession(all ? undefined : (surfaceOf(req) ?? undefined));
  return NextResponse.json({ ok: true });
}
