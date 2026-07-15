# Iyashi — Build Log

> A running record of what has been built, in what order, and what is staged next.
> Newest entries first. See `docs/VC_AUDIT.md` for the product/market audit.

## Legend
- ✅ shipped & verified (typecheck + lint + build pass; demo mode driven)
- 🟡 in progress
- ⏭ staged next

---

## Session 5 — Clinical care journey ✅
Turned the booking demo into a real care product: **Triage → Verified doctor →
Dispatch with live ETA & on-the-way stages → e-Prescription → Rating flywheel.**
Typecheck + lint + build all pass; demo mode driven; no runtime errors.

- ✅ Domain model: request **acuity** + triage summary + visit **stages**
  (enroute/arrived) + **ETA**; **Prescription** type; doctor **verificationStatus**
  + NMC **regNo** + **ratingCount**; **Review** linked to doctor + request.
- ✅ Demo engine + Neo4j repo: doctors register **unverified & offline**; ops
  **verify** action; only verified doctors can go online; accept computes **ETA**
  from distance; **on-my-way / arrived / complete** transitions; **createPrescription**
  (completes the visit); **addReview** recomputes the doctor's rating live.
- ✅ **AI triage / acuity routing** (`lib/triage.ts` + `components/patient/triage.tsx`):
  red-flag detection → pushes to SOS; grades urgent vs routine; recommends the
  care mode; attaches acuity + summary to the request.
- ✅ Doctor UI: online toggle shows **"verification pending"** when unverified;
  RequestCard shows acuity + ETA + **on-my-way / arrived / complete-and-prescribe**;
  **e-prescription composer** dialog.
- ✅ Ops UI: **doctor verification queue** (approve / reject, shows reg number).
- ✅ Patient UI: **live ETA + "on the way"** status, **past visits with the
  prescription**, and **rate-the-visit** stars that update the doctor's rating.
- ✅ Docs: `VC_AUDIT.md` (shareable audit) + this build log.

## Session 4 — Real backend + auth
- ✅ Replaced Supabase (Postgres + RLS) with **Neo4j** (graph) behind a server-only
  driver + central repo; live mode activates on `NEXT_PUBLIC_BACKEND=neo4j`, else
  zero-setup demo mode.
- ✅ **Real auth**: bcrypt passwords, HS256 JWT (Web Crypto, works in Edge + Node)
  in an httpOnly cookie. `/api/auth/register|login|logout|me`.
- ✅ **No RLS**: authorization enforced server-side in `/api` route handlers (one
  read endpoint + one actions endpoint); each role only reads/writes what it may.
- ✅ Live hooks poll `/api/data`; actions POST `/api/actions` + invalidate. Demo
  path unchanged. One-time token-guarded `/api/admin/seed`.
- ✅ Removed `@supabase/*` + `jsonwebtoken`; updated `.env.example`, `render.yaml`,
  README. Bundle shrank (middleware 82.8kB → 27kB).

## Session 3 — Robustness + first-run guide
- ✅ Cross-tab sync hardened (guarded broadcast, isolated subscribers, storage-event
  fallback). Live actions wrapped so a failed write can't crash the tab.
- ✅ Dismissible "How Iyashi works" guide on patient home; clearer empty states.
- ✅ Verified all routes healthy; typecheck/lint/build pass.

## Session 2 — Map finder, themes, glass, UX
- ✅ **Map-based doctor finder**: live map of filtered nearby doctors, tap to see a
  profile and appoint, or broadcast to "find my best match". Filters: speciality,
  gender, junior/practising, fee, rating, sort.
- ✅ **Four Japanese color themes** (Sumi / Matcha / Sakura / Ai) via CSS-variable
  tokens + a no-flash theme switcher in every header.
- ✅ **Glassmorphism** on all cards; removed decorative badges + template animations;
  refreshed landing + home copy in plain language.
- ✅ **Freelance-doctor kind** (junior vs practising), gender, experience, languages
  through types/seed/store/mappers/SQL.
- ✅ Correctness: atomic request accept (first doctor wins); passing on a broadcast
  only hides it for that doctor.

## Session 1 — Uber-style request flow + simpler wording
- ✅ Broadcast + directed requests (home / clinic / video); doctor cockpit shows
  open-to-nearby + directed-to-me, badged.
- ✅ Removed all em-dashes; simpler wording site-wide.

---

## Backlog (staged, roughly in priority order)
- ⏭ **Payments + escrow + doctor payouts/commission** (Razorpay in live; mock in demo).
- ⏭ **ABDM/ABHA** record push + **HPR/NMR** primary-source verification.
- ⏭ **Chronic/elder-care subscriptions** + follow-up automation + family accounts (the LTV moat).
- ⏭ **Notifications**: Web Push + SMS/WhatsApp on new offer / SOS / assignment.
- ⏭ **Real dispatch optimisation**: batched MIP + OSRM travel-time + H3/Redis geo (replace demo timers).
- ⏭ **AI ambient scribe** for doctors (supply-side retention).
- ⏭ **Diagnostics-at-home** booking + **B2B2C** employer/insurer rails.
- ⏭ **Vernacular** UI + AI voice/WhatsApp intake.
