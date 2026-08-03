import { NextResponse } from "next/server";
import { getRequestSession } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { rateLimit, tooMany } from "@/lib/server/rate-limit";
import {
  sanitizeSession,
  upsertSession,
  type CheckSession,
} from "@/lib/care/history";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * The signed-in PATIENT's symptom-checker chat history, stored on their
 * account. This is what makes the AI-chat behave like any chat app: history
 * survives page refreshes, browser data wipes, and other devices — the
 * localStorage copy in use-medical-history.ts is only a cache in front of it.
 * Signed-out visitors get { sessions: null } and stay device-local.
 */

async function patientId(req: Request): Promise<string | null> {
  const session = await getRequestSession(req);
  return session?.role === "patient" ? session.userId : null;
}

export async function GET(req: Request) {
  const id = await patientId(req);
  if (!id) return NextResponse.json({ sessions: null });
  const stored = (await db.getChatHistory(id))
    .map(sanitizeSession)
    .filter(Boolean) as CheckSession[];
  return NextResponse.json({ sessions: stored, patientId: id });
}

export async function POST(req: Request) {
  const id = await patientId(req);
  if (!id) return NextResponse.json({ ok: false }, { status: 401 });
  // Saves fire per answered question (debounced client-side); a real chat
  // burns nowhere near this budget.
  if (!rateLimit(`care-history:${id}`, 240, 10 * 60_000)) return tooMany();

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Malformed body." }, { status: 400 });
  }

  // Accept one session or a batch (the hook pushes local-only sessions up in
  // one request after merging on hydrate).
  const raw = (body as Record<string, unknown>) ?? {};
  const incoming = (Array.isArray(raw.sessions) ? raw.sessions : [raw.session])
    .map(sanitizeSession)
    .filter(Boolean) as CheckSession[];
  if (incoming.length === 0)
    return NextResponse.json({ error: "No usable session." }, { status: 400 });

  const stored = (await db.getChatHistory(id))
    .map(sanitizeSession)
    .filter(Boolean) as CheckSession[];
  let next = stored;
  for (const s of incoming) {
    // upsert for the common single-save; merge semantics come free with it
    // because sanitize already normalized both sides.
    next = upsertSession(next, s);
  }
  await db.setChatHistory(id, next);
  return NextResponse.json({ ok: true, count: next.length });
}

export async function DELETE(req: Request) {
  const id = await patientId(req);
  if (!id) return NextResponse.json({ ok: false }, { status: 401 });
  if (!rateLimit(`care-history:${id}`, 240, 10 * 60_000)) return tooMany();

  const sessionId = new URL(req.url).searchParams.get("id");
  const stored = (await db.getChatHistory(id))
    .map(sanitizeSession)
    .filter(Boolean) as CheckSession[];
  const next = sessionId ? stored.filter((s) => s.id !== sessionId) : [];
  await db.setChatHistory(id, next);
  return NextResponse.json({ ok: true, count: next.length });
}
