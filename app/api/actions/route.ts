import { NextResponse } from "next/server";
import { getRequestSession } from "@/lib/auth/session";
import { emitChange } from "@/lib/server/events";
import { db as repo, DomainError } from "@/lib/db";
import { coerceBookingMode, normalizeAvailability } from "@/lib/scheduling/slots";
import { CANCEL_REASON_MAX } from "@/lib/scheduling/booking";
import { ARRIVE_RADIUS_KM } from "@/lib/scheduling/trip";
import { GIG_DESC_MAX, GIG_TITLE_MAX, sanitizeGigPatch } from "@/lib/gigs/rules";
import { haversineKm } from "@/lib/utils/geo";
import { rateLimit } from "@/lib/server/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const SOS_CATEGORIES = new Set(["cardiac", "trauma", "respiratory", "stroke", "obstetric", "other"]);
const CONSULT_TYPES = new Set(["video", "home_visit", "clinic"]);
const DOCTOR_STATUSES = new Set(["online", "busy", "offline"]);
const GIG_STATUSES = new Set(["active", "paused", "archived"]);

/** A cancellation reason, trimmed and capped. Empty string when absent. */
const reasonOf = (raw: unknown) =>
  typeof raw === "string" ? raw.trim().slice(0, CANCEL_REASON_MAX) : "";

/**
 * A usable coordinate pair, or null when the payload carries none. Every row
 * the maps and `?near=` queries read is filtered on lat/lng, so a row saved
 * without them is invisible to the people who need it — reject at the door.
 */
function coords(raw: Record<string, unknown>): { lat: number; lng: number } | null {
  const lat = Number(raw.lat);
  const lng = Number(raw.lng);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) return null;
  return { lat, lng };
}

/**
 * Allowlist + normalize a doctor profile patch. Only the fields a doctor is
 * permitted to edit pass through (never rating/verified/status/id), and each
 * is coerced + length-capped server-side so the browser can't over-send.
 */
function sanitizeDoctorPatch(raw: unknown): Record<string, unknown> {
  const p = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const out: Record<string, unknown> = {};
  const str = (v: unknown, cap: number) =>
    typeof v === "string" ? v.trim().slice(0, cap) : undefined;
  const num = (v: unknown, min: number, max: number) =>
    Math.max(min, Math.min(max, Math.round(Number(v) || 0)));

  const fullName = str(p.fullName, 80);
  if (fullName) out.fullName = fullName; // never blank out the name
  const specialty = str(p.specialty, 60);
  if (specialty) out.specialty = specialty;
  if (p.consultFee !== undefined) out.consultFee = num(p.consultFee, 0, 100_000);
  if (p.homeVisitFee !== undefined) out.homeVisitFee = num(p.homeVisitFee, 0, 100_000);
  if (p.experienceYears !== undefined) out.experienceYears = num(p.experienceYears, 0, 70);
  if (p.age !== undefined) out.age = num(p.age, 18, 100);
  // Credential text — empty string is allowed (reverts to the fallback on the
  // patient profile), so include it whenever the key was sent.
  if (p.qualifications !== undefined) out.qualifications = str(p.qualifications, 200);
  if (p.education !== undefined) out.education = str(p.education, 200);
  if (p.about !== undefined) out.about = str(p.about, 600);
  if (p.registrationNo !== undefined) out.registrationNo = str(p.registrationNo, 60);
  if (p.clinicAddress !== undefined) out.clinicAddress = str(p.clinicAddress, 160);
  if (Array.isArray(p.languages)) {
    out.languages = p.languages
      .map((x) => String(x).trim())
      .filter(Boolean)
      .slice(0, 6);
  }
  // Live device position from the cockpit's location publisher.
  if (typeof p.lat === "number") out.lat = p.lat;
  if (typeof p.lng === "number") out.lng = p.lng;
  return out;
}

/**
 * Single write endpoint. Every action re-checks the caller's role and
 * ownership server-side, so the browser can never act as someone else.
 * Each successful write: (1) appends an Audit node, (2) emits a change
 * event so SSE-connected clients refresh instantly.
 */
export async function POST(req: Request) {
  // The acting session is the one belonging to the surface that made the call,
  // so a doctor accepting a gig can never be resolved as the patient (or vice
  // versa) when both accounts are signed in on this browser.
  const session = await getRequestSession(req);
  if (!session) return NextResponse.json({ error: "Not signed in." }, { status: 401 });

  let body: { action?: string; payload?: Record<string, unknown> };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Malformed request body." }, { status: 400 });
  }
  const action = String(body.action ?? "");
  const payload = body.payload ?? {};
  const me = session.userId;
  const role = session.role;

  const needs = (r: string) =>
    NextResponse.json({ error: `Only ${r} can do this.` }, { status: 403 });
  const bad = (msg: string) => NextResponse.json({ error: msg }, { status: 400 });

  /** Wrap a result: audit + emit + respond. */
  const done = (body: unknown, entities: string[]) => {
    void repo.audit({ actorId: me, role, action, meta: payload });
    emitChange(entities);
    return NextResponse.json(body);
  };

  /**
   * Going offline takes a doctor off the platform, not just off the map: while
   * offline they cannot put anything new in front of patients or claim new
   * work. Enforced HERE rather than only in the cockpit, because the toggle is
   * the doctor's own promise of availability and a stale tab (or a hand-rolled
   * request) must not be able to publish around it.
   *
   * Withdrawing is deliberately still allowed — pausing, archiving, deleting
   * and finishing what they already took. Blocking those would trap a doctor
   * who went offline mid-shelf.
   *
   * Returns an error response to hand straight back, or null when they're on.
   */
  const blockedWhenOffline = async (msg: string) => {
    const doc = await repo.getDoctorById(me);
    if (doc && doc.status !== "offline") return null;
    return NextResponse.json({ error: msg }, { status: 409 });
  };
  const OFFLINE_PUBLISH = "You're offline. Go online to publish a gig.";
  const OFFLINE_WORK = "You're offline. Go online to take new work.";

  /**
   * Patients should see a face before they see a listing: a doctor without a
   * profile photo cannot go online or put a gig in front of patients. Enforced
   * HERE, not just in the cockpit UI, for the same reason as the offline rule —
   * a stale tab or hand-rolled request must not publish around it.
   */
  const blockedWithoutPhoto = async () => {
    const doc = await repo.getDoctorById(me);
    if (doc?.avatarUrl) return null;
    return NextResponse.json(
      { error: "Add a profile photo first — patients need to see who's treating them. Add one from your profile page." },
      { status: 409 },
    );
  };

  try {
    switch (action) {
      // ── Patient creates (identity is taken from the session) ──
      case "createSos": {
        if (role !== "patient") return needs("patients");
        const at = coords(payload);
        if (!at) return bad("An emergency needs your location to reach a doctor.");
        return done(
          await repo.createSos({
            ...payload,
            ...at,
            // Unknown category degrades to "other" rather than failing the
            // alert — the patient refines it via categorizeSos right after.
            category: SOS_CATEGORIES.has(String(payload.category))
              ? String(payload.category)
              : "other",
            address: String(payload.address ?? "").slice(0, 200),
            notes: payload.notes ? String(payload.notes).slice(0, 600) : undefined,
            patientId: me,
            patientName: session.name,
          }),
          ["sos", "ambulances"],
        );
      }
      case "createRequest": {
        if (role !== "patient") return needs("patients");
        const at = coords(payload);
        if (!at) return bad("A booking needs your location.");
        // Three paths: a booked slot, a hired gig, or an urgent call-out that
        // may go to one doctor or broadcast to the whole pool.
        const mode = coerceBookingMode(payload.mode);
        const doctorId =
          typeof payload.doctorId === "string" && payload.doctorId ? payload.doctorId : null;
        const scheduledAt =
          typeof payload.scheduledAt === "string" ? payload.scheduledAt : null;
        const gigId =
          typeof payload.gigId === "string" && payload.gigId ? payload.gigId : null;

        // A gig's visit type and price are read off the listing by the repo,
        // so neither is required (or trusted) here.
        const type = String(payload.type ?? "");
        if (mode !== "gig" && !CONSULT_TYPES.has(type))
          return bad("Pick a valid consult type.");

        // For everything but a gig the fee arrives from the client; bound it so
        // a hand-rolled request can't credit a doctor's wallet with a negative
        // amount. A gig hire re-prices from the gig row, as orders do from the
        // catalog, so a caller can never name their own price.
        const fee = Number(payload.fee);
        if (mode !== "gig" && (!Number.isFinite(fee) || fee < 0 || fee > 100_000))
          return bad("That consult fee is not valid.");

        if (mode === "scheduled") {
          if (!doctorId) return bad("Pick a doctor before choosing a time.");
          if (!scheduledAt) return bad("Pick an appointment time.");
          // The repo re-checks this against the real grid; this only keeps
          // unparseable junk out of the slot resolver.
          if (!Number.isFinite(Date.parse(scheduledAt)))
            return bad("That appointment time isn't valid.");
        }
        if (mode === "gig") {
          if (!doctorId) return bad("Pick a doctor before hiring a gig.");
          if (!gigId) return bad("Pick a gig to hire.");
        }
        // Offline means off the platform: nothing may be booked against an
        // offline doctor — not a gig, not a slot, not a directed emergency.
        // (Broadcasts carry no doctorId and reach whoever is online.)
        if (doctorId) {
          const target = await repo.getDoctorById(doctorId);
          if (!target || target.status === "offline")
            return bad("That doctor is offline right now. Pick another doctor.");
        }
        return done(
          await repo.createRequest({
            ...at,
            type,
            mode,
            scheduledAt,
            gigId,
            doctorId,
            paymentMethod: payload.paymentMethod === "cash" ? "cash" : "online",
            fee: mode === "gig" ? 0 : Math.round(fee),
            symptoms: String(payload.symptoms ?? "").slice(0, 1000),
            address: String(payload.address ?? "").slice(0, 200),
            patientId: me,
            patientName: session.name,
          }),
          ["requests"],
        );
      }
      case "cancelRequest": {
        // Either side can call off a booking; the repo checks it is theirs
        // and still cancellable. Cancelling is what frees the slot.
        //
        // A doctor must give a reason — they are standing a patient down, and
        // the reason travels back to them. The repo enforces it too, and for a
        // broadcast it re-pools the request instead of ending it.
        if (role !== "patient" && role !== "doctor")
          return needs("patients or doctors");
        const reason = reasonOf(payload.reason);
        if (role === "doctor" && !reason)
          return bad("Tell the patient why you're cancelling.");
        await repo.cancelRequest(String(payload.id), { id: me, role }, { reason });
        return done({ ok: true }, ["requests"]);
      }
      case "createOrder": {
        if (role !== "patient") return needs("patients");
        // The repo re-prices every line from the catalog and rejects unknown
        // items, so only the shape needs checking here.
        if (!Array.isArray(payload.items) || payload.items.length === 0)
          return bad("The order has no items.");
        return done(
          await repo.createOrder({
            items: payload.items as { name: string; qty: number }[],
            total: 0, // ignored — priced server-side from the catalog
            address: String(payload.address ?? "").slice(0, 200),
            darkStore: String(payload.darkStore ?? ""),
            patientId: me,
            patientName: session.name,
          }),
          ["orders"],
        );
      }
      case "createReview":
        if (role !== "patient") return needs("patients");
        return done(
          await repo.createReview({
            patientId: me,
            patientName: session.name,
            doctorId: String(payload.doctorId),
            requestId: String(payload.requestId),
            rating: Number(payload.rating),
            comment: String(payload.comment ?? ""),
          }),
          ["reviews", "doctors"],
        );
      case "ratePatient":
        // Doctor rates the patient after a completed consult they ran.
        if (role !== "doctor") return needs("doctors");
        await repo.ratePatient({
          doctorId: me,
          doctorName: session.name,
          requestId: String(payload.requestId),
          rating: Number(payload.rating),
          comment: String(payload.comment ?? ""),
        });
        return done({ ok: true }, ["requests"]);
      case "categorizeSos": {
        // Patient refines the type of THEIR OWN already-sent SOS. The alert +
        // location reach doctors first (as "other"); this updates the type.
        if (role !== "patient") return needs("patients");
        const sos = await repo.getSosById(String(payload.sosId));
        if (!sos || sos.patientId !== me)
          return NextResponse.json({ error: "That emergency no longer exists." }, { status: 404 });
        const category = SOS_CATEGORIES.has(String(payload.category))
          ? String(payload.category)
          : "other";
        await repo.setSosCategory(String(payload.sosId), category);
        return done({ ok: true }, ["sos"]);
      }

      // ── Doctor actions (only on their own record) ──
      case "heartbeat": {
        // "My cockpit is still open." Deliberately NOT routed through done():
        // this fires every 30 seconds per doctor, and auditing or broadcasting
        // each one would bury the audit log and trigger a refetch storm. It
        // touches last_seen and says nothing else.
        if (role !== "doctor") return needs("doctors");
        await repo.touchDoctor(me);
        return NextResponse.json({ ok: true });
      }
      case "setDoctorStatus": {
        if (role !== "doctor") return needs("doctors");
        // An off-list status would defeat the offline-coordinate rule in
        // /api/data and break every status pill that indexes by it.
        const status = String(payload.status ?? "");
        if (!DOCTOR_STATUSES.has(status)) return bad("Unknown status.");
        // Going online is going on show — the photo requirement bites here.
        // Going offline is always allowed.
        if (status !== "offline") {
          const noPhoto = await blockedWithoutPhoto();
          if (noPhoto) return noPhoto;
        }
        await repo.setDoctorStatus(me, status);
        return done({ ok: true }, ["doctors"]);
      }
      case "updateDoctor": {
        if (role !== "doctor") return needs("doctors");
        const patch = sanitizeDoctorPatch(payload.patch);
        await repo.updateDoctor(me, patch);
        // Delivery-app auto-arrival: the cockpit streams the doctor's live
        // position through this action, so each fix is checked against any
        // home visit they're en route to. Inside the radius the visit flips
        // to "arrived" by itself — the doctor never taps a button, and the
        // patient's tracker (and arrival notification) fire off the change.
        if (typeof patch.lat === "number" && typeof patch.lng === "number") {
          const here = { lat: patch.lat, lng: patch.lng };
          const enroute = (await repo.getRequests()).filter(
            (r) =>
              r.doctorId === me &&
              r.status === "accepted" &&
              r.tripStage === "enroute" &&
              r.type === "home_visit",
          );
          for (const r of enroute) {
            if (haversineKm(here, { lat: r.lat, lng: r.lng }) <= ARRIVE_RADIUS_KM) {
              await repo.advanceTrip(r.id, me); // enroute → arrived
              emitChange(["requests"]);
            }
          }
        }
        return done({ ok: true }, ["doctors"]);
      }
      case "setAvailability": {
        if (role !== "doctor") return needs("doctors");
        // normalizeAvailability is the same function the slot grid is built
        // from, so anything it lets through is guaranteed bookable.
        await repo.setDoctorAvailability(me, normalizeAvailability(payload.availability));
        return done({ ok: true }, ["doctors"]);
      }

      // ── Gig listings (a doctor's own shelf) ──
      case "createGig": {
        if (role !== "doctor") return needs("doctors");
        const offline = await blockedWhenOffline(OFFLINE_PUBLISH);
        if (offline) return offline;
        // Belt and braces: doctors who were online before the photo rule
        // shipped still can't put a new listing up without one.
        const noPhoto = await blockedWithoutPhoto();
        if (noPhoto) return noPhoto;
        const title = String(payload.title ?? "").trim();
        if (!title) return bad("Give the gig a title.");
        const type = String(payload.type ?? "");
        if (!CONSULT_TYPES.has(type)) return bad("Pick where the gig happens.");
        const price = Number(payload.price);
        if (!Number.isFinite(price) || price <= 0) return bad("Set a price for the gig.");
        // normalizeGig in the repo caps and snaps everything; this only keeps
        // obviously unusable payloads out with a message worth reading.
        return done(
          await repo.createGig({
            doctorId: me,
            title: title.slice(0, GIG_TITLE_MAX),
            description: String(payload.description ?? "").slice(0, GIG_DESC_MAX),
            type,
            price,
            durationMinutes: Number(payload.durationMinutes),
          }),
          ["gigs"],
        );
      }
      case "updateGig": {
        if (role !== "doctor") return needs("doctors");
        const patch = sanitizeGigPatch(payload.patch);
        if (Object.keys(patch).length === 0) return bad("Nothing to update.");
        // Editing a paused listing while offline is fine — it isn't on show.
        // Re-publishing through the patch is the same act as tapping Publish.
        if (patch.status === "active") {
          const offline = await blockedWhenOffline(OFFLINE_PUBLISH);
          if (offline) return offline;
          const noPhoto = await blockedWithoutPhoto();
          if (noPhoto) return noPhoto;
        }
        // The repo re-checks ownership, so a doctor can only edit their own.
        await repo.updateGig(String(payload.id), me, patch);
        return done({ ok: true }, ["gigs"]);
      }
      case "setGigStatus": {
        if (role !== "doctor") return needs("doctors");
        const status = String(payload.status ?? "");
        if (!GIG_STATUSES.has(status)) return bad("Unknown gig status.");
        // Pausing and archiving stay open while offline; only going live is
        // barred, since that is what puts the gig in front of patients.
        if (status === "active") {
          const offline = await blockedWhenOffline(OFFLINE_PUBLISH);
          if (offline) return offline;
          const noPhoto = await blockedWithoutPhoto();
          if (noPhoto) return noPhoto;
        }
        await repo.setGigStatus(String(payload.id), me, status as "active");
        return done({ ok: true }, ["gigs"]);
      }
      case "deleteGig": {
        if (role !== "doctor") return needs("doctors");
        // The repo re-checks ownership and refuses while a hire is waiting.
        await repo.deleteGig(String(payload.id), me);
        return done({ ok: true }, ["gigs"]);
      }
      case "acceptRequest": {
        if (role !== "doctor") return needs("doctors");
        // Claiming a patient is a promise to show up; an offline doctor has
        // just said they can't.
        const offline = await blockedWhenOffline(OFFLINE_WORK);
        if (offline) return offline;
        const won = await repo.acceptRequest(String(payload.id), me);
        // Losing the race used to return 200, so the loser still saw
        // "Consult accepted". Say what actually happened instead.
        if (!won)
          return NextResponse.json(
            { error: "Another doctor just took that one." },
            { status: 409 },
          );
        // "gigs" too: accepting a gig hire auto-pauses that listing, and the
        // shelf + patient profiles must reflect it immediately.
        return done({ ok: true }, ["requests", "gigs"]);
      }
      case "declineRequest":
        if (role !== "doctor") return needs("doctors");
        // Passing `me` makes the repo check the request is actually theirs
        // to decline — declining frees a slot someone else may own. For a
        // broadcast the repo records a pass and leaves it pending, so other
        // doctors can still take it. A reason is optional here: nobody has
        // been promised anything yet.
        await repo.declineRequest(String(payload.id), me, reasonOf(payload.reason));
        return done({ ok: true }, ["requests"]);
      case "advanceTrip": {
        if (role !== "doctor") return needs("doctors");
        // One step only, derived server-side — the client's idea of "next" is
        // ignored, exactly as with advanceSos and advanceOrder.
        const stage = await repo.advanceTrip(String(payload.id), me);
        if (stage === null)
          return bad("Ask the patient for their 4-digit code to start the consult.");
        return done({ ok: true, tripStage: stage }, ["requests"]);
      }

      // ── Arrival confirmation (the ride-hailing handshake) ──
      case "verifyStartCode": {
        if (role !== "doctor") return needs("doctors");
        const code = String(payload.code ?? "").trim();
        if (!/^\d{4}$/.test(code)) return bad("Enter the 4-digit code from the patient.");
        const result = await repo.verifyStartCode(String(payload.id), me, code);
        if (!result.ok) {
          // 409, not 400: the request was well-formed, the digits were wrong.
          return NextResponse.json(
            {
              error:
                result.reason === "locked"
                  ? "Too many wrong codes. Ask the patient to generate a new one."
                  : `That code doesn't match. ${result.attemptsLeft} ${result.attemptsLeft === 1 ? "try" : "tries"} left.`,
              reason: result.reason,
              attemptsLeft: result.attemptsLeft,
            },
            { status: 409 },
          );
        }
        return done({ ok: true, tripStage: "in_progress" }, ["requests"]);
      }
      case "startConsultAsPatient": {
        // The escape hatch: a dead doctor phone, or a patient who would
        // rather tap than read digits aloud. Same proof, opposite direction.
        if (role !== "patient") return needs("patients");
        await repo.startConsultAsPatient(String(payload.id), me);
        return done({ ok: true }, ["requests"]);
      }
      case "reissueStartCode": {
        if (role !== "patient") return needs("patients");
        // Cheap to call but not free — a doctor watching the screen shouldn't
        // be able to farm codes by pestering the patient to re-roll.
        if (!rateLimit(`startcode:${me}`, 10, 10 * 60_000)) {
          return NextResponse.json(
            { error: "Too many new codes. Try again in a few minutes." },
            { status: 429 },
          );
        }
        const code = await repo.reissueStartCode(String(payload.id), me);
        return done({ ok: true, startCode: code }, ["requests"]);
      }

      case "completeRequest": {
        if (role !== "doctor") return needs("doctors");
        // A visit can only be completed once it was CONFIRMED started. This
        // is what gives the code teeth: without it a doctor could close (and
        // bill) a visit they never attended, and the handshake would be
        // decoration. The patient-side start and ops override are the ways
        // out for the genuinely stuck.
        const req = (await repo.getRequests()).find((r) => r.id === String(payload.id));
        if (req && req.doctorId === me && req.tripStage !== "in_progress") {
          return NextResponse.json(
            {
              error:
                "Enter the patient's 4-digit code to start the consult before completing it.",
            },
            { status: 409 },
          );
        }
        await repo.completeRequest(String(payload.id), {
          doctorId: me,
          notes: payload.notes ? String(payload.notes) : undefined,
          prescription: Array.isArray(payload.prescription)
            ? payload.prescription
            : undefined,
        });
        return done({ ok: true }, ["requests", "transactions"]);
      }
      case "requestPayout": {
        if (role !== "doctor") return needs("doctors");
        const ok = await repo.requestPayout(me);
        if (!ok)
          return NextResponse.json({ error: "Nothing to withdraw." }, { status: 400 });
        return done({ ok: true }, ["transactions"]);
      }

      // ── SOS lifecycle ──
      case "advanceSos": {
        // Ops always; the ASSIGNED doctor may advance their own SOS
        // (assigned → enroute → resolved).
        if (role === "ops") {
          await repo.advanceSos(String(payload.sosId));
          return done({ ok: true }, ["sos"]);
        }
        if (role === "doctor") {
          const sos = await repo.getSosById(String(payload.sosId));
          if (!sos || sos.doctorId !== me) return needs("ops or the assigned doctor");
          await repo.advanceSos(String(payload.sosId));
          return done({ ok: true }, ["sos"]);
        }
        return needs("ops");
      }

      // ── Ops actions ──
      case "assignAmbulance":
        if (role !== "ops") return needs("ops");
        await repo.assignAmbulance(String(payload.sosId), String(payload.ambulanceId));
        return done({ ok: true }, ["sos", "ambulances"]);
      case "assignDoctorToSos": {
        // Ops can assign any doctor; a doctor may CLAIM an unassigned SOS for
        // themselves (mirrors the advanceSos "assigned doctor" rule), so the
        // patient↔doctor emergency path works without an ops operator.
        if (role === "ops") {
          await repo.assignDoctorToSos(String(payload.sosId), String(payload.doctorId));
          return done({ ok: true }, ["sos"]);
        }
        if (role === "doctor") {
          const sos = await repo.getSosById(String(payload.sosId));
          if (!sos) return NextResponse.json({ error: "That emergency no longer exists." }, { status: 404 });
          if (sos.doctorId && sos.doctorId !== me)
            return NextResponse.json({ error: "Another doctor is already responding." }, { status: 409 });
          await repo.assignDoctorToSos(String(payload.sosId), me); // force to caller — no spoofing
          return done({ ok: true }, ["sos"]);
        }
        return needs("ops or the responding doctor");
      }
      case "advanceOrder":
        if (role !== "ops") return needs("ops");
        await repo.advanceOrder(String(payload.orderId));
        return done({ ok: true }, ["orders"]);
      case "createAmbulance":
        if (role !== "ops") return needs("ops");
        return done(
          await repo.createAmbulance({
            vehicleNo: String(payload.vehicleNo ?? ""),
            driverName: String(payload.driverName ?? ""),
            lat: typeof payload.lat === "number" ? payload.lat : null,
            lng: typeof payload.lng === "number" ? payload.lng : null,
          }),
          ["ambulances"],
        );
      case "updateAmbulance":
        if (role !== "ops") return needs("ops");
        await repo.updateAmbulance(String(payload.id), payload.patch ?? {});
        return done({ ok: true }, ["ambulances"]);

      /**
       * Ops removes a doctor from the platform. The repo owns the policy — what
       * is deleted (profile, gigs, reviews, account + sessions) versus what is
       * deliberately kept (patient consult history, the money ledger) — and it
       * refuses while a consult is live rather than stranding a patient.
       *
       * Every entity the removal touches is invalidated so open ops tabs and
       * any patient browsing that doctor refresh rather than showing a ghost.
       */
      case "deleteDoctor": {
        if (role !== "ops") return needs("ops");
        const doctorId = String(payload.doctorId ?? "");
        if (!doctorId) return bad("Which doctor?");
        const result = await repo.deleteDoctor(doctorId);
        return done(result, ["doctors", "gigs", "reviews", "requests"]);
      }

      default:
        return NextResponse.json({ error: "Unknown action." }, { status: 400 });
    }
  } catch (err) {
    if (err instanceof DomainError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    console.error("action failed:", err);
    return NextResponse.json({ error: "Action failed." }, { status: 500 });
  }
}
