import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { emitChange } from "@/lib/server/events";
import { db as repo, DomainError } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const SOS_CATEGORIES = new Set(["cardiac", "trauma", "respiratory", "stroke", "obstetric", "other"]);

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
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Not signed in." }, { status: 401 });

  const { action, payload } = await req.json();
  const me = session.sub;
  const role = session.role;

  const needs = (r: string) =>
    NextResponse.json({ error: `Only ${r} can do this.` }, { status: 403 });

  /** Wrap a result: audit + emit + respond. */
  const done = (body: unknown, entities: string[]) => {
    void repo.audit({ actorId: me, role, action, meta: payload });
    emitChange(entities);
    return NextResponse.json(body);
  };

  try {
    switch (action) {
      // ── Patient creates (identity is taken from the session) ──
      case "createSos":
        if (role !== "patient") return needs("patients");
        return done(
          await repo.createSos({ ...payload, patientId: me, patientName: session.name }),
          ["sos", "ambulances"],
        );
      case "createRequest":
        if (role !== "patient") return needs("patients");
        return done(
          await repo.createRequest({ ...payload, patientId: me, patientName: session.name }),
          ["requests"],
        );
      case "createOrder":
        if (role !== "patient") return needs("patients");
        return done(
          await repo.createOrder({ ...payload, patientId: me, patientName: session.name }),
          ["orders"],
        );
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
      case "setDoctorStatus":
        if (role !== "doctor") return needs("doctors");
        await repo.setDoctorStatus(me, String(payload.status));
        return done({ ok: true }, ["doctors"]);
      case "updateDoctor":
        if (role !== "doctor") return needs("doctors");
        await repo.updateDoctor(me, sanitizeDoctorPatch(payload.patch));
        return done({ ok: true }, ["doctors"]);
      case "acceptRequest": {
        if (role !== "doctor") return needs("doctors");
        const won = await repo.acceptRequest(String(payload.id), me);
        return done({ ok: won }, ["requests"]);
      }
      case "declineRequest":
        if (role !== "doctor") return needs("doctors");
        await repo.declineRequest(String(payload.id));
        return done({ ok: true }, ["requests"]);
      case "completeRequest":
        if (role !== "doctor") return needs("doctors");
        await repo.completeRequest(String(payload.id), {
          notes: payload.notes ? String(payload.notes) : undefined,
          prescription: Array.isArray(payload.prescription)
            ? payload.prescription
            : undefined,
        });
        return done({ ok: true }, ["requests"]);

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
