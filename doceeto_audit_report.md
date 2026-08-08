# Doceeto — Codebase Audit Report

> Prepared for landing page planning. No files were modified.

---

## 1. Current Tech Stack

| Layer | Technology |
|---|---|
| **Framework** | Next.js 14 (App Router, TypeScript) |
| **React** | React 18 |
| **Styling** | Tailwind CSS 3.4 + CSS Variables (RGB triplets) |
| **Animation** | Framer Motion 12 |
| **Icons** | Lucide React |
| **Data fetching** | TanStack React Query 5 |
| **Maps** | Leaflet + react-leaflet |
| **Database** | PostgreSQL (via `pg`) — falls back to file store in demo mode |
| **Auth** | Custom session-based (cookies per role, DB-backed), Google OAuth |
| **CSS utilities** | `clsx`, `tailwind-merge` (via `cn()`) |
| **Hosting** | Vercel (region: `bom1` Mumbai) |
| **Fonts** | Playfair Display (serif), Inter (sans), JetBrains Mono (mono) — all via `next/font/google` |

---

## 2. Project Structure

```
/
├── app/
│   ├── layout.tsx              ← Root layout (fonts, providers, theme no-flash)
│   ├── page.tsx                ← Current homepage/landing (32KB, client component)
│   ├── globals.css             ← Design tokens, themes, glassmorphism, utilities
│   ├── about/page.tsx          ← Static about page
│   ├── contact/page.tsx        ← Contact form page
│   ├── login/                  ← Login (phone+OTP, Google, role selector)
│   ├── signup/page.tsx         ← Redirect stub → /login?tab=signup
│   ├── patient/                ← Patient surface (auth-guarded)
│   │   ├── layout.tsx          ← Loads PatientShell, LocationSync, ArrivalWatcher
│   │   ├── page.tsx            ← Patient dashboard
│   │   ├── doctors/            ← Find a doctor (map + list)
│   │   ├── care/               ← Active & past care
│   │   ├── medicine/           ← Medicine ordering (feature-flagged off)
│   │   ├── now/                ← Live consult tracking
│   │   └── account/            ← Profile, health data, settings
│   ├── doctor/                 ← Doctor surface (auth-guarded)
│   │   ├── layout.tsx          ← Loads DoctorShell, LocationPublisher, PresenceHeartbeat
│   │   ├── page.tsx            ← Doctor dashboard/cockpit
│   │   ├── consults/           ← Consult management
│   │   ├── gigs/               ← Gig marketplace
│   │   ├── schedule/           ← Availability calendar
│   │   ├── earnings/           ← Earnings tracking
│   │   ├── profile/            ← Doctor profile editor
│   │   └── requests/           ← Incoming patient requests
│   ├── ops/                    ← Ops/admin console (auth-guarded)
│   ├── api/                    ← API routes (auth, consults, doctors, health, etc.)
│   ├── error.tsx               ← Error boundary
│   └── not-found.tsx           ← 404 page
├── components/
│   ├── ui/                     ← Shared UI primitives
│   ├── layout/                 ← Shell, AppDock, PageHeader
│   ├── brand/                  ← Wordmark, LoadingSplash
│   ├── site/                   ← SiteHeader, SiteMenu (public pages)
│   ├── patient/                ← Patient-specific components (12 files)
│   ├── doctor/                 ← Doctor-specific components
│   ├── consult/                ← Consultation components
│   ├── auth/                   ← Auth cards and forms
│   ├── map/                    ← Leaflet map components
│   ├── theme/                  ← ThemeProvider, ThemeSwitcher
│   ├── zumi/                   ← AI assistant components
│   ├── auramed/                ← Premium subscription components
│   ├── dashboard/              ← Dashboard analytics components
│   ├── ops/                    ← Operations admin components
│   └── providers.tsx           ← QueryClient, Toast, RealtimeBridge, SiteDownGate
├── lib/
│   ├── auth/                   ← Session, guard, Google OAuth, password hashing
│   ├── config.ts               ← Runtime configuration (demo/live mode)
│   ├── theme.ts                ← Theme definitions (7 themes)
│   ├── labels.ts               ← UI label constants / localization
│   ├── catalog.ts              ← Medicine catalog, dark stores, avatar colors
│   ├── db/                     ← Database layer
│   ├── hooks/                  ← React hooks
│   ├── types/                  ← TypeScript domain types
│   ├── utils/                  ← Utility functions (cn, format, etc.)
│   ├── i18n/                   ← Internationalization
│   ├── scheduling/             ← Appointment/slot logic
│   ├── gigs/                   ← Gig marketplace logic
│   ├── health/                 ← Health profile utilities (BMI, etc.)
│   └── geo/                    ← Geolocation utilities
├── public/
│   ├── brand/                  ← SVG logos (icon, wordmark, wordmark-light), OG image
│   ├── loading/                ← Splash video (web-load.mp4)
│   └── favicon.svg
├── middleware.ts                ← Auth cookie checking, path header injection
├── tailwind.config.ts           ← Design system configuration
└── vercel.json                  ← Vercel deployment config
```

---

## 3. Existing Design System

### 3.1 Color Palette (CSS Variable Tokens — RGB Triplets)

The entire color system is **theme-switchable** via `data-theme` on `<html>`. Currently **7 themes** are defined:

| Theme | ID | Character |
|---|---|---|
| **Doceeto** (default) | `doceeto` | Light cream canvas, terracotta `#BE642D` + sage green accents, white cards |
| Fresh Health | `fresh` | Light mint-gray canvas, teal `#0FA69C` accent |
| Mori | `mori` | Deep forest green `#143026`, white accent, gold highlights |
| Sumi | `sumi` | Warm espresso `#2A2320`, terracotta `#C15A38` accent |
| Matcha | `matcha` | Tea-green `#1E251D`, gold `#C9A24B` accent |
| Sakura | `sakura` | Dusk plum `#241E24`, blossom-pink `#D96A8A` accent |
| AI | `ai` | Indigo night `#191F2D`, electric blue `#7C8CF0` accent |

> [!IMPORTANT]
> The **default theme is now "doceeto"** — a **light** theme with cream/beige glassmorphism. This is a significant detail for landing page design. Many component classes reference dark-sounding tokens (`espresso`, `cream`) but they are remapped to light values in the default theme.

### Core Semantic Tokens

```
--bg, --surface, --border, --text, --text-muted, --text-faint, --accent
--glass-bg, --glass-bg-strong, --glass-border, --glass-highlight
--elev-shadow, --elev-shadow-strong, --card-fill, --card-blur
--chrome-top (3.5rem), --chrome-dock (5.25rem mobile, 8.5rem desktop)
```

### 3.2 Typography

| Token | Font | Usage |
|---|---|---|
| `font-serif` | Playfair Display | Headings, metric numbers, brand wordmark |
| `font-sans` | Inter | Body text, labels, buttons |
| `font-mono` | JetBrains Mono | Timestamps, technical data |

**Special utility classes:**
- `.label` — `0.6875rem`, `letter-spacing: 0.15em`, uppercase, muted color (section labels)
- `.metric` — Playfair Display, font-weight 500, tight line-height (stat numbers)

### 3.3 Spacing, Borders, Radius, Shadows

| Token | Value |
|---|---|
| `rounded-card` | `14px` — standard card radius, also inherits glass styling from CSS |
| `rounded-2xl` | `1.125rem` — buttons, form inputs |
| `rounded-3xl` | `1.5rem` — larger cards |
| `shadow-card` | Deep inset + shadow combo |
| `shadow-soft` / `shadow-soft-lg` | Theme-aware via `--elev-shadow` / `--elev-shadow-strong` |
| `shadow-glow` | Terracotta glow ring (accent highlight) |
| `tracking-label` | `0.15em` — used for uppercase label text |

### 3.4 Glassmorphism System (CSS Classes)

| Class | Description |
|---|---|
| `.glass` | Frosted translucent panel with backdrop-blur |
| `.glass-strong` | Heavier glass with stronger background |
| `.glass-card` | Pronounced frosted card with radial gradient overlay + grid pattern mask |
| `.fh-card` | Default card surface with top sheen gradient |
| `.glass-sheet` | Heavier frost for panels over maps |
| `.glass-inset` | Recessed field inside glass (search bars, inputs) |
| `.glass-control` | Floating control over maps |
| `.fh-tile` | Raised inner tile (chips, list rows) |
| `.pattern-dots` / `.pattern-grid` | Decorative background patterns |

### 3.5 Animations

**Tailwind keyframes** (in `tailwind.config.ts`):

| Animation | Description |
|---|---|
| `pulse-ring` | Pulsing SOS/urgent ring effect |
| `fade-up` | Subtle 6px fade-up entrance |
| `rise` | Pronounced 16px rise entrance |
| `float` | Gentle 14px floating loop (decorative cards) |
| `sheen` | Glossy sheen sweep across elements |

**CSS animations** (in `globals.css`):

| Animation | Description |
|---|---|
| `shimmer` | Skeleton loading shimmer |
| `page-in` | Fallback page transition |

**Framer Motion** is used extensively for:
- Page transitions (`AnimatePresence` in Shell)
- Scroll-triggered section entrances (`useInView`)
- Parallax effects (`useScroll`, `useTransform`)
- Floating card animations
- Dock icon magnification (`spring` physics)
- Mobile menu expand/collapse

---

## 4. Reusable Components

### 4.1 UI Primitives ([`components/ui/`](file:///home/rox/Work/Doceeto/components/ui))

| Component | Props/Variants | Description |
|---|---|---|
| **[`Button`](file:///home/rox/Work/Doceeto/components/ui/button.tsx)** | `variant`: primary, secondary, ghost, danger, outline · `size`: sm, md, lg · `icon`, `loading` | Core CTA button with focus ring, loading spinner |
| **[`Card`](file:///home/rox/Work/Doceeto/components/ui/card.tsx)** | `className` | Simple bordered card with glass fill |
| **[`GlassCard`](file:///home/rox/Work/Doceeto/components/ui/glass-card.tsx)** | `className` | Frosted glassmorphic card |
| **[`Modal`](file:///home/rox/Work/Doceeto/components/ui/modal.tsx)** | `open`, `onClose`, `dismissible` | HTML `<dialog>`-based modal |
| **[`FlowButton`](file:///home/rox/Work/Doceeto/components/ui/flow-button.tsx)** | `muted`, `loading`, `icon` | Full-width action button for multi-step flows |
| **[`StatCard`](file:///home/rox/Work/Doceeto/components/ui/stat-card.tsx)** | `variant`: default, mini · `label`, `value`, `icon`, `accent` | Metric tile for dashboards |
| **[`StatusPill`](file:///home/rox/Work/Doceeto/components/ui/status-pill.tsx)** | `status` (tone-mapped) | Colored status badge |
| **[`Toast`](file:///home/rox/Work/Doceeto/components/ui/toast.tsx)** | Context-based: `useToast()` | Toast notification system (success/error/info) |
| **[`EmptyState`](file:///home/rox/Work/Doceeto/components/ui/empty-state.tsx)** | `icon`, `title`, `subtitle` | Centered empty content placeholder |
| **[`MacOSDock`](file:///home/rox/Work/Doceeto/components/ui/mac-os-dock.tsx)** | `items` (DockItem[]) | macOS-style magnifying navigation dock |
| **`DoctorAvatar`** | `name`, `src`, `online`, `size` | Doctor avatar with online indicator |
| **`StarRating`** | Rating display with star icons |
| **`LanguageSelector`** | i18n language picker |

### 4.2 Brand ([`components/brand/`](file:///home/rox/Work/Doceeto/components/brand))

| Component | Description |
|---|---|
| **[`Wordmark`](file:///home/rox/Work/Doceeto/components/brand/wordmark.tsx)** | SVG brand mark (D icon) + text lockup ("doc**ee**to" with gold "ee"). Props: `compact` (drops tagline). Includes `BrandMark` and `Name` sub-exports. |
| **[`LoadingSplash`](file:///home/rox/Work/Doceeto/components/brand/loading-splash.tsx)** | Full-screen loading video that plays on surface entry |

### 4.3 Site / Public Page Components ([`components/site/`](file:///home/rox/Work/Doceeto/components/site))

| Component | Description |
|---|---|
| **[`SiteHeader`](file:///home/rox/Work/Doceeto/components/site/site-header.tsx)** | Sticky header for public pages: `Wordmark` + `ThemeSwitcher` + hamburger `SiteMenu` |
| **[`SiteMenu`](file:///home/rox/Work/Doceeto/components/site/site-menu.tsx)** | Dropdown menu with links: About, Contact, Get started, Sign in, Ops sign in |

> [!WARNING]
> The current [app/page.tsx](file:///home/rox/Work/Doceeto/app/page.tsx) (32KB) defines its **own** `SiteNavbar` and `SiteFooter` **inline** — these reference components from `components/site/navbar.tsx` and `components/site/footer.tsx` that **no longer exist** in the actual codebase. The real public-page header is `components/site/site-header.tsx` and `components/site/site-menu.tsx`. The landing page has its own self-contained navigation that doesn't match the shared site components.

### 4.4 Layout ([`components/layout/`](file:///home/rox/Work/Doceeto/components/layout))

| Component | Description |
|---|---|
| **[`Shell`](file:///home/rox/Work/Doceeto/components/layout/shell.tsx)** | Sidebar + top bar + mobile tab nav wrapper for doctor/ops surfaces |
| **[`AppDock`](file:///home/rox/Work/Doceeto/components/layout/app-dock.tsx)** | Desktop macOS-style dock navigation (wraps MacOSDock with router) |
| **[`PageHeader`](file:///home/rox/Work/Doceeto/components/layout/page-header.tsx)** | Section label + serif heading + optional action slot |

### 4.5 Theme ([`components/theme/`](file:///home/rox/Work/Doceeto/components/theme))

- **`ThemeSwitcher`** — Theme toggle UI
- **`ThemeProvider`** — Applies `data-theme` from localStorage

---

## 5. Existing Patient Workflow

The patient surface lives at `/patient/*` and is guarded by `requireSurface("patient")` in the layout. Key flow:

1. **Sign up / Sign in** → Phone + OTP or Google OAuth → Patient session created
2. **Dashboard** (`/patient`) — Greeting, quick actions, active care, health tip
3. **Find a Doctor** (`/patient/doctors`) — Map-based search with doctor cards, filters by specialty/distance
4. **Book a Visit** — Two paths:
   - **Gig hiring** — Pick a packaged service from the doctor's offerings
   - **Appointment booking** — Scheduled slot or urgent/emergency
   - Visit types: Video, Home visit, Clinic
   - Payment: Online (UPI/card) or Cash on visit
5. **Live Tracking** (`/patient/now`) — Real-time map tracking of doctor's ETA, arrival notifications
6. **Care History** (`/patient/care`) — Past consultations, ratings, prescription history
7. **Medicine** (`/patient/medicine`) — Feature-flagged OFF currently
8. **Account** (`/patient/account`) — Health profile (BMI, allergies, conditions, vitals), settings
9. **AI Assistant (Zumi)** — Floating chat for symptom triage, medication reminders

---

## 6. Existing Doctor Workflow

The doctor surface lives at `/doctor/*` and is guarded by `requireSurface("doctor")`. Key flow:

1. **Sign up** — Google OAuth → Profile completion (specialty, bio, clinic address)
2. **Dashboard** (`/doctor`) — Metrics overview, incoming requests, today's queue
3. **Patient Queue** — Accept/decline requests, triage urgency
4. **Consults** (`/doctor/consults`) — Active consultation management, notes, prescriptions
5. **Gig Marketplace** (`/doctor/gigs`) — Create/manage packaged service offerings
6. **Schedule** (`/doctor/schedule`) — Weekly availability calendar with time slot management
7. **Earnings** (`/doctor/earnings`) — Revenue tracking, commission breakdown (15%)
8. **Profile** (`/doctor/profile`) — Professional profile editor

Navigation uses the `Shell` component with sidebar (desktop) and horizontal tab strip (mobile), plus the macOS-style floating dock.

---

## 7. Recommended Location for the New Landing Page

### Primary recommendation: Replace [`app/page.tsx`](file:///home/rox/Work/Doceeto/app/page.tsx)

The current `app/page.tsx` **is** the landing page — a 32KB `"use client"` component with hero, trust bar, how-it-works, features, testimonials, pricing, and CTA sections. The new landing page should **replace this file** at the root route `/`.

### Why this location:
- `/` is the natural entry point and is already a public (unguarded) route
- The middleware's `surfaceFromPath()` returns `null` for `/`, so no auth check runs
- The root layout already provides fonts, providers, and the theme system
- The `about` and `contact` pages already exist as siblings

### File to create/replace:
- `app/page.tsx` — New landing page (back up the existing one if needed)

---

## 8. What Should Be Reused for the Landing Page

### Must reuse (consistency & DRY):

| Asset | Location | Reason |
|---|---|---|
| **Wordmark / BrandMark** | [`components/brand/wordmark.tsx`](file:///home/rox/Work/Doceeto/components/brand/wordmark.tsx) | Brand identity — the D-mark icon + "doc**ee**to" with gold "ee" |
| **SiteHeader** | [`components/site/site-header.tsx`](file:///home/rox/Work/Doceeto/components/site/site-header.tsx) | Consistent public-page navigation with theme switcher |
| **SiteMenu** | [`components/site/site-menu.tsx`](file:///home/rox/Work/Doceeto/components/site/site-menu.tsx) | Shared hamburger navigation for public pages |
| **Button** | [`components/ui/button.tsx`](file:///home/rox/Work/Doceeto/components/ui/button.tsx) | Consistent CTA buttons (primary, ghost, outline variants) |
| **GlassCard** | [`components/ui/glass-card.tsx`](file:///home/rox/Work/Doceeto/components/ui/glass-card.tsx) | Core visual pattern — frosted cards |
| **Design tokens** | [`app/globals.css`](file:///home/rox/Work/Doceeto/app/globals.css) | All CSS variables, glassmorphism classes, patterns |
| **Tailwind config** | [`tailwind.config.ts`](file:///home/rox/Work/Doceeto/tailwind.config.ts) | Colors, fonts, shadows, animations |
| **Framer Motion** | Already in dependencies | For scroll animations, parallax, floating elements |
| **Lucide icons** | Already in dependencies | Consistent iconography |
| **Brand assets** | [`public/brand/`](file:///home/rox/Work/Doceeto/public/brand) | SVG logos (icon, wordmark, wordmark-light), OG image |

### Can reuse (nice-to-have):

| Asset | Reason |
|---|---|
| `.glass-card`, `.fh-card` CSS classes | Hero feature cards, pricing cards |
| `.label` class | Section labels ("HOW IT WORKS", "FOR DOCTORS") |
| `.metric` class | Big stat numbers in trust bar |
| `.pattern-dots` / `.pattern-grid` | Decorative backgrounds |
| `body::before` gradient orbs | Ambient background warmth (already global) |
| `ThemeSwitcher` | Let visitors try themes on the landing page |
| `StatusPill` | If showing live status indicators |

---

## 9. Potential Issues & Constraints

> [!CAUTION]
> ### Critical: Current landing page is a monolith
> The existing [`app/page.tsx`](file:///home/rox/Work/Doceeto/app/page.tsx) is a **32KB single-file client component** with everything inlined — data, markup, styles, animations. It imports `SiteNavbar` and `SiteFooter` from `components/site/navbar.tsx` and `components/site/footer.tsx`, which **no longer exist** in the codebase. The real site components are `site-header.tsx` and `site-menu.tsx`. This means the current landing page likely has **build errors** or is using stale cached builds.

> [!WARNING]
> ### Theme complexity
> The app has **7 themes** that remap every color via CSS variables. The default is now a **light theme** ("doceeto" — cream/beige canvas). Any landing page design must look good in at least the default light theme and the dark themes (Sumi, Mori, Midnight). Hardcoded colors will break theme switching.

> [!IMPORTANT]
> ### Design system has two "eras"
> The codebase shows evidence of evolution:
> - **"Espresso era"** — Dark theme tokens (`espresso`, `cream`, `terracotta`) used throughout Tailwind config and early components
> - **"Fresh Health era"** — Light-first design with `var(--text)`, `var(--border)`, `var(--accent)` semantic tokens, `.fh-card`, `.glass-card` CSS classes
>
> **Newer components** use semantic CSS variables (`var(--text-muted)`, `var(--border)`). **Older components** use Tailwind color classes (`text-cream/60`, `bg-espresso-700`). Both work because the Tailwind classes resolve through the same CSS variables, but new code should prefer the semantic approach.

### Other constraints:

1. **No footer exists as a shared component** — The `SiteFooter` referenced by the old landing page is gone. A new footer component will need to be created in `components/site/`.

2. **Middleware catches all routes** — The matcher excludes static assets but catches everything else. Public routes work because `surfaceFromPath()` returns `null` for non-surface paths.

3. **`"use client"` required for animations** — Framer Motion hooks (`useScroll`, `useInView`, `useTransform`) require client components. The current landing page is already a client component.

4. **No image assets exist** — The `public/` directory has only brand SVGs and a loading video. Any hero images, illustrations, or screenshots will need to be generated or sourced.

5. **The `about` and `contact` pages use `SiteHeader`** — The landing page should use the same header for consistency, or a custom variant that shares the same visual language.

6. **No external analytics/tracking** — No GA, Mixpanel, or similar is configured. If landing page conversion tracking is needed, it would need to be added.

7. **Vercel deployment** — The app deploys to Mumbai (`bom1`). The landing page should be mindful of bundle size since it's the entry point — consider keeping it as a server component where possible, or using dynamic imports for heavy sections.
