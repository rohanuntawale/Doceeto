# Iyashi Dashboard — Reference

> **Single source of truth for the team.** Design tokens, database schema, data
> contracts, realtime channels, component map, and conventions. If you're building
> "your side" (backend, patient app, another surface), build against *this*.

---

## 1. Brand & design tokens

Sourced from the pitch deck. Defined as CSS variables in
[`app/globals.css`](../app/globals.css) and mapped in
[`tailwind.config.ts`](../tailwind.config.ts).

| Token | Hex | Tailwind | Use |
|---|---|---|---|
| Espresso | `#2A2320` | `bg-espresso` | App background (dark shell) |
| Espresso 800 | `#342C26` | `bg-espresso-800` | Raised cards |
| Espresso 700 | `#3F352E` | `border-espresso-700` | Borders / hairlines |
| Cream | `#F1E9D8` | `text-cream` | Primary text on dark |
| Sand | `#D9C9A8` | `bg-sand` | Secondary surface (light) |
| Tan | `#C9A876` | `text-tan` | Tertiary accent, ratings, data bars |
| **Terracotta** | `#C15A38` | `bg-terracotta` | **Primary accent** — CTAs, SOS, emphasis |
| Terracotta 700 | `#A94E30` | `hover:bg-terracotta-700` | Hover / pressed |
| Salmon | `#E0A890` | `text-salmon` | Soft highlight, emphasis words |

**Status hues** (functional, harmonized): `status-critical` `#C15A38` · `status-warn`
`#C9A876` · `status-ok` `#7C8B63` · `status-idle` `#6B615A`.

**Typography** (`next/font`, see [`app/layout.tsx`](../app/layout.tsx)):

| Role | Family | Tailwind | Notes |
|---|---|---|---|
| Display / big numbers | Playfair Display | `font-serif` + `.metric` | Page titles, StatCard values |
| UI / body | Inter | `font-sans` | Default |
| Data / IDs / time | JetBrains Mono | `font-mono` | Timestamps, vehicle no., coords |
| Kanji accents | Noto Sans JP | `font-jp` | 癒し 助け 検診 薬 |
| Section label | Inter, uppercase, `.15em` | `.label` class | e.g. `PHASE 01 · TASUKE` |

Dark is the default shell. Add `data-surface="light"` to any container to remap tokens
to the cream surface (variables cascade — no component changes needed).

---

## 2. Database schema (Supabase / Postgres)

Full DDL in [`supabase/migrations/0001_init.sql`](../supabase/migrations/0001_init.sql).
Enums are Postgres enum types. All ids are `uuid`.

| Table | Key columns | Notes |
|---|---|---|
| `profiles` | `id`→auth.users, `role` (`doctor`\|`ops`\|`admin`), `full_name`, `phone` | 1:1 with an auth user |
| `doctors` | `profile_id?`, `full_name`, `specialty`, `status` (`online`\|`offline`\|`busy`), `verified`, `rating`, `consult_fee`, `home_visit_fee`, `lat`, `lng`, `last_seen` | Catalog row; `profile_id` links to the logged-in doctor |
| `patients` | `full_name`, `phone`, `dob`, `blood_group`, `allergies` | |
| `ambulances` | `vehicle_no`, `driver_name`, `status` (`free`\|`dispatched`\|`busy`), `lat`, `lng` | |
| `sos_events` | `patient_name`, `category`, `status` (`open`→`assigned`→`enroute`→`resolved`\|`cancelled`), `address`, `lat`, `lng`, `ambulance_id?`, `doctor_id?`, `notes`, `resolved_at` | **Tasuke**. Realtime on. |
| `consult_requests` | `patient_name`, `doctor_id?`, `type` (`video`\|`home_visit`\|`clinic`), `status` (`pending`\|`accepted`\|`declined`\|`completed`\|`cancelled`), `symptoms`, `fee`, `lat`, `lng` | **Zumi**. Realtime on. |
| `consults` | `request_id?`, `doctor_id?`, `patient_id?`, `started_at`, `ended_at`, `notes` | |
| `prescriptions` | `consult_id?`, `doctor_id?`, `items jsonb` | |
| `dark_stores` | `name`, `lat`, `lng`, `status` | AuraMed fulfilment nodes |
| `orders` | `patient_name`, `dark_store`, `status` (`placed`→`packed`→`out_for_delivery`→`delivered`\|`cancelled`), `items jsonb`, `total`, `address`, `eta` | **AuraMed**. Realtime on. |
| `reviews` | `doctor_id`, `patient_name`, `rating` (1–5), `comment` | |

**Indexes:** `sos_events(status)`, `sos_events(lat,lng)`, `consult_requests(status)`,
`consult_requests(doctor_id)`, `orders(status)`, `doctors(status)`.

**RPCs:** `nearby_sos(in_lat, in_lng, radius_km)` → open/active SOS within radius
(haversine; swap for PostGIS later). Helpers: `role_of(uid)`, `is_ops()`.

**Triggers:** `on_auth_user_created` → creates a `profiles` row (role from signup metadata)
and, for doctors, a `doctors` row.

---

## 3. Data contracts (domain types)

The UI only ever sees these camelCase types — never raw rows. Defined in
[`lib/types/domain.ts`](../lib/types/domain.ts). Row→domain mapping lives in
[`lib/api/mappers.ts`](../lib/api/mappers.ts). If you add a column, update both.

```ts
SosEvent   { id, patientName, category, status, address, lat, lng,
             ambulanceId, doctorId, notes, createdAt, resolvedAt }
ConsultRequest { id, patientName, type, status, symptoms, fee,
                 address, lat, lng, createdAt, doctorId,
                 // booking path — read via bookingModeOf(), never raw
                 mode:'emergency'|'scheduled'|'gig',
                 scheduledAt, scheduledEnd, slotMinutes,   // appointments
                 gigId, gigTitle,                          // gig hires
                 broadcast,                                // went to the pool
                 tripStage:'accepted'|'enroute'|'arrived'|'in_progress',
                 tripStageAt, passedBy:[doctorId],
                 acceptedAt, completedAt, cancelledAt, cancelledBy, cancelReason }
Gig        { id, doctorId, title, description, type, price, durationMinutes,
             status:'active'|'paused'|'archived', createdAt, updatedAt }
Order      { id, patientName, status, items:[{name,qty}], total,
             address, darkStore, etaMins, createdAt }
Doctor     { id, fullName, specialty, status, verified, rating,
             consultFee, homeVisitFee, avatarColor, lat, lng, lastSeen,
             availability?,
             // derived on read by /api/data — never stored
             onGig, onConsult, gigCount, gigFromPrice }
Ambulance  { id, vehicleNo, driverName, status, lat, lng }
Review     { id, patientName, rating, comment, createdAt }
```

### The three booking paths

Every engagement is **one `ConsultRequest`**, distinguished by `mode`. That is why
they all share the wallet, review, cancellation, audit and realtime machinery.

| Path | `mode` | `doctorId` | Holds a slot? | Occupies the doctor |
|---|---|---|---|---|
| **Hire a gig** | `gig` | the gig's owner | no | **until completed** — this is the auto-pause |
| **Book a slot** | `scheduled` | one doctor | yes | only while the slot is running |
| **Get care now** | `emergency` | `null` = broadcast to the pool | no | until completed |

The pause needs no stored flag. `intervalOf()` returns `null` for a gig, and
`isOngoingConsult()` treats an `accepted` row with no interval as live — so an
accepted gig is "ongoing" until it is closed, which is what makes
`hasOngoingConsult`, `emergencyAvailable` and `assertCanAccept` all do the right
thing. Completing or cancelling the row releases it, so a crash mid-gig can never
strand a doctor. **Never overload `Doctor.status` with this**; that field is the
doctor's own online/offline intent.

`bookableState(doctor, requests)` in [`lib/scheduling/slots.ts`](../lib/scheduling/slots.ts)
is the single answer to "what can a patient do with this doctor right now?" —
`/api/availability` and the demo path both call it, so they cannot drift.
`GIG_LOCKS_APPOINTMENTS` in [`lib/gigs/rules.ts`](../lib/gigs/rules.ts) is the one
switch for whether a running gig also closes the slot picker.

### The one API a component uses

```ts
// reads (auto-refresh on realtime / demo tick)
useSosEvents()        useConsultRequests()   useOrders()
useDoctors()          useAmbulances()        useReviews(doctorId?)
useGigs(doctorId?)    // one doctor's live gigs, or your own shelf as a doctor
useDoctorSchedule(id) // the calendar + every bookable flag (see bookableState)
useOpsSnapshot()      // derived KPI object
useCurrentDoctor()    // the signed-in doctor ("me")

// writes
const a = useActions()
// patient-side creates (feed the consoles)
a.createSos({ patientId, patientName, category, address, lat, lng })
a.createRequest({ ... })              // the three paths — see the table above
//   book a slot : { mode:'scheduled', doctorId, scheduledAt }
//   hire a gig  : { mode:'gig', doctorId, gigId }   ← fee/type read off the gig
//   care now    : { mode:'emergency', doctorId: null }  ← broadcast
a.createOrder({ patientId, patientName, items, total, address, darkStore })
// doctor-side
a.createGig({ title, description, type, price, durationMinutes })
a.updateGig(id, patch)          a.setGigStatus(id, 'active'|'paused'|'archived')
a.setAvailability(id, availability)
a.advanceTrip(id)               // one step along the trip rail, server-derived
// console-side mutations
a.setDoctorStatus(id, 'online'|'offline'|'busy')
a.acceptRequest(id, doctorId)   a.declineRequest(id, reason?)
a.cancelRequest(id, reason?)    // a DOCTOR must give a reason
a.completeRequest(id)
a.assignAmbulance(sosId, ambId) a.assignDoctorToSos(sosId, docId)
a.advanceSos(sosId, current)    a.advanceOrder(orderId, current)

// patient identity + reset
useCurrentPatient()   // { patient:{id,name,address,lat,lng}, update() }
resetTestData()       // wipe locally-created test data (demo mode)
```

**Local mode connection:** in demo/local mode the create actions write to
`lib/demo/store.ts`, which persists to `localStorage` and broadcasts over a
`BroadcastChannel` — so a patient action in one tab pushes live into the doctor/ops tabs.
The store starts **empty** — no seeded data of any kind; everything is user-created.

**To wire a different backend:** implement these hooks/actions in `lib/hooks/data.ts`
returning the same domain types. Nothing in `app/` or `components/` changes.

---

## 4. Realtime channels

Live mode subscribes to Supabase `postgres_changes` (event `*`, schema `public`) on:

| Channel | Table | Consumed by |
|---|---|---|
| `rt-sos_events` | `sos_events` | ops overview + SOS board + map, doctor nearby-SOS |
| `rt-consult_requests` | `consult_requests` | doctor requests/consults/earnings |
| `rt-orders` | `orders` | ops orders board + overview |
| `rt-doctors` | `doctors` | ops network, online counts, doctor "me" |
| `rt-ambulances` | `ambulances` | ops map + dispatch |

Any insert/update/delete invalidates the matching query key and re-renders. Enable
Realtime on these tables in Supabase (the migration already adds them to the
`supabase_realtime` publication).

---

## 5. Component map

| Component | File | Role |
|---|---|---|
| `PatientShell` | `components/patient/patient-shell.tsx` | Patient app chrome (top bar + bottom tabs + reset) |
| `SosTrigger` / `CareStatus` | `components/patient/*` | Patient SOS button + live "your care" list |
| `Shell` | `components/layout/shell.tsx` | Sidebar + topbar + role switch, both consoles |
| `PageHeader` | `components/layout/page-header.tsx` | Kanji + label + title header |
| `Wordmark` | `components/brand/wordmark.tsx` | 癒 mark + name |
| `StatCard` | `components/ui/stat-card.tsx` | Signature serif-number metric tile |
| `StatusPill` | `components/ui/status-pill.tsx` | Tone-coded status chip |
| `Button` / `Card` / `EmptyState` / toast | `components/ui/*` | Base kit |
| `OnlineToggle` | `components/doctor/online-toggle.tsx` | Doctor online/offline switch |
| `SosCard` | `components/sos/sos-card.tsx` | Emergency card + dispatch controls |
| `RequestCard` | `components/zumi/request-card.tsx` | Consult request + accept/pass |
| `OrderCard` | `components/auramed/order-card.tsx` | Delivery card + progress rail |
| `LiveMap` | `components/map/live-map.tsx` | Leaflet map (dynamic, `ssr:false`) |

Status → label/tone lookups live in [`lib/labels.ts`](../lib/labels.ts) — one place to
rename or recolor a status everywhere.

---

## 6. Conventions

- **Path alias:** `@/*` → repo root. Import `@/lib/...`, `@/components/...`.
- **Domain in, domain out.** Components never import Supabase directly; they use the hooks.
- **snake_case in Postgres, camelCase in TS.** Cross the boundary only in `lib/api/mappers.ts`.
- **Client vs server:** add `"use client"` only where you use state/hooks/events. Keep
  layouts server-side.
- **Colors via tokens**, never raw hex in components (except deliberate avatar/legend chips).
- **New status?** add it to the enum in the migration, the domain union in `domain.ts`,
  and the lookup in `labels.ts`.

---

## 7. Environment

| Var | Where | Purpose |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | client+server | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | client+server | Public anon key |
| `SUPABASE_SERVICE_ROLE_KEY` | **server only** | Privileged ops (never expose) |
| `NEXT_PUBLIC_APP_URL` | client | Auth redirect base |

Absent all of the above → **demo mode**. See `.env.example`.

---

## 8. Tightening for production (before real patients)

The MVP favors "it just works". Before launch:

1. **RLS:** the operational-table write policies are permissive (`authenticated`). Scope
   them — doctors update only their own `consult_requests`/`sos_events` assignments; ops via
   `is_ops()`. Policies are all in `0001_init.sql`, labeled to tighten.
2. **Role guard the routes:** enforce `role='ops'` on `/ops/*` and `role IN (doctor,admin)`
   on `/doctor/*` in the layouts (hook point noted in `app/(doctor|ops)/layout.tsx`).
3. **Map provider:** OSM tiles are fine for a demo; move to Mapbox/Google (API key) for
   production traffic and better India coverage.
4. **Geo:** replace haversine `nearby_sos` with PostGIS `geography` + GiST index.
5. **Secrets:** never ship `SUPABASE_SERVICE_ROLE_KEY` to the client; it's server-only here.
