/**
 * Single source of truth for every legal identifier, address, officer and
 * contact address that the policy pages cite.
 *
 * WHY ONE FILE: a privacy policy that names the company in eleven places is
 * eleven places to get out of date the day the registered office moves, and a
 * store reviewer who finds the Grievance Officer named differently on two
 * pages treats the whole submission as unreliable. Every legal page reads from
 * here, so the entity is described identically everywhere or nowhere.
 *
 * EMPTY STRING = NOT YET KNOWN. Fields are deliberately blank rather than
 * filled with plausible-looking dummy values: `<EntityDetails>` and the
 * contact blocks skip empty rows, so an unfilled CIN renders as nothing at all
 * instead of publishing a fake one. See docs/LEGAL_CHECKLIST.md for the list
 * of what must be filled before an App Store / Play Store submission.
 */

export const COMPANY = {
  /** Registered corporate name, as it appears on the certificate of incorporation. */
  legalName: "Doceeto Health Private Limited",
  /** Short form used mid-sentence in prose. */
  shortName: "Doceeto",
  /** Consumer-facing brand and app name. */
  brand: "Doceeto",
  tagline: "Care that reaches you",

  /**
   * The platform ships under the internal codename "Iyashi" in parts of the
   * codebase (session cookie prefix, database file, some env vars). Named here
   * so the Privacy Policy can disclose the cookie names honestly rather than
   * leaving a user who inspects `iyashi_sid_patient` wondering whose it is.
   */
  internalCodename: "Iyashi",

  /** Corporate Identification Number (MCA). */
  cin: "",
  /** GST Identification Number. */
  gstin: "",

  registeredOffice: {
    lines: [] as string[],
    city: "Nagpur",
    state: "Maharashtra",
    postalCode: "",
    country: "India",
  },

  /**
   * Where correspondence actually goes, if it differs from the registered
   * office. Leave `lines` empty to fall back to the registered office.
   */
  operatingOffice: {
    lines: [] as string[],
    city: "Nagpur",
    state: "Maharashtra",
    postalCode: "",
    country: "India",
  },

  jurisdiction: {
    /** Governing law of the contract. */
    law: "the laws of India",
    /** Courts with exclusive jurisdiction. */
    courts: "the courts at Nagpur, Maharashtra",
    /** Seat of arbitration under the Arbitration and Conciliation Act, 1996. */
    arbitrationSeat: "Nagpur, Maharashtra, India",
  },

  web: {
    /**
     * Canonical origin. Used for absolute URLs in sitemap.xml and in the
     * store-facing links (privacy policy URL, account-deletion URL), which
     * must be absolute and publicly reachable without a login.
     */
    origin: "https://doceeto.health",
    domain: "doceeto.health",
  },
} as const;

/**
 * Contact addresses, split by purpose. Regulators expect different roles to be
 * separately reachable — the DPDP Act's Data Protection Officer and the
 * IT Rules' Grievance Officer are distinct functions even when one person
 * currently holds both.
 */
export const CONTACTS = {
  general: "hello@doceeto.health",
  support: "support@doceeto.health",
  /** DPDP Act, 2023 — Data Protection Officer / person answering data questions. */
  privacy: "privacy@doceeto.health",
  /** Consumer Protection (E-Commerce) Rules, 2020 + IT Rules, 2021. */
  grievance: "grievance@doceeto.health",
  /** Clinical governance: complaints about care itself, not about the app. */
  medical: "medical@doceeto.health",
  legal: "legal@doceeto.health",
  /** Coordinated disclosure of security issues. */
  security: "security@doceeto.health",
  /** Phone line, if one is published. Blank until a number is live. */
  phone: "",
} as const;

/**
 * Named officers. Both roles are legally required to be published with a name
 * and a means of contact — a role address alone does not satisfy Rule 4(1)(d)
 * of the E-Commerce Rules or Rule 3(2) of the IT Rules.
 */
export const OFFICERS = {
  grievance: {
    role: "Grievance Officer",
    name: "",
    email: CONTACTS.grievance,
    phone: "",
    /** Statutory: acknowledge within 48 hours, resolve within one month. */
    acknowledgeWithin: "48 hours",
    resolveWithin: "one month",
  },
  dataProtection: {
    role: "Data Protection Officer",
    name: "",
    email: CONTACTS.privacy,
    phone: "",
    respondWithin: "30 days",
  },
  nodal: {
    role: "Nodal Contact Person",
    name: "",
    email: CONTACTS.legal,
    phone: "",
  },
  medical: {
    role: "Medical Director",
    name: "",
    /** NMC / State Medical Council registration number of the medical director. */
    registrationNo: "",
    email: CONTACTS.medical,
  },
} as const;

/**
 * Version stamp shown on every policy. Bump `version` and `effectiveDate`
 * together whenever a document changes materially — users who accepted an
 * earlier version must be re-prompted, and a store reviewer comparing the app's
 * consent screen against the live page will check these agree.
 */
export const POLICY_VERSION = {
  version: "1.0",
  /** ISO date. Rendered through `formatLegalDate`. */
  effectiveDate: "2026-08-12",
  lastUpdated: "2026-08-12",
} as const;

/** "12 August 2026" — the unambiguous form, since 08/12 reads two ways. */
export function formatLegalDate(iso: string): string {
  const d = new Date(`${iso}T00:00:00Z`);
  return d.toLocaleDateString("en-IN", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
}

/** A postal address as display lines, skipping anything not yet filled in. */
export function addressLines(
  addr: typeof COMPANY.registeredOffice | typeof COMPANY.operatingOffice,
): string[] {
  const tail = [addr.city, addr.state].filter(Boolean).join(", ");
  return [
    ...addr.lines,
    [tail, addr.postalCode].filter(Boolean).join(" "),
    addr.country,
  ].filter((l) => l.trim().length > 0);
}

/** The correspondence address: the operating office if given, else registered. */
export function correspondenceAddress(): string[] {
  const op = addressLines(COMPANY.operatingOffice);
  const reg = addressLines(COMPANY.registeredOffice);
  return COMPANY.operatingOffice.lines.length > 0 ? op : reg;
}

/** An absolute URL on the canonical origin — required by both app stores. */
export const absoluteUrl = (path: string): string =>
  `${COMPANY.web.origin}${path.startsWith("/") ? path : `/${path}`}`;
