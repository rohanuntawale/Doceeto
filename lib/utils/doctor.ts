import { doctorKind } from "@/lib/labels";
import type { Doctor } from "@/lib/types/domain";

/** A short, friendly one-line description for a doctor card. */
export function doctorBlurb(d: Doctor): string {
  const years =
    d.experienceYears > 0
      ? `${d.experienceYears} yr${d.experienceYears === 1 ? "" : "s"} of experience`
      : "new on Iyashi";
  const langs =
    d.languages.length > 1
      ? `Speaks ${d.languages.slice(0, 2).join(" and ")}`
      : `Speaks ${d.languages[0] ?? "English"}`;
  return `${d.specialty} with ${years}. ${doctorKind[d.kind].label}. ${langs}.`;
}
