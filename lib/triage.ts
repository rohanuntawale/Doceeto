import type { Acuity, ConsultType } from "@/lib/types/domain";

/**
 * A lightweight, rules-based symptom triage. It never diagnoses — it only
 * routes the patient to the right level of care (the clinician-in-the-loop
 * principle). Red flags force an emergency recommendation; everything else
 * is graded urgent vs routine. In production this is where an Infermedica-
 * style validated engine plugs in behind the same interface.
 */

export interface TriageQuestion {
  id: string;
  text: string;
}

/** Emergency "red flags" — any one selected → recommend SOS. */
export const RED_FLAGS: TriageQuestion[] = [
  { id: "chest_pain", text: "Chest pain or pressure" },
  { id: "breathing", text: "Trouble breathing" },
  { id: "stroke", text: "Face droop, slurred speech, or sudden weakness" },
  { id: "bleeding", text: "Heavy bleeding that won't stop" },
  { id: "unconscious", text: "Fainting or not fully conscious" },
  { id: "allergic", text: "Severe allergic reaction / swelling" },
  { id: "suicidal", text: "Thoughts of harming yourself" },
];

/** Moderate warning signs — push toward an in-person (home/clinic) visit soon. */
export const WARNING_SIGNS: TriageQuestion[] = [
  { id: "high_fever", text: "High fever for more than 3 days" },
  { id: "severe_pain", text: "Severe pain anywhere" },
  { id: "vomiting", text: "Can't keep food or water down" },
  { id: "injury", text: "A recent injury or fall" },
  { id: "pregnancy", text: "Pregnancy-related concern" },
  { id: "elderly", text: "Patient is elderly or has a long-term illness" },
];

export interface TriageResult {
  acuity: Acuity;
  recommendedMode: ConsultType;
  isEmergency: boolean;
  summary: string;
  advice: string;
}

export function runTriage(input: {
  complaint: string;
  redFlags: string[];
  warnings: string[];
}): TriageResult {
  const complaint = input.complaint.trim() || "General health concern";

  if (input.redFlags.length > 0) {
    const flags = RED_FLAGS.filter((f) => input.redFlags.includes(f.id))
      .map((f) => f.text.toLowerCase())
      .join(", ");
    return {
      acuity: "emergency",
      recommendedMode: "home_visit",
      isEmergency: true,
      summary: `Emergency signs: ${flags}.`,
      advice:
        "This may be an emergency. Please press SOS now so an ambulance and a doctor are alerted.",
    };
  }

  if (input.warnings.length > 0) {
    const signs = WARNING_SIGNS.filter((w) => input.warnings.includes(w.id))
      .map((w) => w.text.toLowerCase())
      .join(", ");
    return {
      acuity: "urgent",
      recommendedMode: "home_visit",
      isEmergency: false,
      summary: `${complaint}. Warning signs: ${signs}.`,
      advice: "You should be seen soon. A home visit is recommended.",
    };
  }

  return {
    acuity: "routine",
    recommendedMode: "video",
    isEmergency: false,
    summary: `${complaint}. No warning signs reported.`,
    advice: "This looks routine. A video call is usually enough to start.",
  };
}
