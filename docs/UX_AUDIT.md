# Iyashi — Experience Audit (User · Doctor · VC) + Fixes

> Three independent role-based reviews of the product experience, the concrete
> UI bugs found, and what was fixed. Companion to `VC_AUDIT.md` (market),
> `CODE_AUDIT.md` (security) and `BUILD_LOG.md` (history).

## The one thing all three agreed on

**The single iconic Uber moment — watching your doctor move toward you on a live
map with a counting-down ETA — did not exist**, and the demo **stalled for a solo
visitor** (no doctor ever accepted without a second tab). Everything else is
polish next to those two. Both are now built.

---

## What was fixed this round

### The Uber loop (all three audits' #1)
- **Live-tracking screen** (`components/patient/live-tracking.tsx` + `components/map/track-map*.tsx`):
  after a doctor accepts, the patient now sees a **live map with the doctor's
  marker moving toward "You"**, a **counting-down ETA**, a **Requested → Accepted →
  On the way → Arrived** stepper, and (for video) a **Join call** button. It takes
  over the top of the home and Find-a-doctor screens while a visit is live.
- **Self-driving demo simulator** (`lib/demo/simulator.ts`): in demo mode, a nearby
  verified doctor **auto-accepts** your request after ~3.5s (a real manual accept
  in the doctor tab still wins the race), then advances on-my-way → arrived →
  completed with a sample prescription. A solo visitor now **watches it work**
  instead of staring at "waiting for a doctor."
- **Doctor side of the loop** (`app/doctor/page.tsx`): the accepted job no longer
  vanishes — an **"Active visit"** card stays on the cockpit with the full
  on-my-way / arrived / complete-and-prescribe ladder and a **"Navigate"** button
  that opens Google Maps directions to the patient.

### The UI bugs you reported
- **Dropdowns/menus/toasts were see-through** (content bled through the glass). Root
  cause: the global `.rounded-card` rule forced a 55%-opacity background on *every*
  card, including floating overlays. Fixed with an opaque **`.popover`** surface now
  applied to the theme switcher, site menu, prescription dialog and toasts.
- **Overlays could render under the map** (Leaflet's internal z-index goes to ~1000).
  Fixed by containing the map in its own stacking context (`.leaflet-container`
  `z-index: 0`) and raising overlays to `z-[1000]+`.
- **Landing overflow / not responsive**: the hero now uses `clamp()` and natural
  vertical flow instead of forced spread; smaller base sizes on phones.
- **Internal codenames** (ZUMI / TASUKE / AURAMED) leaked into UI labels — **purged**
  and replaced with plain language ("Incoming requests", "Nearby emergencies",
  "Medicine · in transit", etc.).
- **Fake/wrong data**: the hardcoded "4m avg response" stat is gone; the doctor
  **profile now shows only their own reviews** (it was showing the seed doctor's).
- **Home reorder**: "Find a doctor" leads; SOS is present but no longer the alarming
  first thing. The demo-only "Doctor view" link is gated to demo mode.

---

## The three lenses (top findings)

### 1. Patient (User)
- **P0** live-tracking screen — *fixed*.
- **P0** opaque popovers, map z-index, landing responsiveness — *fixed*.
- **P1 (open)** two competing booking flows (broadcast vs pick-a-doctor) are
  confusing — should lead with the map + one primary "Request a doctor" CTA and
  hide triage/symptoms/mode/filters behind progressive disclosure.
- **P1 (open)** accessibility: 44px tap targets, a global `focus-visible` ring,
  and lifting low-contrast (`--text-faint` 0.4α) small text to WCAG AA.
- **P2 (open)** let the patient set their location/address (the "where I am" half
  of the promise is currently hardcoded).

### 2. Doctor (freelancer)
- **P0** active job vanished + no navigation — *fixed* (Active visit card + Navigate).
- **P0 (open)** earnings are fake — needs real payment collection (cash/online),
  a wallet, and an instant-payout ledger. Money must *move*.
- **P0 (open)** verification is a dead end — needs document upload, an SLA/status
  panel, required reg number, and honest "Submit application" copy.
- **P1 (open)** show **distance** on every incoming request and cap by radius;
  capture the doctor's **real location** at registration (it's random today).
- **P1 (open)** **notifications** — sound + Web Notifications (and push) on a new
  request; tab-open polling loses jobs.
- **P1 (open)** video consults have no actual call; auto-set `busy` during a visit;
  route the Consults-page "Complete" through the prescription (it currently skips it).

### 3. VC / demo-readiness
- **#1/#2** live tracking + self-driving demo — *fixed* (the two that convert a
  static walkthrough into "oh, it works like Uber").
- **#4 (open)** make the **verified-doctor credential** visible (photo, NMC reg,
  years, "ID + background checked, X visits") — the trust/moat made visible.
- **#5 (open)** put the product (a map of "doctors near you now") on the landing
  hero instead of a decorative kanji; promote direct entry over the auth wall.
- **#6** purge codenames — *fixed*.
- Cut from the core demo: over-featuring themes and the flat medicine catalog;
  keep one confident theme and a one-line "meds too."

---

## Prioritized next (roadmap)
1. **One-CTA booking flow** + progressive disclosure (patient P1).
2. **Payments: collection + wallet + payout** (doctor P0) — also the fundability spine.
3. **Verification funnel** (doc upload, SLA, required reg no) (doctor P0).
4. **Notifications** (sound + Web Push) (doctor P1).
5. **Distance in the queue + real doctor geolocation** (doctor P1).
6. **Visible credential card** + landing product frame (VC #4/#5).
7. **A11y pass**: tap targets, focus rings, contrast (patient P1).
8. **Patient location editor** (patient P2).

typecheck + lint + production build pass; demo mode driven; no runtime errors.
