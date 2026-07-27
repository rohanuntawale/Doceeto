import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * AI symptom checker — the "brain" behind the Akinator-style flow. Given the
 * conversation so far (seed + chosen answers + the patient's history), it
 * returns the NEXT step: either one more question with fresh option chips, or
 * a final conclusion (bookable specialty + urgency + plain-language reasons).
 *
 * Uses OpenRouter (OPENROUTER_API_KEY, OPENROUTER_MODEL, OPENROUTER_FALLBACKS).
 * If no key is configured or the call fails, it responds { unavailable: true }
 * and the client falls back to the offline rule engine — so the checker always
 * works, and upgrades the moment a key is present.
 */

/** Must stay in sync with `Specialty` in lib/diagnose/engine.ts — the
 *  conclusion feeds a /patient/doctors?specialty=… link, so anything the model
 *  invents ("Cardiology", "Dermatology") would land on an empty results page. */
const SPECIALTIES = [
  "General Physician",
  "Cardiologist",
  "Gynecologist",
  "Pediatrician",
  "Orthopedic",
  "Dermatologist",
  "ENT",
  "Psychiatrist",
  "Neurologist",
] as const;

/** Hard cap on questions before we force a conclusion. Without it a chatty
 *  model will happily keep asking and the patient never reaches a booking. */
const MAX_QUESTIONS = 6;

const SYSTEM = `You are a careful medical triage assistant for an India-based on-demand doctor app.
Your job is NOT to diagnose. Your job is to ask ONE short question at a time with 3-5 concrete,
tappable options (like the game Akinator narrows down) and then recommend the RIGHT KIND of doctor.

Rules:
- Keep language simple; a first-time smartphone user in a small Indian city should understand it.
- Ask ONE question per turn. Options must be specific and mutually exclusive, each with a short label and an optional emoji.
- Never repeat a question that already appears in the transcript. Each question must narrow things down further.
- After 3-6 questions (or sooner if clear), STOP and give a conclusion.
- ALWAYS map to exactly one of these bookable specialties, spelled EXACTLY as written: ${SPECIALTIES.join(", ")}. Default to "General Physician".
- Use the patient's history to personalise. If a red-flag emergency is present (trouble breathing, chest pain to arm/jaw, stroke signs, heavy bleeding, unconscious, self-harm), immediately conclude with emergency=true and urgency="emergency".
- This app does NOT dispatch ambulances. For emergency=true, the advice must tell them to call their local emergency number or go to the nearest hospital — never reference an in-app SOS or alert.
- NEVER give a definitive diagnosis; "conditions" are gentle possibilities, not verdicts. Keep each condition under 6 words.

Respond with STRICT JSON only, no prose and no markdown fences, in ONE of these two shapes:
{"kind":"question","id":"<slug>","prompt":"<question>","hint":"<optional short hint>","options":[{"value":"<slug>","label":"<short>","emoji":"<optional>"}]}
{"kind":"conclusion","specialty":"<one of the list>","alt":"<optional second>","urgency":"routine|urgent|emergency","emergency":false,"conditions":["..."],"advice":"<one or two sentences>"}`;

interface Body {
  seed?: string;
  answers?: { prompt: string; label: string }[];
  history?: string[];
}

/** Pull the JSON object out of a reply that may be fenced or prefixed. */
function extractJson(text: string): unknown | null {
  const cleaned = text.replace(/```(?:json)?/gi, "").trim();
  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");
  if (start < 0 || end <= start) return null;
  try {
    return JSON.parse(cleaned.slice(start, end + 1));
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

/** Snap whatever the model wrote onto a specialty a doctor can be booked in. */
function normaliseSpecialty(raw: unknown): string | undefined {
  if (typeof raw !== "string" || !raw.trim()) return undefined;
  const t = raw.trim().toLowerCase();
  const exact = SPECIALTIES.find((s) => s.toLowerCase() === t);
  if (exact) return exact;
  if (/cardio|heart/.test(t)) return "Cardiologist";
  if (/gyn|obstet|women/.test(t)) return "Gynecologist";
  if (/p(a)?ediatric|child/.test(t)) return "Pediatrician";
  if (/ortho|bone|joint/.test(t)) return "Orthopedic";
  if (/derma|skin/.test(t)) return "Dermatologist";
  if (/ent\b|otolaryng|ear|nose|throat/.test(t)) return "ENT";
  if (/psych|mental/.test(t)) return "Psychiatrist";
  if (/neuro|brain|nerve/.test(t)) return "Neurologist";
  return "General Physician";
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

  const model = process.env.OPENROUTER_MODEL || "nvidia/nemotron-3-ultra-550b-a55b";
  const fallbacks = (process.env.OPENROUTER_FALLBACKS ?? "")
    .split(",")
    .map((m) => m.trim())
    .filter(Boolean);

  const asked = body.answers?.length ?? 0;
  const transcript = [
    body.seed ? `Patient first said: "${body.seed}"` : "Patient hasn't typed anything yet.",
    body.history?.length ? `Known history: ${body.history.join("; ")}.` : "No prior history.",
    ...(body.answers ?? []).map((a) => `Q: ${a.prompt}\nA: ${a.label}`),
    asked >= MAX_QUESTIONS
      ? "You have asked enough. Give the CONCLUSION now as strict JSON — do not ask another question."
      : "Give the next step now (question or conclusion) as strict JSON.",
  ].join("\n");

  try {
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
        temperature: 0.3,
        // Nemotron 3 is a reasoning model: leave room for thinking tokens so
        // the JSON body isn't cut off mid-object.
        max_tokens: 1200,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: SYSTEM },
          { role: "user", content: transcript },
        ],
      }),
      // Never let a slow model hang the UI.
      signal: AbortSignal.timeout(25_000),
    });

    if (!res.ok) {
      console.error("diagnose upstream:", res.status, await res.text().catch(() => ""));
      return NextResponse.json({ unavailable: true, reason: `http-${res.status}` });
    }
    const data = await res.json();
    const content: string = data?.choices?.[0]?.message?.content ?? "";
    const step = extractJson(content);
    if (!valid(step)) return NextResponse.json({ unavailable: true, reason: "bad-json" });

    const s = step as Record<string, unknown>;
    if (s.kind === "question") {
      // Past the cap the model ignored the instruction — let the client's rule
      // engine close the session out rather than looping forever.
      if (asked >= MAX_QUESTIONS)
        return NextResponse.json({ unavailable: true, reason: "max-questions" });
      // Normalise: ensure a stable id + option values.
      s.id = String(s.id ?? `ai-${asked + 1}`);
      s.options = (s.options as Record<string, unknown>[]).slice(0, 6).map((o, i) => ({
        value: String(o.value ?? `opt-${i}`),
        label: String(o.label ?? "Option"),
        emoji: o.emoji ? String(o.emoji) : undefined,
      }));
    } else {
      s.specialty = normaliseSpecialty(s.specialty) ?? "General Physician";
      const alt = normaliseSpecialty(s.alt);
      if (alt && alt !== s.specialty) s.alt = alt;
      else delete s.alt;
      if (s.emergency === true) s.urgency = "emergency";
    }
    // `data.model` is what actually served it (may be a fallback, not `model`).
    return NextResponse.json({ step: s, model: data?.model ?? model });
  } catch (err) {
    console.error("diagnose failed:", err);
    return NextResponse.json({ unavailable: true, reason: "exception" });
  }
}
