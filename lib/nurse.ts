/**
 * Nursing rules: the services a nurse can offer, the cadre helpers every
 * surface reads, and the profile sanitizer.
 *
 * Pure and dependency-free (types only), so it is safe on the client and the
 * server — same contract as lib/gigs/rules.ts.
 */
import type { CSSProperties } from "react";
import type { Cadre, Doctor } from "@/lib/types/domain";

export type NurseService =
  | "injection_iv"
  | "wound_dressing"
  | "elderly_bedridden"
  | "vitals_sample_collection";

export type ProviderVerificationStatus =
  | "not_started"
  | "submitted"
  | "under_review"
  | "verified"
  | "rejected"
  | "suspended";

export interface NurseProfile {
  fullName: string;
  gender?: "female" | "male" | "other";
  age?: number;
  languages: string[];
  qualifications: string[];
  registrationCouncil?: string;
  registrationNumber?: string;
  experienceYears: number;
  about?: string;
  serviceCapabilities: NurseService[];
  homeVisitFee?: number;
  serviceRadiusKm?: number;
  lat?: number;
  lng?: number;
  verificationStatus: ProviderVerificationStatus;
  available: boolean;
}

export const NURSE_SERVICES: Array<{ id: NurseService; label: string; short: string; price: number }> = [
  { id: "wound_dressing", label: "Wound dressing & post-op care", short: "Wound care", price: 650 },
  { id: "elderly_bedridden", label: "Elderly & bedridden care", short: "Elder care", price: 800 },
  { id: "vitals_sample_collection", label: "Vitals & sample collection", short: "Vitals", price: 450 },
  { id: "injection_iv", label: "Injection & IV assistance", short: "Injection / IV", price: 500 },
];

export const nurseServiceLabel = (service: NurseService) =>
  NURSE_SERVICES.find((item) => item.id === service)?.label ?? service;

/**
 * Indian nursing cadres, in the order a patient would read them as seniority.
 * Stored on the provider row's `qualifications`, which is where the doctor
 * profile keeps its degrees — same column, same meaning.
 */
export const NURSE_CADRES = [
  "ANM",
  "GNM",
  "B.Sc Nursing",
  "M.Sc Nursing",
] as const;

/**
 * The patient-facing headline on a nurse's card. Stored on `specialty` — the
 * column that already drives every provider list and profile, so nurses need
 * no separate display path.
 */
export const NURSE_TITLES = [
  "Home Care Nurse",
  "Elder Care Nurse",
  "Post-Operative Care Nurse",
  "Critical Care Nurse",
] as const;

/**
 * The nurse-blue accent, as RGB-triplet CSS variable overrides. The whole app
 * colours itself off --c-terracotta/--c-salmon (see tailwind.config.ts), so
 * setting these on any wrapper turns every themed class inside it blue —
 * shared components (GigList, the gig cockpit) recolour without forks. Apply
 * via `style={NURSE_ACCENT_VARS}` on a surface root.
 */
export const NURSE_ACCENT_VARS = {
  "--c-terracotta": "47 123 196" /* #2F7BC4 — calm clinical blue */,
  "--c-terracotta-700": "37 95 153" /* #255F99 — pressed */,
  "--c-terracotta-300": "191 217 242" /* #BFD9F2 — light tint */,
  "--c-salmon": "127 179 227" /* #7FB3E3 — secondary */,
} as CSSProperties;

export const isProviderRole = (role: string | null | undefined) => role === "doctor" || role === "nurse";
export const isDoctorRole = (role: string | null | undefined) => role === "doctor";
export const isNurseRole = (role: string | null | undefined) => role === "nurse";

/**
 * Only a doctor may prescribe. This is the one capability the shared provider
 * engine must NOT hand to every cadre, so it stays a named rule rather than an
 * inline role test that could drift.
 */
export const canPrescribe = (role: string | null | undefined) => role === "doctor";

/**
 * The cadre of a provider row or a request, defaulting to "doctor".
 *
 * Rows written before nurses existed carry no cadre, and a bare
 * `x.cadre === "doctor"` would read those as neither — hiding every legacy
 * doctor and every legacy request. Always read through here.
 */
export const cadreOf = (x: { cadre?: Cadre | null } | null | undefined): Cadre =>
  x?.cadre === "nurse" ? "nurse" : "doctor";

/** The cadre a request is aimed at, defaulting to "doctor" for legacy rows. */
export const targetCadreOf = (r: { targetCadre?: Cadre | null } | null | undefined): Cadre =>
  r?.targetCadre === "nurse" ? "nurse" : "doctor";

/** True when this provider is a nurse. */
export const isNurse = (p: Pick<Doctor, "cadre"> | null | undefined) => cadreOf(p) === "nurse";

/** The services a nurse row actually offers, dropping anything unrecognised. */
export function skillsOf(p: Pick<Doctor, "skills"> | null | undefined): NurseService[] {
  const allowed = new Set<string>(NURSE_SERVICES.map((s) => s.id));
  return (p?.skills ?? []).filter((s): s is NurseService => allowed.has(s));
}

export function sanitizeNurseProfile(input: Partial<NurseProfile>): NurseProfile {
  const allowed = new Set(NURSE_SERVICES.map((service) => service.id));
  const capabilities = Array.isArray(input.serviceCapabilities)
    ? input.serviceCapabilities.filter((service): service is NurseService => allowed.has(service as NurseService)).slice(0, 4)
    : [];
  return {
    fullName: String(input.fullName ?? "").trim().slice(0, 100),
    gender: input.gender,
    age: input.age && input.age >= 18 && input.age <= 100 ? Math.round(input.age) : undefined,
    languages: Array.isArray(input.languages) ? input.languages.map(String).map((x) => x.trim()).filter(Boolean).slice(0, 6) : [],
    qualifications: Array.isArray(input.qualifications) ? input.qualifications.map(String).map((x) => x.trim()).filter(Boolean).slice(0, 6) : [],
    registrationCouncil: String(input.registrationCouncil ?? "").trim().slice(0, 100) || undefined,
    registrationNumber: String(input.registrationNumber ?? "").trim().slice(0, 80) || undefined,
    experienceYears: Math.max(0, Math.min(70, Math.round(Number(input.experienceYears) || 0))),
    about: String(input.about ?? "").trim().slice(0, 600) || undefined,
    serviceCapabilities: capabilities,
    homeVisitFee: Math.max(0, Math.min(10000, Number(input.homeVisitFee) || 0)),
    serviceRadiusKm: Math.max(1, Math.min(100, Number(input.serviceRadiusKm) || 10)),
    lat: input.lat,
    lng: input.lng,
    verificationStatus: input.verificationStatus ?? "not_started",
    available: Boolean(input.available),
  };
}
