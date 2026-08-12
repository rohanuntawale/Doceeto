<div align="center">

# 癒し · Iyashi Health — Dashboard

**Healing, on demand.** One console for emergencies, freelance doctors, and medicine.

</div>

Iyashi in one Next.js app — **three connected surfaces**:

- **Patient app** (`/patient`) — big SOS button, find a doctor, order medicine. *(Tasuke + Zumi + AuraMed)*
- **Doctor cockpit** (`/doctor`) — go online, take consult & SOS requests, run consults, track earnings. *(Zumi + Tasuke)*
- **Ops console** (`/ops`) — live SOS dispatch, doctor-network health, AuraMed order tracking. *(Tasuke + Zumi + AuraMed)*

**They're wired together:** a request a patient raises appears **live** in the doctor cockpit and ops console, and its status flows back to the patient as the doctor/ops act on it.

> Runs in **two modes**. With no backend env it boots in **demo mode**, a cross-tab
> engine (BroadcastChannel + localStorage) that behaves like a shared backend on your
> machine, seeded with the doctor/ambulance **catalog only** (no fake activity, you create
> the data). Set DATABASE_URL and it switches to a real **Postgres backend with accounts and login** (cross-device), no code changes.

### See patient → doctor connect (30 seconds, no setup)

1. `npm run dev`, open **http://localhost:3000**.
2. Open the **Patient app** in one tab and the **Doctor cockpit** in a second tab (same browser).
3. In the doctor tab, flip **online**. In the patient tab, **Find a doctor → request a video consult** (or press **SOS**).
4. Watch it appear **live** in the doctor's Requests / nearby-SOS. Accept it → the patient tab shows *"accepted"* instantly. Same for **Ops → orders**.
5. Use **Reset** (top-right of the patient app) to wipe your test data and start clean.

> Cross-tab works within one browser today. Add DATABASE_URL for real accounts and cross-device.

---

## Quick start

```bash
npm install
npm run dev          # → http://localhost:3000  (demo mode, no setup)
```

Open the landing page and enter either **Doctor cockpit** or **Ops console**.

## Go live with Postgres (real accounts + login)

Any Postgres works — [Neon](https://neon.tech) and Supabase are both a
connection string away.

1. Create a project and copy its **pooled** connection string.
2. Copy `.env.example` → `.env.local` and fill in:
   ```
   NEXT_PUBLIC_BACKEND=server
   DATABASE_URL=postgres://user:pass@ep-xxx.region.aws.neon.tech/dbname?sslmode=require
   SETUP_TOKEN=any-secret-you-choose
   OPS_EMAIL=ops@iyashi.health
   OPS_PASSWORD=change-me
   ```
3. `npm run dev`, then run the one-time setup (applies the schema in
   `lib/postgres/schema.sql` and creates the ops login):
   ```
   curl -X POST -H "x-setup-token: $SETUP_TOKEN" http://localhost:3000/api/admin/seed
   ```
   The schema is idempotent, so this is safe to re-run on every deploy.
4. Patients and doctors now **register with a real email + password** at `/signup`;
   Ops signs in at `/ops-signin` with `OPS_EMAIL` / `OPS_PASSWORD`.

`DATABASE_URL` is the switch: set it and every read, write and session goes to
Postgres; leave it empty and the app runs on the zero-setup file store at
`.data/iyashi.json`. See [lib/db/index.ts](lib/db/index.ts).

### Coming from the Neo4j version?

One command copies the graph across, ids unchanged. It is idempotent
(`ON CONFLICT DO NOTHING`), so a re-run tops up instead of duplicating:

```
npm run db:migrate:neo4j-to-postgres -- --dry-run   # report only
npm run db:migrate:neo4j-to-postgres
```

It reads `NEO4J_URI` / `NEO4J_USER` / `NEO4J_PASSWORD` and `DATABASE_URL` from
the environment. Sessions are deliberately not copied — everyone signs in once
more. Afterwards the Neo4j variables can be deleted.

### Sessions live in the database

A sign-in creates a `sessions` row. The browser is handed only that row's
**opaque id** in an httpOnly cookie — no role, no user id, nothing signed — so
the database is the single authority on who you are, and deleting the row ends
the session immediately (`POST /api/auth/logout`, or `?all=1` for every device).

There is **one cookie per role** (`iyashi_sid_patient`, `iyashi_sid_doctor`,
`iyashi_sid_ops`), which is what lets a patient and a doctor be signed in on the
same browser at once. Each surface reads only its own, so signing into the
cockpit to accept a gig cannot flip an open patient tab into the doctor's — and
`/doctor` never renders the patient dashboard. Roles do not switch: `/doctor`
with only a patient session shows the sign-in form for a doctor account.

Page authorization runs in the surface layouts (`requireSurface`), which execute
on the server before anything renders. The middleware only turns away requests
carrying no session cookie at all — the Edge runtime cannot reach the database.

**Authorization** is enforced server-side in the `/api` route handlers (there is no
database RLS): each role only reads and writes the rows it is allowed to.

## Scripts

| Command | Does |
|---|---|
| `npm run dev` | Local dev server |
| `npm run build` | Production build |
| `npm run start` | Serve the production build |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run lint` | Next/ESLint |

## Deploy

**Vercel (recommended):** import the repo → framework auto-detected → add the env vars → deploy.
**Render:** the included `render.yaml` blueprint builds and serves it as a Node web service; set the env vars in the dashboard.

Both work with **zero** extra config. In demo mode they deploy even with no env vars set.

## Docs

- [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) — how the system fits together.
- [`docs/REFERENCE.md`](docs/REFERENCE.md) — **teammate source of truth**: design tokens, DB schema, data contracts, realtime channels, component map, conventions.
- [`docs/MASTER_PROMPT.md`](docs/MASTER_PROMPT.md) — the master prompt describing the whole project.

## Tech

Next.js 14 (App Router) · TypeScript · Tailwind · Postgres (Neon) · database-backed sessions (bcrypt + opaque httpOnly cookie) · TanStack Query · MapLibre GL (MapTiler vector tiles, OSRM routing) · lucide-react.

Modules covered: **Tasuke** (SOS), **Zumi** (freelance doctors), **AuraMed** (medicine). **Kenshin** (diagnostics) is reserved in the schema and nav for a later phase.
