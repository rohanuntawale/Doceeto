#!/usr/bin/env node
/**
 * Measure whether the self-hosted GPU is actually faster than OpenRouter.
 *
 *   node scripts/bench-diagnose.mjs
 *   node scripts/bench-diagnose.mjs --runs 5 --lang hi
 *   node scripts/bench-diagnose.mjs --cold        # first-request-after-idle
 *
 * Reads .env.local, then calls BOTH providers directly with the same realistic
 * symptom-checker payloads and reports p50/p95 side by side.
 *
 * It bypasses /api/diagnose on purpose. That route falls back from one provider
 * to the other, which is exactly right in production and useless in a
 * benchmark — a "fast" number could be the fallback answering, and a slow one
 * could be both legs added together. Here each provider is timed alone.
 *
 * There is no separate time-to-first-token column because this route does not
 * stream: the client needs the whole JSON object before it can render a
 * question and its option chips, so total time IS the latency the patient
 * feels. Adding streaming would not change that.
 */

import { readFileSync } from "node:fs";

// ── env ──────────────────────────────────────────────────────────────────
for (const file of [".env.local", ".env"]) {
  try {
    for (const line of readFileSync(file, "utf8").split("\n")) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
      if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
    }
  } catch {
    /* optional */
  }
}

const args = process.argv.slice(2);
const flag = (name, fallback) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 && args[i + 1] && !args[i + 1].startsWith("--") ? args[i + 1] : fallback;
};
const RUNS = Number(flag("runs", 5));
const LANG = flag("lang", "en");
const COLD = args.includes("--cold");

/** Realistic turns: an opening complaint, a mid-flow narrowing, and a final
 *  conclusion. The conclusion is the expensive one and must be timed too — it
 *  is where a slow model hurts most, because the patient has already waited
 *  through every question to reach it. */
const CASES = [
  {
    name: "opening question",
    maxTokens: LANG === "en" ? 500 : 900,
    user: `PATIENT PROFILE: Age 55, male. DIAGNOSED high blood pressure.
Patient first said: "chest feels tight since morning"
COMPLAINT DETECTED: yes.
Give the next step now as strict JSON.`,
  },
  {
    name: "mid-flow question",
    maxTokens: LANG === "en" ? 500 : 900,
    user: `PATIENT PROFILE: Age 34, female. BMI 31.2 (obese).
Patient first said: "my knee hurts when I climb stairs"
COMPLAINT DETECTED: yes.
Q: When does it hurt most?
A: Going up or down stairs
Q: Any swelling?
A: A little in the evening
Give the next step now as strict JSON.`,
  },
  {
    name: "conclusion",
    maxTokens: LANG === "en" ? 1200 : 2000,
    user: `PATIENT PROFILE: Age 62, male. DIAGNOSED diabetes. Family history: father had heart disease.
Patient first said: "burning in my feet at night"
COMPLAINT DETECTED: yes.
Q: How long has this been going on?
A: A few months
Q: Is it both feet?
A: Both feet
Q: Any numbness?
A: Yes, sometimes
You have asked enough. Give the CONCLUSION now as strict JSON.`,
  },
];

const SYSTEM = `You are a careful medical triage assistant for an India-based on-demand doctor app.
Ask ONE short question at a time with 3-5 concrete, tappable options, then conclude.
Respond with STRICT JSON only, no prose and no markdown fences, in ONE of these two shapes:
{"kind":"question","id":"<slug>","prompt":"<question>","options":[{"value":"<slug>","label":"<short>"}]}
{"kind":"conclusion","summary":"<one or two sentences>","causes":[{"name":"<possibility>","likelihood":"likely|possible|less-likely","why":"<one sentence>","specialty":"General Physician"}],"specialty":"General Physician","urgency":"routine|urgent|emergency","emergency":false,"advice":"<one or two sentences>"}`;

// ── providers ────────────────────────────────────────────────────────────
async function callOllama(c) {
  const base = process.env.OLLAMA_BASE_URL?.replace(/\/+$/, "");
  if (!base) return { skipped: "OLLAMA_BASE_URL not set" };
  const headers = { "Content-Type": "application/json" };
  if (process.env.OLLAMA_AUTH_TOKEN)
    headers.Authorization = `Bearer ${process.env.OLLAMA_AUTH_TOKEN}`;
  const res = await fetch(`${base}/api/chat`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      model: process.env.OLLAMA_MODEL || "qwen3:30b-a3b",
      stream: false,
      format: "json",
      think: false,
      keep_alive: "-1",
      messages: [
        { role: "system", content: SYSTEM },
        { role: "user", content: c.user },
      ],
      options: {
        temperature: 0.3,
        num_predict: c.maxTokens,
        num_ctx: Number(process.env.OLLAMA_NUM_CTX || 8192),
      },
    }),
    signal: AbortSignal.timeout(120_000),
  });
  if (!res.ok) throw new Error(`ollama http-${res.status}`);
  const data = await res.json();
  return { text: data?.message?.content ?? "" };
}

async function callOpenRouter(c) {
  const key = process.env.OPENROUTER_API_KEY;
  if (!key) return { skipped: "OPENROUTER_API_KEY not set" };
  const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: process.env.OPENROUTER_MODEL || "nvidia/nemotron-3-ultra-550b-a55b",
      temperature: 0.3,
      max_tokens: c.maxTokens,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: SYSTEM },
        { role: "user", content: c.user },
      ],
    }),
    signal: AbortSignal.timeout(120_000),
  });
  if (!res.ok) throw new Error(`openrouter http-${res.status}`);
  const data = await res.json();
  return { text: data?.choices?.[0]?.message?.content ?? "" };
}

// ── measure ──────────────────────────────────────────────────────────────
const pct = (sorted, p) =>
  sorted.length ? sorted[Math.min(sorted.length - 1, Math.floor((p / 100) * sorted.length))] : 0;

/** Did we get parseable JSON back? A fast answer the route would throw away is
 *  not a fast answer — the patient still gets the offline engine. */
const parses = (text) => {
  const s = String(text ?? "");
  const a = s.indexOf("{");
  const b = s.lastIndexOf("}");
  if (a < 0 || b <= a) return false;
  try {
    JSON.parse(s.slice(a, b + 1));
    return true;
  } catch {
    return false;
  }
};

async function bench(label, fn) {
  const times = [];
  let bad = 0;
  let skipped = null;

  for (const c of CASES) {
    for (let i = 0; i < RUNS; i++) {
      const t0 = performance.now();
      try {
        const out = await fn(c);
        if (out.skipped) {
          skipped = out.skipped;
          break;
        }
        const ms = performance.now() - t0;
        times.push(ms);
        if (!parses(out.text)) bad++;
        process.stdout.write(`  ${label} ${c.name} #${i + 1}: ${(ms / 1000).toFixed(2)}s\n`);
      } catch (err) {
        bad++;
        process.stdout.write(`  ${label} ${c.name} #${i + 1}: FAILED (${err.message})\n`);
      }
    }
    if (skipped) break;
  }

  if (skipped) return { label, skipped };
  const sorted = [...times].sort((a, b) => a - b);
  return {
    label,
    n: times.length,
    p50: pct(sorted, 50),
    p95: pct(sorted, 95),
    mean: times.reduce((a, b) => a + b, 0) / (times.length || 1),
    badJson: bad,
  };
}

const fmt = (ms) => `${(ms / 1000).toFixed(2)}s`;

console.log(`\nlang=${LANG}  runs=${RUNS} per case  cases=${CASES.length}\n`);

if (COLD) {
  console.log("COLD START — timing the very first request after idle.");
  console.log("Stop and restart the Lightning Studio first, or this number lies.\n");
  const t0 = performance.now();
  try {
    await callOllama(CASES[0]);
    console.log(`  first request after idle: ${fmt(performance.now() - t0)}\n`);
  } catch (err) {
    console.log(`  first request after idle: FAILED (${err.message})\n`);
  }
}

const results = [];
results.push(await bench("ollama", callOllama));
results.push(await bench("openrouter", callOpenRouter));

console.log("\n─────────────────────────────────────────────────────");
console.log("provider      n    p50       p95       mean      bad JSON");
console.log("─────────────────────────────────────────────────────");
for (const r of results) {
  if (r.skipped) {
    console.log(`${r.label.padEnd(13)} skipped — ${r.skipped}`);
    continue;
  }
  console.log(
    `${r.label.padEnd(13)} ${String(r.n).padEnd(4)} ${fmt(r.p50).padEnd(9)} ${fmt(r.p95).padEnd(9)} ${fmt(r.mean).padEnd(9)} ${r.badJson}`,
  );
}
console.log("─────────────────────────────────────────────────────");

const [a, b] = results;
if (!a.skipped && !b.skipped && a.p50 && b.p50) {
  const x = b.p50 / a.p50;
  console.log(
    x > 1
      ? `\nSelf-hosted is ${x.toFixed(1)}x faster at p50.`
      : `\nSelf-hosted is NOT faster (${(1 / x).toFixed(1)}x slower at p50).` +
          `\nCheck the model is pinned in VRAM and the GPU is not shared before keeping this.`,
  );
  if (a.badJson > 0)
    console.log(
      `\nWARNING: ${a.badJson} self-hosted replies were not valid JSON. Those turns fall` +
        `\nback to the offline rule engine, so speed there is bought at the cost of the` +
        `\nAI answer entirely. Consider a larger model if this is more than occasional.`,
    );
}
console.log("");
