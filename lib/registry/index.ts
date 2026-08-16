import "server-only";

/**
 * Looking up a practitioner by their council registration number.
 *
 * ── What this is and is not ──
 *
 * There is no official, supported API for the Indian Medical Register. The NMC
 * publishes a public search page whose own front-end calls a JSON endpoint;
 * that endpoint is free and it is the authoritative data, but it is
 * undocumented, unversioned, and can change or start refusing traffic without
 * anyone telling us.
 *
 * So a hit here AUTOFILLS A FORM. It never marks anyone verified. The thing
 * that decides whether a stranger may enter a patient's home stays a human
 * looking at the official register — this only saves them typing, and saves the
 * doctor from typos in their own registration number.
 *
 * When volume makes the manual step the bottleneck, add a paid verification
 * vendor as a second RegistryAdapter and put it first in ADAPTERS. Nothing
 * above this file changes.
 */

export interface RegistryMatch {
  registrationNo: string;
  fullName: string;
  /** State Medical Council that issued it, e.g. "Maharashtra Medical Council". */
  council?: string;
  /** Year of registration, as printed on the register. */
  year?: string;
  /** Degree(s) as recorded, e.g. "M.B.B.S." */
  qualification?: string;
  /** Which source answered, shown to ops so they know what they are trusting. */
  source: string;
}

export interface RegistryAdapter {
  name: string;
  lookup(registrationNo: string, council?: string): Promise<RegistryMatch[]>;
}

/** Registration numbers are short and alphanumeric; anything else is a typo
 *  or an attempt to push something odd into a URL. */
export function isPlausibleRegistrationNo(value: string): boolean {
  return /^[A-Za-z0-9/\-.]{3,24}$/.test(value.trim());
}

const NMC_ENDPOINT = "https://www.nmc.org.in/MCIRest/open/getPaginatedData";

/** Join the name parts the register stores separately, without double spaces. */
function joinName(row: Record<string, unknown>): string {
  return ["firstName", "middleName", "lastName"]
    .map((k) => String(row[k] ?? "").trim())
    .filter(Boolean)
    .join(" ");
}

const nmcAdapter: RegistryAdapter = {
  name: "NMC Indian Medical Register",
  async lookup(registrationNo) {
    const qs = new URLSearchParams({
      service: "getPaginatedDoctor",
      draw: "1",
      start: "0",
      length: "10",
      name: "",
      registrationNo,
      smcId: "",
      year: "",
    });

    // Short timeout: this sits in front of a signup form. If the register is
    // slow or gone, the doctor types their details and moves on.
    const res = await fetch(`${NMC_ENDPOINT}?${qs}`, {
      signal: AbortSignal.timeout(8000),
      headers: { accept: "application/json" },
      cache: "no-store",
    });
    if (!res.ok) throw new Error(`register responded ${res.status}`);

    const body = (await res.json()) as { data?: Record<string, unknown>[] };
    const rows = Array.isArray(body?.data) ? body.data : [];

    // Every field is treated as optional. This is someone else's undocumented
    // response shape; assuming it is stable is how this breaks silently.
    return rows
      .map((row) => ({
        registrationNo: String(row.registrationNo ?? registrationNo).trim(),
        fullName: joinName(row),
        council: String(row.smcName ?? "").trim() || undefined,
        year: String(row.yearInfo ?? "").trim() || undefined,
        qualification: String(row.doctorDegree ?? "").trim() || undefined,
        source: nmcAdapter.name,
      }))
      .filter((m) => m.fullName);
  },
};

/**
 * A paid verification vendor (IDfy, Signzy, Karza/Perfios, HyperVerge…).
 *
 * ── Turning this on ──
 * Set these in .env.local (and in the deploy environment). Nothing else needs
 * to change; the adapter switches itself on the moment the key is present and
 * is skipped entirely while it is absent.
 *
 *   REGISTRY_API_URL=https://<vendor>/…/doctor-registration-verify
 *   REGISTRY_API_KEY=<the key they give you>
 *   REGISTRY_API_HEADER=Authorization      # optional, this is the default
 *   REGISTRY_API_NAME=IDfy                 # optional, shown to ops
 *
 * Vendors do not agree on a response shape, so `readVendorRows` below is the
 * one place to adjust: it looks in the three envelopes they commonly use
 * (`result`, `data`, or a bare array) and reads the field names most of them
 * share. If yours differs, that function is the only edit.
 */
const VENDOR_FIELDS = {
  name: ["name", "fullName", "doctor_name", "practitioner_name"],
  registration: ["registrationNumber", "registration_no", "registrationNo"],
  council: ["council", "smcName", "state_medical_council", "issuing_authority"],
  year: ["year", "registrationYear", "yearOfRegistration"],
  qualification: ["qualification", "degree", "doctorDegree"],
} as const;

/** First non-empty value among the aliases a vendor might use. */
function pick(row: Record<string, unknown>, keys: readonly string[]) {
  for (const k of keys) {
    const v = row[k];
    if (typeof v === "string" && v.trim()) return v.trim();
    if (typeof v === "number") return String(v);
  }
  return undefined;
}

function readVendorRows(body: unknown): Record<string, unknown>[] {
  if (Array.isArray(body)) return body as Record<string, unknown>[];
  const b = (body ?? {}) as Record<string, unknown>;
  for (const key of ["result", "data", "results", "records"]) {
    const v = b[key];
    if (Array.isArray(v)) return v as Record<string, unknown>[];
    // Several vendors return a single object rather than a list.
    if (v && typeof v === "object") return [v as Record<string, unknown>];
  }
  return [];
}

const vendorAdapter: RegistryAdapter = {
  name: process.env.REGISTRY_API_NAME || "Verification partner",
  async lookup(registrationNo, council) {
    const url = process.env.REGISTRY_API_URL;
    const key = process.env.REGISTRY_API_KEY;
    if (!url || !key) return []; // Not configured, stay out of the way.

    const header = process.env.REGISTRY_API_HEADER || "Authorization";
    const res = await fetch(url, {
      method: "POST",
      signal: AbortSignal.timeout(10_000),
      cache: "no-store",
      headers: {
        "content-type": "application/json",
        accept: "application/json",
        [header]: header.toLowerCase() === "authorization" ? `Bearer ${key}` : key,
      },
      body: JSON.stringify({ registrationNumber: registrationNo, council }),
    });
    if (!res.ok) throw new Error(`vendor responded ${res.status}`);

    return readVendorRows(await res.json())
      .map((row) => ({
        registrationNo: pick(row, VENDOR_FIELDS.registration) ?? registrationNo,
        fullName: pick(row, VENDOR_FIELDS.name) ?? "",
        council: pick(row, VENDOR_FIELDS.council),
        year: pick(row, VENDOR_FIELDS.year),
        qualification: pick(row, VENDOR_FIELDS.qualification),
        source: vendorAdapter.name,
      }))
      .filter((m) => m.fullName);
  },
};

/** Whether a paid vendor is wired up. Surfaced so ops can tell at a glance
 *  how much a match is worth. */
export const vendorConfigured = Boolean(
  process.env.REGISTRY_API_URL && process.env.REGISTRY_API_KEY,
);

/**
 * First adapter that returns anything wins, so the paid vendor goes first and
 * the free public register is the fallback — not the other way round.
 *
 * The vendor is left OUT of the list entirely when it has no key, rather than
 * being included and returning nothing: an adapter that answers "no matches"
 * counts as reachable, which would report a dead register as "no such
 * registration number" — telling a doctor their own licence is wrong.
 */
const ADAPTERS: RegistryAdapter[] = [
  ...(vendorConfigured ? [vendorAdapter] : []),
  nmcAdapter,
];

export interface LookupResult {
  matches: RegistryMatch[];
  /** Set when every adapter failed — the form says so rather than showing
   *  "no match", which would read as "your number is wrong". */
  unavailable?: boolean;
}

export async function lookupRegistration(
  registrationNo: string,
  council?: string,
): Promise<LookupResult> {
  const value = registrationNo.trim();
  if (!isPlausibleRegistrationNo(value)) return { matches: [] };

  let anyReachable = false;

  for (const adapter of ADAPTERS) {
    try {
      const matches = await adapter.lookup(value, council);
      anyReachable = true;
      if (matches.length) return { matches };
    } catch (err) {
      // A register being down is not the doctor's problem, and not an error
      // worth failing signup over. Log it and fall through to manual entry.
      console.warn(`[registry] ${adapter.name} lookup failed:`, err);
    }
  }

  return { matches: [], unavailable: !anyReachable };
}
