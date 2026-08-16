/**
 * Practitioner credential verification.
 *
 * A patient is being asked to let a stranger into their home, so "is this
 * person actually registered?" is the single most important question the
 * platform answers. This module is the one place that answers it.
 *
 * ── Why ABDM rather than a scraper ──
 *
 * The government already runs the registry we need. Every practising
 * clinician in India is enrolled in the Healthcare Professionals Registry
 * (HPR), part of ABDM, and their record is verified by their OWN council:
 *
 *   NMC    doctors            NCISM  Ayush (Indian systems)
 *   INC    nurses             NCH    homeopathy
 *   DCI    dentists
 *
 * That matters for us specifically because we onboard NURSES, and the
 * commercial "NMC verification" APIs only cover doctors. HPR covers both, is
 * authoritative rather than scraped, and is free.
 *
 * ── Why this is an interface and not just an HPR call ──
 *
 * ABDM access needs an application and approval, which is not something the
 * code can grant itself. So the provider is chosen by env, and the default
 * works today with no credentials at all: it records the claim and queues the
 * practitioner for a human to check. Nobody is ever marked verified by
 * default, and nothing here invents a credential.
 *
 * Set VERIFY_PROVIDER=hpr plus the ABDM_* vars to switch the real one on.
 */

export type Cadre = "doctor" | "nurse";

/** Which council should hold this person's record. */
export type Council = "NMC" | "INC" | "DCI" | "NCISM" | "NCH";

export const COUNCILS: Record<Cadre, Council[]> = {
  doctor: ["NMC", "NCISM", "NCH", "DCI"],
  nurse: ["INC"],
};

export type VerifyRequest = {
  cadre: Cadre;
  /** Council registration number exactly as printed on the certificate. */
  registrationNo: string;
  /** The council they say holds the record. */
  council: Council;
  /** Name on the account, compared against the registry's. */
  name: string;
  /** Year of registration, where the registry needs it to disambiguate. */
  year?: string;
};

export type VerifyResult = {
  /**
   * verified  the registry returned a live record matching this person
   * pending   we could not decide automatically; a human must look
   * rejected  the registry says no such record, or the name does not match
   */
  status: "verified" | "pending" | "rejected";
  /** Which provider produced this answer, recorded for audit. */
  source: string;
  /** Name as the registry holds it, when it gave one. */
  matchedName?: string;
  /** Shown to the practitioner, so it must be plain and non-accusatory. */
  message: string;
};

export interface PractitionerVerifier {
  readonly id: string;
  verify(req: VerifyRequest): Promise<VerifyResult>;
}

/** Registration numbers are short, alphanumeric, sometimes slashed or hyphenated. */
export function normaliseRegistrationNo(raw: string): string {
  return raw.trim().toUpperCase().replace(/\s+/g, "");
}

export function isPlausibleRegistrationNo(raw: string): boolean {
  const v = normaliseRegistrationNo(raw);
  return v.length >= 4 && v.length <= 24 && /^[A-Z0-9/-]+$/.test(v);
}

/**
 * Compare the name on the account with the one in the registry.
 *
 * Deliberately loose: registries hold "SHARMA RAJESH KUMAR" where the account
 * says "Dr. Rajesh Sharma". Requiring an exact string would reject real
 * doctors, which is a worse failure than sending a borderline case to a human.
 * Every token of the shorter name must appear in the longer one.
 */
export function namesAgree(a: string, b: string): boolean {
  const clean = (s: string) =>
    s
      .toLowerCase()
      .replace(/\b(dr|doctor|mr|mrs|ms|miss|sr|smt|shri)\b\.?/g, "")
      .replace(/[^a-z\s]/g, " ")
      .split(/\s+/)
      .filter((t) => t.length > 1);
  const x = clean(a);
  const y = clean(b);
  if (x.length === 0 || y.length === 0) return false;
  const [short, long] = x.length <= y.length ? [x, y] : [y, x];
  return short.every((t) => long.includes(t));
}

/**
 * The default. Takes the claim, decides nothing, queues a human.
 *
 * This is what runs until ABDM credentials exist. It is honest: the
 * practitioner is told their credentials are being checked, patients keep
 * seeing an unverified badge, and an ops person confirms against the public
 * IMR/INC register by hand.
 */
class ManualReviewVerifier implements PractitionerVerifier {
  readonly id = "manual-review";

  async verify(req: VerifyRequest): Promise<VerifyResult> {
    if (!isPlausibleRegistrationNo(req.registrationNo)) {
      return {
        status: "rejected",
        source: this.id,
        message:
          "That does not look like a registration number. Check it against your certificate and try again.",
      };
    }
    return {
      status: "pending",
      source: this.id,
      message:
        "Your registration has been submitted for verification. You can finish your profile now; patients will see a verified badge once it clears.",
    };
  }
}

/**
 * ABDM Healthcare Professionals Registry.
 *
 * Kept behind the same interface so switching is an env change. The request
 * shape follows HPR's search-by-registration contract; the exact host and
 * payload are pinned by the ABDM environment you are granted, which is why
 * they are configuration rather than constants.
 */
class HprVerifier implements PractitionerVerifier {
  readonly id = "abdm-hpr";

  constructor(
    private readonly baseUrl: string,
    private readonly token: string,
  ) {}

  async verify(req: VerifyRequest): Promise<VerifyResult> {
    if (!isPlausibleRegistrationNo(req.registrationNo)) {
      return {
        status: "rejected",
        source: this.id,
        message:
          "That does not look like a registration number. Check it against your certificate and try again.",
      };
    }

    try {
      const res = await fetch(`${this.baseUrl}/api/v1/practitioner/search`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${this.token}`,
        },
        body: JSON.stringify({
          registrationNumber: normaliseRegistrationNo(req.registrationNo),
          councilName: req.council,
          ...(req.year ? { yearOfRegistration: req.year } : {}),
        }),
        // A registry timeout must not hold up onboarding.
        signal: AbortSignal.timeout(8000),
      });

      if (res.status === 404) {
        return {
          status: "rejected",
          source: this.id,
          message: `No ${req.council} record found for that registration number. Check the number and the council.`,
        };
      }
      if (!res.ok) throw new Error(`HPR responded ${res.status}`);

      const data = (await res.json()) as {
        name?: string;
        status?: string;
      };

      const registryName = String(data.name ?? "");
      if (!registryName) {
        return {
          status: "pending",
          source: this.id,
          message:
            "The registry returned a record without a name, so a person will confirm it. You can carry on in the meantime.",
        };
      }

      if (!namesAgree(registryName, req.name)) {
        /*
         * A name mismatch is NOT treated as fraud. Married names, initials and
         * transliteration all produce honest mismatches, and accusing a real
         * doctor is the more expensive mistake. A human decides.
         */
        return {
          status: "pending",
          source: this.id,
          matchedName: registryName,
          message:
            "That registration exists, but the name on it reads differently from your account, so a person will confirm it.",
        };
      }

      return {
        status: "verified",
        source: this.id,
        matchedName: registryName,
        message: "Your registration was confirmed against the national registry.",
      };
    } catch (err) {
      console.error("HPR verification failed:", err);
      // The registry being down is our problem, not the practitioner's.
      return {
        status: "pending",
        source: this.id,
        message:
          "The national registry did not answer just now, so your registration is queued for checking. You can carry on.",
      };
    }
  }
}

/** Chosen once, by environment. */
export function practitionerVerifier(): PractitionerVerifier {
  const base = process.env.ABDM_HPR_BASE_URL;
  const token = process.env.ABDM_HPR_TOKEN;
  if (process.env.VERIFY_PROVIDER === "hpr" && base && token) {
    return new HprVerifier(base, token);
  }
  return new ManualReviewVerifier();
}
