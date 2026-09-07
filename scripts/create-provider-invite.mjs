import { createHmac } from "node:crypto";

const [email, role = "doctor", hours = "72"] = process.argv.slice(2);
const secret = process.env.PROVIDER_INVITE_SECRET;
if (!secret || secret.length < 32 || !email?.includes("@") || !["doctor", "nurse"].includes(role) || !(Number(hours) > 0 && Number(hours) <= 168)) {
  throw new Error("Set PROVIDER_INVITE_SECRET (32+ characters), then run: node scripts/create-provider-invite.mjs email doctor|nurse [hours, max 168]");
}
const payload = Buffer.from(JSON.stringify({ email: email.trim().toLowerCase(), role, expiresAt: Date.now() + Number(hours) * 3600000 })).toString("base64url");
console.log(`${payload}.${createHmac("sha256", secret).update(payload).digest("base64url")}`);
