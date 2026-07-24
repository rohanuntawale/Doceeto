import "server-only";

/**
 * Small in-memory sliding-window rate limiter for the auth routes.
 * Per-process (resets on deploy/restart) — enough to stop credential
 * stuffing and signup spam on a single instance. Swap for Redis/Upstash
 * when running multiple instances.
 */

const g = globalThis as unknown as { __iyashiRl?: Map<string, number[]> };
const hits: Map<string, number[]> = (g.__iyashiRl ??= new Map());

/** Returns true when the call is allowed, false when over the limit. */
export function rateLimit(key: string, limit: number, windowMs: number): boolean {
  const now = Date.now();
  const arr = (hits.get(key) ?? []).filter((t) => now - t < windowMs);
  if (arr.length >= limit) {
    hits.set(key, arr);
    return false;
  }
  arr.push(now);
  hits.set(key, arr);
  // Opportunistic GC so the map can't grow unbounded.
  if (hits.size > 5000) {
    for (const [k, v] of hits) {
      if (v.every((t) => now - t >= windowMs)) hits.delete(k);
    }
  }
  return true;
}

/** Best-effort client IP (works behind Render/Vercel proxies). */
export function clientIp(req: Request): string {
  return (
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    req.headers.get("x-real-ip") ||
    "local"
  );
}

export const tooMany = () =>
  new Response(JSON.stringify({ error: "Too many attempts. Try again in a few minutes." }), {
    status: 429,
    headers: { "content-type": "application/json" },
  });
