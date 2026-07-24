import { doctorKind } from "@/lib/labels";
import type { Doctor } from "@/lib/types/domain";

/** Typical qualification per specialty, used as a fallback for doctors who
 *  registered without filling their profile yet. */
const SPECIALTY_QUALS: Record<string, string> = {
  "General Physician": "MBBS, MD (General Medicine)",
  Cardiologist: "MBBS, MD, DM (Cardiology)",
  Pediatrician: "MBBS, MD (Pediatrics)",
  Orthopedic: "MBBS, MS (Orthopedics)",
  Dermatologist: "MBBS, MD (Dermatology)",
  Gynecologist: "MBBS, MS (Obstetrics & Gynecology)",
  ENT: "MBBS, MS (ENT)",
  Psychiatrist: "MBBS, MD (Psychiatry)",
};

/** Qualification line, with a sensible specialty-derived fallback. */
export function doctorQualification(d: Doctor): string {
  return d.qualifications || SPECIALTY_QUALS[d.specialty] || "MBBS";
}

/** Academic background, with a neutral fallback. */
export function doctorEducation(d: Doctor): string {
  return d.education || "Registered medical practitioner";
}

/** About / bio, falling back to the generated one-liner. */
export function doctorAbout(d: Doctor): string {
  return d.about || doctorBlurb(d);
}

/** A short, friendly one-line description for a doctor card. */
export function doctorBlurb(d: Doctor): string {
  const years =
    d.experienceYears > 0
      ? `${d.experienceYears} yr${d.experienceYears === 1 ? "" : "s"} of experience`
      : "new on Doceeto";
  const langs =
    d.languages.length > 1
      ? `Speaks ${d.languages.slice(0, 2).join(" and ")}`
      : `Speaks ${d.languages[0] ?? "English"}`;
  return `${d.specialty} with ${years}. ${doctorKind[d.kind].label}. ${langs}.`;
}
