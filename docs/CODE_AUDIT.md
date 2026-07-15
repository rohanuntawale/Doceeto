# Iyashi Health — Technical Re-Audit (2026-07-15)

> A brutally honest engineering + product due-diligence review of the codebase
> **after** the clinical-care-journey build (triage, verification, dispatch
> stages, e-prescriptions, ratings, Neo4j auth). Companion to `VC_AUDIT.md`
> (market) and `BUILD_LOG.md` (history). Share freely with the team.

## Update — fixes applied (2026-07-15, same day)

The Critical findings and several Highs were fixed the same day. Summary:

- **F1 (cross-doctor prescribing)** — FIXED. `createPrescription` now matches
  `ConsultRequest {id, doctorId: $me}` with an active status and a verified doctor;
  rejects with 403 otherwise.
- **F2 (verification only on the toggle)** — FIXED. `acceptRequest` now requires
  `verificationStatus='verified'` in both the Neo4j query and the demo store; the
  doctor UI blocks accept with an honest error until verified.
- **F3 (unowned visit transitions)** — FIXED. start/arrive/complete/decline now
  require `r.doctorId = $me` and the expected status; `me` comes from the session.
- **F4 (open ratings)** — FIXED. `addReview` requires a **completed** request the
  caller **owns**, matching the doctor, **not already reviewed**; rating clamped 1–5.
- **F5 (forgeable secrets)** — FIXED. `AUTH_SECRET` and `OPS_PASSWORD` now hard-fail
  at boot in production instead of falling back to public strings.
- **F6 (triage cosmetic)** — PARTIAL. Pending requests are now **acuity-priority
  sorted** (emergency → urgent → routine) in the doctor queues, so acuity drives
  dispatch order. Server-forced SOS on emergency + mandatory triage still pending.
- **F7 (unverified in discovery)** — FIXED. Patient discovery (API + demo) now
  returns **verified doctors only**; the pending seed doctor is offline.
- **F9 (live seed drops verificationStatus)** — FIXED. `seedCatalog` now persists it.
- **F10 (no ETA in live)** — FIXED. `acceptRequest` computes a distance-based ETA
  server-side (haversine in Cypher) and stamps `acceptedAt`. (Real live-GPS/heartbeat
  still pending — coords are still seeded/random; see the geolocation backlog item.)
- **F11 (dishonest success toasts)** — PARTIAL. `callAction` now logs server
  rejections and re-syncs; the accept flow shows an honest error. Full toast-on-reject
  for every action still pending.
- **F8 (Schedule-X blocking), F12 (SOS PII), F14 (cancellation), F15 (tests/CI)** —
  still open; tracked in the backlog.

typecheck + lint + build pass; demo mode driven; no runtime errors.

---

## Bottom line up front

Real work landed since the pure demo — genuine JWT auth, a Neo4j read/write
backend with per-role filtering, an atomic "first-accept-wins" claim, visit
stages, e-prescriptions, a ratings recompute, and a verification concept. **But
the new features are a UI-deep veneer over an authorization layer that checks
*role* but almost never checks *ownership*.** In live mode, any logged-in doctor
can complete, prescribe on, or decline **another doctor's** patient; any patient
can rate **any** doctor unlimited times; and the verification "gate" only blocks
the online toggle, not the actual accept/prescribe actions. Triage is cosmetic
and fully skippable. This build is **more impressive to demo and more dangerous
to ship** than the last one.

---

## Maturity delta

### Genuinely improved (fair credit)
- **Real authentication** — HS256 JWT via Web Crypto (Edge + Node), httpOnly
  cookie, bcrypt hashing, register/login handlers.
- **A real backend seam** — `lib/neo4j/repo.ts` + `app/api/data|actions` centralize
  reads/writes; `lib/hooks/data.ts` binds one `Actions` interface to demo or live.
- **Server takes patient identity from the session, not the client** — genuine
  anti-spoof for *creates*.
- **Atomic claim** — `acceptRequest` uses `WHERE r.status='pending'` in one write;
  correct "first accept wins".
- **Verification concept exists** end-to-end (type, ops queue UI, online-toggle block).
- **Visit stages + e-Rx + ratings recompute** are coherent as UI flows.

### Still fake / simulated / missing
- **Ownership authorization** on doctor stage-transitions and prescriptions — absent.
- **Triage is cosmetic** — optional, client-only, never routes or prioritizes dispatch.
- **ETA** is a one-shot static number off a *random* coordinate; not computed in
  live mode; no live GPS.
- **Ratings** — no integrity controls (unlimited, unowned, un-deduped).
- **Payments: none.** `fee` is a display number.
- **Geolocation: none.** Patient coords = center+offset; doctor coords random.
- **Notifications: none.** 4s polling with the tab open.
- **ABDM/ABHA + NMR/NMC verification: none.** `regNo` is free text, never checked.
- **Controlled-substance / Schedule-X blocking: none** (legally required in India).
- **Cancellation / no-show / refunds: none** (`cancelled` status is unused).
- **Care continuity / subscriptions: none.**
- **Tests / CI: none.**

---

## Severity-ranked findings

| # | Sev | Finding | Location | Fix |
|---|-----|---------|----------|-----|
| 1 | **Critical** | **Any doctor can prescribe on another doctor's request.** `createPrescription` checks only that request + doctor exist, never `req.doctorId === acting doctor`. Issues a legally-binding e-Rx for a patient never seen. | `repo.ts` createPrescription; `actions/route.ts` (role-only) | Require `r.doctorId=$me AND r.status IN ['accepted','enroute','arrived']` before creating the Rx. |
| 2 | **Critical** | **Verification gate doesn't cover `acceptRequest`/prescribe.** It only blocks the online toggle. A rejected/unverified doctor can POST `acceptRequest` directly, then start/prescribe. | `store.ts`/`repo.ts` acceptRequest; `actions/route.ts` | Gate the *action*: require `verificationStatus='verified'` inside accept/start/arrive/complete/prescribe. |
| 3 | **Critical** | **No ownership check on start/arrive/complete/decline.** All take only a request id; handler checks only `role==='doctor'`. `declineRequest` also has no status guard (can be flipped mid-visit). | `repo.ts`/`store.ts` transitions; `actions/route.ts` | Add `WHERE r.doctorId=$me AND r.status='<expected>'` to every transition. |
| 4 | **Critical** | **Ratings fully open to manipulation.** `addReview` never checks the request belongs to the patient, that it was completed, or dedups. `doctorId`/`requestId` come from the client. | `repo.ts`/`store.ts` addReview; `actions/route.ts` | Require `MATCH (r {id,patientId:$me,doctorId,status:'completed'}) WHERE NOT EXISTS { (:Review {requestId}) }`. |
| 5 | **Critical** | **Forgeable sessions if envs unset.** `AUTH_SECRET` falls back to a hardcoded string; ops password falls back to `"iyashi-ops"`. | `jwt.ts`, `seed.ts` | Throw at boot in production if `AUTH_SECRET`/`OPS_PASSWORD` unset; no fallbacks. |
| 6 | **High** | **Triage cosmetic + skippable; emergency never blocks a routine booking.** Acuity defaults `routine`; never used to route/sort/prioritize; nothing stops `type:'video'` + `acuity:'emergency'`. | `doctors/page.tsx`, `request-card.tsx`, `requests/page.tsx` | Persist triage server-side; emergency → force SOS + block consult; acuity-priority dispatch; re-run rules server-side. |
| 7 | **High** | **Unverified doctors appear in patient discovery.** `getDoctors` returns all; discovery doesn't filter verification; seed doc-5 is `pending` **and** `online` → bookable. | `repo.ts` getDoctors, `doctors/page.tsx`, `seed.ts` | Filter discovery to `verificationStatus='verified'`; fix seed so no unverified doctor is online. |
| 8 | **High** | **No controlled-substance/Schedule-X enforcement; regNo unverified.** Rx accepts arbitrary meds; issues even with null regNo. | `prescription-dialog.tsx`, `repo.ts` | Formulary with Schedule H1/X flags; block prohibited schedules; require verified regNo before any Rx. |
| 9 | **High** | **Live-mode seed bug: `verificationStatus` never persisted.** `seedCatalog`'s `SET` omits it; `setDoctorStatus` uses `coalesce(...,'pending')` → seeded "verified" doctors can't go online in live mode. | `seed.ts` vs `repo.ts` setDoctorStatus | Add `verificationStatus` to the seed `SET`. |
| 10 | **High** | **ETA not computed in live mode; static + GPS-free.** `acceptRequest` sets status+doctorId only, not `acceptedAt`/`etaMins`. Demo computes once off a random coordinate; never counts down. | `repo.ts` acceptRequest, `store.ts` | Compute ETA server-side at accept from real coords; recompute on a heartbeat; require real geolocation. |
| 11 | **Medium** | **Optimistic success toasts regardless of outcome.** `callAction` invalidates on `.then()` without checking `res.ok`; Rx dialog toasts "issued" before knowing the result. | `data.ts` callAction, `prescription-dialog.tsx` | Check `res.ok`; surface server errors; toast only on success. |
| 12 | **Medium** | **All active SOS (patient name/address/notes) broadcast to every doctor** — no proximity/verification/on-shift filter. | `data/route.ts` sos case | Filter SOS to verified, on-shift, nearby doctors; minimize PII until assigned. |
| 13 | **Medium** | **Demo ops passcode hardcoded in the client bundle** (`"iyashi"`). | `ops-auth.ts` | Keep demo-only; live `/ops` is guarded by the server session already. |
| 14 | **Low** | **No cancellation/no-show/refund path** though `cancelled` exists in the type. | `domain.ts` | Add patient/doctor cancel actions with ownership + timing rules. |
| 15 | **Low** | **No tests, no CI.** | `package.json`, no `.github/` | Vitest for repo/authz + CI running lint/typecheck/authz tests. |

---

## The 10 things to fix first

1. **Prescription ownership (F1)** — highest clinical/legal risk.
2. **Visit-transition + decline ownership (F3)**.
3. **Verification on the action, not just the toggle (F2)**.
4. **Rating integrity (F4)**.
5. **Kill forgeable-secret fallbacks (F5)**.
6. **Make triage load-bearing (F6)** — server-side; emergency → force SOS; acuity-priority dispatch.
7. **Filter discovery to verified doctors + fix the online-unverified seed (F7, F9)**.
8. **Fix live-mode ETA + real geolocation (F10)**.
9. **Prescription safety layer (F8)** — Schedule H1/X blocking + verified registration.
10. **Honest error surfacing (F11)**.

---

## Honest fundability re-rating

**Closer to investable? Yes — but only as a *product demo*, not a *platform*.** The
delta is real (auth, backend seam, atomic claim, a coherent verification/triage/
e-Rx/ratings narrative), and a non-technical investor watching the flow will
believe it's a working marketplace.

**But engineering maturity did not move as far as the surface did.** The recurring
pattern — *role is checked, ownership is not* — means the newest, most impressive
features are exactly where the Critical holes are. In healthcare these are not
"harden later" items: an unowned e-prescription (F1) and an unverified doctor
accepting patients (F2) are patient-safety and regulatory failures that would end
a real pilot.

**The single biggest remaining gap is that there is no trust spine:** no payments
(no escrow/payout/refund) and no real identity/clinical verification (no ABDM/NMR,
no controlled-drug enforcement, no ownership-scoped clinical actions). Those are
the two things a doctor and a patient must both trust.

**Rating: demo-stage, pre-seed.** Strong founder velocity and a convincing
prototype; not yet a safe or defensible platform. Closing F1–F5 is the price of a
credible technical diligence pass; **payments + ABDM/NMR verification is the price
of a real pilot.**
