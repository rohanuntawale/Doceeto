/**
 * ABHA, the patient half of ABDM.
 *
 * An ABHA number (14 digits, shown as 12-3456-7890-1234) is India's health
 * account. Two reasons we want it, and the second is the one that matters for
 * onboarding:
 *
 *  1. Records follow the patient. An ABHA-linked prescription or report is
 *     readable by the next clinician they see, which is exactly the "nothing
 *     to repeat next time" promise on the landing page.
 *
 *  2. It IS the "import my details from Aadhaar" step. Creating an ABHA runs
 *     on an Aadhaar OTP, and the response carries name, date of birth, gender
 *     and address already verified. The patient types a phone number and an
 *     OTP instead of filling a form, and what lands in the profile is
 *     government-verified rather than self-declared.
 *
 * We never store the Aadhaar number itself. The OTP exchange happens against
 * ABDM and what we keep is the ABHA number and address it returns, which is
 * the whole point of the scheme: an Aadhaar-derived identity you can use
 * without handing the Aadhaar around.
 *
 * As with HPR, this needs ABDM credentials, so an unconfigured deployment gets
 * a verifier that declines cleanly instead of pretending.
 */

export type AbhaProfile = {
  abhaNumber: string;
  /** The human-readable handle, e.g. rajesh@abdm. */
  abhaAddress?: string;
  name?: string;
  gender?: "male" | "female" | "other";
  /** ISO date. */
  dob?: string;
  stateName?: string;
  districtName?: string;
};

export type AbhaSendOtpResult =
  | { ok: true; txnId: string; maskedMobile?: string }
  | { ok: false; message: string };

export type AbhaVerifyResult =
  | { ok: true; profile: AbhaProfile }
  | { ok: false; message: string };

/** 14 digits, with or without the display hyphens. */
export function isAbhaNumber(raw: string): boolean {
  return /^\d{14}$/.test(raw.replace(/[\s-]/g, ""));
}

export function formatAbha(raw: string): string {
  const d = raw.replace(/[\s-]/g, "");
  if (d.length !== 14) return raw;
  return `${d.slice(0, 2)}-${d.slice(2, 6)}-${d.slice(6, 10)}-${d.slice(10)}`;
}

export interface AbhaClient {
  readonly configured: boolean;
  /** Start an Aadhaar OTP to create or link an ABHA. */
  sendAadhaarOtp(aadhaar: string): Promise<AbhaSendOtpResult>;
  /** Complete it, returning the verified profile. */
  verifyAadhaarOtp(txnId: string, otp: string): Promise<AbhaVerifyResult>;
}

class UnconfiguredAbha implements AbhaClient {
  readonly configured = false;
  async sendAadhaarOtp(): Promise<AbhaSendOtpResult> {
    return {
      ok: false,
      message:
        "ABHA linking is not switched on for this deployment yet. You can enter your details by hand for now, and link ABHA later from your account.",
    };
  }
  async verifyAadhaarOtp(): Promise<AbhaVerifyResult> {
    return { ok: false, message: "ABHA linking is not switched on yet." };
  }
}

class AbdmAbha implements AbhaClient {
  readonly configured = true;
  constructor(
    private readonly baseUrl: string,
    private readonly token: string,
  ) {}

  private headers() {
    return {
      "Content-Type": "application/json",
      Authorization: `Bearer ${this.token}`,
    };
  }

  async sendAadhaarOtp(aadhaar: string): Promise<AbhaSendOtpResult> {
    const digits = aadhaar.replace(/\s/g, "");
    if (!/^\d{12}$/.test(digits)) {
      return { ok: false, message: "An Aadhaar number is 12 digits." };
    }
    try {
      const res = await fetch(
        `${this.baseUrl}/v1/registration/aadhaar/generateOtp`,
        {
          method: "POST",
          headers: this.headers(),
          body: JSON.stringify({ aadhaar: digits }),
          signal: AbortSignal.timeout(10_000),
        },
      );
      if (!res.ok) throw new Error(`ABDM responded ${res.status}`);
      const data = (await res.json()) as { txnId?: string; mobileNumber?: string };
      if (!data.txnId) throw new Error("no txnId");
      return { ok: true, txnId: data.txnId, maskedMobile: data.mobileNumber };
    } catch (err) {
      console.error("ABHA OTP request failed:", err);
      return {
        ok: false,
        message:
          "Could not reach ABDM to send the OTP. Try again, or enter your details by hand.",
      };
    }
  }

  async verifyAadhaarOtp(txnId: string, otp: string): Promise<AbhaVerifyResult> {
    if (!/^\d{4,6}$/.test(otp.trim())) {
      return { ok: false, message: "Enter the OTP you received." };
    }
    try {
      const res = await fetch(
        `${this.baseUrl}/v1/registration/aadhaar/verifyOTP`,
        {
          method: "POST",
          headers: this.headers(),
          body: JSON.stringify({ txnId, otp: otp.trim() }),
          signal: AbortSignal.timeout(10_000),
        },
      );
      if (res.status === 401 || res.status === 400) {
        return { ok: false, message: "That OTP was not accepted. Try again." };
      }
      if (!res.ok) throw new Error(`ABDM responded ${res.status}`);

      const d = (await res.json()) as Record<string, unknown>;
      const num = String(d.healthIdNumber ?? d.ABHANumber ?? "").replace(/-/g, "");
      if (!num) throw new Error("no ABHA number in response");

      const g = String(d.gender ?? "").toUpperCase();
      return {
        ok: true,
        profile: {
          abhaNumber: num,
          abhaAddress: d.healthId ? String(d.healthId) : undefined,
          name: d.name ? String(d.name) : undefined,
          gender: g === "M" ? "male" : g === "F" ? "female" : g ? "other" : undefined,
          dob: isoDob(d),
          stateName: d.stateName ? String(d.stateName) : undefined,
          districtName: d.districtName ? String(d.districtName) : undefined,
        },
      };
    } catch (err) {
      console.error("ABHA OTP verification failed:", err);
      return {
        ok: false,
        message: "Could not complete ABHA linking just now. Please try again.",
      };
    }
  }
}

/** ABDM returns the date in parts on some endpoints and as a string on others. */
function isoDob(d: Record<string, unknown>): string | undefined {
  if (typeof d.dateOfBirth === "string" && d.dateOfBirth) return d.dateOfBirth;
  const y = String(d.yearOfBirth ?? "");
  if (!/^\d{4}$/.test(y)) return undefined;
  const m = String(d.monthOfBirth ?? "01").padStart(2, "0");
  const day = String(d.dayOfBirth ?? "01").padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function abhaClient(): AbhaClient {
  const base = process.env.ABDM_ABHA_BASE_URL;
  const token = process.env.ABDM_ABHA_TOKEN;
  if (base && token) return new AbdmAbha(base, token);
  return new UnconfiguredAbha();
}
