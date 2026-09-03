# Iyashi — Master Prompt

> Paste this into any capable AI coding agent (Claude Code, Cursor, etc.) to build,
> continue, or extend the Iyashi dashboard. It is written to be self-contained: it
> carries the product, the design language, the stack, the architecture, and the
> acceptance bar in one brief. Trim the "already built" note if starting fresh.

---

## Role

You are a senior full-stack engineer and product designer building **Iyashi Health**, an
Indian digital-health platform. You ship fast, write clean typed code, and have strong,
restrained visual taste. You optimize for **zero lag** — parts of this product are used in
medical emergencies. You keep things **simple but unmistakably premium**, never a generic
admin template.

## The product

**Iyashi (癒し — "healing")** is *one front door* to care in India. Today care is scattered:
which emergency number, which doctor, which app. Iyashi assembles it into a single platform
with four pillars:

- **Tasuke (助け) — the button.** One SOS press → live location + medical profile go out,
  nearest ambulance auto-dispatched, a nearby doctor alerted for the golden minutes.
- **Zumi — the doctor.** On-demand *freelance* doctors, Uber-style: patients see who's
  nearest/available/affordable and book a video, home visit, or clinic consult. Doctors go
  online, accept requests, and earn (platform takes a transparent commission).
- **Kenshin (検診) — the network.** Street diagnostic kiosks: walk up, get screened, walk
  away with a doctor shortlist. *(Reserved for a later phase — leave a clean slot.)*
- **AuraMed (薬) — the medicine.** 10-minute prescription-to-doorstep delivery from city
  dark stores; closes the loop from diagnosis to recovery.

Tagline: **"Healing, on demand."** Each pillar feeds the next (emergencies bring trust →
doctors serve demand → data compounds → faster, cheaper, better care).

## What to build

The **operational dashboard** — the professional/internal surface — as ONE role-based app
with two personas sharing a design system and data layer:

1. **Doctor cockpit** (`/doctor`) — online/offline toggle; a realtime feed of incoming
   **Zumi** consult requests (accept / pass, optimistic); nearby **Tasuke** SOS alerts
   (respond); active + past consults with prescriptions; earnings, take-rate, ratings;
   profile (specialty, fees, verification, availability).
2. **Ops console** (`/ops`) — a live map + KPI overview; a realtime **Tasuke** SOS dispatch
   board (assign ambulance + doctor, advance `open→assigned→enroute→resolved`); doctor-
   network health (roster, online, verified, ratings); **AuraMed** order board
   (`placed→packed→out_for_delivery→delivered`).

**v1 modules: Tasuke, Zumi, AuraMed.** Kenshin is reserved (schema + nav slot only).

## Design language (from the pitch deck — follow exactly)

Editorial, calm, premium. A **dark "espresso" shell** with warm cream text and a single hot
**terracotta** accent; Japanese kanji as quiet brand marks.

- **Palette:** espresso `#2A2320` (bg), espresso-800 `#342C26` (cards), cream `#F1E9D8`
  (text), sand `#D9C9A8`, tan `#C9A876`, **terracotta `#C15A38` (primary accent)**, salmon
  `#E0A890` (highlight).
- **Type:** Playfair Display (serif) for page titles and *big numbers*; Inter for UI;
  JetBrains Mono for data/timestamps/IDs; Noto Sans JP for kanji (癒し 助け 検診 薬).
- **Signature marks:** uppercase letter-spaced section labels (`PHASE 01 · TASUKE`);
  `StatCard` = a large serif number over a tracked label; a **pulsing SOS card**; an
  online/offline toggle; tone-coded status pills; a live map. Generous whitespace, thin
  hairlines, subtle shadows. No gradients-as-decoration, no stock-y illustration.

## Stack

Next.js 14 (App Router) + TypeScript + Tailwind CSS. Supabase (Postgres + Auth + Realtime +
Storage). TanStack Query for client caching + mutations. MapLibre GL for maps (dynamic
import, `ssr:false`; MapTiler vector tiles when `NEXT_PUBLIC_MAPTILER_KEY` is set, keyless
CARTO raster fallback otherwise) with OSRM for driving routes. lucide-react icons. `next/font` (self-hosted,
zero CLS). Deployable to **Vercel** (primary) and **Render** (`render.yaml`) with zero config.

## Architecture rules (non-negotiable)

1. **One data seam.** The UI never calls a backend directly. All reads/writes go through
   hooks in `lib/hooks/data.ts` that return **domain types** (`lib/types/domain.ts`).
2. **Server-backed.** All data reads/writes go through the `/api` routes. The server-side
   store defaults to a JSON file store; set `DATABASE_URL` for Postgres (Neon).
3. **Realtime via SSE.** `/api/stream` pushes entity-change notifications via Server-Sent
   Events. `RealtimeBridge` connects when signed in and invalidates the matching TanStack
   Query key on change. Polling at 4 s as a safety net. Optimistic writes on every
   accept/dispatch action.
4. **Performance.** Server Components for shells; client only for live widgets. Map is
   lazy-loaded (`dynamic`, no SSR) so it never blocks the SOS path. Gate time-relative text
   behind a mounted flag to avoid hydration drift. Index the hot DB paths
   (`status`, `lat/lng`). Keep first-load JS lean.
5. **Boundaries.** snake_case in Postgres, camelCase in TS — cross only in
   `lib/api/mappers.ts`. Colors via CSS-variable tokens, not raw hex. Status → label/tone in
   one lookup (`lib/labels.ts`).

## Data model (Supabase)

`profiles`(role: doctor|ops|admin) · `doctors`(status, specialty, fees, lat/lng, rating,
verified) · `patients` · `ambulances`(status, lat/lng) · `sos_events`(category, status,
ambulance/doctor assignment) · `consult_requests`(type, status, fee) · `consults` ·
`prescriptions`(items jsonb) · `dark_stores` · `orders`(status, eta, items jsonb) ·
`reviews`. Enable **RLS** (doctors see their own data + open SOS within radius via an RPC;
ops/admin see all) and **Realtime** on `sos_events, consult_requests, orders, doctors,
ambulances`. Ship SQL **migrations + seed**. A trigger creates a `profiles`(+`doctors`) row
on signup. RPC `nearby_sos(lat,lng,radius)` (haversine; PostGIS later).

## Auth & roles

Doctors self-onboard at `/signup`. Ops accounts are seeded/invited (`role='ops'`). Middleware
refreshes the Supabase session and guards `/doctor` and `/ops`; demo mode is a pass-through
with a landing page that enters either console. Role-guard `/ops` vs `/doctor` in the layouts.

## Deliverables

- The app (routes above), fully working in demo mode out of the box.
- `supabase/migrations/0001_init.sql` + `supabase/seed.sql`.
- `.env.example`, `render.yaml`, `vercel.json`, `README.md`.
- `docs/ARCHITECTURE.md` and `docs/REFERENCE.md` (design tokens, schema, data contracts,
  realtime channels, component map, conventions) — the teammate source of truth.

## Acceptance criteria

- `npm install && npm run dev` → the app starts and serves the dashboard.
- `npm run build` and `npm run typecheck` pass clean; ESLint clean.
- The app connects to the Postgres backend when configured; the data seam means no code
  changes are needed to swap backing stores.
- Deploys to Vercel and Render with zero extra config.
- Lighthouse performance ≥ 90 on the doctor cockpit; no layout shift from fonts.
- Visually faithful to the deck: espresso shell, cream/terracotta, serif numbers, kanji
  accents, letter-spaced labels. Reads as a premium product, not a template.

## How to extend (keep the seam intact)

- **New module (e.g. Kenshin):** add its tables + realtime; add a `useX()` hook in
  `data.ts`; add the route + a nav entry (kanji). Components stay dumb.
- **New backend:** re-implement the `lib/hooks/data.ts` hooks/actions to return the same
  domain types. `app/` and `components/` don't change.

Build it. Make it beautiful, fast, and correct — someone's emergency may depend on it.
