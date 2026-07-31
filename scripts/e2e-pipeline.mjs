/**
 * End-to-end backend pipeline test — onboarding → patient → doctor.
 *
 *   node scripts/e2e-pipeline.mjs            (defaults to http://localhost:3000)
 *   BASE=http://localhost:3000 node scripts/e2e-pipeline.mjs
 *
 * Exercises the LIVE backend (file store or Neo4j) exactly as the apps do:
 * the two role sessions come from the dev-only role switcher, then we drive
 * the real /api/auth, /api/data and /api/actions endpoints and assert the
 * cross-actor pipeline: a patient books (incl. a seeded doctor) → a doctor
 * sees + accepts it → the patient sees it accepted; a patient raises an SOS →
 * a doctor self-assigns + advances it; a doctor publishes a GIG → a patient
 * hires it → the doctor is paused until they complete it; a patient BROADCASTS
 * an urgent request → the first doctor to accept wins and a pass persists;
 * and blocked actions return real errors.
 *
 * Requires the dev server running in a non-production build (the role switcher
 * is disabled in production). Exit code 0 = all checks passed.
 */
const BASE = process.env.BASE || "http://localhost:3000";

// Sessions are per-role opaque cookies (iyashi_sid_<role>); registering sets
// exactly one non-empty one and clears the retired names.
const cookieFrom = (res) => {
  const list = res.headers.getSetCookie
    ? res.headers.getSetCookie()
    : [res.headers.get("set-cookie") || ""];
  for (const sc of list) {
    const m = sc.match(/(iyashi_sid_\w+)=([^;]+)/);
    if (m && m[2]) return `${m[1]}=${m[2]}`;
  }
  return "";
};
/** Register a fresh throwaway account and return its session cookie. */
const sessionFor = async (role) => {
  const email = `e2e-${role}-${Math.random().toString(36).slice(2)}@t.test`;
  const body =
    role === "doctor"
      ? { role: "doctor", fullName: "E2E Doctor", email, password: "e2epass123" }
      : { role: "patient", name: "E2E Patient", email, password: "e2epass123" };
  const res = await fetch(`${BASE}/api/auth/register`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  const cookie = cookieFrom(res);
  if (!cookie) {
    const err = await res.json().catch(() => ({}));
    throw new Error(`Could not register a ${role} session (status ${res.status}): ${err.error ?? ""}. Is the dev server running?`);
  }
  return cookie;
};
const me = async (cookie) => (await fetch(`${BASE}/api/auth/me`, { headers: { cookie }, cache: "no-store" })).json();
const get = async (entity, cookie) => {
  const r = await fetch(`${BASE}/api/data?entity=${entity}`, { headers: { cookie }, cache: "no-store" });
  return { status: r.status, data: await r.json().catch(() => null) };
};
const act = async (action, payload, cookie) => {
  const r = await fetch(`${BASE}/api/actions`, { method: "POST", headers: { "content-type": "application/json", cookie }, body: JSON.stringify({ action, payload }) });
  return { status: r.status, data: await r.json().catch(() => ({})) };
};
/**
 * A SECOND doctor session. The dev switcher only ever hands back the one
 * test doctor, but the ownership rules need two of them, so this registers
 * a stable extra account (and signs back into it on later runs).
 */
const secondDoctorSession = async () => {
  const creds = { email: "e2e.second.doctor@doceeto.local", password: "e2e-doctor-1" };
  const reg = await fetch(`${BASE}/api/auth/register`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ ...creds, role: "doctor", fullName: "Dr. Second Opinion", specialty: "General Physician" }),
  });
  if (reg.ok) return cookieFrom(reg);
  const login = await fetch(`${BASE}/api/auth/login`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(creds),
  });
  return login.ok ? cookieFrom(login) : "";
};
/** One doctor's bookable calendar, as the patient's picker sees it. */
const calendar = async (doctorId, cookie) => {
  const r = await fetch(`${BASE}/api/availability?doctorId=${encodeURIComponent(doctorId)}`, { headers: { cookie }, cache: "no-store" });
  return r.ok ? r.json() : { days: [] };
};
const allSlots = (cal) => (cal.days || []).flatMap((d) => d.slots);

let passed = 0;
let failed = 0;
const check = (name, cond, detail) => {
  cond ? passed++ : failed++;
  console.log(`${cond ? "PASS" : "FAIL"}  ${name}${detail ? "  — " + detail : ""}`);
};

async function run() {
  // ── Onboarding / identity ──────────────────────────────────
  const docCookie = await sessionFor("doctor");
  const patCookie = await sessionFor("patient");
  const dMe = await me(docCookie);
  const pMe = await me(patCookie);
  const doctorId = dMe?.doctor?.id;
  check("doctor session resolves to a doctor identity", dMe?.role === "doctor" && !!doctorId, doctorId);
  check("patient session resolves to a patient identity", pMe?.role === "patient" && !!pMe?.patient?.id);
  await act("setDoctorStatus", { status: "online" }, docCookie); // ensure the doctor is online

  // Clean slate: the "one active consult" rule blocks a new accept while an
  // earlier consult is still open, so finish any left over from a prior run.
  for (const r of ((await get("requests", docCookie)).data || []).filter((r) => r.status === "accepted" && r.doctorId === doctorId)) {
    await act("completeRequest", { id: r.id }, docCookie);
  }

  // ── Reads: patient sees the doctor roster ──────────────────
  const docs = await get("doctors", patCookie);
  check("patient reads the doctor list", docs.status === 200 && Array.isArray(docs.data) && docs.data.length > 0, `count=${docs.data?.length}`);

  // ── Booking a SEEDED doctor completes (any online doctor can claim it) ──
  const booked = await act("createRequest", { type: "clinic", symptoms: "e2e clinic visit", fee: 400, address: "Clinic", lat: 21.15, lng: 79.09, doctorId: "doc-seed-1" }, patCookie);
  const reqId = booked.data?.id;
  check("patient books a seeded doctor", booked.status === 200 && !!reqId, reqId);
  const seenByDoc = ((await get("requests", docCookie)).data || []).find((r) => r.id === reqId);
  check("a real doctor sees the pending request", seenByDoc?.status === "pending");
  check("doctor accepts the request", (await act("acceptRequest", { id: reqId }, docCookie)).status === 200);
  const seenByPat = ((await get("requests", patCookie)).data || []).find((r) => r.id === reqId);
  check("patient sees it accepted + claimed by the real doctor", seenByPat?.status === "accepted" && seenByPat?.doctorId === doctorId, `status=${seenByPat?.status}`);

  // ── One active consult: a second accept is blocked until this one closes ──
  const booked2 = await act("createRequest", { type: "clinic", symptoms: "e2e second visit", fee: 300, address: "Clinic 2", lat: 21.15, lng: 79.09, doctorId: "doc-seed-1" }, patCookie);
  const reqId2 = booked2.data?.id;
  const blockedAccept = await act("acceptRequest", { id: reqId2 }, docCookie);
  check("doctor with an active consult is blocked from a second accept (409)", blockedAccept.status === 409 && !!blockedAccept.data?.error, `status=${blockedAccept.status}`);

  // ── Complete the consult, then both sides rate each other ──
  check("doctor completes the consult", (await act("completeRequest", { id: reqId }, docCookie)).status === 200);
  check("patient rates the doctor", (await act("createReview", { doctorId, requestId: reqId, rating: 5, comment: "great" }, patCookie)).status === 200);
  const ratedDoc = ((await get("doctors", patCookie)).data || []).find((d) => d.id === doctorId);
  check("doctor's aggregate rating updated", typeof ratedDoc?.rating === "number" && ratedDoc.rating > 0, `rating=${ratedDoc?.rating}`);
  const reviewedReq = ((await get("requests", patCookie)).data || []).find((r) => r.id === reqId);
  check("consult is flagged reviewed for the patient", reviewedReq?.reviewed === true);
  check("doctor rates the patient", (await act("ratePatient", { requestId: reqId, rating: 4, comment: "polite" }, docCookie)).status === 200);
  const ratedReq = ((await get("requests", docCookie)).data || []).find((r) => r.id === reqId);
  check("consult shows the patient as rated", ratedReq?.patientRated === true);
  check("re-rating the same patient is rejected (409)", (await act("ratePatient", { requestId: reqId, rating: 2 }, docCookie)).status === 409);

  // Now the earlier consult is closed, the doctor can accept the next one.
  check("doctor can accept again once free", (await act("acceptRequest", { id: reqId2 }, docCookie)).status === 200);
  await act("completeRequest", { id: reqId2 }, docCookie); // leave a clean slate

  // ══ Appointment scheduling ═════════════════════════════════
  // The doctor publishes wide-open hours so the grid is dense enough to
  // pick from whatever time of day this test happens to run at.
  const availability = {
    slotMinutes: 30,
    windows: [0, 1, 2, 3, 4, 5, 6].map((day) => ({ day, start: "06:00", end: "22:00" })),
    daysOff: [],
    horizonDays: 7,
    leadMinutes: 0,
    acceptsEmergency: true,
  };
  check("doctor publishes their availability", (await act("setAvailability", { availability }, docCookie)).status === 200);

  const cal = await calendar(doctorId, patCookie);
  const open = allSlots(cal).filter((s) => !s.taken && !s.past);
  check("patient reads the doctor's bookable calendar", open.length > 0, `free slots=${open.length}`);
  check("calendar reports the doctor takes appointments", cal.takesAppointments === true);

  // Take a slot a few along, so a slow run can't age the pick into the past.
  const slot = open[Math.min(4, open.length - 1)];
  const apptPayload = { type: "video", symptoms: "e2e appointment", fee: 400, address: "Video call", lat: 21.15, lng: 79.09, doctorId, mode: "scheduled" };
  const appt = await act("createRequest", { ...apptPayload, scheduledAt: slot.start }, patCookie);
  const apptId = appt.data?.id;
  check("patient books a slot on the doctor's calendar", appt.status === 200 && appt.data?.scheduledAt === slot.start, `at=${appt.data?.scheduledAt ?? appt.data?.error}`);
  check("the booking carries its end time and length", !!appt.data?.scheduledEnd && appt.data?.slotMinutes === 30);

  // The whole point: a taken slot is gone for everyone.
  const dupe = await act("createRequest", { ...apptPayload, scheduledAt: slot.start }, patCookie);
  check("the same slot cannot be booked twice (409)", dupe.status === 409, `status=${dupe.status}`);
  const afterBooking = await calendar(doctorId, patCookie);
  check("the calendar now shows that slot as taken", allSlots(afterBooking).find((s) => s.start === slot.start)?.taken === true);

  // Times that aren't on the grid never reach the calendar.
  const offGrid = await act("createRequest", { ...apptPayload, scheduledAt: new Date(Date.parse(slot.start) + 7 * 60000).toISOString() }, patCookie);
  check("a time off the slot grid is rejected (400)", offGrid.status === 400, `status=${offGrid.status}`);
  const gonePast = allSlots(cal).find((s) => s.past);
  if (gonePast) {
    const stale = await act("createRequest", { ...apptPayload, scheduledAt: gonePast.start }, patCookie);
    check("a slot that has already passed is rejected (400)", stale.status === 400, `status=${stale.status}`);
  }
  const noSlot = await act("createRequest", { ...apptPayload, scheduledAt: null }, patCookie);
  check("a scheduled booking with no time is rejected (400)", noSlot.status === 400);

  // ══ Urgent requests vs a doctor who is already busy ════════
  const urgentPayload = { type: "clinic", symptoms: "e2e urgent", fee: 300, address: "Home", lat: 21.15, lng: 79.09, doctorId, mode: "emergency" };
  const urgent1 = await act("createRequest", urgentPayload, patCookie);
  check("doctor accepts an urgent request", (await act("acceptRequest", { id: urgent1.data?.id }, docCookie)).status === 200);

  const urgent2 = await act("createRequest", urgentPayload, patCookie);
  const busyFeed = (await get("requests", docCookie)).data || [];
  check("a busy doctor is NOT shown new urgent requests", !busyFeed.some((r) => r.id === urgent2.data?.id));
  check("a busy doctor still sees their booked appointment", busyFeed.some((r) => r.id === apptId));
  check("a busy doctor can still confirm an appointment", (await act("acceptRequest", { id: apptId }, docCookie)).status === 200);
  check("a busy doctor cannot accept another urgent request (409)", (await act("acceptRequest", { id: urgent2.data?.id }, docCookie)).status === 409);

  await act("completeRequest", { id: urgent1.data?.id }, docCookie);
  const freeFeed = (await get("requests", docCookie)).data || [];
  check("urgent requests return once the doctor is free", freeFeed.some((r) => r.id === urgent2.data?.id));

  // ══ A slot is only its own doctor's to release ═════════════
  // urgent2 is directed at this doctor, so a SECOND doctor session must not
  // be able to decline it out from under them (that would free the slot).
  const otherDoc = await secondDoctorSession();
  const otherId = otherDoc ? (await me(otherDoc))?.doctor?.id : null;
  check("a second doctor account is available for the ownership checks", !!otherId && otherId !== doctorId, otherId ?? "none");
  if (otherId && otherId !== doctorId) {
    check("another doctor cannot decline a request that isn't theirs (403)", (await act("declineRequest", { id: urgent2.data?.id }, otherDoc)).status === 403);
    check("another doctor cannot complete someone else's consult (403)", (await act("completeRequest", { id: apptId }, otherDoc)).status === 403);
    check("the request survives the rejected decline", ((await get("requests", docCookie)).data || []).find((r) => r.id === urgent2.data?.id)?.status === "pending");
  }

  // ══ Cancelling frees the slot again ════════════════════════
  check("patient cancels their appointment", (await act("cancelRequest", { id: apptId }, patCookie)).status === 200);
  const afterCancel = await calendar(doctorId, patCookie);
  check("the freed slot is bookable again", allSlots(afterCancel).find((s) => s.start === slot.start)?.taken === false);
  check("cancelling twice is rejected (409)", (await act("cancelRequest", { id: apptId }, patCookie)).status === 409);
  await act("declineRequest", { id: urgent2.data?.id }, docCookie); // clean slate for the SOS checks

  // ── SOS: patient raises → doctor self-assigns → advances ───
  const sos = await act("createSos", { category: "cardiac", address: "Home", lat: 21.15, lng: 79.09, notes: "e2e sos" }, patCookie);
  const sosId = sos.data?.id;
  check("patient raises an SOS", sos.status === 200 && !!sosId, sosId);
  check("doctor self-assigns the SOS", (await act("assignDoctorToSos", { sosId, doctorId }, docCookie)).status === 200);
  const seenSos = ((await get("sos", patCookie)).data || []).find((s) => s.id === sosId);
  check("patient sees the SOS claimed by the doctor", seenSos?.doctorId === doctorId);
  check("doctor advances the claimed SOS", (await act("advanceSos", { sosId }, docCookie)).status === 200);

  // ── Gigs: publish → hire → the doctor is PAUSED → complete ─
  // The freelance spine. An accepted gig has no calendar slot, so it occupies
  // the doctor until they close it — that is what pauses their listing.
  const gig = await act(
    "createGig",
    { title: "E2E home visit", description: "e2e", type: "home_visit", price: 900, durationMinutes: 45 },
    docCookie,
  );
  const gigId = gig.data?.id;
  check("doctor publishes a gig", gig.status === 200 && !!gigId, JSON.stringify(gig.data).slice(0, 120));
  check("gig snaps to a supported duration", gig.data?.durationMinutes === 45, String(gig.data?.durationMinutes));
  const patientGigs = (await get(`gigs&doctorId=${doctorId}`, patCookie)).data || [];
  check("patient sees the live gig", patientGigs.some((g) => g.id === gigId), `${patientGigs.length} listed`);
  check("patients cannot publish gigs (403)", (await act("createGig", { title: "x", type: "video", price: 10 }, patCookie)).status === 403);

  // Pausing hides it from patients but keeps it on the doctor's own shelf.
  await act("setGigStatus", { id: gigId, status: "paused" }, docCookie);
  check("a paused gig is hidden from patients", !((await get(`gigs&doctorId=${doctorId}`, patCookie)).data || []).some((g) => g.id === gigId));
  check("the owner still sees their paused gig", ((await get("gigs", docCookie)).data || []).some((g) => g.id === gigId && g.status === "paused"));
  check("a paused gig cannot be hired (409)", (await act("createRequest", { mode: "gig", gigId, doctorId, lat: 21.14, lng: 79.08, address: "T", symptoms: "x" }, patCookie)).status === 409);
  await act("setGigStatus", { id: gigId, status: "active" }, docCookie);

  // The fee and visit type come off the LISTING, never the request body —
  // same posture as order pricing from the catalog.
  const hire = await act(
    "createRequest",
    { mode: "gig", gigId, doctorId, fee: 1, type: "video", lat: 21.14, lng: 79.08, address: "12 Test Rd", symptoms: "e2e gig hire" },
    patCookie,
  );
  const hireId = hire.data?.id;
  check("patient hires the gig", hire.status === 200 && !!hireId, JSON.stringify(hire.data).slice(0, 120));
  check("the hire is priced from the gig, not the client", hire.data?.fee === 900, String(hire.data?.fee));
  check("the hire takes the gig's visit type", hire.data?.type === "home_visit", String(hire.data?.type));
  check("the hire snapshots the gig title", !!hire.data?.gigTitle, String(hire.data?.gigTitle));
  check("a gig hire reaches the doctor's inbox", ((await get("requests", docCookie)).data || []).some((r) => r.id === hireId && r.status === "pending"));

  check("doctor takes the gig", (await act("acceptRequest", { id: hireId }, docCookie)).status === 200);
  const paused = await calendar(doctorId, patCookie);
  check("onGig is true once accepted", paused.onGig === true, String(paused.onGig));
  check("activeGigId points at the gig", paused.activeGigId === gigId, String(paused.activeGigId));
  check("urgent visits are closed while on a gig", paused.emergencyAvailable === false, String(paused.emergencyAvailable));
  check("further hiring is closed while on a gig", paused.gigsHireable === false, String(paused.gigsHireable));
  check("appointment booking is locked while on a gig", paused.appointmentsOpen === false, String(paused.appointmentsOpen));
  check("a second gig hire is refused (409)", (await act("createRequest", { mode: "gig", gigId, doctorId, lat: 21.14, lng: 79.08, address: "T", symptoms: "x" }, patCookie)).status === 409);
  const lockedSlot = allSlots(await calendar(doctorId, patCookie)).find((s) => !s.taken && !s.past);
  if (lockedSlot) {
    check("booking a slot is refused while on a gig (409)", (await act("createRequest", { mode: "scheduled", doctorId, scheduledAt: lockedSlot.start, type: "video", fee: 500, lat: 21.14, lng: 79.08, address: "T", symptoms: "x" }, patCookie)).status === 409);
  }

  // The Uber-style rail: one step at a time, server-derived.
  check("trip advances to enroute", (await act("advanceTrip", { id: hireId }, docCookie)).data?.tripStage === "enroute");
  check("trip advances to arrived", (await act("advanceTrip", { id: hireId }, docCookie)).data?.tripStage === "arrived");
  check("trip advances to in_progress", (await act("advanceTrip", { id: hireId }, docCookie)).data?.tripStage === "in_progress");
  check("advancing past the last stage is refused (400)", (await act("advanceTrip", { id: hireId }, docCookie)).status === 400);

  await act("completeRequest", { id: hireId }, docCookie);
  const freed = await calendar(doctorId, patCookie);
  check("completing the gig unpauses the doctor", freed.onGig === false && freed.gigsHireable === true, `onGig=${freed.onGig}`);
  check("appointment booking reopens", freed.appointmentsOpen === true, String(freed.appointmentsOpen));
  const gigEarning = ((await get("transactions", docCookie)).data || []).find((t) => t.requestId === hireId && t.kind === "earning");
  check("the gig credited one earning at the platform rate", gigEarning?.commission === 135 && gigEarning?.net === 765, JSON.stringify(gigEarning));

  // ── Broadcast dispatch: first to accept wins, a pass persists ──
  const bc = await act(
    "createRequest",
    { mode: "emergency", doctorId: null, type: "home_visit", fee: 700, lat: 21.14, lng: 79.08, address: "5 Broadcast Ln", symptoms: "e2e broadcast" },
    patCookie,
  );
  const bcId = bc.data?.id;
  check("patient posts a broadcast", bc.status === 200 && bc.data?.broadcast === true, String(bc.data?.broadcast));
  check("a broadcast starts with no doctor", bc.data?.doctorId === null, String(bc.data?.doctorId));
  check("the broadcast reaches a free doctor", ((await get("requests", docCookie)).data || []).some((r) => r.id === bcId));
  check("the broadcast reaches a second doctor too", ((await get("requests", otherDoc)).data || []).some((r) => r.id === bcId));

  // Passing is persisted, so it stays gone after a refresh — but stays open
  // for everyone else.
  await act("declineRequest", { id: bcId }, docCookie);
  check("a pass hides the broadcast from that doctor", !((await get("requests", docCookie)).data || []).some((r) => r.id === bcId));
  check("a pass leaves it pending for others", ((await get("requests", patCookie)).data || []).find((r) => r.id === bcId)?.status === "pending");

  check("the second doctor wins the broadcast", (await act("acceptRequest", { id: bcId }, otherDoc)).status === 200);
  check("the first doctor now loses the race (409)", (await act("acceptRequest", { id: bcId }, docCookie)).status === 409);

  // A doctor cancelling a broadcast re-pools it rather than ending it.
  check("a doctor must give a reason to cancel (400)", (await act("cancelRequest", { id: bcId }, otherDoc)).status === 400);
  check("a doctor cancels with a reason", (await act("cancelRequest", { id: bcId, reason: "An emergency came up" }, otherDoc)).status === 200);
  const repooled = ((await get("requests", patCookie)).data || []).find((r) => r.id === bcId);
  check("a cancelled broadcast returns to the pool", repooled?.status === "pending" && repooled?.doctorId === null, `status=${repooled?.status} doctorId=${repooled?.doctorId}`);
  check("the canceller is not re-offered it", !((await get("requests", otherDoc)).data || []).some((r) => r.id === bcId));

  // ── Authorization: patient cannot act as ops/doctor ────────
  const spoof = await act("acceptRequest", { id: reqId }, patCookie);
  check("patient blocked from a doctor-only action (403)", spoof.status === 403 && !!spoof.data?.error, `status=${spoof.status}`);

  console.log(`\n=== ${passed}/${passed + failed} checks passed ===`);
  if (failed > 0) process.exitCode = 1;
}

run().catch((e) => {
  console.error("e2e failed:", e.message);
  process.exit(1);
});
