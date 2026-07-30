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
You do TWO things: narrow down what might be going on, then route the patient to the right doctor(s).

Ask ONE short question at a time with 3-5 concrete, tappable options (like the game Akinator narrows
down). Then STOP and give a conclusion containing a DIFFERENTIAL — a short ranked list of what could
be causing this, each mapped to the specialty that treats it.

Question rules:
- Keep language simple; a first-time smartphone user in a small Indian city should understand it.
- Ask ONE question per turn. Options must be specific and mutually exclusive, each with a short label and an optional emoji.
- Never repeat a question that already appears in the transcript. Each question must narrow things down further.
- Prefer questions that SEPARATE competing causes (e.g. for back pain, ask whether pain shoots down a
  leg — that splits a muscle strain from a pinched nerve). A question that cannot change the answer is wasted.
- After 3-6 questions (or sooner if clear), STOP and conclude.

Conclusion rules — the differential is the point:
- "causes" must hold 2-4 entries, most likely FIRST. A single-entry differential is only acceptable when the
  cause is genuinely unambiguous (e.g. routine pregnancy care).
- Each cause needs: "name" (plain language, under 8 words, phrased as a possibility and NEVER as a settled
  diagnosis), "likelihood" (exactly one of "likely", "possible", "less-likely"), "why" (ONE short sentence
  explaining what in their answers points here), and "specialty".
- Write cause names in EVERYDAY WORDS, not medical jargon. Say "slipped disc pressing on a nerve", NOT
  "lumbar disc herniation". Say "narrowed spinal canal", NOT "spinal stenosis". Say "low vitamin B12",
  NOT "cobalamin deficiency". If a technical term is unavoidable, put the plain phrase first.
- If "advice" recommends another kind of doctor beyond the causes (e.g. suggesting a Gynecologist for heavy
  bleeding), spell that specialty EXACTLY as it appears in the list — the app turns it into a booking button.
- Causes should span DIFFERENT specialties when the symptom genuinely could sit with more than one. Bone pain
  can be orthopaedic OR a nerve problem; chest tightness can be cardiac OR reflux. Show that.
- Include a cheap, common, easily-missed cause where relevant (low haemoglobin, thyroid, vitamin D or B12
  deficiency) rather than only the dramatic ones.
- "summary" is one or two plain sentences naming the leading possibility and noting it needs a doctor to confirm.
- "specialty" is the top-level booking recommendation and MUST equal the specialty of the FIRST cause.
- Every "specialty" and "alt" must be spelled EXACTLY as one of: ${SPECIALTIES.join(", ")}. Default to "General Physician".
- Use the patient's history to personalise. If a red-flag emergency is present (trouble breathing, chest pain to
  arm/jaw, stroke signs, heavy bleeding, unconscious, self-harm), immediately conclude with emergency=true and urgency="emergency".
- This app does NOT dispatch ambulances. For emergency=true, the advice must tell them to call their local emergency
  number or go to the nearest hospital — never reference an in-app SOS or alert.
- NEVER give a definitive diagnosis. These are possibilities to be checked, not verdicts.

Respond with STRICT JSON only, no prose and no markdown fences, in ONE of these two shapes:
{"kind":"question","id":"<slug>","prompt":"<question>","hint":"<optional short hint>","options":[{"value":"<slug>","label":"<short>","emoji":"<optional>"}]}
{"kind":"conclusion","summary":"<one or two sentences>","causes":[{"name":"<possibility>","likelihood":"likely|possible|less-likely","why":"<one sentence>","specialty":"<one of the list>"}],"specialty":"<same as first cause>","alt":"<optional second>","urgency":"routine|urgent|emergency","emergency":false,"advice":"<one or two sentences>"}`;

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

const LIKELIHOODS = ["likely", "possible", "less-likely"] as const;

/** Coerce the model's differential into the shape the UI renders. Anything
 *  unusable is dropped rather than passed through — a cause without a bookable
 *  specialty would render a dead "Find a …" button. */
function normaliseCauses(raw: unknown): { name: string; likelihood: string; why?: string; specialty: string }[] {
  if (!Array.isArray(raw)) return [];
  const out: { name: string; likelihood: string; why?: string; specialty: string }[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const c = item as Record<string, unknown>;
    const name = typeof c.name === "string" ? c.name.trim() : "";
    if (!name) continue;
    if (out.some((x) => x.name.toLowerCase() === name.toLowerCase())) continue;
    const lik = String(c.likelihood ?? "").toLowerCase().replace(/\s+/g, "-");
    out.push({
      name,
      likelihood: (LIKELIHOODS as readonly string[]).includes(lik) ? lik : "possible",
      why: typeof c.why === "string" && c.why.trim() ? c.why.trim() : undefined,
      specialty: normaliseSpecialty(c.specialty) ?? "General Physician",
    });
    if (out.length >= 4) break;
  }
  return out;
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
      const causes = normaliseCauses(s.causes);
      s.causes = causes;
      // The headline doctor must be the one who treats the leading cause, or
      // the card recommends a specialty none of the listed causes point at.
      s.specialty = causes[0]?.specialty ?? normaliseSpecialty(s.specialty) ?? "General Physician";
      // `alt` has to come from the differential once we have one. The model
      // otherwise names a second doctor no cause supports (a back-pain case
      // returned alt="Neurologist" with three Orthopedic causes), and the UI
      // builds its booking buttons from the causes — so that alt was a doctor
      // the patient was told about but could not book.
      const alt = causes.length
        ? causes.find((c) => c.specialty !== s.specialty)?.specialty
        : normaliseSpecialty(s.alt);
      if (alt && alt !== s.specialty) s.alt = alt;
      else delete s.alt;
      // The model often gives genuinely useful side-advice ("a Gynecologist can
      // help manage the heavy bleeding") for a specialty no cause names. Rather
      // than suppress that, surface it so the UI can offer a button — advice the
      // patient can't act on is worse than advice that widens the options.
      const named = new Set([s.specialty as string, ...causes.map((c) => c.specialty)]);
      const advice = typeof s.advice === "string" ? s.advice : "";
      s.alsoSee = SPECIALTIES.filter(
        (sp) => !named.has(sp) && new RegExp(`\\b${sp}\\b`, "i").test(advice),
      );
      // `conditions` is still what history priors read, so keep it populated
      // from the differential for older consumers.
      if (!Array.isArray(s.conditions) || s.conditions.length === 0)
        s.conditions = causes.map((c) => c.name);
      if (s.emergency === true) s.urgency = "emergency";
    }
    // `data.model` is what actually served it (may be a fallback, not `model`).
    return NextResponse.json({ step: s, model: data?.model ?? model });
  } catch (err) {
    console.error("diagnose failed:", err);
    return NextResponse.json({ unavailable: true, reason: "exception" });
  }
}
