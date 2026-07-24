import { NextResponse } from "next/server";
import { verifyPassword } from "@/lib/auth/password";
import { setSession } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { clientIp, rateLimit, tooMany } from "@/lib/server/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const ip = clientIp(req);
    // 20 attempts / 10 min per IP — stops brute force without hurting users.
    if (!rateLimit(`login:ip:${ip}`, 20, 10 * 60_000)) return tooMany();

    const body = await req.json();
    const email = String(body.email ?? "").trim().toLowerCase();
    const password = String(body.password ?? "");

    // 8 attempts / 15 min per account — stops targeted credential stuffing.
    if (email && !rateLimit(`login:email:${email}`, 8, 15 * 60_000)) return tooMany();

    const user = await db.findUserByEmail(email);
    if (!user || !(await verifyPassword(password, user.passwordHash))) {
      return NextResponse.json({ error: "Wrong email or password." }, { status: 401 });
    }
    await setSession({ id: user.id, role: user.role, name: user.name });
    return NextResponse.json({ ok: true, role: user.role });
  } catch (err) {
    console.error("login failed:", err);
    return NextResponse.json({ error: "Could not sign in." }, { status: 500 });
  }
}
