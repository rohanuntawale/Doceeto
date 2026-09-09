import "server-only";

import { createHash, randomBytes } from "node:crypto";

export const OPS_INVITE_TTL_MS = 30 * 60_000;

export function newOpsProviderInviteCode(): string {
  return `DCT-${randomBytes(9).toString("base64url").toUpperCase()}`;
}

export function hashOpsProviderInviteCode(code: unknown): string {
  return createHash("sha256")
    .update(String(code ?? "").trim().toUpperCase())
    .digest("hex");
}
