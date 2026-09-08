import { randomBytes } from "node:crypto";

const [role, emailsArg, hours = "72"] = process.argv.slice(2);
const emails = (emailsArg ?? "")
  .split(",")
  .map((email) => email.trim().toLowerCase())
  .filter(Boolean);
const duration = Number(hours);

if (
  !["doctor", "nurse"].includes(role) ||
  emails.length === 0 ||
  emails.some((email) => !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) ||
  !Number.isFinite(duration) ||
  duration <= 0 ||
  duration > 168
) {
  throw new Error(
    "Usage: node scripts/create-provider-cohort-invite.mjs doctor|nurse email1@example.com,email2@example.com [hours, max 168]",
  );
}

const invite = {
  code: `DCT-${randomBytes(9).toString("base64url").toUpperCase()}`,
  role,
  emails: [...new Set(emails)],
  expiresAt: new Date(Date.now() + duration * 60 * 60_000).toISOString(),
};

console.log("Add this JSON object to the PROVIDER_COHORT_INVITES array in your deployment environment:");
console.log(JSON.stringify(invite, null, 2));
