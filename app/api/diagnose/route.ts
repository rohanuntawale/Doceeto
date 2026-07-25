import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * AI symptom checker — the "brain" behind the Akinator-style flow. Given the
 * conversation so far (seed + chosen answers + the patient's history), it
 * returns the NEXT step: either one more question with fresh option chips, or
 * a final conclusion (bookable specialty + urgency + plain-language reasons).
 *
 * Uses OpenRouter (set OPENROUTER_API_KEY, optionally OPENROUTER_MODEL). If no
 * key is configured or the call fails, it responds { unavailable: true } and
 * the client falls back to the offline rule engine — so the checker always
 * works, and upgrades the moment a key is present.
 */

const SPECIALTIES = [
  "General Physician",
  "Cardiologist",
  "Gynecologist",
  "Pediatrician",
  "Orthopedic",
  "Dermatologist",
  "ENT",
  "Psychiatrist",
];

const SYSTEM = `You are a careful medical triage assistant for an India-based on-demand doctor app.
Your job is NOT to diagnose. Your job is to ask ONE short question at a time with 3-5 concrete,
tappable options (like the game Akinator narrows down) and then recommend the RIGHT KIND of doctor.

Rules:
- Keep language simple; a first-time smartphone user in a small Indian city should understand it.
- Ask ONE question per turn. Options must be specific and mutually exclusive, each with a short label and an optional emoji.
- After 3-6 questions (or sooner if clear), STOP and give a conclusion.
- ALWAYS map to exactly one of these bookable specialties: ${SPECIALTIES.join(", ")}. Default to "General Physician".
- Use the patient's history to personalise. If a red-flag emergency is present (trouble breathing, chest pain to arm/jaw, stroke signs, heavy bleeding, unconscious, self-harm), immediately conclude with emergency=true.
- NEVER give a definitive diagnosis; "conditions" are gentle possibilities, not verdicts.

Respond with STRICT JSON only, no prose, in ONE of these two shapes:
{"kind":"question","id":"<slug>","prompt":"<question>","hint":"<optional short hint>","options":[{"value":"<slug>","label":"<short>","emoji":"<optional>"}]}
{"kind":"conclusion","specialty":"<one of the list>","alt":"<optional second>","urgency":"routine|urgent|emergency","emergency":false,"conditions":["..."],"advice":"<one or two sentences>","sosCategory":"cardiac|trauma|respiratory|stroke|obstetric|other"}`;

interface Body {
  seed?: string;
  answers?: { prompt: string; label: string }[];
  history?: string[];
}

function extractJson(text: string): unknown | null {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start < 0 || end <= start) return null;
  try {
    return JSON.parse(text.slice(start, end + 1));
  } catch {
    return null;
  }
}

function valid(step: unknown): boolean {
  if (!step || typeof step !== "object") return false;
  const s = step as Record<string, unknown>;
  if (s.kind === "question")
    return typeof s.prompt === "string" && Array.isArray(s.options) && s.options.length > 0;
  if (s.kind === "conclusion") return typeof s.specialty === "string";
  return false;
}

export async function POST(req: Request) {
  const key = process.env.OPENROUTER_API_KEY;
  if (!key) return NextResponse.json({ unavailable: true, reason: "no-key" });

  let body: Body;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ unavailable: true, reason: "bad-request" });
  }

  const model = process.env.OPENROUTER_MODEL || "nvidia/nemotron-nano-9b-v2:free";
  const transcript = [
    body.seed ? `Patient first said: "${body.seed}"` : "Patient hasn't typed anything yet.",
    body.history?.length ? `Known history: ${body.history.join("; ")}.` : "No prior history.",
    ...(body.answers ?? []).map((a) => `Q: ${a.prompt}\nA: ${a.label}`),
    "Give the next step now (question or conclusion) as strict JSON.",
  ].join("\n");

  try {
    const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        temperature: 0.3,
        max_tokens: 500,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: SYSTEM },
          { role: "user", content: transcript },
        ],
      }),
      // Never let a slow model hang the UI.
      signal: AbortSignal.timeout(20_000),
    });

    if (!res.ok) return NextResponse.json({ unavailable: true, reason: `http-${res.status}` });
    const data = await res.json();
    const content: string = data?.choices?.[0]?.message?.content ?? "";
    const step = extractJson(content);
    if (!valid(step)) return NextResponse.json({ unavailable: true, reason: "bad-json" });

    // Normalise: ensure a stable id + option values.
    const s = step as Record<string, unknown>;
    if (s.kind === "question") {
      s.id = String(s.id ?? `ai-${(body.answers?.length ?? 0) + 1}`);
      s.options = (s.options as Record<string, unknown>[]).slice(0, 6).map((o, i) => ({
        value: String(o.value ?? `opt-${i}`),
        label: String(o.label ?? "Option"),
        emoji: o.emoji ? String(o.emoji) : undefined,
      }));
    }
    return NextResponse.json({ step: s, model });
  } catch (err) {
    console.error("diagnose failed:", err);
    return NextResponse.json({ unavailable: true, reason: "exception" });
  }
}
