# Session context — 12 Aug 2026

Work done in local Claude Code sessions on `main`, with the reasoning behind it.
Everything below is **uncommitted working-tree state** unless noted. Two separate
pieces of work landed, plus one environment problem worth not repeating.

---

## 1. Colour-theme switcher removed from the whole site

**Ask:** remove the palette button (the popover showing "COLOR THEME → Doceeto ·
Cream glass") from everywhere.

`lib/theme.ts` held a `THEMES` array with exactly **one** entry, so the popover was
a one-option menu. Removing the button made the rest of the machinery dead, so it
went too.

### Removed from 5 mount points

| File | Where it was |
|---|---|
| `app/page.tsx` | landing header action cluster |
| `components/site/site-header.tsx` | About / Contact header |
| `components/layout/shell.tsx` | doctor / ops top bar |
| `app/login/login-form.tsx` | floating top-right |
| `app/signup/page.tsx` | floating top-right |

### Deleted

- `components/theme/theme-switcher.tsx`
- `lib/theme.ts`
- The inline no-flash `<script>` in `app/layout.tsx` that read the saved theme from
  `localStorage` before paint. With no UI left to change the value, that script
  could only ever restore a stale key — anyone holding an old value would have been
  locked into it with no way out.

### Deliberately left alone

- The unused `[data-theme="fresh"|"mori"|"sumi"|…]` blocks in `app/globals.css` —
  dead but harmless.
- The `@media print` rule at the bottom of `globals.css`; it still matches through
  its `:root` selector.

Every visitor now gets the Doceeto skin straight from `:root` in `app/globals.css`.

---

## 2. Production 500s on `/api/data` and `/api/auth/me`

**Symptom:** `GET /api/data?entity=doctors` and `GET /api/auth/me` returning 500 on
doceeto.vercel.app.

### How it was narrowed down

| Probe | Result | Conclusion |
|---|---|---|
| prod `/api/data?entity=doctors` + bogus session cookie | `401` | `sessions` reads work |
| prod `/api/auth/login` + junk credentials | `401` | `users` reads work |
| same Neon DB from local, every entity | `200` | the schema is already correct |

Both env files point at the same database
(`ep-billowing-butterfly-a7rs2p4r-pooler.ap-southeast-2.aws.neon.tech`), so the
local result rules out schema drift as the cause.

The endpoints that 500 are **exactly** the ones that pass through the lazy
self-heal migrations in `lib/postgres/repo.ts`; the ones that work don't touch
them.

### Root cause

Those blocks fired `ALTER TABLE … ADD COLUMN IF NOT EXISTS` plus a
`DROP CONSTRAINT` / `ADD CONSTRAINT` rebuild against `users`, `sessions`,
`pending_signups`, `doctors` and `consult_requests` on the **first request of every
serverless instance** — taking ACCESS EXCLUSIVE locks on the two tables every other
in-flight request is reading, through Neon's PgBouncer pooler. Since all those
columns already exist, none of that DDL was ever doing anything.

Two things turned that into a hard outage:

1. **The memo cached the rejected promise** (`ready ??= (async () => …)()`). One
   failure and that instance answered *every* later request with the same 500 until
   it was recycled — which is why it looked permanent rather than flaky.
2. **A self-heal failure failed the caller's read**, so a maintenance convenience
   could take down ordinary reads.

### Fixes

**`lib/postgres/repo.ts`** — all four self-heal blocks (`ensureProviderColumns`,
`ensureAddressFullColumn`, `ensureChatColumn`, `ensurePrescriptions`) now go through
one `lazyMigration(label, needed, run)` helper that:

- **probes first** (`pg_attribute` / `pg_constraint` via the `hasColumn` and
  `checkAllowsNurse` helpers) and only runs DDL when something is genuinely
  missing — in the normal case, one cheap catalog `SELECT` per process and zero DDL;
- **never caches a failure** — the memo is cleared so a later request retries
  instead of the instance staying poisoned;
- **never propagates** — the caller's real query then fails with a precise message
  if the column truly is absent.

`ensureTestAccounts` already had this shape (try/catch + a flag set only on success)
and was the model for it.

**`lib/postgres/client.ts`**

- Added the missing `pool.on("error")` handler. An idle pooled client killed by
  Neon's compute suspend emits `error` on the pool with no request attached, and an
  EventEmitter `error` with no listener is an uncaught exception — it kills the Node
  process and 500s everything in flight.
- `keepAlive: true`.
- One retry on dead-connection errors (`57P0x`, `08xxx`, "connection terminated",
  ECONNRESET…), **restricted to read statements** — a write could have committed
  before the socket died, so replaying it is not safe.

**`app/api/auth/me/route.ts`** — wrapped in try/catch, returning `503`. It
deliberately does *not* answer `{user: null}` on a DB error; that reads as "signed
out" and would empty every dashboard.

**`app/api/data/route.ts`** — the catch now logs entity and role, and includes the
database's actual message as `detail` **for ops sessions only**. Ops already see
every row, so it costs nothing, and it means the next failure is diagnosable from
the app instead of Vercel's log viewer.

**`lib/hooks/data.ts` and `lib/hooks/use-current-doctor.ts`** — both swallowed a
5xx as an answer (`[]` and `null`), so one bad poll cached an empty doctor list and
a signed-out cockpit. They now throw on 5xx, which keeps the last good data on
screen and lets the next poll correct it.

### Status

- `npx tsc --noEmit` passes.
- `next build` completed successfully (`BUILD_ID` written).
- Verified against the live database: `doctors`, `requests`, `gigs`,
  `prescriptions` and `/api/auth/me` all return `200`.
- **Not yet deployed** — production stays broken until this ships.
- One stray ops session row exists in the database from local testing; it expires on
  its own, or "sign out everywhere" clears it.

---

## 3. Dev environment: never run two `next dev` processes

Symptom: every `/_next/static/*` asset 404s, the page renders as raw HTML with a
viewport-sized brand mark, and the dev log shows `Cannot find module './8948.js'`.

Cause: **two Next processes sharing one `.next` directory.** `next dev` and
`next build` both own that directory exclusively. A second `next dev` takes port
3001 (because 3000 is busy) but still compiles into the *same* `.next`, overwriting
the chunks the first one is serving — so the server hands the browser a manifest
pointing at files that no longer exist.

This happened repeatedly during the session; at one point 8 orphaned node processes
had accumulated.

**Rules:**

- Only ever one `next dev` running.
- Never run `next build` while `next dev` is up.
- `⚠ Port 3000 is in use, trying 3001 instead` is the warning sign — kill that
  process immediately; by the time the page loads it has already clobbered `.next`.
- Killing the `npm` wrapper is not enough. It leaves `next dev` and its
  `start-server.js` child orphaned, which is how duplicates kept reappearing.

**Recovery:**

```powershell
Get-CimInstance Win32_Process -Filter "Name='node.exe'" |
  Where-Object { $_.CommandLine -match 'Iyashi' } |
  ForEach-Object { Stop-Process -Id $_.ProcessId -Force }
Remove-Item -Recurse -Force .\.next
npm run dev
```

Then confirm the page's assets actually resolve, not just that `/` returns 200 —
the HTML renders fine even when every chunk is missing.

---

## Files touched in these sessions

```
app/api/auth/me/route.ts          resilience + 503
app/api/data/route.ts             ops-visible error detail
app/layout.tsx                    no-flash theme script removed
app/login/login-form.tsx          theme switcher removed
app/page.tsx                      theme switcher removed
app/signup/page.tsx               theme switcher removed
components/layout/shell.tsx       theme switcher removed
components/site/site-header.tsx   theme switcher removed
components/theme/theme-switcher.tsx   DELETED
lib/theme.ts                          DELETED
lib/hooks/data.ts                 don't cache a 5xx as an empty list
lib/hooks/use-current-doctor.ts   don't cache a 5xx as signed-out
lib/postgres/client.ts            pool error handler, keepAlive, read retry
lib/postgres/repo.ts              lazyMigration for all four self-heals
```

Other modified and untracked files in the tree — the landing components,
`app/globals.css`, `tailwind.config.ts`, `next.config.mjs`, `app/legal/`,
`components/legal/`, `lib/legal/`, `app/sitemap*`, `app/robots.ts` — are separate
in-progress work and were not part of these sessions.
