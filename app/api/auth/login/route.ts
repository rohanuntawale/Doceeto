import { NextResponse } from "next/server";
import { verifyPassword } from "@/lib/auth/password";
import { setSession } from "@/lib/auth/session";
import { findUserByEmail } from "@/lib/neo4j/repo";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const email = String(body.email ?? "").trim().toLowerCase();
    const password = String(body.password ?? "");
    const user = await findUserByEmail(email);
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
