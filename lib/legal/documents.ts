/**
 * The registry of published legal documents.
 *
 * One list, five consumers: the Legal hub, the footer bar, the human Site Map,
 * the machine-readable /sitemap.xml, and the cross-links printed at the foot of
 * each policy. Adding a policy here publishes it everywhere at once, which is
 * the point — a document that exists but is missing from the sitemap is a
 * document a store reviewer will report as unreachable.
 */

export type LegalCategory = "core" | "clinical" | "commercial" | "data";

export interface LegalDoc {
  /** URL segment under /legal. */
  slug: string;
  /** Title as it appears on the page and in the browser tab. */
  title: string;
  /** Shorter label for the footer bar and dense link lists. */
  shortTitle?: string;
  /** One line, shown on the hub card and as the page meta description. */
  summary: string;
  category: LegalCategory;
  /**
   * Who most needs to read it. Rendered as a chip on the hub so a doctor
   * looking for their own terms is not made to read the patient's.
   */
  audience: "Everyone" | "Patients" | "Providers" | "Visitors";
  /**
   * Surfaced by the app stores or required to be linked from a store listing.
   * The hub marks these so nobody unpublishes one without realising.
   */
  storeRequired?: boolean;
}

export const LEGAL_DOCS: LegalDoc[] = [
  {
    slug: "privacy",
    title: "Privacy Policy",
    summary:
      "What personal and health data we collect, why, who it reaches, how long we keep it, and the rights you hold over it under the DPDP Act, 2023.",
    category: "data",
    audience: "Everyone",
    storeRequired: true,
  },
  {
    slug: "terms",
    title: "Terms of Use",
    summary:
      "The contract between you and Doceeto: what the platform is, what it is not, how accounts work, and the limits of our liability.",
    category: "core",
    audience: "Everyone",
    storeRequired: true,
  },
  {
    slug: "sales",
    title: "Sales Policy",
    summary:
      "Fees, payment methods, invoicing and taxes, plus the cancellation, refund and no-show rules for consultations, home visits and medicine orders.",
    category: "commercial",
    audience: "Patients",
    storeRequired: true,
  },
  {
    slug: "medical-disclaimer",
    title: "Medical Disclaimer",
    summary:
      "Doceeto is not a hospital and the symptom checker is not a diagnosis. What our AI triage can and cannot do, and when to stop reading and call for help.",
    category: "clinical",
    audience: "Everyone",
    storeRequired: true,
  },
  {
    slug: "telemedicine-consent",
    title: "Telemedicine & Informed Consent",
    summary:
      "How remote consultations run under the Telemedicine Practice Guidelines, 2020, what you consent to, prescribing limits, and when a doctor must refuse.",
    category: "clinical",
    audience: "Patients",
  },
  {
    slug: "emergency",
    title: "Emergency Services Policy",
    summary:
      "The hard limits of the SOS button. Doceeto is not a replacement for 112, 108 or your nearest emergency department.",
    category: "clinical",
    audience: "Everyone",
    storeRequired: true,
  },
  {
    slug: "pharmacy",
    title: "Medicine & Pharmacy Policy",
    summary:
      "How prescription and over-the-counter medicine is sourced, verified and delivered, which schedules we will not dispense, and why some orders are refused.",
    category: "clinical",
    audience: "Patients",
  },
  {
    slug: "providers",
    title: "Provider Terms",
    summary:
      "For doctors and nurses: verification, independent-contractor status, scope of practice, commission and payouts, conduct, and grounds for removal.",
    category: "core",
    audience: "Providers",
  },
  {
    slug: "cookies",
    title: "Cookie Policy",
    summary:
      "Every cookie and local-storage key Doceeto sets, what it holds, how long it lives, and which ones you can refuse.",
    category: "data",
    audience: "Visitors",
  },
  {
    slug: "data-deletion",
    title: "Account & Data Deletion",
    summary:
      "How to delete your Doceeto account and health data, what is erased immediately, and the narrow set of records the law requires us to retain.",
    category: "data",
    audience: "Everyone",
    storeRequired: true,
  },
  {
    slug: "grievance",
    title: "Grievance Redressal",
    summary:
      "How to raise a complaint, who handles it, the timelines we are held to, and how to escalate beyond us to a regulator or consumer forum.",
    category: "core",
    audience: "Everyone",
    storeRequired: true,
  },
  {
    slug: "accessibility",
    title: "Accessibility Statement",
    summary:
      "Our WCAG 2.2 AA commitment, the parts of Doceeto that fall short today, and how to tell us when something is unusable.",
    category: "core",
    audience: "Everyone",
  },
  {
    slug: "security",
    title: "Security & Vulnerability Disclosure",
    summary:
      "How health data is protected in transit and at rest, how we handle a breach, and safe-harbour terms for security researchers who report a flaw.",
    category: "data",
    audience: "Everyone",
  },
];

export const CATEGORY_META: Record<
  LegalCategory,
  { label: string; blurb: string }
> = {
  core: {
    label: "The agreement",
    blurb: "What you agree to by using Doceeto, and how to hold us to it.",
  },
  clinical: {
    label: "Care & clinical safety",
    blurb:
      "The medical limits of the platform, read these before relying on it in an emergency.",
  },
  commercial: {
    label: "Money",
    blurb: "What things cost, how you pay, and when you get your money back.",
  },
  data: {
    label: "Your data",
    blurb:
      "Health data is the most sensitive category there is. These say exactly what we do with yours.",
  },
};

/** Order categories appear in on the hub and the site map. */
export const CATEGORY_ORDER: LegalCategory[] = [
  "core",
  "clinical",
  "data",
  "commercial",
];

export const docBySlug = (slug: string): LegalDoc | undefined =>
  LEGAL_DOCS.find((d) => d.slug === slug);

export const docsInCategory = (c: LegalCategory): LegalDoc[] =>
  LEGAL_DOCS.filter((d) => d.category === c);

export const legalHref = (slug: string): string => `/legal/${slug}`;

/**
 * The condensed bar at the very bottom of every page. Deliberately five items:
 * a footer that lists thirteen policies is a footer nobody reads, so the rest
 * live one click deeper on the hub.
 */
export const FOOTER_BAR_LINKS = [
  { label: "Privacy Policy", href: "/legal/privacy" },
  { label: "Terms of Use", href: "/legal/terms" },
  { label: "Sales Policy", href: "/legal/sales" },
  { label: "Legal", href: "/legal" },
  { label: "Site Map", href: "/sitemap" },
] as const;
