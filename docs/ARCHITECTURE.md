# Iyashi Dashboard — Architecture

> How the system fits together, and *why* it's built this way. Pair this with
> [`REFERENCE.md`](REFERENCE.md) for the exact tokens, schema, and contracts.

## 1. What this is

One Next.js app serving **three personas** off a shared design system and data layer:

| Persona | Route | Modules | Purpose |
|---|---|---|---|
| **Patient** | `/patient/*` | Tasuke + Zumi + AuraMed | Consumer app — hire a gig, book a slot, get care now, order medicine, live "your care" |
| **Doctor** | `/doctor/*` | Zumi + Tasuke | Freelance doctor cockpit — publish gigs, keep a calendar, take requests, earnings |
| **Ops** | `/ops/*` | Tasuke + Zumi + AuraMed | Command center — SOS dispatch, network health, order tracking |

The patient app **creates** the work (gig hire / booking / SOS / order); the doctor and
ops surfaces **consume** it live. That patient→provider connection is the spine of the
product.

## 1a. The freelance spine: gigs

The product is a **freelance marketplace for doctors**. A doctor publishes `Gig`
listings — their own title, price and duration — and a patient hires one outright.
There are three ways a patient engages a doctor, and all three land as **one
`ConsultRequest`** distinguished by `mode`:

```
hire a gig   mode:'gig'        → one doctor, no slot,  occupies them until completed
book a slot  mode:'scheduled'  → one doctor, a slot,   occupies them while it runs
get care now mode:'emergency'  → doctorId null = broadcast; first to accept wins
```

Reusing one entity is deliberate: the wallet ledger, reviews, mutual ratings,
cancellation, audit and SSE invalidation all work for gigs and broadcasts with no
duplication.

**The auto-pause is derived, not stored.** `intervalOf()` returns `null` for a gig, and
`isOngoingConsult()` treats an accepted row with no interval as live — so an accepted gig
occupies its doctor until they close it. `hasOngoingConsult`, `visibleToDoctor`,
`emergencyAvailable` and `assertCanAccept` then all behave correctly for free.
Completing or cancelling releases it, so a crash mid-gig cannot strand anyone. The
`Doctor.status` field stays what it always was — the doctor's own online/offline
intent — and is never machine-written.

``bookableState()` in `lib/scheduling/slots.ts` is the single source for every
"can this be booked?" flag, called by `/api/availability`.

The product's four pillars map to features: **Tasuke** (助け, emergency SOS), **Zumi**
(freelance doctors), **AuraMed** (薬, medicine delivery). **Kenshin** (検診, diagnostics)
is reserved in the schema for a later phase.

## 2. The data seam

The single most important design decision: **the UI never talks to a backend directly.**
Every read and write goes through the hooks in [`lib/hooks/data.ts`](../lib/hooks/data.ts),
which fetch from the `/api` routes and return **domain types**
([`lib/types/domain.ts`](../lib/types/domain.ts)).

```
Component  ──►  useConsultRequests() / useGigs() / useActions()
(dumb UI)       (lib/hooks/data.ts)
                     │
                     └─ /api/data + /api/actions
                              │
                              ├─ lib/filedb/repo.ts  (default; JSON file store)
                              └─ lib/postgres/repo.ts (Postgres/Neon)
```

The server-side store is chosen in [`lib/db/index.ts`](../lib/db/index.ts) and the API
routes talk to `db` without caring which is behind it.

**Why:** there is exactly one file to change when swapping the backing store, and
components are identical regardless of what's behind the API.

### The rules live in one place, not three

All three stores share the same **pure** rule modules, so a rejection is identical
everywhere and a slot can never be free in the UI and taken on the server:

| Module | Owns |
|---|---|
| [`lib/scheduling/time.ts`](../lib/scheduling/time.ts) | one fixed zone; wall-clock ⇄ instant |
| [`lib/scheduling/slots.ts`](../lib/scheduling/slots.ts) | the grid, occupancy, `visibleToDoctor`, `bookableState` |
| [`lib/scheduling/booking.ts`](../lib/scheduling/booking.ts) | write guards: `resolveScheduledSlot`, `assertCanHire`, `assertCanAccept`, cancel rules |
| [`lib/scheduling/trip.ts`](../lib/scheduling/trip.ts) | the trip rail and its next step |
| [`lib/gigs/rules.ts`](../lib/gigs/rules.ts) | gig bounds, `normalizeGig`, `sanitizeGigPatch` |

Server-side pricing is a standing rule: a gig hire's fee and visit type are read off the
stored gig and an order's total is re-priced from the catalog — the client's numbers are
discarded in both cases.

The one-active-gig-per-doctor invariant is enforced **at accept**, not at create (several
patients queueing for the same gig is wanted). On the file store `assertCanAccept` runs
synchronously before the mutation; Neo4j repeats it as a guarded Cypher `SET`.

## 3. Realtime, not polling

Emergencies can't lag, so the app is push-based:

- **SSE via `/api/stream`:** a Server-Sent Events endpoint pushes entity-change
  notifications to the browser. `RealtimeBridge` connects when signed in and
  invalidates the matching TanStack Query key on each event, so the UI re-renders
  instantly. Polling backs off to a slow safety net while SSE is connected.
- **Polling fallback:** when SSE can't connect (serverless, proxy, offline), reads
  poll on a short interval (4 s) and every mutation invalidates the matching query.

Mutations (accept request, dispatch ambulance, advance order) update state immediately
(optimistic); the SSE echo or next poll reconciles across every open client.

## 4. Rendering & performance

- **Server Components** for the shells/layouts; **Client Components** for the live widgets.
- **`next/font`** self-hosts Playfair Display / Inter / JetBrains Mono / Noto Sans JP →
  zero layout shift.
- **The map is `dynamic(..., { ssr:false })`** (`components/map/live-map.tsx`) so MapLibre
  never touches the server and never blocks the SOS-critical render path.
- **Time-relative text is gated behind `useMounted`** to avoid SSR/client hydration drift.
- Route-level code splitting; first-load JS ~170–190 kB per route.
- DB indexes on the hot paths: `(status)`, `(lat,lng)` for SOS and requests.

## 5. Auth & routing

- `middleware.ts` refreshes the session each request and guards `/doctor` and `/ops`
  (redirect to `/login` when unauthenticated).
- **Role model:** Doctors self-onboard at `/signup`. Ops accounts are seeded/invited.
  Role-based hard-guarding of `/ops` vs `/doctor` is handled in the layouts.

## 6. Directory map

```
app/
  page.tsx              landing / role entry
  login, signup         auth (JWT session cookie in live mode)
  patient/              app: home, now (broadcast), doctors, doctors/[id], care, medicine, account
  doctor/               cockpit: home, gigs, requests, schedule, consults, earnings, profile
  ops/                  console: overview, doctors, orders
  api/                  data (reads), actions (writes), availability, stream (SSE), auth/*
components/
  ui/                   design-system kit (Button, Card, StatCard, StatusPill, toast…)
  layout/               Shell (sidebar+topbar), PageHeader, AppDock
  brand/                Wordmark
  patient/              shell, gig-list, booking-panel, care-status, rate-doctor
  doctor/               shell, gig-editor-dialog, on-gig-banner, cancel-visit-dialog,
                        availability-editor, online-toggle, edit-profile-dialog
  consult/              consult-tracker (live map + the trip rail)
  zumi/ auramed/        per-module cards
  map/                  MapLibre maps — browse, ops, live trip (all dynamic)
lib/
  hooks/data.ts         THE data seam (useActions, useGigs, useOpsSnapshot, etc.)
  hooks/use-schedule.ts one doctor's calendar + bookable flags
  db/index.ts           server store selector (Neo4j ⇄ file store)
  filedb/ neo4j/        the two server stores, same exported surface

  scheduling/           time, slots, booking, trip — the shared rules
  gigs/rules.ts         gig bounds + normalisation
  types/domain.ts       the shared domain types
  labels.ts, utils/     status labels, geo (haversine), formatting
```

## 7. Data flow, end to end (a gig)

1. A doctor publishes a `Gig` at `/doctor/gigs` → `createGig` → `(:Doctor)-[:OFFERS]->(:Gig)`
   (or a row in the file store's `gigs`).
2. A patient opens that doctor's profile. `useGigs(id)` returns only **active** listings, so
   gigs render above the appointment picker — which collapses to a fallback disclosure.
   With no gigs the picker is the whole surface, unchanged.
3. The patient hires one → `createRequest({ mode:'gig', gigId })`. The server reads the
   price, visit type and duration **off the gig** and snapshots `gigTitle` onto the row, so
   later edits or archiving don't rewrite history.
4. The doctor accepts → `assertCanAccept` allows one gig at a time; `tripStage` starts at
   `accepted`.
5. **They are now paused.** `bookableState` reports `onGig`, and `emergencyAvailable`,
   `gigsHireable` and `appointmentsOpen` all go false. Their search card shows "On a gig";
   pending urgent requests route elsewhere. Appointments already confirmed still stand.
6. The doctor walks the trip rail (`advanceTrip`, one server-derived step at a time) and
   marks it complete → one idempotent `earning` transaction at `COMMISSION_RATE`, and every
   flag flips back.

Broadcast dispatch is the same row with `mode:'emergency'` and `doctorId: null`: it reaches
every free doctor in range, the first `acceptRequest` wins and the rest get a 409, a pass is
persisted in `passedBy`, and a doctor cancelling one re-pools it instead of ending it.

## 7a. Data flow, end to end (an SOS)

1. An `sos_events` row is created (patient app, or the demo simulator, or a manual insert).
2. **Live:** Realtime pushes the change → `useSosEvents()` refetches → ops SOS board + map
   update instantly. **Demo:** the store emits → subscribers re-render.
3. Ops assigns an ambulance/doctor → `useActions().assignAmbulance()` → `sos_events.status`
   moves `open → assigned → enroute → resolved`; ambulance flips to `dispatched`.
4. A nearby online doctor sees the same SOS in their cockpit (filtered by haversine radius)
   and can respond.

## 8. Extending to Kenshin (next phase)

Add a `kiosks` table + `screenings` table, a `useKiosks()` hook pair in `data.ts`, an
`/ops/kenshin` route, and a nav entry (kanji 検). Nothing else changes — the seam holds.
