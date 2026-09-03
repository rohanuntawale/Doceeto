import "server-only";

/**
 * Distributed sliding-window rate limiter.
 *
 * When UPSTASH_REDIS_REST_URL is set, every call hits Upstash Redis — a
 * shared store that survives cold starts, deploys and multiple serverless
 * instances. Without it (local dev), falls back to a per-process in-memory
 * map, which is fine for a single long-running Node process.
 *
 * The public API is unchanged from the original: rateLimit(key, limit, windowMs).
 * Call sites don't need to know which backend is behind them.
 *
 * Design: one Ratelimit instance per unique (limit, windowMs) pair, cached
 * in a module-level Map. Each instance is stateless and thread-safe — the
 * constructor just holds the config, and every .limit() call is an independent
 * Redis round-trip. This avoids recreating instances on every call while
 * keeping the dynamic (limit, windowMs) API that all 25 call sites use.
 */

// ── Upstash backend ──────────────────────────────────────────

let upstashAvailable = false;
let RatelimitCtor: typeof import("@upstash/ratelimit").Ratelimit | null = null;
let RedisCtor: typeof import("@upstash/redis").Redis | null = null;

async function loadUpstash(): Promise<boolean> {
  if (RatelimitCtor) return upstashAvailable;
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) {
    upstashAvailable = false;
    return false;
  }
  try {
    const rl = await import("@upstash/ratelimit");
    const rd = await import("@upstash/redis");
    RatelimitCtor = rl.Ratelimit;
    RedisCtor = rd.Redis;
    upstashAvailable = true;
    return true;
  } catch {
    // Package not installed or import failed — stay on in-memory.
    upstashAvailable = false;
    return false;
  }
}

/** One Ratelimit instance per (limit, windowMs) pair. Created lazily. */
const upstashLimiters = new Map<
  string,
  import("@upstash/ratelimit").Ratelimit
>();

function getUpstashLimiter(limit: number, windowMs: number) {
  const key = `${limit}:${windowMs}`;
  let limiter = upstashLimiters.get(key);
  if (!limiter) {
    limiter = new RatelimitCtor!({
      redis: RedisCtor!.fromEnv(),
      limiter: RatelimitCtor!.fixedWindow(limit, durationOf(windowMs)),
      analytics: false,
      prefix: "rl",
    });
    upstashLimiters.set(key, limiter);
  }
  return limiter;
}

/** Convert milliseconds to the "10 s" / "15 m" / "1 h" format Upstash expects. */
function durationOf(ms: number): `${number} ${"ms" | "s" | "m" | "h"}` {
  if (ms < 1_000) return `${ms} ms`;
  if (ms < 60_000) return `${ms / 1_000} s`;
  if (ms < 3_600_000) return `${ms / 60_000} m`;
  return `${ms / 3_600_000} h`;
}

// ── In-memory fallback (single-process dev) ──────────────────

const g = globalThis as unknown as { __iyashiRl?: Map<string, number[]> };
const hits: Map<string, number[]> = (g.__iyashiRl ??= new Map());
let memOps = 0;

function inMemoryRateLimit(key: string, limit: number, windowMs: number): boolean {
  const now = Date.now();
  const arr = (hits.get(key) ?? []).filter((t) => now - t < windowMs);
  if (arr.length >= limit) {
    hits.set(key, arr);
    return false;
  }
  arr.push(now);
  hits.set(key, arr);
  // Opportunistic GC so the map can't grow unbounded.
  if (++memOps % 100 === 0 && hits.size > 5000) {
    for (const [k, v] of hits) {
      if (v.every((t) => now - t >= windowMs)) hits.delete(k);
    }
  }
  return true;
}

// ── Public API ───────────────────────────────────────────────

/**
 * Returns true when the call is allowed, false when over the limit.
 *
 * The Upstash path is tried once per process. If the env vars aren't set
 * or the package isn't available, all subsequent calls use the in-memory
 * fallback immediately — no retry, no latency.
 *
 * Upstash errors (network, auth) are treated as "allow" to avoid locking
 * everyone out when Redis is down. The worst case is no rate limiting for
 * that one request, which is better than blocking a login during a blip.
 */
export async function rateLimit(
  key: string,
  limit: number,
  windowMs: number,
): Promise<boolean> {
  // Fast path: already decided which backend to use.
  if (upstashAvailable) {
    try {
      const { success } = await getUpstashLimiter(limit, windowMs).limit(key);
      return success;
    } catch {
      // Redis down — fail open, don't block the request.
      return true;
    }
  }

  // First call per process: check for Upstash env vars.
  if (await loadUpstash()) {
    try {
      const { success } = await getUpstashLimiter(limit, windowMs).limit(key);
      return success;
    } catch {
      return true;
    }
  }

  // No Upstash — in-memory (single-process dev).
  return inMemoryRateLimit(key, limit, windowMs);
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
