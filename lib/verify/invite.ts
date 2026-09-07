import { createHmac, timingSafeEqual } from "node:crypto";

export function validProviderInvite(token: unknown, email: string, role: string): boolean {
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
