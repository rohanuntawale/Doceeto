import { NextResponse } from "next/server";
import { lookupRegistration, isPlausibleRegistrationNo } from "@/lib/registry";
import { clientIp, rateLimit } from "@/lib/server/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Autofill a provider's details from their council registration number.
 *
 * Server-side so the external register never sees a visitor's IP and so the
 * call can be rate-limited: this endpoint is open to anyone mid-signup, and
 * without a ceiling it is a free proxy for enumerating the medical register.
 *
 * Returns candidate matches only. Nothing here grants verification — see the
 * note in lib/registry.
 */
export async function GET(req: Request) {
  if (!rateLimit(`registry:${clientIp(req)}`, 12, 60_000)) {
    return NextResponse.json(
      { error: "Too many lookups. Wait a minute and try again." },
      { status: 429 },
    );
  }

  const params = new URL(req.url).searchParams;
  const registrationNo = (params.get("registrationNo") ?? "").trim();
  const council = params.get("council") ?? undefined;

  if (!isPlausibleRegistrationNo(registrationNo)) {
    return NextResponse.json(
      { error: "Enter a valid registration number." },
      { status: 400 },
    );
  }

  try {
    const result = await lookupRegistration(registrationNo, council);
    return NextResponse.json(result);
  } catch (err) {
    console.error("registry lookup failed:", err);
    // Never block signup on this. The form falls back to manual entry.
    return NextResponse.json({ matches: [], unavailable: true });
  }
}
