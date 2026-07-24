/**
 * Symptom triage — a fast, deterministic keyword engine (no network, no
 * latency) that maps free-text symptoms to a likely specialty, a plain-
 * language read of what might be happening, an urgency level, and — most
 * importantly for a platform built around emergencies — red-flag
 * detection that tells the patient to hit SOS.
 *
 * It maps ONLY to specialties a doctor can register with, defaulting to
 * a General Physician, so every suggestion is bookable.
 */
import type { SosCategory } from "@/lib/types/domain";

export type Urgency = "emergency" | "urgent" | "routine";

export interface TriageResult {
  urgency: Urgency;
  /** Ranked, bookable specialties (most-likely first). */
  specialties: string[];
  /** Plain-language possibilities — NOT a diagnosis. */
  conditions: string[];
  advice: string;
  /** Matched emergency signals, if any. */
  redFlags: string[];
  /** Best SOS category when this is an emergency. */
  sosCategory?: SosCategory;
}

interface Rule {
  test: RegExp;
  specialty: string;
  conditions: string[];
  urgency: Urgency;
}

// Ordered most-specific → least. First matches rank first.
const RULES: Rule[] = [
  {
    test: /chest pain|palpitation|heart racing|cardiac|tightness in (the )?chest|angina/,
    specialty: "Cardiologist",
    conditions: ["Possible heart-related problem"],
    urgency: "urgent",
  },
  {
    test: /pregnan|in labour|labor pain|period|menstru|vaginal|gynae|pcos|pcod|miscarriage/,
    specialty: "Gynecologist",
    conditions: ["Gynaecological / pregnancy-related concern"],
    urgency: "routine",
  },
  {
    test: /\b(child|baby|infant|toddler|kid|my son|my daughter|newborn)\b/,
    specialty: "Pediatrician",
    conditions: ["Child health concern"],
    urgency: "routine",
  },
  {
    test: /fracture|broken bone|dislocat|sprain|joint pain|knee|back pain|shoulder|swollen (ankle|wrist)|bone/,
    specialty: "Orthopedic",
    conditions: ["Bone / joint / muscle problem"],
    urgency: "routine",
  },
  {
    test: /rash|itch|acne|pimple|eczema|hives|mole|skin|psorias|fungal/,
    specialty: "Dermatologist",
    conditions: ["Skin condition"],
    urgency: "routine",
  },
  {
    test: /\b(ear|hearing|sinus|tonsil|nosebleed|nose bleed)\b|sore throat|throat pain/,
    specialty: "ENT",
    conditions: ["Ear / nose / throat issue"],
    urgency: "routine",
  },
  {
    test: /anxiety|depress|panic attack|stress|can'?t sleep|insomnia|mental|feeling low|hopeless/,
    specialty: "Psychiatrist",
    conditions: ["Mental-health / stress concern"],
    urgency: "routine",
  },
  {
    test: /breath|breathless|short of breath|asthma|wheez|suffocat/,
    specialty: "General Physician",
    conditions: ["Breathing difficulty"],
    urgency: "urgent",
  },
  {
    test: /stomach|abdomen|belly|vomit|nausea|diarr|loose motion|constipat|acidity|indigest|gas\b/,
    specialty: "General Physician",
    conditions: ["Digestive / stomach problem"],
    urgency: "routine",
  },
  {
    test: /fever|cough|cold\b|flu|running nose|body ache|chills|weak|fatigue|headache|migraine|dizzy|dizziness/,
    specialty: "General Physician",
    conditions: ["Likely a viral infection or general illness"],
    urgency: "routine",
  },
];

interface Flag {
  test: RegExp;
  label: string;
  sos: SosCategory;
}

// Any of these overrides urgency to "emergency".
const RED_FLAGS: Flag[] = [
  { test: /can'?t breathe|not breathing|stopped breathing|no pulse/, label: "Not breathing", sos: "respiratory" },
  { test: /unconscious|unrespons|passed out|fainted and not/, label: "Unconscious", sos: "other" },
  { test: /chest pain.*(breath|sweat|left arm|jaw)|heart attack/, label: "Heart-attack signs", sos: "cardiac" },
  { test: /stroke|face droop|slurred speech|sudden weakness|numb (face|arm|side)/, label: "Stroke signs", sos: "stroke" },
  { test: /severe bleeding|bleeding heavily|won'?t stop bleeding|blood loss/, label: "Severe bleeding", sos: "trauma" },
  { test: /seizure|convuls|fits\b/, label: "Seizure", sos: "other" },
  { test: /chok|can'?t swallow|swelling.*(throat|tongue)|anaphyla|severe allergic/, label: "Choking / severe allergy", sos: "respiratory" },
  { test: /suicid|kill myself|end my life|harm myself/, label: "Self-harm risk", sos: "other" },
  { test: /overdose|poison|swallowed (pills|chemical)/, label: "Poisoning / overdose", sos: "other" },
  { test: /major accident|hit by|road accident|serious injury|can'?t move/, label: "Serious injury", sos: "trauma" },
  { test: /labour|water broke|delivering/, label: "Childbirth", sos: "obstetric" },
];

const RANK: Record<Urgency, number> = { routine: 0, urgent: 1, emergency: 2 };

/** Analyze free-text symptoms. Returns null if there's nothing to read yet. */
export function analyzeSymptoms(input: string): TriageResult | null {
  const text = input.toLowerCase().trim();
  if (text.length < 4) return null;

  const redFlags: string[] = [];
  let sosCategory: SosCategory | undefined;
  for (const f of RED_FLAGS) {
    if (f.test.test(text)) {
      redFlags.push(f.label);
      sosCategory ??= f.sos;
    }
  }

  const specialties: string[] = [];
  const conditions: string[] = [];
  let urgency: Urgency = "routine";
  for (const r of RULES) {
    if (r.test.test(text)) {
      if (!specialties.includes(r.specialty)) specialties.push(r.specialty);
      for (const c of r.conditions) if (!conditions.includes(c)) conditions.push(c);
      if (RANK[r.urgency] > RANK[urgency]) urgency = r.urgency;
    }
  }

  if (specialties.length === 0) {
    specialties.push("General Physician");
    conditions.push("General consultation");
  }

  if (redFlags.length > 0) {
    urgency = "emergency";
    return {
      urgency,
      specialties,
      conditions,
      redFlags,
      sosCategory: sosCategory ?? "other",
      advice:
        "This looks like it could be a medical emergency. Press SOS now — an ambulance and the nearest doctor will be alerted with your location.",
    };
  }

  return {
    urgency,
    specialties,
    conditions,
    redFlags,
    advice:
      urgency === "urgent"
        ? `Best seen soon by a ${specialties[0]}. If it gets worse, press SOS.`
        : `A ${specialties[0]} is a good fit. Book a visit below.`,
  };
}
