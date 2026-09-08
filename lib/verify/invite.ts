import { createHmac, timingSafeEqual } from "node:crypto";

type ProviderRole = "doctor" | "nurse";

interface CohortInvite {
  code: string;
  role: ProviderRole;
  emails: string[];
  expiresAt: string | number;
}

function equalSecret(left: string, right: string): boolean {
  const a = Buffer.from(left);
  const b = Buffer.from(right);
  return a.length === b.length && timingSafeEqual(a, b);
}

/**
 * A cohort invite is deliberately not universal. Operations can hand one code
 * to a batch they already verified, while the email allowlist remains the
 * actual authorisation boundary if that code is forwarded.
 */
function validCohortInvite(token: unknown, email: string, role: string): boolean {
  if (typeof token !== "string" || token.length < 8 || token.length > 128) return false;
  let campaigns: unknown;
  try {
    campaigns = JSON.parse(process.env.PROVIDER_COHORT_INVITES ?? "[]");
  } catch {
    return false;
  }
  if (!Array.isArray(campaigns)) return false;
  const address = email.trim().toLowerCase();
  return campaigns.some((raw) => {
    if (!raw || typeof raw !== "object") return false;
    const invite = raw as Partial<CohortInvite>;
    if (
      typeof invite.code !== "string" ||
      (invite.role !== "doctor" && invite.role !== "nurse") ||
      invite.role !== role ||
      !Array.isArray(invite.emails) ||
      !equalSecret(invite.code, token.trim())
    ) return false;
    const expiresAt = typeof invite.expiresAt === "number"
      ? invite.expiresAt
      : Date.parse(String(invite.expiresAt ?? ""));
    return Number.isFinite(expiresAt) && expiresAt > Date.now() && invite.emails.some(
      (allowed) => typeof allowed === "string" && allowed.trim().toLowerCase() === address,
    );
  });
}

export function validProviderInvite(token: unknown, email: string, role: string): boolean {
  if (validCohortInvite(token, email, role)) return true;
  const secret = process.env.PROVIDER_INVITE_SECRET;
  if (!secret || secret.length < 32 || typeof token !== "string" || token.length > 2048) return false;
  const [payload, signature, extra] = token.trim().split(".");
  if (!payload || !signature || extra) return false;
  const expected = createHmac("sha256", secret).update(payload).digest();
  const supplied = Buffer.from(signature, "base64url");
  if (supplied.length !== expected.length || !timingSafeEqual(supplied, expected)) return false;
  try {
    const claim = JSON.parse(Buffer.from(payload, "base64url").toString());
    return claim.email === email.trim().toLowerCase() && claim.role === role &&
      Number.isFinite(claim.expiresAt) && claim.expiresAt > Date.now();
  } catch { return false; }
}

export function providerDetailsError(body: Record<string, unknown>): string | null {
  if (typeof body.fullName !== "string" || body.fullName.trim().length < 2) return "Enter your full legal name.";
  if (typeof body.registrationNo !== "string" || !/^[a-zA-Z0-9 /.-]{3,60}$/.test(body.registrationNo.trim())) return "Enter your council registration number.";
  if (typeof body.qualifications !== "string" || !body.qualifications.trim()) return "Enter your qualifications.";
  const age = Number(body.age);
  if (!Number.isInteger(age) || age < 18 || age > 100) return "Enter your age (18 to 100).";
  if (!Array.isArray(body.languages) || !body.languages.some(value => typeof value === "string" && value.trim())) return "Enter at least one consultation language.";
  return null;
}
