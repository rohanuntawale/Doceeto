/**
 * The real health score.
 *
 * Four pillars, each worth 25, each computed only from things the app can
 * honestly measure. A pillar with NO data is EXCLUDED and the score
 * renormalises over what's known — the gauge then says "based on N of 4
 * areas" instead of quietly inventing points. With no body, lifestyle or
 * risk data at all there is no score, and the UI shows a "fill your health
 * profile" state rather than a flattering number.
 *
 *   Body       — BMI against Asian-Indian bands (ICMR 2022: 18.5 / 23 / 25).
 *   Lifestyle  — smoking, alcohol, daily activity.
 *   Risk       — the validated Indian Diabetes Risk Score (age, waist,
 *                activity, family history) plus diagnosed diabetes/BP.
 *   Events     — the last 90 days of actual care history: emergency
 *                consults, missed appointments, urgent symptom checks.
 *
 * This is a wellness indicator, not a diagnosis — the captions keep saying
 * so. Engagement (checkups booked, orders placed) deliberately earns nothing:
 * using the app is not the same as being well.
 */

import {
  ageFrom,
  bmiBand,
  bmiOf,
  type HealthProfile,
} from "@/lib/health/profile";

const DAY_MS = 24 * 3600 * 1000;

// ── Indian Diabetes Risk Score (Madras Diabetes Research Foundation) ──

export type IdrsBand = "low" | "moderate" | "high";

/**
 * The published IDRS scores four things — age (0/20/30), waist (0/10/20),
 * physical activity (0/10/20/30) and family history of diabetes (0/10/20) —
 * for a total of 0–100, banded <30 low, 30–59 moderate, ≥60 high.
 *
 * ── This app computes it from THREE ──
 *
 * The family-history question was removed from the health profile, so the
 * highest score anyone can now reach is 80, not 100.
 *
 * That matters more than it looks. Banding a partial score against the
 * published ABSOLUTE thresholds systematically UNDER-flags people: a
 * 55-year-old with a 38-inch waist who barely moves scores the maximum on
 * every question we still ask — 80 — and would clear "high" at 60, but
 * someone answering only two of the three can max out at 50 and never be
 * flagged at all, however bad their answers. For a screening tool, missing
 * someone at risk is the dangerous direction to fail in.
 *
 * So the band is taken from the PROPORTION of the achievable maximum, at the
 * same 60% / 30% cuts the published bands sit at. A person who scored the
 * worst possible answer to everything we asked is "high", whether we asked
 * three questions or four. The raw `score` is still returned for display, and
 * `max` says what it was out of — never show one without the other.
 */
export function idrsOf(
  p: HealthProfile,
): { score: number; max: number; band: IdrsBand } | undefined {
  const age = ageFrom(p.dob);
  if (age === undefined) return undefined;

  // Age is a precondition, so it is always in both the score and the maximum.
  let score = age < 35 ? 0 : age < 50 ? 20 : 30;
  let max = 30;

  if (p.waistCm !== undefined) {
    max += 20;
    const cuts = p.gender === "female" ? [80, 90] : [90, 100];
    score += p.waistCm < cuts[0] ? 0 : p.waistCm < cuts[1] ? 10 : 20;
  }
  if (p.activity) {
    max += 30;
    score += { vigorous: 0, moderate: 10, mild: 20, sedentary: 30 }[p.activity];
  }
  // Age alone is not a risk assessment, it is a birthday.
  if (max === 30) return undefined;

  const ratio = score / max;
  return { score, max, band: ratio >= 0.6 ? "high" : ratio >= 0.3 ? "moderate" : "low" };
}

// ── Pillars ──────────────────────────────────────────────────

export interface ScorePillar {
  key: "body" | "lifestyle" | "risk" | "events";
  label: string;
  /** Points earned, 0–25. */
  earned: number;
  /** Always 25 — kept explicit so the renormalising math reads honestly. */
  max: number;
  /** One plain sentence: what moved this pillar. */
  note: string;
}

export interface ScoreInputs {
  profile: HealthProfile;
  /** Epoch-ms of consults the patient took as emergencies ("I need care NOW"). */
  emergencyConsultTimes: number[];
  /** Epoch-ms of booked appointments the patient simply didn't complete. */
  missedAppointmentTimes: number[];
  /** Symptom-check conclusions: when they ran, and how urgent the answer was. */
  checkConclusions: { at: number; urgency: "emergency" | "urgent" | "routine" }[];
}

export interface RealHealthScore {
  /** 0–100, renormalised over the pillars that have data. */
  value: number;
  /** Pillars that COULD be computed; the breakdown the UI renders. */
  pillars: ScorePillar[];
  /** Of the four possible pillars, how many had data. */
  coverage: { known: number; total: number };
  caption: string;
  /** Change vs 7 days ago (events window shifting is the honest mover). */
  trend: number;
  /** The score recomputed at each of the last 7 days. */
  spark: number[];
  idrs?: { score: number; band: IdrsBand };
}

function bodyPillar(p: HealthProfile): ScorePillar | undefined {
  const bmi = bmiOf(p);
  if (bmi === undefined) return undefined;
  const band = bmiBand(bmi);
  const earned = { healthy: 25, overweight: 15, underweight: 12, obese: 6 }[band];
  const note = {
    healthy: `BMI ${bmi} sits in the healthy range for Indian adults.`,
    overweight: `BMI ${bmi} is above the healthy Indian range (23).`,
    underweight: `BMI ${bmi} is below the healthy range (18.5).`,
    obese: `BMI ${bmi} is in the obese range for Indian adults (25+).`,
  }[band];
  return { key: "body", label: "Body", earned, max: 25, note };
}

function lifestylePillar(p: HealthProfile): ScorePillar | undefined {
  // Each answered habit contributes its own slice; unanswered ones are left
  // out of the denominator instead of counting silently for or against.
  //
  // Smoking and alcohol used to sit here, worth 12 and 7 of the 19 points
  // before activity's 6. They were removed from the profile, so this pillar
  // now rests on activity alone — the normalisation below still scales it to
  // 25, so no score changes meaning, but the pillar is thinner than it reads.
  // If lifestyle is to carry a quarter of the score again, it needs another
  // input (sleep and diet are the obvious candidates).
  let earned = 0;
  let max = 0;
  const notes: string[] = [];

  if (p.activity) {
    max += 6;
    earned += { vigorous: 6, moderate: 6, mild: 3, sedentary: 0 }[p.activity];
    if (p.activity === "sedentary") notes.push("mostly sitting through the day");
    else if (p.activity === "vigorous" || p.activity === "moderate")
      notes.push("regular movement is helping");
  }
  if (max === 0) return undefined;

  return {
    key: "lifestyle",
    label: "Lifestyle",
    earned: Math.round((earned / max) * 25),
    max: 25,
    note: notes.length
      ? notes[0][0].toUpperCase() + notes[0].slice(1) + "."
      : "Habits look steady.",
  };
}

function riskPillar(p: HealthProfile): ScorePillar | undefined {
  const idrs = idrsOf(p);
  const hasFlags = p.diabetes !== undefined || p.hypertension !== undefined;
  if (!idrs && !hasFlags) return undefined;

  let earned = 25;
  const notes: string[] = [];
  if (idrs) {
    if (idrs.band === "high") {
      earned -= 12;
      notes.push("diabetes risk factors are high — worth a check-up");
    } else if (idrs.band === "moderate") {
      earned -= 6;
      notes.push("some diabetes risk factors are present");
    }
  }
  if (p.diabetes === "yes") {
    earned -= 5;
    notes.push("living with diabetes");
  }
  if (p.hypertension === "yes") {
    earned -= 5;
    notes.push("living with high blood pressure");
  }
  return {
    key: "risk",
    label: "Risk factors",
    earned: Math.max(0, earned),
    max: 25,
    note: notes.length
      ? notes[0][0].toUpperCase() + notes[0].slice(1) + "."
      : "No major risk factors on record.",
  };
}

function eventsPillarAt(inputs: ScoreInputs, at: number): ScorePillar {
  const within = (t: number, days: number) => t <= at && at - t <= days * DAY_MS;

  const emergencies = inputs.emergencyConsultTimes.filter((t) => within(t, 90)).length;
  const missed = inputs.missedAppointmentTimes.filter((t) => within(t, 90)).length;
  const urgentChecks = inputs.checkConclusions.filter(
    (c) => within(c.at, 30) && c.urgency !== "routine",
  );
  const emergencyChecks = urgentChecks.filter((c) => c.urgency === "emergency").length;

  let earned = 25;
  earned -= Math.min(16, emergencies * 8);
  earned -= Math.min(8, missed * 4);
  earned -= Math.min(8, emergencyChecks * 8 + (urgentChecks.length - emergencyChecks) * 4);
  earned = Math.max(0, earned);

  const note =
    emergencies > 0
      ? `${emergencies} emergency consult${emergencies > 1 ? "s" : ""} in the last 3 months.`
      : urgentChecks.length > 0
        ? "Recent symptom checks pointed at something urgent."
        : missed > 0
          ? `${missed} booked appointment${missed > 1 ? "s" : ""} missed recently.`
          : "No emergencies or urgent flags lately.";

  return { key: "events", label: "Recent health", earned, max: 25, note };
}

// ── The score ────────────────────────────────────────────────

function scoreValueAt(inputs: ScoreInputs, at: number): number | null {
  const informed = [
    bodyPillar(inputs.profile),
    lifestylePillar(inputs.profile),
    riskPillar(inputs.profile),
  ].filter((x): x is ScorePillar => Boolean(x));
  // Events alone can't carry a "health score" — an empty profile with a quiet
  // month is unknown, not healthy.
  if (informed.length === 0) return null;

  const pillars = [...informed, eventsPillarAt(inputs, at)];
  const earned = pillars.reduce((a, p) => a + p.earned, 0);
  const max = pillars.reduce((a, p) => a + p.max, 0);
  return Math.round((earned / max) * 100);
}

/**
 * Compute the score, or null when the profile is too empty to say anything —
 * the UI must then invite the patient to fill it in, never invent a number.
 */
export function realHealthScore(inputs: ScoreInputs, now = Date.now()): RealHealthScore | null {
  const informed = [
    bodyPillar(inputs.profile),
    lifestylePillar(inputs.profile),
    riskPillar(inputs.profile),
  ].filter((x): x is ScorePillar => Boolean(x));
  if (informed.length === 0) return null;

  const events = eventsPillarAt(inputs, now);
  const pillars = [...informed, events];
  const value = scoreValueAt(inputs, now)!;
  const weekAgo = scoreValueAt(inputs, now - 7 * DAY_MS) ?? value;
  const spark = Array.from(
    { length: 7 },
    (_, i) => scoreValueAt(inputs, now - (6 - i) * DAY_MS) ?? value,
  );

  // The caption speaks to the weakest pillar — the one worth acting on.
  const weakest = [...pillars].sort((a, b) => a.earned / a.max - b.earned / b.max)[0];
  const caption =
    value >= 75 && weakest.earned / weakest.max >= 0.6
      ? "Looking good — keep it up"
      : weakest.note;

  return {
    value,
    pillars,
    coverage: { known: pillars.length, total: 4 },
    caption,
    trend: value - weekAgo,
    spark,
    idrs: idrsOf(inputs.profile),
  };
}
