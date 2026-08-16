import { NextResponse } from "next/server";
import { getRequestSession } from "@/lib/auth/session";
import { ageFrom, bmiBand, bmiOf, sanitizeHealthProfile } from "@/lib/health/profile";
import { rateLimit, tooMany } from "@/lib/server/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30; // one model call

/**
 * A short, personal suggestion when the patient's BMI sits outside the healthy
 * range — surfaced as a notification on their dashboard.
 *
 * Same posture as the symptom checker: OpenRouter when a key is configured,
 * a sensible built-in line when not, so the feature never breaks. The reply is
 * a gentle nudge, not a diagnosis — the system prompt keeps it that way.
 */

const SYSTEM = `You write ONE short health nudge (2-3 sentences, under 60 words) for a patient of an
India-based doctor-on-demand app, based on their BMI and profile.

Rules:
- Warm, encouraging, plain language a first-time smartphone user understands. No jargon, no lecturing.
- Give one or two SPECIFIC, everyday actions (food, movement, sleep) appropriate to Indian daily life.
- If underweight, suggest gaining gently and checking for causes; if overweight/obese, suggest small
  sustainable changes. Mention that their doctor on this app can help with a plan.
- NEVER diagnose, never mention medication, never promise outcomes, never shame.
- Respond with STRICT JSON only: {"tip":"<the suggestion>"}`;

const FALLBACK: Record<string, string> = {
  underweight:
    "Your BMI is a little below the healthy range. Try adding an extra wholesome snack to your day, a banana, nuts, or a glass of milk, and if your weight has been dropping without trying, a quick chat with a doctor here can help find out why.",
  overweight:
    "Your BMI is a little above the healthy range. Small steps count: a 20–30 minute walk most days and going easy on fried snacks and sugary drinks can make a real difference. A doctor on Doceeto can help you build a simple plan.",
  obese:
    "Your BMI is in a range where your heart, joints and sugar levels deserve extra care. Start small, daily walks and lighter dinners, and consider booking a consult here; a doctor can guide you with a plan that fits your routine.",
  extremelyObese:
    "Your BMI is in a range where extra support can help protect your heart, joints and sugar levels. A doctor on Doceeto can help you make a safe, gradual plan that fits your routine.",
};

export async function POST(req: Request) {
  const session = await getRequestSession(req);
  if (!session || session.role !== "patient") {
    return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  }
  // One tip per band change is all the client asks for; this cap is a backstop.
  if (!rateLimit(`health-tip:${session.userId}`, 10, 60 * 60_000)) return tooMany();

  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    raw = {};
  }
  // Reuse the profile sanitizer: the tip inputs are a subset of the profile.
  const p = sanitizeHealthProfile(raw);
  const bmi = bmiOf(p);
  if (!bmi) return NextResponse.json({ error: "Height and weight needed." }, { status: 400 });
  const band = bmiBand(bmi);
  if (band === "healthy") return NextResponse.json({ tip: null, band, bmi });

  const key = process.env.OPENROUTER_API_KEY;
  if (key) {
    try {
      const age = ageFrom(p.dob);
      const profileLine = [
        `BMI ${bmi} (${band})`,
        p.heightCm && `height ${p.heightCm} cm`,
        p.weightKg && `weight ${p.weightKg} kg`,
        age && `age ${age}`,
        p.gender && `gender ${p.gender}`,
        p.conditions && `known conditions: ${p.conditions}`,
      ]
        .filter(Boolean)
        .join(", ");

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
          "HTTP-Referer": process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000",
          "X-Title": "Doceeto Health Tips",
        },
        body: JSON.stringify({
          model,
          ...(fallbacks.length ? { models: [model, ...fallbacks] } : {}),
          temperature: 0.5,
          max_tokens: 400,
          response_format: { type: "json_object" },
          messages: [
            { role: "system", content: SYSTEM },
            { role: "user", content: `Patient: ${profileLine}. Write the nudge now as strict JSON.` },
          ],
        }),
        cache: "no-store",
      });
      if (res.ok) {
        const body = (await res.json()) as {
          choices?: { message?: { content?: string } }[];
        };
        const text = body.choices?.[0]?.message?.content ?? "";
        const start = text.indexOf("{");
        const end = text.lastIndexOf("}");
        if (start >= 0 && end > start) {
          const parsed = JSON.parse(text.slice(start, end + 1)) as { tip?: unknown };
          const tip = typeof parsed.tip === "string" ? parsed.tip.trim().slice(0, 500) : "";
          if (tip) return NextResponse.json({ tip, band, bmi, ai: true });
        }
      }
    } catch {
      // fall through to the built-in line
    }
  }

  return NextResponse.json({ tip: FALLBACK[band], band, bmi, ai: false });
}
