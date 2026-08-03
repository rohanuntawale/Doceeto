import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Liveness probe for the client-side SiteDownGate. Deliberately touches
 * nothing (no DB, no auth) — it answers exactly one question: "is the
 * Next.js server reachable?" /api/warm stays the DB wake-up path.
 */
export function GET() {
  return NextResponse.json({ ok: true });
}
