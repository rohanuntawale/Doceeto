import { NextResponse } from "next/server";
import { getRequestSession } from "@/lib/auth/session";
import { db as repo, type Near } from "@/lib/db";
import { hasOngoingConsult, isOnGig, visibleToDoctor } from "@/lib/scheduling/slots";
import { activeGigs, gigFromPrice } from "@/lib/gigs/rules";
import { withRealStatus } from "@/lib/presence";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Parse ?near=lat,lng&km=10 into a geo filter (bounded to 100 km). */
function parseNear(params: URLSearchParams): Near | undefined {
  const near = params.get("near");
  if (!near) return undefined;
  const [latS, lngS] = near.split(",");
  const lat = Number(latS);
  const lng = Number(lngS);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return undefined;
  const km = Math.min(100, Math.max(0.2, Number(params.get("km")) || 10));
  return { lat, lng, km };
}

/**
 * Single read endpoint. Authorization is enforced HERE (there is no RLS):
 * each role only receives the rows — and the coordinates — it is allowed
 * to see. Supports geo filtering: ?entity=doctors&near=21.14,79.08&km=10
 */
export async function GET(req: Request) {
  // Resolved against the calling surface, so a browser holding both a patient
  // and a doctor session gets answered as whichever app is asking.
  const session = await getRequestSession(req);
  if (!session) return NextResponse.json({ error: "Not signed in." }, { status: 401 });

  const params = new URL(req.url).searchParams;
  const entity = params.get("entity");
  const near = parseNear(params);
  const me = session.userId;
  const role = session.role;

  try {
    switch (entity) {
      case "doctors": {
        const all = await repo.getDoctors(near);
        // Availability that a patient cannot derive themselves (they only ever
        // receive their own requests) is attached here: whether each doctor is
        // on a gig, and what they're offering. Read-only — none of it is stored.
        const [requests, gigs, signedIn] = await Promise.all([
          repo.getRequests(),
          repo.getGigs(),
          repo.signedInDoctorIds(),
        ]);
        // THE status every surface sees is derived here, not read off the row.
        // A doctor is only shown online if they asked to be, still hold a live
        // session, and their cockpit has reported in recently — see
        // lib/presence.ts. Doing it at this one read means the map, the list,
        // the ops console and every count agree, and none of them can show
        // someone who has walked away as available.
        const now = Date.now();
        const signedInIds = new Set(signedIn);
        const decorated = all.map((raw) => {
          const d = withRealStatus(raw, signedInIds, now);
          const live = activeGigs(gigs.filter((g) => g.doctorId === d.id));
          return {
            ...d,
            onGig: isOnGig(requests, d.id),
            onConsult: hasOngoingConsult(requests, d.id),
            gigCount: live.length,
            gigFromPrice: gigFromPrice(live),
          };
        });
        if (role === "ops") return NextResponse.json(decorated);
        // Offline means OFF the platform: an offline doctor is not
        // discoverable at all — no pin, no list row, no gig teasers, no
        // profile. Two carve-outs keep existing relationships intact:
        //   • a doctor always receives their own row (the cockpit needs it
        //     to render the dashboard and flip back online), and
        //   • a patient keeps a doctor tied to any of THEIR OWN requests,
        //     so live trackers and consult history never lose the name.
        const mine = new Set(
          role === "patient"
            ? requests.filter((r) => r.patientId === me).map((r) => r.doctorId)
            : [],
        );
        return NextResponse.json(
          decorated
            .filter((d) => d.status !== "offline" || d.id === me || mine.has(d.id))
            .map((d) => {
              // Stale coordinates never leave the server; a doctor mid-gig
              // has no hireable shelf, so their gig teasers vanish with it.
              const out = d.status === "offline" ? { ...d, lat: 0, lng: 0 } : { ...d };
              if (d.onGig || d.status === "offline") {
                out.gigCount = 0;
                out.gigFromPrice = null;
              }
              return out;
            }),
        );
      }

      // Everything ops can see about one doctor: profile, the account behind
      // it, reviews, consult history, gigs and the wallet ledger. Ops only —
      // it returns the account email and unmasked coordinates.
      case "doctorDetail": {
        if (role !== "ops")
          return NextResponse.json({ error: "Ops only." }, { status: 403 });
        const doctorId = params.get("doctorId");
        if (!doctorId)
          return NextResponse.json({ error: "doctorId is required." }, { status: 400 });
        const detail = await repo.getDoctorDetail(doctorId);
        if (!detail)
          return NextResponse.json({ error: "Doctor not found." }, { status: 404 });
        // Same derived availability the roster shows, so the profile agrees
        // with the row that linked to it.
        const [requests, gigs] = await Promise.all([repo.getRequests(), repo.getGigs()]);
        const live = activeGigs(gigs.filter((g) => g.doctorId === doctorId));
        return NextResponse.json({
          ...detail,
          doctor: {
            ...detail.doctor,
            onGig: isOnGig(requests, doctorId),
            onConsult: hasOngoingConsult(requests, doctorId),
            gigCount: live.length,
            gigFromPrice: gigFromPrice(live),
          },
        });
      }

      case "ambulances": {
        // Fleet positions are operational data — ops only.
        if (role !== "ops") return NextResponse.json([]);
        return NextResponse.json(await repo.getAmbulances());
      }

      case "reviews":
        return NextResponse.json(
          await repo.getReviews(params.get("doctorId") ?? undefined),
        );

      case "gigs": {
        const forDoctor = params.get("doctorId");
        const gigs = await repo.getGigs(forDoctor ?? undefined);
        if (role === "ops") return NextResponse.json(gigs);
        // A doctor managing their own shelf needs the paused and archived rows
        // too. Everyone else — including that doctor browsing someone else —
        // only ever sees what is actually hireable: active listings from a
        // doctor who is NOT already committed to a gig. Accepting a hire pulls
        // the whole shelf until it's completed — one gig at a time.
        if (role === "doctor" && !forDoctor)
          return NextResponse.json(gigs.filter((g) => g.doctorId === me));
        const active = gigs.filter((g) => g.status === "active");
        const [requests, doctors] = await Promise.all([
          repo.getRequests(),
          repo.getDoctors(),
        ]);
        // An offline doctor's shelf goes offline with them — going offline
        // takes the doctor off the platform as a whole, gigs included.
        const offline = new Set(
          doctors.filter((d) => d.status === "offline").map((d) => d.id),
        );
        return NextResponse.json(
          active.filter((g) => !offline.has(g.doctorId) && !isOnGig(requests, g.doctorId)),
        );
      }

      case "requests": {
        const all = await repo.getRequests(near);
        if (role === "ops") return NextResponse.json(all);
        if (role === "patient")
          return NextResponse.json(all.filter((r) => r.patientId === me));
        // doctor: open broadcasts, directed-to-me, requests aimed at a
        // display-only seed doctor (claimable by any online doctor since
        // seed rows have no account), and my own accepted/history. While a
        // consult is in progress, pending emergencies are withheld —
        // visibleToDoctor() owns that rule for every surface.
        //
        // `all` is already narrowed by ?near=, which would make "am I busy?"
        // depend on the map radius, so the live consult is looked up over
        // the unfiltered set.
        const busy = hasOngoingConsult(near ? await repo.getRequests() : all, me);
        return NextResponse.json(
          all.filter((r) => visibleToDoctor(r, { doctorId: me, busy })),
        );
      }

      case "sos": {
        const all = await repo.getSosEvents(near);
        if (role === "ops") return NextResponse.json(all);
        if (role === "patient")
          return NextResponse.json(all.filter((s) => s.patientId === me));
        // doctor: active emergencies they can respond to + their own. Same
        // rule as consults — a doctor mid-visit isn't shown alerts they
        // can't leave for; the ones they already own stay visible.
        const busy = hasOngoingConsult(await repo.getRequests(), me);
        return NextResponse.json(
          all.filter((s) =>
            s.doctorId === me
              ? true
              : !busy && (s.status === "open" || s.status === "assigned"),
          ),
        );
      }

      case "orders": {
        const all = await repo.getOrders();
        if (role === "ops") return NextResponse.json(all);
        if (role === "patient")
          return NextResponse.json(all.filter((o) => o.patientId === me));
        return NextResponse.json([]); // doctors don't see orders
      }

      case "transactions": {
        // A doctor sees only their own wallet ledger; ops sees all.
        const all = await repo.getTransactions();
        if (role === "ops") return NextResponse.json(all);
        if (role === "doctor")
          return NextResponse.json(all.filter((t) => t.doctorId === me));
        return NextResponse.json([]);
      }

      default:
        return NextResponse.json({ error: "Unknown entity." }, { status: 400 });
    }
  } catch (err) {
    console.error("data read failed:", err);
    return NextResponse.json({ error: "Could not load data." }, { status: 500 });
  }
}
