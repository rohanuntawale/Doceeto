# Implementation Plan — Doceeto Landing Page (Updated)

Transform the Doceeto homepage into a tight, editorial, and immersive brand landing experience that communicates Doceeto's core two-sided platform value proposition: **Patient Need ↔ Doceeto ↔ Doctor Expertise**.

This updated plan incorporates all user refinements from the review step.

---

## User Review Required & Critical Constraints

> [!IMPORTANT]
> **Single Entry Point Route: `/login?tab=signup`**
> In the Doceeto codebase, `app/signup/page.tsx` is a redirect stub to `/login?tab=signup`, and `app/login/login-form.tsx` handles both signup and login with role tabs (Patient & Doctor).
> 
> Both **"I need care"** (Patient CTA) and **"I'm a doctor"** (Doctor CTA) throughout the landing page will navigate directly to `/login?tab=signup`. No authentication code, signup pages, or onboarding forms will be created or modified.

> [!CAUTION]
> **Zero Invented Product Claims or Unverified Metrics**
> All copy, feature descriptions, metrics, prices, and status indicators will strictly use verified data from the codebase (`lib/catalog.ts`, `lib/labels.ts`, `lib/config.ts`) or neutral visual placeholders.
> 
> - **Verified care prices**: General Checkup (`₹499`), Specialist Visit (`₹999`), Pediatric Care (`₹699`), Urgent Care (`₹799`), Follow-up (`₹299`).
> - **No unverified claims**: No "under 60 seconds", "AI Triage & Matching", "built-in EHR", "4.9★ rating", "12 min ETA", or "₹4,200 daily earnings".

---

## 1. Reference Site Analysis vs. Doceeto Brand Identity

### Analysis of Reference (`https://zumi-ashen.vercel.app/`)
- **Typography Scale**: Fluid display headlines (`clamp()`), tight letter-spacing (`tracking-tighter`), serif/italic emphasis words within display titles, and uppercase tracked section labels (`tracking-[0.42em]`).
- **Composition & Pacing**: Asymmetrical editorial header layouts (large title on left, narrative on right), generous vertical rhythm (100px–140px section gaps), infinite marquee ticker bands for structural breaks, and ambient glow washes.
- **Transitions & Motion**: Smooth scroll-triggered line/word entrance reveals (`opacity`, `translateY`, `blur`), top scroll progress bar, and crisp hover micro-interactions.
- **Visual Presentation**: Glassmorphic browser/device frames with live status dots, real product UI displays, and interactive spatial storytelling.

### Brand Hierarchy Rule
$$\text{DOCEETO BRAND IDENTITY (Cream/Terracotta/Playfair/Inter)} \gg \text{REFERENCE EXPERIENTIAL PATTERNS}$$

We adopt the reference's **motion, composition scale, section pacing, and scroll storytelling**, while grounding 100% of the **colors, typography (Playfair Display + Inter), logos, UI components, and brand tone in Doceeto**.

---

## 2. Final Consolidated Section Order & Narrative Arc

The landing page structure is consolidated into a tight, immersive 7-part editorial flow:

```
NAV
 → HERO
 → EDITORIAL STORY
 → PATIENT ↔ DOCTOR
 → THE CONNECTION / HOW DOCEETO WORKS
 → PRODUCT SHOWCASE
 → FINAL CTA
 → FOOTER
```

| # | Section | Purpose | Visual & Interactive Concept |
|---|---|---|---|
| **01** | **Site Navigation** | Brand mark & primary actions | • Uses [`SiteHeader`](file:///home/rox/Work/Doceeto/components/site/site-header.tsx) & [`SiteMenu`](file:///home/rox/Work/Doceeto/components/site/site-menu.tsx) with `Wordmark`, theme switcher, and entry CTA to `/login?tab=signup`. |
| **02** | **Hero Section** | Brand thesis & immediate entry | • Headline: *"Care that reaches you."* in `Playfair Display` with terracotta italic accent.<br>• Subtitle: *"Connect your healthcare needs with the medical expertise that can help."*<br>• Dual CTAs: **[ I need care ]** and **[ I'm a doctor ]** (both linking to `/login?tab=signup`).<br>• Background ambient glow wash (`radial-gradient` tokens from `globals.css`). |
| **03** | **Editorial Story** | Narrative positioning statement | • Large-scale scroll-revealed editorial typography:<br>  *"Healthcare starts with a need. Expertise starts with a doctor. Doceeto brings the two together."*<br>• Infinite counter-scrolling marquee ticker band featuring verified catalog care types (*General Checkup, Specialist Visit, Pediatric Care, Urgent Care, Follow-up*). |
| **04** | **Patient ↔ Doctor** | Dual audience positioning | • Asymmetrical split editorial presentation incorporating audience narratives:<br>  - **Patient Side**: *"Start with what you need"* — Express symptoms/queries directly without clinic navigation hassle. Includes CTA **[ I need care ]**.<br>  - **Doctor Side**: *"Put your expertise where it's needed"* — Create packaged gig offerings and practice on your own terms. Includes CTA **[ I'm a doctor ]**.<br>• Both CTAs navigate to `/login?tab=signup`. |
| **05** | **The Connection / How It Works** | The visual climax of the landing page | • Sophisticated, lightweight **Canvas 2D + SVG CareConnectionField** visually representing:<br>  $$\text{PATIENT NEED} \longrightarrow \text{DOCEETO} \longrightarrow \text{DOCTOR EXPERTISE}$$<br>• Interactive node constellation with glowing connection strands, smooth particle flow, and scroll-linked animation. Zero heavy 3D frameworks. |
| **06** | **Product Showcase** | Real product proof & trust | • Interactive browser frame presenting **real verified Doceeto UI components**:<br>  - **Patient UI tab**: Shows [`CareCard`](file:///home/rox/Work/Doceeto/components/patient/care-card.tsx), [`DoctorCard`](file:///home/rox/Work/Doceeto/components/patient/doctor-card.tsx), and [`SosButton`](file:///home/rox/Work/Doceeto/components/patient/sos-button.tsx).<br>  - **Doctor UI tab**: Shows [`GigCard`](file:///home/rox/Work/Doceeto/components/doctor/gig-card.tsx), [`QueueCard`](file:///home/rox/Work/Doceeto/components/doctor/queue-card.tsx), and [`StatCard`](file:///home/rox/Work/Doceeto/components/ui/stat-card.tsx).<br>• Live platform status badge (`● Platform Live`). |
| **07** | **Final Editorial CTA** | Conclusion & conversion | • Editorial statement: *"Your care journey starts here."*<br>• Dual CTAs: **[ I need care ]** and **[ I'm a doctor ]** (both linking to `/login?tab=signup`). |
| **08** | **Site Footer** | Marketing & legal navigation | • Clean 4-column footer with `Wordmark`, product links (How it works, For Doctors, About, Contact), legal links, and copyright. |

---

## 3. Reusable Components & Design Tokens

### Existing Components to Reuse (`components/`)
- [`components/brand/wordmark.tsx`](file:///home/rox/Work/Doceeto/components/brand/wordmark.tsx): `Wordmark`, `BrandMark`, `Name`
- [`components/site/site-header.tsx`](file:///home/rox/Work/Doceeto/components/site/site-header.tsx): Sticky marketing top bar
- [`components/site/site-menu.tsx`](file:///home/rox/Work/Doceeto/components/site/site-menu.tsx): Mobile hamburger navigation
- [`components/ui/button.tsx`](file:///home/rox/Work/Doceeto/components/ui/button.tsx): Primary, outline, ghost buttons
- [`components/ui/glass-card.tsx`](file:///home/rox/Work/Doceeto/components/ui/glass-card.tsx): Frosted card container
- [`components/ui/stat-card.tsx`](file:///home/rox/Work/Doceeto/components/ui/stat-card.tsx): Dashboard metric tile
- [`components/ui/status-pill.tsx`](file:///home/rox/Work/Doceeto/components/ui/status-pill.tsx): Status badge
- [`components/patient/care-card.tsx`](file:///home/rox/Work/Doceeto/components/patient/care-card.tsx): Real care card component
- [`components/patient/doctor-card.tsx`](file:///home/rox/Work/Doceeto/components/patient/doctor-card.tsx): Real doctor card component
- [`components/patient/sos-button.tsx`](file:///home/rox/Work/Doceeto/components/patient/sos-button.tsx): Real SOS button component
- [`components/doctor/gig-card.tsx`](file:///home/rox/Work/Doceeto/components/doctor/gig-card.tsx): Real doctor gig card component
- [`components/doctor/queue-card.tsx`](file:///home/rox/Work/Doceeto/components/doctor/queue-card.tsx): Real patient queue item

### Design Tokens & CSS Classes (`globals.css`)
- **Colors**: `var(--bg)`, `var(--surface)`, `var(--text)`, `var(--text-muted)`, `var(--text-faint)`, `var(--accent)`, `var(--border)`
- **Glassmorphism**: `.glass-card`, `.fh-card`, `.fh-tile`, `.pattern-dots`, `.pattern-grid`
- **Typography classes**: `.label` (uppercase tracked subheadings), `.metric` (serif stat numbers)
- **Keyframe animations**: `fade-up`, `rise`, `float`, `sheen`, `pulse-ring`, `shimmer`

---

## 4. Connection Visual Strategy (Canvas 2D + SVG)

- **Architecture**: A bespoke `<canvas>` + SVG component (`CareConnectionField`).
- **Zero Heavy 3D Dependencies**: Uses native HTML5 2D Canvas context and SVG paths. No Three.js or React Three Fiber.
- **Narrative Visual Flow**:
  1. **Left Cluster (Patient Needs)**: Pulse nodes representing patient care requests (*General Checkup, Specialist Visit, Urgent Care*).
  2. **Center Core (Doceeto Engine)**: Central glowing radial node representing the Doceeto platform.
  3. **Right Cluster (Doctor Expertise)**: Network nodes representing doctor gig offerings and medical expertise.
- **Interaction**: Particles travel smoothly along bezier curves connecting Left → Center → Right. Scrolling links particle density and glow intensity. Cursor movement subtly shifts node positions with fluid spring physics.
- **Performance**: Runs at 60fps, automatically scales for device DPR, and pauses execution via `IntersectionObserver` when scrolled off-screen.

---

## 5. Proposed Files to Create & Modify

```
Proposed Changes

components/
  site/
    [NEW] site-footer.tsx               ← Shared marketing footer component
  landing/
    [NEW] landing-hero.tsx              ← Hero section with dual CTAs & editorial typography
    [NEW] landing-ticker.tsx            ← Infinite marquee ticker using verified catalog care types
    [NEW] landing-story.tsx             ← Editorial narrative positioning section
    [NEW] landing-two-sides.tsx         ← Patient ↔ Doctor split audience section
    [NEW] landing-connection.tsx        ← Canvas 2D + SVG CareConnectionField visual section
    [NEW] landing-product-showcase.tsx  ← Interactive browser frame showcasing real product UI
    [NEW] landing-final-cta.tsx         ← Conclusion editorial CTA section

app/
  [MODIFY] page.tsx                     ← Main homepage route (replacing 32KB monolith with tight landing layout)
```

---

## 6. Verification Plan

### Automated Tests & Checks
- Run TypeScript typecheck: `npm run typecheck`
- Run Next.js linter: `npm run lint`
- Run build validation: `npm run build`

### Manual Verification
- Verify both **"I need care"** and **"I'm a doctor"** CTAs across all sections navigate directly to `/login?tab=signup`.
- Test theme switching across all 7 themes (`doceeto`, `fresh`, `mori`, `sumi`, `matcha`, `sakura`, `ai`) to confirm no text or background contrast issues.
- Verify smooth responsive scaling on mobile (375px), tablet (768px), and desktop (1280px+).
- Verify smooth 60fps canvas animation performance and reduced motion fallbacks.
