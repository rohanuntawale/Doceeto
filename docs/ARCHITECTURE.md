# Iyashi Dashboard — Architecture

> How the system fits together, and *why* it's built this way. Pair this with
> [`REFERENCE.md`](REFERENCE.md) for the exact tokens, schema, and contracts.

## 1. What this is

One Next.js app serving **three personas** off a shared design system and data layer:

| Persona | Route | Modules | Purpose |
|---|---|---|---|
| **Patient** | `/patient/*` | Tasuke + Zumi + AuraMed | Consumer app — SOS button, find a doctor, order medicine, live "your care" |
| **Doctor** | `/doctor/*` | Zumi + Tasuke | Freelance doctor cockpit — online toggle, requests, consults, earnings |
| **Ops** | `/ops/*` | Tasuke + Zumi + AuraMed | Command center — SOS dispatch, network health, order tracking |

The patient app **creates** the work (SOS/consult/order); the doctor and ops surfaces
**consume** it live. That patient→provider connection is the spine of the product.

The product's four pillars map to features: **Tasuke** (助け, emergency SOS), **Zumi**
(freelance doctors), **AuraMed** (薬, medicine delivery). **Kenshin** (検診, diagnostics)
is reserved in the schema for a later phase.

## 2. Two modes, one seam

The single most important design decision: **the UI never talks to a backend directly.**
Every read and write goes through the hooks in [`lib/hooks/data.ts`](../lib/hooks/data.ts),
which are bound **once at module load** to one of two implementations:

```
DEMO  (no env)   →  lib/demo/store.ts   (in-memory + simulated realtime)
LIVE  (Supabase) →  Supabase queries + Realtime + lib/api/actions.ts
```

`isDemoMode` is derived from `NEXT_PUBLIC_SUPABASE_*` env, so it's a compile-time
constant — React always sees a stable hook (no conditional-hook hazard). Because both
paths return the same **domain types** ([`lib/types/domain.ts`](../lib/types/domain.ts)),
components are identical in either mode.

```
Component  ──►  useSosEvents() / useActions()  ──►  ┌ demo store  (dev, zero-config)
(dumb UI)       (lib/hooks/data.ts)                 └ Supabase    (prod)
```

**Why:** the founder sees a fully-alive product on `npm run dev` with no setup, teammates
building the real backend only have to satisfy the schema + channel contract, and there's
exactly one file to change when swapping the source.

## 3. Realtime, not polling

Emergencies can't lag, so the app is push-based:

- **Live mode:** Supabase Realtime `postgres_changes` on `sos_events`, `consult_requests`,
  `orders`, `doctors`, `ambulances`. A change invalidates the matching TanStack Query key
  and the UI re-renders. See `useLiveTable` in `lib/hooks/data.ts`.
- **Local mode:** `lib/demo/store.ts` is a browser-only engine that **persists to
  localStorage** and **broadcasts every change over a `BroadcastChannel`** — so a patient
  action in one tab pushes live into the doctor/ops tabs (patient→provider actually
  connects, no server). UI subscribes via `useSyncExternalStore`. There is **no fake
  auto-generated activity** — all SOS/consults/orders are created by the patient app.
  `SEED_LEVEL` (`catalog` default / `full` / `none`) sets the starting catalog.

Mutations (accept request, dispatch ambulance, advance order) update state immediately
(optimistic in spirit); in live mode the Realtime echo reconciles across every open client.

## 4. Rendering & performance

- **Server Components** for the shells/layouts; **Client Components** for the live widgets.
- **`next/font`** self-hosts Playfair Display / Inter / JetBrains Mono / Noto Sans JP →
  zero layout shift.
- **The map is `dynamic(..., { ssr:false })`** (`components/map/live-map.tsx`) so Leaflet
  never touches the server and never blocks the SOS-critical render path.
- **Time-relative text is gated behind `useMounted`** to avoid SSR/client hydration drift.
- Route-level code splitting; first-load JS ~170–190 kB per route.
- DB indexes on the hot paths: `(status)`, `(lat,lng)` for SOS and requests.

## 5. Auth & routing

- `middleware.ts` → `lib/supabase/middleware.ts` refreshes the Supabase session each
  request and guards `/doctor` and `/ops` (redirect to `/login` when unauthenticated).
- **Demo mode:** middleware is a pass-through; the landing page enters either console.
- **Role model:** `profiles.role ∈ {doctor, ops, admin}`. Doctors self-onboard at `/signup`
  (a Postgres trigger creates their `profiles` + `doctors` rows). Ops accounts are seeded /
  invited. Role-based hard-guarding of `/ops` vs `/doctor` is a hook point in the layouts
  (see REFERENCE → "Tightening for production").

## 6. Directory map

```
app/
  page.tsx              landing / role entry
  login, signup         auth (Supabase in live mode)
  doctor/               cockpit: home, requests, consults, earnings, profile
  ops/                  console: overview, sos, doctors, orders
components/
  ui/                   design-system kit (Button, Card, StatCard, StatusPill, toast…)
  layout/               Shell (sidebar+topbar), PageHeader
  brand/                Wordmark
  sos/ zumi/ auramed/   per-module cards
  map/                  Leaflet live map (dynamic)
lib/
  hooks/data.ts         THE data seam (demo ⇄ live), useActions, useOpsSnapshot
  demo/                 seed.ts + store.ts (simulated realtime)
  supabase/             client / server / middleware helpers
  api/                  mappers.ts (row→domain), actions.ts (live mutations)
  types/domain.ts       the shared domain types
  labels.ts, utils/     status labels, geo (haversine), formatting
supabase/
  migrations/0001_init.sql   schema + RLS + realtime + RPCs
  seed.sql                   demo data
```

## 7. Data flow, end to end (an SOS)

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
