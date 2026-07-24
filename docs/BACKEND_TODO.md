# Backend — status & remaining work

> The frontend talks to the backend through `GET /api/data?entity=…`
> (reads), `POST /api/actions` (writes), `/api/auth/*`, and now
> `GET /api/stream` (SSE). **There is no demo data anywhere** —
> `POST /api/admin/seed` creates constraints/indexes + the ops login only.

## ✅ Implemented (2026-07)

### 1. Location
- `repo.updateDoctor` whitelists `lat`/`lng`, writes the Neo4j
  `point()` `location` property + `lastSeen`. The cockpit's location
  publisher works end-to-end.
- Doctor registration persists real signup GPS (`lat`/`lng` +
  `location`); SOS and consult requests store `location` points too.
- Point indexes (`doctor_location`, `sos_location`) + status indexes
  created by `lib/neo4j/seed.ts`.

### 2. Nearby queries
- `GET /api/data?entity=doctors|sos|requests&near=<lat>,<lng>&km=10`
  filters server-side with `point.distance` (radius clamped to 100 km,
  results capped). Full-list reads still work with no params.

### 3. Location privacy (enforced in `/api/data` by session role)
- Offline doctors' coordinates are zeroed for non-ops callers.
- Patients see only their own requests/SOS/orders; doctors see open
  broadcasts + their own case-load (so patient coords only reach
  eligible doctors); ambulance fleet positions are **ops-only**.

### 4. Realtime
- `GET /api/stream` (SSE) + in-process change bus
  (`lib/server/events.ts`); every write emits which entities changed.
- Client `RealtimeBridge` invalidates those query keys instantly and
  backs polling off to a 30 s safety net while connected; if SSE can't
  connect (e.g. serverless) it falls back to 4 s polling automatically.
- NOTE: the bus is per-process — fully live on Render/`npm start`;
  on Vercel serverless use the polling fallback or move to
  Ably/Pusher/Upstash later.

### 5. Auth hardening
- Rate limits: login 20/10 min per IP + 8/15 min per email;
  register 10/hour per IP (in-memory sliding window,
  `lib/server/rate-limit.ts`).
- Password policy: ≥8 chars with a letter and a number (server-enforced,
  UI hints updated). Email format validated.
- `middleware.ts` verifies the **role claim** for `/ops` and `/doctor`.
- Secret rotation: set `AUTH_SECRET_PREVIOUS` while rolling
  `AUTH_SECRET`; old sessions verify for their remaining lifetime.

### 6. Domain persistence
- **Reviews**: `createReview` action — patient-only, one per completed
  request, must match doctor+patient; refreshes the doctor's aggregate
  rating. `entity=reviews&doctorId=…` filter added.
- **Consults/prescriptions**: `completeRequest` now creates a `Consult`
  node (`RESULTED_IN`) and an optional `Prescription` node
  (`PRESCRIBED`) from `payload.notes` / `payload.prescription`.
- **Orders**: server-side pricing from the shared `lib/catalog.ts` —
  client totals are ignored, unknown items rejected (400), qty clamped.
- **Ambulances**: ops `createAmbulance` / `updateAmbulance` actions.

### 7. SOS pipeline
- On `createSos`: fan-out writes `NOTIFIES` relations to the 5 nearest
  online doctors (≤15 km, with distance) and stores
  `suggestedAmbulanceId` (nearest free unit).
- `advanceSos`: ops always; the **assigned doctor** may advance their
  own SOS.

### 8. Audit
- Every `/api/actions` write appends an `:Audit` node
  (actor, role, action, meta, timestamp), fire-and-forget.

## 🔲 Still open (needs product/infra decisions)

1. **Email verification** — needs an email provider (Resend/SES/SMTP).
   Flow: signed token → `/api/auth/verify` → `u.verifiedAt`.
2. **Push notifications** — FCM/WebPush for SOS `NOTIFIES` fan-out and
   accepted-request alerts; SSE only reaches open tabs.
3. **Multi-instance scale-out** — swap the in-memory rate limiter and
   event bus for Redis/Upstash (or Ably/Pusher) when running >1 server.
4. **Payments** — Razorpay order on accept/complete, doctor payout
   ledger (graph: `(:Payment)-[:FOR]->(:Consult)`).
5. **Geocoding** — address ⇄ lat/lng (Nominatim/Google) for users who
   deny GPS; today they fall back to the Nagpur center.
6. **Ops ambulance UI** — backend CRUD exists; add the fleet screen in
   `/ops` when needed.
7. **Patient review UI** — `createReview` is live; add a "rate your
   consult" card in the patient app's care history.
8. **Backups/monitoring** — Aura has automatic backups; add uptime +
   error alerting (Sentry) before launch.

## Setup (per environment)

```
NEXT_PUBLIC_BACKEND=neo4j
NEO4J_URI=neo4j+s://<aura-id>.databases.neo4j.io
NEO4J_USER=neo4j
NEO4J_PASSWORD=…
AUTH_SECRET=<long random>          # rotate via AUTH_SECRET_PREVIOUS
SETUP_TOKEN=<long random>
OPS_EMAIL=…  OPS_PASSWORD=…        # change from the default immediately
```

Then once: `POST /api/admin/seed` with the setup token → constraints,
indexes, ops login. No data is seeded.
