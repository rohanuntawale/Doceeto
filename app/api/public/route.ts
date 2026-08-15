import { NextResponse } from "next/server";
import { db as repo } from "@/lib/db";
import { withRealStatus } from "@/lib/presence";
import { hasOngoingConsult, isOnGig } from "@/lib/scheduling/slots";
import { cadreOf } from "@/lib/nurse";
import { clientIp, rateLimit } from "@/lib/server/rate-limit";
import type { Cadre } from "@/lib/types/domain";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * The ONLY endpoint an anonymous visitor can read.
 *
 * It exists so the landing page's nav can show something real instead of
 * bouncing every curious visitor straight to a sign-in form. Everything else
 * lives behind /api/data, which requires a session.
 *
 * ── What is deliberately NOT in the response ──
 *
 * COORDINATES. Not rounded, not fuzzed — absent. A provider's live lat/lng is
 * the single most sensitive field on the row: publishing it to anyone with a
 * URL tells the internet where a named woman is standing right now. The
 * signed-in patient app needs it to draw a map and earns it with an account;
 * a preview does not.
 *
 * Also absent: email, phone, last-seen timestamps (a precise "online since"
 * is a movement log), gig shelves, and anything about requests or patients.
 *
 * What IS returned is what a provider publishes about themselves to be found
 * by: name, cadre, specialty or services, credentials, experience, rating,
 * fee, photo, and whether they are free right now.
 */

/** The projection. Built field by field — never a spread of the row. */
function publicProvider(d: {
  id: string;
  fullName: string;
  specialty: string;
  cadre?: Cadre;
  skills?: string[];
  verified: boolean;
  rating: number;
  experienceYears: number;
  languages: string[];
  consultFee: number;
  homeVisitFee: number;
  avatarUrl?: string;
  avatarColor: string;
  qualifications?: string;
  status: string;
  available: boolean;
  clinicAddress?: string;
  clinicLat?: number;
  clinicLng?: number;
}) {
  return {
    id: d.id,
    fullName: d.fullName,
    cadre: cadreOf(d),
    specialty: d.specialty,
    skills: d.skills ?? [],
    qualifications: d.qualifications ?? "",
    verified: d.verified,
    rating: d.rating,
    experienceYears: d.experienceYears,
    languages: d.languages ?? [],
    consultFee: d.consultFee,
    homeVisitFee: d.homeVisitFee,
    avatarUrl: d.avatarUrl,
    avatarColor: d.avatarColor,
    /** Online AND not already committed to someone else. */
    available: d.available,
    /**
     * The CLINIC — a published business address, and the only geography in
     * this projection. Note what is still absent: `lat`/`lng`, the doctor's
     * live position. The distinction is the whole point. A clinic is where a
     * practice advertises itself to be found; a live position is where a named
     * person is standing right now, and no URL should hand that to a stranger.
     *
     * Both are gated on `verified`. An unverified doctor's self-declared
     * address has been checked by nobody, and putting an unchecked address on
     * a public map is how a patient ends up at a door that isn't a clinic.
     */
    clinicAddress: d.verified ? (d.clinicAddress ?? "") : "",
    clinicLat: d.verified ? d.clinicLat : undefined,
    clinicLng: d.verified ? d.clinicLng : undefined,
  };
}

export async function GET(req: Request) {
  // Unauthenticated and cacheable-looking, so it needs its own ceiling —
  // otherwise it is a free directory scrape.
  if (!rateLimit(`public:${clientIp(req)}`, 60, 60_000)) {
    return NextResponse.json({ error: "Too many requests." }, { status: 429 });
  }

  const params = new URL(req.url).searchParams;
  const entity = params.get("entity");

  try {
    switch (entity) {
      /**
       * The roster a visitor may browse.
       *
       * `?cadre=nurse` for the nurse list, `?urgent=1` for only those free to
       * take a request this minute — which is what "urgent care" has to mean
       * if the word is to be worth anything.
       */
      case "providers": {
        const wantCadre: Cadre = params.get("cadre") === "nurse" ? "nurse" : "doctor";
        const urgentOnly = params.get("urgent") === "1";

        const [all, requests, signedIn] = await Promise.all([
          repo.getDoctors(),
          repo.getRequests(),
          repo.signedInDoctorIds(),
        ]);

        const now = Date.now();
        const signedInIds = new Set(signedIn);

        const rows = all
          // Presence is DERIVED, exactly as it is for signed-in patients:
          // said they're online, still hold a session, and their app has
          // checked in recently. A stale flag never shows anyone as available.
          .map((raw) => withRealStatus(raw, signedInIds, now))
          .filter((d) => cadreOf(d) === wantCadre)
          // Unverified providers are not discoverable anywhere, and least of
          // all on a page with no sign-in. Ops sign-off is the precondition.
          .filter((d) => d.verified)
          .map((d) => ({
            ...d,
            available:
              d.status === "online" &&
              !isOnGig(requests, d.id) &&
              !hasOngoingConsult(requests, d.id),
          }))
          .filter((d) => (urgentOnly ? d.available : d.status !== "offline"));

        return NextResponse.json({
          providers: rows.map(publicProvider),
          // A count, so the page can say "4 of 26 free right now" rather than
          // leaving a short list to imply the platform is empty.
          total: rows.length,
          availableNow: rows.filter((d) => d.available).length,
        });
      }

      /**
       * The clinic directory behind the landing map.
       *
       * Separate from `providers` because it asks a different question. That
       * one means "who could see me right now", so it filters on derived
       * presence. A clinic is a PLACE: it is on the corner whether or not its
       * doctor happens to hold a session this minute, and a map that empties
       * itself overnight would tell a visitor the platform has no doctors.
       *
       * Still verified-only, and still no live coordinates — the projection is
       * the same one, so it cannot drift from the privacy rules above.
       */
      case "clinics": {
        const all = await repo.getDoctors();
        const rows = all
          .filter((d) => cadreOf(d) === "doctor")
          .filter((d) => d.verified)
          .filter(
            (d) =>
              typeof d.clinicLat === "number" &&
              typeof d.clinicLng === "number" &&
              Boolean(d.clinicAddress?.trim()),
          )
          // `available` is not knowable here and not claimed. The landing map
          // says where a clinic is, never that someone is sitting in it.
          .map((d) => ({ ...d, available: false }));

        return NextResponse.json({
          clinics: rows.map(publicProvider),
          total: rows.length,
        });
      }

      default:
        return NextResponse.json({ error: "Unknown entity." }, { status: 400 });
    }
  } catch (err) {
    console.error(`public read failed (entity=${entity}):`, err);
    return NextResponse.json({ error: "Could not load that right now." }, { status: 500 });
  }
}
