import { NextResponse } from "next/server";
import { getRequestSession } from "@/lib/auth/session";
import { db } from "@/lib/db";
import {
  ageFrom,
  bmiOf,
  bmiBand,
  BMI_BAND_LABEL,
  ACTIVITY_LABEL,
  type HealthProfile,
} from "@/lib/health/profile";
import { idrsOf } from "@/lib/health/score";
import { NURSE_SERVICES } from "@/lib/nurse";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * AI symptom checker — the "brain" behind the Akinator-style flow. Given the
 * conversation so far (seed + chosen answers + the patient's history), it
 * returns the NEXT step: either one more question with fresh option chips, or
 * a final conclusion (bookable specialty + urgency + plain-language reasons).
 *
 * PERSONALISED: the signed-in patient's health profile (age, BMI, blood
 * pressure, diabetes, medication, allergies, family history, lifestyle) is
 * loaded server-side from their session and woven into the triage, so a
 * hypertensive 55-year-old asking about chest pain is treated as exactly that
 * person — not as a generic patient. Loaded HERE, never sent by the browser,
 * so it can't be spoofed and never rides through client code.
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

/**
 * The patient's health record, flattened into plain lines the model can use.
 * Only facts that are actually on file are included — an empty profile
 * produces an empty block, and the prompt tells the model how to behave in
 * both cases. Derived numbers (age, BMI, diabetes-risk band) are computed
 * here so the model never does arithmetic.
 */
function profileBlock(p: HealthProfile | undefined, gender?: string): string {
  if (!p) return "";
  const lines: string[] = [];
  const age = ageFrom(p.dob);
  const sex = p.gender ?? gender;
  if (age || sex) lines.push(`- ${[age ? `Age ${age}` : null, sex].filter(Boolean).join(", ")}`);
  const bmi = bmiOf(p);
  if (bmi) {
    const band = BMI_BAND_LABEL[bmiBand(bmi)];
    lines.push(
      `- BMI ${bmi.toFixed(1)} (${band})${p.heightCm ? ` — ${p.heightCm} cm` : ""}${p.weightKg ? `, ${p.weightKg} kg` : ""}`,
    );
  }
  if (p.waistCm) lines.push(`- Waist ${p.waistCm} cm`);
  if (p.hypertension === "yes") lines.push("- DIAGNOSED high blood pressure (hypertension)");
  if (p.diabetes === "yes") lines.push("- DIAGNOSED diabetes");
  const idrs = idrsOf(p);
  if (p.diabetes !== "yes" && idrs && idrs.band !== "low")
    lines.push(`- Diabetes risk (IDRS): ${idrs.band}`);
  if (p.conditions?.trim()) lines.push(`- Ongoing conditions: ${p.conditions.trim()}`);
  if (p.medications?.trim()) lines.push(`- Current medication: ${p.medications.trim()}`);
  if (p.allergies?.trim()) lines.push(`- Allergies: ${p.allergies.trim()}`);
  if (p.surgeries?.trim()) lines.push(`- Past surgeries: ${p.surgeries.trim()}`);
  if (p.familyHistory?.trim()) lines.push(`- Family history: ${p.familyHistory.trim()}`);
  if (p.familyDiabetes && p.familyDiabetes !== "none")
    lines.push(`- Diabetes in ${p.familyDiabetes === "both-parents" ? "both parents" : "one parent"}`);
  if (p.smoking && p.smoking !== "never") lines.push(`- Smoking: ${p.smoking}`);
  if (p.alcohol && p.alcohol !== "never") lines.push(`- Alcohol: ${p.alcohol}`);
  if (p.activity) lines.push(`- Activity level: ${ACTIVITY_LABEL[p.activity] ?? p.activity}`);
  if (p.bloodGroup) lines.push(`- Blood group: ${p.bloodGroup}`);
  return lines.join("\n");
}

const SYSTEM = `You are a careful medical triage assistant for an India-based on-demand doctor app.
You do TWO things: narrow down what might be going on, then route the patient to the right doctor(s).

Ask ONE short question at a time with 3-5 concrete, tappable options (like the game Akinator narrows
down). Then STOP and give a conclusion containing a DIFFERENTIAL — a short ranked list of what could
be causing this, each mapped to the specialty that treats it.

PERSONALISATION — the most important rule set. When a PATIENT PROFILE block is present, this
patient is a specific person you already know, and every turn must show it:
- Their profile CHANGES THE MEDICINE. Chest pain in someone with diagnosed high blood pressure is a
  different differential (cardiac causes rank higher, urgency rises) than the same words from a fit
  25-year-old. Numbness with diabetes suggests diabetic nerve damage. Knee pain at BMI 32 has weight
  as a named contributor. A smoker's chronic cough is not treated like a non-smoker's. Family history
  of heart disease compounds cardiac risk. USE all of this when ranking causes and setting urgency.
- Their MEDICATION matters: a symptom can be a side effect (dizziness on BP tablets, cough on some BP
  medicines, stomach pain with painkillers). When plausible, include it as a cause. Never tell them to
  stop a medicine — say a doctor should review it.
- Never suggest anything their ALLERGIES list rules out.
- NEVER ask what the profile already answers — their age, sex, whether they have BP or diabetes,
  what they take, whether they smoke. Asking reads as not knowing them. Build on it instead:
  "Since you're on blood-pressure medication, does the dizziness come when you stand up?"
- SPEAK to them personally, in second person, naming their specifics: "given your blood pressure",
  "at your BMI of 31", "since your father had heart disease". The "why" of each cause and the summary
  should read like it was written about THIS person, because it was. Warm and plain, never clinical
  or generic; never lecture about lifestyle beyond one practical, relevant nudge.
- The profile INFORMS but never overrides what they report now. New symptoms always win over history.
If there is NO profile block, triage normally and do not invent facts about them.

BEFORE ANY TRIAGE — is there actually a symptom yet? If the patient's messages so far carry NO
current health complaint (a greeting like "hello"/"hi"/"namaste", small talk, a test message,
gibberish, or a question about the app), do NOT start triage. Ask ONE warm, open question — e.g.
"Hi! What's troubling you today?" — with broad body-area options (fever/whole body, chest or
breathing, stomach, head, skin, bones or joints, mood or sleep). NEVER use their history or health
profile to guess a complaint they have not made TODAY: an old "bleeding" or "chest pain" session is
a closed episode, and asking about it out of nowhere is wrong and alarming. History and profile
exist to RANK and personalise a complaint the patient has actually raised in THIS conversation —
never to invent one.

Question rules:
- Keep language simple; a first-time smartphone user in a small Indian city should understand it.
- Ask ONE question per turn. Options must be specific and mutually exclusive, each with a short label and an optional emoji.
- Never repeat a question that already appears in the transcript. Each question must narrow things down further.
- Prefer questions that SEPARATE competing causes (e.g. for back pain, ask whether pain shoots down a
  leg — that splits a muscle strain from a pinched nerve). A question that cannot change the answer is wasted.
- With a profile present, prefer the question their risk factors make most valuable — for chest
  symptoms with hypertension, ask the cardiac separators (exertion? spreading? sweating?) FIRST.
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

NURSE ROUTING — a strict, narrow rule. The app also has home-visit nurses, but they do practical
hands-on care ONLY. Add "nurseService" to a conclusion ONLY when what the patient needs is one of
these tasks, spelled exactly:
- "wound_dressing"            → cleaning/dressing a minor cut, scratch, wound, or post-surgery dressing changes
- "injection_iv"              → giving an injection or IV a doctor has ALREADY prescribed
- "vitals_sample_collection"  → measuring BP/sugar/vitals or collecting a lab sample at home
- "elderly_bedridden"         → day-to-day care of an elderly or bedridden person
When you set it, also set "nurseWhy": one warm sentence on why a home nurse fits this, personalised.
NEVER set nurseService when the problem needs diagnosing — fever, pain of unknown cause, infection,
chest/breathing trouble, anything urgent or emergency. Nurses do not diagnose or prescribe. When in
doubt, leave it out. "specialty" must STILL name the right doctor either way — for a simple wound
that's usually "General Physician"; the nurse is an ADDITIONAL practical option, never a replacement.
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
{"kind":"conclusion","summary":"<one or two sentences>","causes":[{"name":"<possibility>","likelihood":"likely|possible|less-likely","why":"<one sentence>","specialty":"<one of the list>"}],"specialty":"<same as first cause>","alt":"<optional second>","urgency":"routine|urgent|emergency","emergency":false,"advice":"<one or two sentences>","nurseService":"<optional, one of wound_dressing|injection_iv|vitals_sample_collection|elderly_bedridden>","nurseWhy":"<required when nurseService is set>"}`;

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

  // The health record comes from the SESSION, never the request body — the
  // browser cannot claim to be someone else or pad the profile. Absent (signed
  // out, provider role, or an empty profile) the checker degrades to generic
  // triage exactly as before.
  let profile = "";
  let patientName = "";
  try {
    const session = await getRequestSession(req);
    if (session?.role === "patient") {
      const p = await db.getPatientProfile(session.userId);
      profile = profileBlock(p?.healthProfile, undefined);
      patientName = (session.name ?? "").split(" ")[0] ?? "";
    }
  } catch (err) {
    // A profile failure must never take the checker down with it.
    console.error("diagnose: profile load failed:", err);
  }

  const asked = body.answers?.length ?? 0;
  const transcript = [
    profile
      ? `PATIENT PROFILE (their own health record — personalise with it):\n${
          patientName ? `- Name: ${patientName}\n` : ""
        }${profile}`
      : "No health profile on file for this patient.",
    body.seed ? `\nPatient first said: "${body.seed}"` : "\nPatient hasn't typed anything yet.",
    body.history?.length
      ? `Past symptom checks (CLOSED episodes — context for ranking only, the patient has NOT raised these today): ${body.history.join("; ")}.`
      : "No past symptom checks.",
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
      // Nurse routing is enforced HERE, not just in the prompt: only known
      // service ids pass, never on urgent/emergency conclusions (a nurse is
      // not an escalation path), and the card text must exist. Anything else
      // the model invents is dropped.
      const nurseService = typeof s.nurseService === "string" ? s.nurseService : "";
      if (
        NURSE_SERVICES.some((x) => x.id === nurseService) &&
        s.urgency === "routine" &&
        s.emergency !== true
      ) {
        s.nurseService = nurseService;
        s.nurseWhy =
          typeof s.nurseWhy === "string" && s.nurseWhy.trim()
            ? s.nurseWhy.trim().slice(0, 240)
            : "A home-visit nurse can take care of this at your place.";
      } else {
        delete s.nurseService;
        delete s.nurseWhy;
      }
    }
    // `data.model` is what actually served it (may be a fallback, not `model`).
    // `personalised` lets the UI say the answer used their health record.
    return NextResponse.json({ step: s, model: data?.model ?? model, personalised: Boolean(profile) });
  } catch (err) {
    console.error("diagnose failed:", err);
    return NextResponse.json({ unavailable: true, reason: "exception" });
  }
}
