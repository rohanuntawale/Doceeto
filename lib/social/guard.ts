import "server-only";
import { NextResponse } from "next/server";
import { getRequestSession } from "@/lib/auth/session";
import { isProvider } from "@/lib/auth/constants";
import { DomainError } from "@/lib/db/shared";
import { ensureSchema, socialEnabled } from "@/lib/social/repo";
import type { SessionRecord } from "@/lib/db/shared";

/**
 * Shared entry checks for every social endpoint.
 *
 * The two read endpoints and the one write endpoint all start here, so the
 * questions "is the module even installed", "who is calling" and "are they
 * allowed on this surface at all" are answered once, the same way.
 */

/**
 * WHO THE NETWORK IS FOR.
 *
 * Providers — doctors and nurses. This is a professional network: colleagues
 * discussing cases, referring to each other and comparing practice notes.
 * Patients are deliberately outside it, and that is a product decision with a
 * clinical edge to it — a feed where patients can follow, message and comment
 * on their own doctor's posts turns a professional forum into an unlogged
 * consulting channel, outside the consult record and outside prescribing
 * rules. Ops are excluded too: they moderate through the report queue, not by
 * joining the conversation.
 *
 * Enforced here, at the API, rather than by only hiding the tab. The surface
 * is never the security boundary.
 */
const NETWORK_ROLES = "Doctors and nurses";

export interface SocialCaller {
  session: SessionRecord;
  me: string;
}

/** Config, auth and role — or a Response to return as-is. */
export async function requireSocial(
  req: Request,
): Promise<SocialCaller | { error: NextResponse }> {
  if (!socialEnabled()) {
    return {
      error: NextResponse.json(
        { error: "The network needs a database. Set DATABASE_URL to enable it." },
        { status: 503 },
      ),
    };
  }

  const session = await getRequestSession(req);
  if (!session) {
    return { error: NextResponse.json({ error: "Not signed in." }, { status: 401 }) };
  }
  if (!isProvider(session.role)) {
    return {
      error: NextResponse.json(
        { error: `${NETWORK_ROLES} can use the network.` },
        { status: 403 },
      ),
    };
  }

  // Idempotent, cached per process — the module installs its own tables rather
  // than waiting for someone to re-run the seed after a deploy.
  await ensureSchema();
  return { session, me: session.userId };
}

export const isError = (
  v: SocialCaller | { error: NextResponse },
): v is { error: NextResponse } => "error" in v;

/**
 * Turn a thrown error into the right response.
 *
 * DomainError carries its own status and a message written for a person to
 * read, so it passes through. Anything else is a bug or an outage: it is
 * logged with its context and answered with a generic 500, because the
 * database's own words are not for the browser.
 *
 * The extra fields (`code`, `restricted`, `pending`) ride along when present —
 * they are what let the client offer "follow them first" or "request sent"
 * instead of a flat error.
 */
export function toErrorResponse(err: unknown, context: string): NextResponse {
  if (err instanceof DomainError) {
    const extra = err as DomainError & {
      code?: string;
      restricted?: boolean;
      pending?: boolean;
    };
    return NextResponse.json(
      {
        error: err.message,
        ...(extra.code ? { code: extra.code } : {}),
        ...(extra.restricted ? { restricted: true } : {}),
        ...(extra.pending ? { pending: true } : {}),
      },
      { status: err.status },
    );
  }
  console.error(`social ${context} failed:`, err);
  return NextResponse.json({ error: "Something went wrong. Try again." }, { status: 500 });
}
