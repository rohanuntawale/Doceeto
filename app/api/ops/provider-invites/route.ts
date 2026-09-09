import { NextResponse } from "next/server";
import { getRequestSession } from "@/lib/auth/session";
import { db } from "@/lib/db";
import {
  hashOpsProviderInviteCode,
  newOpsProviderInviteCode,
  OPS_INVITE_TTL_MS,
} from "@/lib/verify/ops-provider-invite";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const session = await getRequestSession(req);
  if (session?.role !== "ops") {
    return NextResponse.json({ error: "Ops access required." }, { status: 403 });
  }

  const body = await req.json().catch(() => ({}));
  const role = body.role === "nurse" ? "nurse" : body.role === "doctor" ? "doctor" : null;
  if (!role) return NextResponse.json({ error: "Choose doctor or nurse." }, { status: 400 });

  const code = newOpsProviderInviteCode();
  const expiresAt = new Date(Date.now() + OPS_INVITE_TTL_MS).toISOString();
  await db.createProviderInvite({
    codeHash: hashOpsProviderInviteCode(code),
    role,
    createdById: session.userId,
    expiresAt,
  });
  await db.audit({
    actorId: session.userId,
    role: "ops",
    action: "provider.invite_issued",
    meta: { role, expiresAt },
  });

  return NextResponse.json({ code, role, expiresAt });
}
