<div align="center">

# 癒し · Iyashi Health — Dashboard

**Healing, on demand.** One console for emergencies, freelance doctors, and medicine.

</div>

Iyashi in one Next.js app — **three connected surfaces**:

- **Patient app** (`/patient`) — big SOS button, find a doctor, order medicine. *(Tasuke + Zumi + AuraMed)*
- **Doctor cockpit** (`/doctor`) — go online, take consult & SOS requests, run consults, track earnings. *(Zumi + Tasuke)*
- **Ops console** (`/ops`) — live SOS dispatch, doctor-network health, AuraMed order tracking. *(Tasuke + Zumi + AuraMed)*

**They're wired together:** a request a patient raises appears **live** in the doctor cockpit and ops console, and its status flows back to the patient as the doctor/ops act on it.

> Runs in **two modes**. With no Supabase keys it boots in **local mode** — a cross-tab
> engine (BroadcastChannel + localStorage) that behaves like a shared backend on your
> machine, seeded with the doctor/ambulance **catalog only** (no fake activity — you create
> the data). Add Supabase keys and it switches to a real Postgres + Auth + Realtime backend
> (cross-device), no code changes.

### See patient → doctor connect (30 seconds, no setup)

1. `npm run dev`, open **http://localhost:3000**.
2. Open the **Patient app** in one tab and the **Doctor cockpit** in a second tab (same browser).
3. In the doctor tab, flip **online**. In the patient tab, **Find a doctor → request a video consult** (or press **SOS**).
4. Watch it appear **live** in the doctor's Requests / nearby-SOS. Accept it → the patient tab shows *"accepted"* instantly. Same for **Ops → orders**.
5. Use **Reset** (top-right of the patient app) to wipe your test data and start clean.

> Cross-tab works within one browser today. Add Supabase keys for true cross-device.

---

## Quick start

```bash
npm install
npm run dev          # → http://localhost:3000  (demo mode, no setup)
```

Open the landing page and enter either **Doctor cockpit** or **Ops console**.

## Go live with Supabase

1. Create a project at [supabase.com](https://supabase.com).
2. In the SQL editor, run **`supabase/migrations/0001_init.sql`**, then **`supabase/seed.sql`**.
3. Copy `.env.example` → `.env.local` and fill in:
   ```
   NEXT_PUBLIC_SUPABASE_URL=https://xxxx.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
   SUPABASE_SERVICE_ROLE_KEY=eyJ...      # server only
   ```
4. `npm run dev`. The app now reads/writes real data. Insert a row into `sos_events` in Supabase and watch it appear on the ops board **without a refresh**.

Doctors self-onboard at `/signup` (a `profiles` + `doctors` row is created by a trigger). Ops accounts are seeded/invited — set `role = 'ops'` on their `profiles` row.

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

Next.js 14 (App Router) · TypeScript · Tailwind · Supabase (Postgres/Auth/Realtime) · TanStack Query · React-Leaflet · lucide-react.

Modules covered: **Tasuke** (SOS), **Zumi** (freelance doctors), **AuraMed** (medicine). **Kenshin** (diagnostics) is reserved in the schema and nav for a later phase.
