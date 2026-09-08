import { NextResponse } from "next/server";
import { hashPassword, verifyPassword } from "@/lib/auth/password";
import { getRequestSession, setSession } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { rateLimit, tooMany } from "@/lib/server/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function passwordProblem(value: string) {
  if (value.length < 8 || !/[a-zA-Z]/.test(value) || !/\d/.test(value)) {
    return "Use at least 8 characters with a letter and a number.";
  }
  return null;
}

export async function POST(req: Request) {
  const session = await getRequestSession(req);
  if (!session) return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  if (!(await rateLimit(`password:${session.userId}`, 5, 15 * 60_000))) return tooMany();

  const body = await req.json().catch(() => null);
  const currentPassword = typeof body?.currentPassword === "string" ? body.currentPassword : "";
  const newPassword = typeof body?.newPassword === "string" ? body.newPassword : "";
  const problem = passwordProblem(newPassword);
  if (problem) return NextResponse.json({ error: problem }, { status: 400 });

  const user = await db.findUserById(session.userId);
  if (!user) return NextResponse.json({ error: "Account not found." }, { status: 404 });
  if (!user.passwordHash) {
    return NextResponse.json({ error: "This account uses Google sign-in. Change your Google password instead." }, { status: 400 });
  }
  if (!(await verifyPassword(currentPassword, user.passwordHash))) {
    return NextResponse.json({ error: "Your current password is incorrect." }, { status: 401 });
  }
  if (await verifyPassword(newPassword, user.passwordHash)) {
    return NextResponse.json({ error: "Choose a new password, not your existing one." }, { status: 400 });
  }

  const changed = await db.updateUserPassword(user.id, await hashPassword(newPassword));
  if (!changed) return NextResponse.json({ error: "Could not update your password." }, { status: 500 });
  await db.deleteSessionsForUser(user.id);
  await db.audit({ actorId: user.id, role: user.role, action: "account.password_changed" });
  await setSession({ id: user.id, role: user.role, name: user.name });
  return NextResponse.json({ ok: true });
}
