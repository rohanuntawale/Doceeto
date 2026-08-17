/**
 * The symptom checker's model client.
 *
 * ONE job: take a system prompt and a transcript, return the model's text.
 * Everything medical — the prompt, the safety floor, the specialty
 * normalisation — stays in app/api/diagnose/route.ts. This file only decides
 * WHICH model answers and how long we wait for it.
 *
 * Two providers, in a deliberate order:
 *
 *   1. OLLAMA — a model we host ourselves on a GPU (see infra/lightning/).
 *      Chosen for LATENCY. The hosted 550B behind OpenRouter answers a simple
 *      narrowing question in 9-13s, which is long enough that patients give up
 *      or type again mid-wait. A 30B-A3B class model on a warm GPU answers the
 *      same question in ~1-2s. For a triage flow that asks up to six questions
 *      in a row, that difference is the entire feel of the product.
 *
 *   2. OPENROUTER — the previous provider, kept as the fallback. It is slower
 *      but it is somebody else's uptime problem, and a self-hosted GPU has
 *      strictly more ways to be down than a managed API does.
 *
 * If both fail the caller returns { unavailable: true } and the client's
 * offline rule engine answers, exactly as before. The checker never hard-fails.
 */

export interface ChatRequest {
  /** System turns, in order. Kept as an array so the language directive stays
   *  its own turn and the big English prompt remains one cacheable constant. */
  system: string[];
  user: string;
  temperature: number;
  maxTokens: number;
  /** Budget for THIS provider alone. The route gives Ollama a much tighter one
   *  than OpenRouter — the whole point of self-hosting is that a slow answer
   *  from it means something is wrong, not that the model is thinking. */
  timeoutMs: number;
}

export interface ChatResult {
  content: string;
  /** What actually served it, for the `model` field the UI already reports. */
  model: string;
  via: "ollama" | "openrouter";
}

const truthy = (v: string | undefined) =>
  v === "1" || v?.toLowerCase() === "true" || v?.toLowerCase() === "yes";

/** Is the self-hosted path configured and switched on? */
export function ollamaEnabled(): boolean {
  return Boolean(process.env.OLLAMA_BASE_URL) && truthy(process.env.USE_OLLAMA);
}

export function ollamaModel(): string {
  return process.env.OLLAMA_MODEL || "qwen3:30b-a3b";
}

function ollamaHeaders(): Record<string, string> {
  const h: Record<string, string> = { "Content-Type": "application/json" };
  // The GPU box is on the public internet. Never talk to it unauthenticated —
  // see the note in infra/lightning/README.md about what an open /api/chat
  // endpoint attracts.
  const token = process.env.OLLAMA_AUTH_TOKEN;
  if (token) h.Authorization = `Bearer ${token}`;
  return h;
}

/**
 * Ollama's NATIVE chat endpoint, not its OpenAI-compatible shim.
 *
 * The native API is what exposes the three knobs this route depends on:
 *
 *   format: "json"  — constrained decoding. The route parses the reply as JSON
 *                     and drops the turn if it doesn't parse, so this is not a
 *                     nicety; without it a small model wraps its answer in
 *                     prose often enough to matter.
 *   think: false    — Qwen3 is a hybrid reasoning model and will emit a long
 *                     <think> block before answering unless told not to. For
 *                     "where does it hurt?" that reasoning is pure latency, and
 *                     latency is the only reason we are self-hosting at all.
 *   keep_alive      — how long the weights stay resident in VRAM after this
 *                     request. -1 means forever. A cold load is 20-60s; paying
 *                     it once per idle period would undo the entire exercise.
 *
 * num_ctx matters just as much and is easy to miss: Ollama defaults to a small
 * context window, and the system prompt here is already several thousand
 * tokens before the patient's transcript is appended. Left at the default the
 * front of the prompt — the personalisation and safety rules — is silently
 * truncated away, and the model gets dumber in a way that looks like a bad
 * model rather than a bad config.
 */
async function viaOllama(req: ChatRequest): Promise<ChatResult | null> {
  const base = process.env.OLLAMA_BASE_URL?.replace(/\/+$/, "");
  if (!base) return null;
  const model = ollamaModel();

  const res = await fetch(`${base}/api/chat`, {
    method: "POST",
    headers: ollamaHeaders(),
    body: JSON.stringify({
      model,
      stream: false,
      format: "json",
      think: false,
      keep_alive: Number(process.env.OLLAMA_KEEP_ALIVE ?? -1),
      messages: [
        ...req.system.map((content) => ({ role: "system", content })),
        { role: "user", content: req.user },
      ],
      options: {
        temperature: req.temperature,
        num_predict: req.maxTokens,
        num_ctx: Number(process.env.OLLAMA_NUM_CTX || 8192),
      },
    }),
    signal: AbortSignal.timeout(req.timeoutMs),
  });

  if (!res.ok) {
    console.error("diagnose ollama:", res.status, await res.text().catch(() => ""));
    return null;
  }
  const data = await res.json();
  const content: string = data?.message?.content ?? "";
  if (!content.trim()) return null;
  return { content, model: data?.model ?? model, via: "ollama" };
}

/**
 * OpenRouter — unchanged from what this route did before Ollama existed, moved
 * here so the two providers sit behind one interface.
 */
async function viaOpenRouter(req: ChatRequest): Promise<ChatResult | null> {
  const key = process.env.OPENROUTER_API_KEY;
  if (!key) return null;

  const model = process.env.OPENROUTER_MODEL || "nvidia/nemotron-3-ultra-550b-a55b";
  const fallbacks = (process.env.OPENROUTER_FALLBACKS ?? "")
    .split(",")
    .map((m) => m.trim())
    .filter(Boolean);

  const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
      // OpenRouter attribution — shows the app on the dashboard/leaderboards.
      "HTTP-Referer": process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000",
      "X-Title": "Doceeto Symptom Checker",
    },
    body: JSON.stringify({
      model,
      // OpenRouter falls through this list on rate-limit / provider error,
      // so a busy primary degrades to the free tier instead of to no AI.
      ...(fallbacks.length ? { models: [model, ...fallbacks] } : {}),
      temperature: req.temperature,
      max_tokens: req.maxTokens,
      response_format: { type: "json_object" },
      messages: [
        ...req.system.map((content) => ({ role: "system", content })),
        { role: "user", content: req.user },
      ],
    }),
    signal: AbortSignal.timeout(req.timeoutMs),
  });

  if (!res.ok) {
    console.error("diagnose openrouter:", res.status, await res.text().catch(() => ""));
    return null;
  }
  const data = await res.json();
  const content: string = data?.choices?.[0]?.message?.content ?? "";
  if (!content.trim()) return null;
  // `data.model` is what actually served it (may be one of the fallbacks).
  return { content, model: data?.model ?? model, via: "openrouter" };
}

/** Is any model at all configured? Lets the route answer "no-key" up front. */
export function anyProviderConfigured(): boolean {
  return ollamaEnabled() || Boolean(process.env.OPENROUTER_API_KEY);
}

/**
 * Ask whichever model is available, self-hosted first.
 *
 * `timeoutMs` is the OpenRouter budget the route already calculated. Ollama
 * gets a much shorter one, because a warm GPU that hasn't answered in a few
 * seconds is not going to — it is cold, unreachable, or swapping. Falling
 * through to OpenRouter early is better than sitting on a dead socket, and the
 * two budgets are additive in the worst case, so the Ollama slice is kept
 * small on purpose.
 */
export async function chat(req: ChatRequest): Promise<ChatResult | null> {
  if (ollamaEnabled()) {
    const budget = Number(process.env.OLLAMA_TIMEOUT_MS || 8000);
    try {
      const out = await viaOllama({ ...req, timeoutMs: Math.min(budget, req.timeoutMs) });
      if (out) return out;
    } catch (err) {
      console.error("diagnose ollama failed, falling back:", err);
    }
  }
  try {
    return await viaOpenRouter(req);
  } catch (err) {
    console.error("diagnose openrouter failed:", err);
    return null;
  }
}

/**
 * Nudge the GPU so the weights are resident before a patient needs them.
 *
 * Sent with num_predict 0: Ollama loads the model and returns without
 * generating anything. Called from /api/warm, which the checker page already
 * hits on mount — so the load happens while the patient is still typing.
 * Best-effort by design; a failure here must never surface.
 */
export async function warmOllama(): Promise<boolean> {
  if (!ollamaEnabled()) return false;
  const base = process.env.OLLAMA_BASE_URL?.replace(/\/+$/, "");
  if (!base) return false;
  try {
    const res = await fetch(`${base}/api/chat`, {
      method: "POST",
      headers: ollamaHeaders(),
      body: JSON.stringify({
        model: ollamaModel(),
        messages: [],
        stream: false,
        keep_alive: Number(process.env.OLLAMA_KEEP_ALIVE ?? -1),
        options: { num_predict: 0 },
      }),
      signal: AbortSignal.timeout(Number(process.env.OLLAMA_WARM_TIMEOUT_MS || 90_000)),
    });
    return res.ok;
  } catch {
    return false;
  }
}
