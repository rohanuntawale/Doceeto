/**
 * The patient health profile — the basics any care app should hold, and what a
 * doctor reads before walking into a consult: body measurements, blood group,
 * allergies, ongoing conditions and medication, past surgeries, family history,
 * lifestyle, and who to call if something goes wrong.
 *
 * Pure and dependency-free: shared by the account form (client), the API route
 * that persists it (server), and the doctor's patient-brief view.
 */

export interface HealthProfile {
  /** Height in centimetres. */
  heightCm?: number;
  /** Weight in kilograms. */
  weightKg?: number;
  /** Waist in centimetres — with age, activity and family history it forms
   *  the validated Indian Diabetes Risk Score (IDRS). */
  waistCm?: number;
  /** Date of birth, "YYYY-MM-DD" — age is derived, never stored. */
  dob?: string;
  gender?: "female" | "male" | "other";
  bloodGroup?: (typeof BLOOD_GROUPS)[number];
  /** Day-to-day movement, IDRS's four grades. */
  activity?: (typeof ACTIVITY_CHOICES)[number];
  /** Diagnosed diabetes — "no" is an answer, undefined means never asked. */
  diabetes?: "yes" | "no";
  /** Diagnosed high blood pressure. */
  hypertension?: "yes" | "no";
  /** Diabetes among parents, graded the way IDRS grades it. */
  familyDiabetes?: (typeof FAMILY_DIABETES_CHOICES)[number];
  /** Free text, comma-separated where it helps: "penicillin, peanuts". */
  allergies?: string;
  /** Ongoing conditions: "type 2 diabetes, high blood pressure". */
  conditions?: string;
  /** Current medication, with doses where known. */
  medications?: string;
  /** Past surgeries / hospitalisations, roughly dated. */
  surgeries?: string;
  /** Conditions that run in the family. */
  familyHistory?: string;
  smoking?: "never" | "former" | "current";
  alcohol?: "never" | "occasional" | "regular";
  emergencyContactName?: string;
  emergencyContactPhone?: string;
  /** ISO — stamped by the server on every save. */
  updatedAt?: string;
}

export const BLOOD_GROUPS = ["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"] as const;
export const SMOKING_CHOICES = ["never", "former", "current"] as const;
export const ALCOHOL_CHOICES = ["never", "occasional", "regular"] as const;
export const ACTIVITY_CHOICES = ["vigorous", "moderate", "mild", "sedentary"] as const;
export const FAMILY_DIABETES_CHOICES = ["none", "one-parent", "both-parents"] as const;

export const ACTIVITY_LABEL: Record<(typeof ACTIVITY_CHOICES)[number], string> = {
  vigorous: "Heavy exercise or physical work",
  moderate: "Regular exercise or brisk walks",
  mild: "Light activity now and then",
  sedentary: "Mostly sitting",
};

export const FAMILY_DIABETES_LABEL: Record<(typeof FAMILY_DIABETES_CHOICES)[number], string> = {
  none: "No parent",
  "one-parent": "One parent",
  "both-parents": "Both parents",
};

const oneOf = <T extends readonly string[]>(list: T, v: unknown): T[number] | undefined =>
  typeof v === "string" && (list as readonly string[]).includes(v) ? (v as T[number]) : undefined;

const text = (v: unknown, cap: number): string | undefined => {
  if (typeof v !== "string") return undefined;
  const t = v.trim().slice(0, cap);
  return t || undefined;
};

const bounded = (v: unknown, min: number, max: number): number | undefined => {
  const n = Number(v);
  if (!Number.isFinite(n) || n < min || n > max) return undefined;
  return Math.round(n * 10) / 10;
};

/**
 * Allowlist + bound every field. Anything out of range is DROPPED, not
 * clamped — a typo'd 1750 cm height must not silently become a stored "250".
 */
export function sanitizeHealthProfile(raw: unknown): HealthProfile {
  const p = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const out: HealthProfile = {
    heightCm: bounded(p.heightCm, 50, 250),
    weightKg: bounded(p.weightKg, 2, 400),
    waistCm: bounded(p.waistCm, 40, 200),
    gender: oneOf(["female", "male", "other"] as const, p.gender),
    bloodGroup: oneOf(BLOOD_GROUPS, p.bloodGroup),
    activity: oneOf(ACTIVITY_CHOICES, p.activity),
    diabetes: oneOf(["yes", "no"] as const, p.diabetes),
    hypertension: oneOf(["yes", "no"] as const, p.hypertension),
    familyDiabetes: oneOf(FAMILY_DIABETES_CHOICES, p.familyDiabetes),
    allergies: text(p.allergies, 300),
    conditions: text(p.conditions, 500),
    medications: text(p.medications, 500),
    surgeries: text(p.surgeries, 500),
    familyHistory: text(p.familyHistory, 500),
    smoking: oneOf(SMOKING_CHOICES, p.smoking),
    alcohol: oneOf(ALCOHOL_CHOICES, p.alcohol),
    emergencyContactName: text(p.emergencyContactName, 80),
    emergencyContactPhone: text(p.emergencyContactPhone, 20),
  };
  // DOB: a real date, in the past, for a person under 120.
  const dob = text(p.dob, 10);
  if (dob && /^\d{4}-\d{2}-\d{2}$/.test(dob)) {
    const t = Date.parse(dob);
    const age = (Date.now() - t) / (365.25 * 24 * 3600 * 1000);
    if (Number.isFinite(t) && age > 0 && age < 120) out.dob = dob;
  }
  return out;
}

/** Whole-year age from the stored date of birth. */
export function ageFrom(dob?: string): number | undefined {
  if (!dob) return undefined;
  const t = Date.parse(dob);
  if (!Number.isFinite(t)) return undefined;
  const age = Math.floor((Date.now() - t) / (365.25 * 24 * 3600 * 1000));
  return age >= 0 && age < 120 ? age : undefined;
}

// ── BMI ──────────────────────────────────────────────────────

export type BmiBand = "underweight" | "healthy" | "overweight" | "obese";

/** kg / m², one decimal — undefined until both measurements exist. */
export function bmiOf(p: Pick<HealthProfile, "heightCm" | "weightKg">): number | undefined {
  if (!p.heightCm || !p.weightKg) return undefined;
  const m = p.heightCm / 100;
  return Math.round((p.weightKg / (m * m)) * 10) / 10;
}

/**
 * Asian-Indian cut-offs (ICMR 2022 consensus): overweight from 23, obese from
 * 25 — NOT the Western 25/30. Indians develop diabetes and heart disease at
 * markedly lower BMI, so Western bands under-warn the entire audience of this
 * app. This is the one place the bands live; everything reads through here.
 */
export function bmiBand(bmi: number): BmiBand {
  if (bmi < 18.5) return "underweight";
  if (bmi < 23) return "healthy";
  if (bmi < 25) return "overweight";
  return "obese";
}

export const BMI_BAND_LABEL: Record<BmiBand, string> = {
  underweight: "Underweight",
  healthy: "Healthy range",
  overweight: "Overweight",
  obese: "Obese range",
};

/** How filled-in the profile is, 0–100 — drives the account page nudge. */
export function healthProfileCompletion(p: HealthProfile | undefined): number {
  if (!p) return 0;
  const fields: (keyof HealthProfile)[] = [
    "heightCm", "weightKg", "waistCm", "dob", "gender", "bloodGroup",
    "activity", "diabetes", "hypertension", "familyDiabetes", "allergies",
    "conditions", "medications", "smoking", "alcohol",
    "emergencyContactName", "emergencyContactPhone",
  ];
  const filled = fields.filter((k) => p[k] !== undefined && p[k] !== "").length;
  return Math.round((filled / fields.length) * 100);
}
