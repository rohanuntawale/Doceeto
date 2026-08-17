import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { warmOllama } from "@/lib/ai/llm";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Wake the database. The free Neon tier suspends its compute after a few idle
 * minutes, and the first query afterwards pays a multi-second resume. Sign-in
 * pages fire this on mount, so the wake-up happens while the person is still
 * reading the page (or off picking a Google account) — by the time the OAuth
 * callback needs the database, it's warm. Returns nothing worth caching.
 *
 * Also wakes the symptom checker's GPU when one is configured. Loading model
 * weights into VRAM costs 20-60s, and that cost lands on whoever asks first;
 * the checker page hits this on mount, so it lands on nobody. Fire-and-forget
 * on purpose — the caller must not wait for a model load, and a GPU that is
 * down is the fallback provider's problem, not this route's.
 *
 * The two waits run concurrently: the database ping should not queue behind a
 * cold GPU.
 */
export async function GET() {
  const llm = warmOllama().catch(() => false);
  try {
    await db.ping();
  } catch {
    // Waking is best-effort; the real request will surface real errors.
  }
  // Give the model load a brief window to be *reported*, without ever holding
  // the response open for the full load — whatever it returns, the request to
  // Ollama has already been sent and the load is underway on the GPU.
  const warmed = await Promise.race([
    llm,
    new Promise<boolean>((r) => setTimeout(() => r(false), 1500)),
  ]);
  return NextResponse.json({ ok: true, llmWarm: warmed });
}
