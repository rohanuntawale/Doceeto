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
 * a doctor self-assigns + advances it; and blocked actions return real errors.
 *
 * Requires the dev server running in a non-production build (the role switcher
 * is disabled in production). Exit code 0 = all checks passed.
 */
const BASE = process.env.BASE || "http://localhost:3000";

const cookieFrom = (res) => {
  const sc = res.headers.getSetCookie ? res.headers.getSetCookie().join("; ") : res.headers.get("set-cookie");
  const m = sc && sc.match(/iyashi_session=[^;]+/);
  return m ? m[0] : "";
};
/** Grab a real role session from the dev switcher (don't follow the redirect). */
const sessionFor = async (role) => {
  const res = await fetch(`${BASE}/api/dev/switch-role?role=${role}`, { redirect: "manual" });
  const cookie = cookieFrom(res);
  if (!cookie) throw new Error(`Could not get a ${role} session (status ${res.status}). Is the dev server running in a non-production build?`);
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

  // ── SOS: patient raises → doctor self-assigns → advances ───
  const sos = await act("createSos", { category: "cardiac", address: "Home", lat: 21.15, lng: 79.09, notes: "e2e sos" }, patCookie);
  const sosId = sos.data?.id;
  check("patient raises an SOS", sos.status === 200 && !!sosId, sosId);
  check("doctor self-assigns the SOS", (await act("assignDoctorToSos", { sosId, doctorId }, docCookie)).status === 200);
  const seenSos = ((await get("sos", patCookie)).data || []).find((s) => s.id === sosId);
  check("patient sees the SOS claimed by the doctor", seenSos?.doctorId === doctorId);
  check("doctor advances the claimed SOS", (await act("advanceSos", { sosId }, docCookie)).status === 200);

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
