# Doceeto — Landing Page Brief

## 01 — Read This First

Before doing anything, read:

1. `doceeto_audit_report.md`
2. This file: `LANDING_PAGE_BRIEF.md`

`doceeto_audit_report.md` is the source of truth for the current Doceeto codebase, architecture, design system, routes, components, assets, existing functionality, and technical constraints.

DO NOT repeat the repository audit unless something in the audit is unclear or has changed.

Do not modify any existing application code until an implementation plan has been proposed and approved.

---

# 02 — What We Are Building

Build a new marketing landing page for Doceeto.

Doceeto is an existing two-sided healthcare platform connecting:

PATIENT NEEDS ↔ DOCTOR EXPERTISE

Patients can express their healthcare needs, requirements, and queries.

Doctors can participate by creating gigs describing the expertise/services they can provide.

The patient-side and doctor-side application functionality already exists.

The landing page is therefore primarily:

- brand introduction
- product storytelling
- value proposition
- visual experience
- conversion/entry point

It is NOT a new application.

It is NOT a redesign of the existing application.

---

# 03 — CRITICAL: Authentication / Signup

There must be ONLY ONE signup/entry experience.

The existing Doceeto signup page already contains:

- patient/doctor selection
- signup form
- existing authentication flow

KEEP THIS PAGE.

DO NOT create:

- `/patient-signup`
- `/doctor-signup`
- separate signup forms
- duplicate authentication UI
- duplicate patient onboarding
- duplicate doctor onboarding

The new landing page should simply direct users to the EXISTING signup/entry page.

For example:

"I need care"
→ existing signup/entry page

"I'm a doctor"
→ existing signup/entry page

Do not redesign or duplicate the existing signup page.

The existing signup page remains the single entry point into the application.

---

# 04 — Design Sources

There are two different sources of inspiration.

They have different jobs.

## Source A — Existing Doceeto

The existing Doceeto application determines:

- brand identity
- colors
- typography
- UI language
- buttons
- spacing
- borders
- visual tone
- logo
- illustrations
- component styling
- overall aesthetic

The existing Doceeto design must remain the foundation.

---

## Source B — Reference Website

Reference:

https://zumi-ashen.vercel.app/

This is a portfolio website created by my senior.

I particularly like its:

- typography
- large editorial headlines
- composition
- visual storytelling
- section transitions
- scrolling experience
- large-scale visual elements
- interactive elements
- 3D visuals
- WebGL-style experiences
- movement and pacing
- use of whitespace
- immersive presentation of content

Use this website as an EXPERIENCE reference.

Do NOT copy it.

Do not reproduce its:

- branding
- logo
- exact layouts
- text
- assets
- colors
- proprietary visual identity
- exact implementation

The final result must unmistakably be Doceeto.

---

# 05 — Design Hierarchy

When deciding between the existing Doceeto design and the reference website:

EXISTING DOCEETO BRAND >
REFERENCE WEBSITE

The reference website tells us:

HOW THE PAGE CAN FEEL

Doceeto tells us:

WHAT THE PAGE SHOULD LOOK LIKE

In other words:

Doceeto provides the identity.

The reference provides inspiration for:

- motion
- composition
- pacing
- interaction
- visual storytelling
- 3D
- scroll behavior

The result should feel like:

"Doceeto evolved into a more immersive and expressive landing experience."

It should NOT feel like:

"Doceeto copied a portfolio website."

---

# 06 — Existing Doceeto Visual Language

Use the existing application as the primary visual reference.

The current Doceeto entry experience establishes a visual direction around:

- editorial serif typography
- restrained sans-serif typography
- warm off-white / cream backgrounds
- deep charcoal / near-black
- sage / olive green
- warm terracotta / orange
- subtle borders
- generous whitespace
- thin circular/radial visual elements
- minimal iconography
- restrained shadows
- calm and premium presentation

Preserve this language.

Do not introduce a generic healthcare aesthetic.

Avoid automatically turning the page into:

- blue medical gradients
- hospital imagery
- generic doctor stock photography
- generic SaaS cards
- excessive rounded rectangles
- neon
- cyberpunk visuals
- random blobs
- excessive glassmorphism

---

# 07 — Core Brand Message

The existing Doceeto message is:

"Care that reaches you."

This should remain central to the landing page.

The deeper concept is:

A patient has a need.

A doctor has expertise.

Doceeto creates the connection.

The landing page should communicate this relationship visually.

PATIENT
NEED
↓
DOCEETO
↓
DOCTOR
EXPERTISE

Do not make this feel like a literal flowchart.

It should become part of the visual storytelling.

---

# 08 — Landing Page Experience

The page should NOT feel like a standard SaaS template.

Avoid the predictable:

Hero
↓
3 feature cards
↓
3 more feature cards
↓
Testimonials
↓
Pricing
↓
FAQ
↓
CTA

Instead, build an editorial / immersive narrative.

The visitor should progressively understand:

1. What is Doceeto?
2. Who is it for?
3. What problem does it address?
4. How do patients and doctors connect?
5. What does the actual product look like?
6. Why should a patient join?
7. Why should a doctor join?
8. What should I do next?

---

# 09 — Proposed Page Structure

This is a design direction, NOT a rigid list of mandatory sections.

Use the reference website and the existing application to refine the final structure.

---

## SECTION 01 — HERO

Primary message:

# Care that reaches you.

Supporting copy should clearly explain Doceeto in one concise statement.

Example direction:

"Connect your healthcare needs with the expertise that can help."

The hero must immediately communicate the two audiences.

Primary CTAs:

[ I need care ]

[ I'm a doctor ]

Both go to the EXISTING signup/entry page.

Do not create signup UI inside the hero.

---

## Hero Visual

The hero should be visually distinctive.

Consider creating an abstract representation of:

PATIENT NEED
↕
DOCEETO
↕
DOCTOR EXPERTISE

This is a strong opportunity for an interactive visual.

Possible techniques:

- subtle 3D
- WebGL
- React Three Fiber
- particles
- flowing lines
- radial systems
- animated typography
- depth
- scroll interaction

But only use these if they fit the existing technology and performance constraints described in `doceeto_audit_report.md`.

Do not add 3D simply because the reference has 3D.

The visual must communicate the concept of connection.

---

# 10 — EDITORIAL STORY SECTION

Move away from traditional marketing copy.

Use large typography and whitespace to tell the story.

Possible narrative:

"Healthcare starts with a need."

↓

"Expertise starts with a doctor."

↓

"Doceeto brings the two together."

These are example directions, not necessarily final copy.

The section should feel closer to an editorial statement than a feature section.

Use scroll-based reveals or transitions if appropriate.

---

# 11 — TWO SIDES OF DOCEETO

Introduce the two audiences.

## Patient

### Start with what you need.

Patients can express their healthcare needs, concerns, or queries.

They don't need to navigate a complicated healthcare marketplace before explaining what they actually need.

CTA:

"I need care"

→ existing signup page

---

## Doctor

### Put your expertise where it's needed.

Doctors can create gigs describing the expertise and services they can provide.

CTA:

"I'm a doctor"

→ existing signup page

---

Do not necessarily present these as two generic cards.

Explore an editorial split-screen, scroll interaction, large typography, or interactive transition inspired by the reference website.

---

# 12 — THE CONNECTION

This should be one of the major visual moments of the landing page.

Visually communicate:

PATIENT NEED
↓
DOCEETO
↓
DOCTOR EXPERTISE

Possible visual language:

- flowing paths
- radial fields
- particles
- typography
- 3D objects
- spatial transitions
- subtle WebGL
- scroll-driven animation

The visual should evolve as the user scrolls.

The purpose is to make the relationship between the two sides memorable.

Avoid random decorative 3D.

Every major visual element should communicate something about Doceeto.

---

# 13 — PRODUCT SHOWCASE

Show the REAL Doceeto product.

Use the existing application.

Possible approaches:

- large product UI presentation
- browser-frame presentation
- patient UI transitioning into doctor UI
- scroll-driven product reveal
- layered application screens
- interactive product preview

Do not invent features.

Do not create fake application screenshots.

Use actual existing UI/components/assets wherever practical.

The purpose is to establish:

"This is a real working platform."

---

# 14 — DOCTOR STORY

Give doctors their own moment.

Core concept:

"Your expertise has somewhere to go."

Explain the gig model visually.

Show the real doctor workflow/application.

Use actual UI from the existing product.

CTA:

"I'm a doctor"

→ existing signup page

This section should feel like part of the overall story, not another feature card.

---

# 15 — PATIENT STORY

Give patients their own moment.

Core concept:

"Start with what you need."

Show how a patient begins with their need/query and moves toward relevant care.

Use the existing patient-side experience.

CTA:

"I need care"

→ existing signup page

Again, prioritize storytelling and visual interaction over generic feature cards.

---

# 16 — FINAL CTA

End with a strong editorial conclusion.

Possible direction:

# Your care journey starts here.

Then:

[ I need care ]

[ I'm a doctor ]

Both route to the existing signup/entry page.

The final CTA should feel like the conclusion of the visual story.

---

# 17 — 3D / WebGL Direction

3D is encouraged, but it must be intentional.

The reference website demonstrates a strong use of 3D visual experiences.

For Doceeto, investigate whether 3D can represent:

- connection
- care
- patient/doctor relationship
- medical expertise
- a network
- a pathway
- a central Doceeto system

Possible implementation:

- Three.js
- React Three Fiber
- existing project animation stack
- CSS 3D where sufficient

However, first check `doceeto_audit_report.md` for existing dependencies.

Prefer existing libraries where possible.

Do not introduce a heavy new stack without a strong reason.

---

# 18 — Motion

Motion is an important part of the design.

Use motion for:

- hero entrance
- typography reveals
- section transitions
- scroll storytelling
- patient ↔ doctor transitions
- product UI transitions
- 3D interaction
- hover states

Motion should feel:

- smooth
- intentional
- restrained
- premium

Avoid:

- constant movement
- excessive parallax
- distracting effects
- animations that delay content
- animation for decoration alone

Respect `prefers-reduced-motion`.

---

# 19 — Navigation

The landing page should have a minimal marketing navigation.

Potential structure:

DOCEETO

How it works
For Patients
For Doctors

Get started

Keep it visually consistent with the existing brand.

Do not duplicate internal application navigation.

The landing navigation is only for the marketing experience.

---

# 20 — Responsive Design

Design intentionally for:

- mobile
- tablet
- laptop
- desktop
- large desktop

Do not simply shrink the desktop layout.

The composition should be designed around the viewport.

For 3D/WebGL:

- optimize for mobile
- reduce complexity where necessary
- provide fallbacks
- avoid excessive GPU usage
- avoid blocking the initial render

A beautiful desktop experience that performs badly on mobile is not acceptable.

---

# 21 — Performance

The page may contain immersive visual elements, but performance is important.

Requirements:

- lazy-load heavy 3D
- avoid blocking initial render
- optimize images
- minimize unnecessary dependencies
- avoid excessive GPU usage
- provide mobile fallbacks
- respect reduced motion
- maintain fast navigation
- preserve existing application performance

Premium does NOT mean heavy.

---

# 22 — Components

Use the existing architecture from `doceeto_audit_report.md`.

Before creating a component, check whether an existing component can be reused.

Reuse wherever possible:

- logo
- buttons
- typography
- theme tokens
- layout primitives
- icons
- animation utilities
- navigation
- existing UI components
- product components

Landing-specific components may be created where appropriate.

Potential organization:

components/
landing/
Hero
Story
Audience
Connection
ProductShowcase
Doctor
Patient
FinalCTA

But follow the existing project's architecture if `doceeto_audit_report.md` indicates a better approach.

---

# 23 — Routing

The landing page should become the marketing entry point.

The existing signup page remains unchanged.

Expected relationship:

LANDING PAGE
│
├── "I need care"
│ ↓
│ EXISTING SIGNUP
│
└── "I'm a doctor"
↓
EXISTING SIGNUP

Do not create new authentication routes unless the existing architecture explicitly requires it.

---

# 24 — Content Tone

Copy should be:

- human
- calm
- trustworthy
- confident
- modern
- concise
- premium
- emotionally clear

Avoid:

"Revolutionizing healthcare."

"The future of healthcare is here."

"AI-powered healthcare ecosystem."

"Transforming the healthcare industry."

Avoid generic startup jargon.

Do not make unsupported medical or healthcare claims.

Do not make the website sound like an AI company.

The product is about PEOPLE:

patients + doctors.

Technology should support that story.

---

# 25 — What NOT To Do

Do NOT:

- redesign the existing signup page
- create separate patient/doctor signup pages
- duplicate authentication
- redesign the entire application
- change the existing global design system unnecessarily
- replace the Doceeto visual identity with the reference site's identity
- copy the reference site
- create generic SaaS feature cards everywhere
- use random 3D objects
- add 3D just for visual novelty
- introduce unnecessary dependencies
- add excessive gradients
- add excessive glassmorphism
- use generic medical stock imagery
- use excessive rounded cards
- add meaningless animations
- invent product functionality

---

# 26 — Implementation Process

Do not immediately start coding.

Since `doceeto_audit_report.md` already contains the repository audit:

### Step 1

Read:

`doceeto_audit_report.md`

and:

`LANDING_PAGE_BRIEF.md`

### Step 2

Cross-reference the audit with the desired experience.

Identify:

- existing components to reuse
- existing design tokens
- existing animation system
- existing product UI
- existing routing
- available assets
- existing 3D/animation dependencies

### Step 3

Analyze the reference website:

https://zumi-ashen.vercel.app/

Focus specifically on:

- typography
- pacing
- section transitions
- visual storytelling
- 3D
- scrolling
- interaction
- composition

Do not copy it.

### Step 4

Produce an implementation plan.

The plan should specify:

- final section order
- purpose of each section
- visual treatment
- animation/interaction
- reusable components
- new components
- routing
- 3D/WebGL approach
- mobile behavior
- performance considerations

### Step 5

STOP.

Do not modify files until the implementation plan is approved.

---

# 27 — Final Creative Direction

The landing page should feel:

Editorial.
Immersive.
Human.
Premium.
Calm.
Technically sophisticated.

The visual identity should remain unmistakably Doceeto.

The reference site's influence should be felt through:

- typography scale
- visual pacing
- interaction
- motion
- spatial composition
- 3D
- scroll storytelling

But the brand should remain:

DOCEETO.

The final impression should be:

"Doceeto is a serious healthcare platform with a beautifully crafted digital experience."

Not:

"This is a portfolio website."

Not:

"This is a generic healthcare SaaS template."

Not:

"This is an AI-generated landing page."
