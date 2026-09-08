import { NextResponse } from "next/server";
import { getRequestSession } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { rateLimit, tooMany } from "@/lib/server/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const SUPPORT_INBOX = "shivansh1411@gmail.com";
const CATEGORIES = new Set(["account", "care", "payment", "technical", "other"]);

function clean(value: unknown, max: number) {
  return typeof value === "string" ? value.trim().replace(/\s+/g, " ").slice(0, max) : "";
}

async function notifySupport(ticket: {
  id: string;
  category: string;
  subject: string;
  message: string;
  user: { name: string; email: string; role: string };
}) {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.SUPPORT_FROM_EMAIL;
  if (!apiKey || !from) return false;

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from,
      to: [SUPPORT_INBOX],
      reply_to: ticket.user.email,
      subject: `[${ticket.id}] ${ticket.subject}`,
      text: [
        `Ticket: ${ticket.id}`,
        `Category: ${ticket.category}`,
        `From: ${ticket.user.name} <${ticket.user.email}> (${ticket.user.role})`,
        "",
        ticket.message,
      ].join("\n"),
    }),
  });
  return response.ok;
}

export async function POST(req: Request) {
  const session = await getRequestSession(req);
  if (!session) return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  if (!(await rateLimit(`support-ticket:${session.userId}`, 5, 60 * 60_000))) return tooMany();

  const body = await req.json().catch(() => null);
  const category = clean(body?.category, 32);
  const subject = clean(body?.subject, 120);
  const message = clean(body?.message, 2_000);
  if (!CATEGORIES.has(category)) return NextResponse.json({ error: "Choose a support category." }, { status: 400 });
  if (subject.length < 4) return NextResponse.json({ error: "Add a short subject for your request." }, { status: 400 });
  if (message.length < 12) return NextResponse.json({ error: "Please describe the issue in a little more detail." }, { status: 400 });

  const user = await db.findUserById(session.userId);
  if (!user) return NextResponse.json({ error: "Account not found." }, { status: 404 });
  const ticket = { id: `DCT-${crypto.randomUUID().slice(0, 8).toUpperCase()}`, category, subject, message, user };
  await db.audit({ actorId: user.id, role: user.role, action: "support.ticket_created", meta: ticket });

  try {
    const delivered = await notifySupport(ticket);
    if (!delivered) {
      return NextResponse.json({ error: "Support email is not configured yet. Please email shivansh1411@gmail.com directly." }, { status: 503 });
    }
  } catch {
    return NextResponse.json({ error: "We could not send your ticket right now. Please try again shortly." }, { status: 502 });
  }

  return NextResponse.json({ ok: true, ticketId: ticket.id });
}
