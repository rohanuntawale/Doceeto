# Doceeto Landing Page — Latest Revision

## Objective

Rework ONLY the public-facing Doceeto landing/site experience.

The current landing page feels too basic and does not create enough visual impact.

The new landing page should feel:

- funky
- colorful
- typographically bold
- visually expressive
- modern
- slightly unconventional
- brutalist-inspired
- selectively glassmorphic
- visually interactive
- premium despite being playful

The goal is NOT to make the entire Doceeto application look like this.

The landing page should intentionally feel more expressive than the dashboard/application.

Think:

"Doceeto's bold public-facing identity"

rather than:

"the dashboard stretched into a landing page."

---

# READ THESE FILES FIRST

Before making any changes, thoroughly inspect:

1. `doceeto_audit_report.md`
2. `LANDING_PAGE_BRIEF.md`

These files describe the existing project, design system, architecture, components, typography, colors, responsive behavior and the original landing-page requirements.

Do not skip them.

Also inspect the actual source code before implementing anything.

---

# IMPORTANT — DESIGN PHILOSOPHY

The existing Doceeto website is the foundation.

However, the landing page is allowed to BREAK SOME OF THE EXISTING VISUAL RULES when doing so creates a better landing-page experience.

This is intentional.

Do NOT interpret "match the existing website" as:

"make the landing page look exactly like the dashboard."

Instead:

EXISTING DOCEETO BRAND +
LANDING-PAGE EXPRESSION +
ZUMI-INSPIRED VISUAL STORYTELLING

The final result should still clearly look like Doceeto.

---

# ZUMI REFERENCE

Reference:

https://zumi-ashen.vercel.app/

This is a portfolio website created by a senior.

Use it as visual and experiential inspiration.

What we like about it:

- strong typography
- very large text
- interesting composition
- 3D visual elements
- visual storytelling
- playful layouts
- depth
- motion
- unconventional section layouts
- strong scrolling experience
- visual presentation of work/content
- interaction between typography and visual elements

Do NOT copy the website.

Do not copy:

- exact layouts
- branding
- logo
- colors
- text
- proprietary assets
- exact components
- implementation

Take inspiration from the level of creativity and visual ambition.

---

# DOCEETO THEME

Even though the landing page can be more experimental, it must still feel like Doceeto.

Use the existing Doceeto:

- brand colors
- typography
- logo
- visual language
- semantic CSS variables
- existing components
- existing animation utilities
- existing spacing conventions where appropriate

The landing page may intentionally exaggerate these elements.

For example:

Existing Doceeto typography
→ use much larger display typography on the landing page.

Existing accent color
→ use it more aggressively.

Existing glass components
→ use them as visual layers and product showcases.

Existing borders
→ use them more boldly in brutalist-inspired layouts.

Existing cards
→ transform their presentation rather than replacing the entire design system.

---

# BRUTALISM

Introduce brutalist-inspired elements selectively.

Good examples:

- oversized typography
- strong 1px/2px borders
- asymmetric layouts
- hard-edged containers
- unexpected spacing
- large numbers
- oversized section labels
- offset elements
- intentionally imperfect compositions
- high contrast
- editorial-style layouts

Do NOT turn the website into pure brutalism.

The result should be:

Doceeto + brutalist influence

not:

generic brutalist portfolio template.

---

# GLASSMORPHISM

Use glassmorphism selectively.

Good places:

- floating UI previews
- doctor/patient interface previews
- hero visual elements
- product showcases
- floating cards
- interactive overlays
- service demonstrations

Avoid:

- making every section a glass card
- excessive blur
- excessive transparency
- random glowing blobs
- generic AI landing-page glassmorphism

Glass should support the visual storytelling.

---

# COLOR

Make the landing page more colorful than the existing basic implementation.

However, use Doceeto's existing palette as the foundation.

Do not introduce a completely unrelated color system.

Color can be used more aggressively on the landing page through:

- accent blocks
- highlighted words
- colored borders
- large background sections
- visual cards
- product mockups
- typography
- interactive elements

The landing page should feel visually alive.

---

# TYPOGRAPHY

Typography should be one of the major visual features.

Use the existing Doceeto typography system.

However, significantly increase the scale where appropriate.

The hero should be capable of using:

- very large headlines
- oversized words
- different text weights
- italic/serif contrast
- highlighted words
- intentional line breaks
- text overlapping or interacting with visuals

Avoid small generic SaaS-style hero copy.

The landing page should communicate visually before the user reads every sentence.

---

# REMOVE THE AI-GENERATED FEEL

The current page feels too generic.

Avoid common AI-generated landing-page patterns such as:

- identical rounded cards
- endless centered sections
- generic "Everything you need..." copy
- excessive gradients
- random floating blobs
- meaningless statistics
- excessive pill-shaped UI
- every section having a heading + paragraph + 3 cards
- excessive smooth scrolling animations
- generic SaaS layouts

Every section should have a reason to exist.

---

# REMOVE UNNECESSARY AI DASHES

Review all public-facing landing-page copy.

Remove unnecessary AI-style em dashes and awkward punctuation.

Prefer natural human-written copy.

For example, avoid:

"Healthcare — whenever you need it — wherever you are."

Prefer natural alternatives such as:

"Healthcare whenever you need it."

Do this throughout the landing experience.

---

# LANDING PAGE STRUCTURE

Do not blindly follow the original section structure.

Create a strong visual narrative.

A possible structure:

1. Hero
2. Strong value proposition
3. What Doceeto actually does
4. Patient experience
5. Doctor experience
6. Services / care ecosystem
7. Product/interface showcase
8. How it works
9. Trust / credibility
10. Strong final CTA
11. Existing public footer

Only include sections that contribute to the story.

The page should feel like one continuous experience rather than a collection of cards.

---

# HERO

The hero should be the strongest part of the page.

Do NOT make it a conventional:

"Heading
Paragraph
Two buttons
Image"

layout.

Experiment with:

- oversized typography
- asymmetry
- 3D visual elements
- floating UI
- glass layers
- large colored shapes
- product interface fragments
- typography interacting with visuals
- subtle movement
- unexpected positioning

The hero should immediately communicate:

What is Doceeto?

Why should I care?

What can I do here?

The primary CTAs must remain clear.

---

# 3D / VISUAL ELEMENTS

The Zumi site demonstrates a strong use of visual/3D elements.

We want that level of visual interest.

Where appropriate, create or use:

- 3D-inspired objects
- medical/healthcare visual objects
- floating interface elements
- layered product previews
- depth-based compositions
- interactive visual storytelling

Do not add 3D merely because it looks cool.

Every visual should reinforce the product.

If an existing asset/component can achieve the effect, reuse it.

Do not add huge unnecessary dependencies.

---

# SERVICES

The team specifically wants services to have separate public-facing pages.

Do not present the entire service offering as one generic landing-page block.

Create or prepare separate public pages where appropriate.

For example:

- `/services/...`
- individual service pages

Use the existing routing and component conventions.

The landing page should introduce the services and direct users into their respective pages.

Do not modify authenticated dashboard service flows unless absolutely necessary.

---

# TERMS & CONDITIONS

Add a proper public-facing Terms & Conditions page.

Suggested route:

`/terms`

Follow the existing site's design system while making it visually consistent with the new public site.

It should be accessible from the public footer.

Do not create a fake or placeholder link.

---

# PRIVACY POLICY

Add a proper public-facing Privacy Policy page.

Suggested route:

`/privacy`

It should:

- use the existing public-site layout
- be responsive
- be accessible from the footer
- not require authentication

Do not break or modify authenticated application flows.

---

# NAVBAR

IMPORTANT:

The navbar should NOT appear on the main landing page.

The landing page should have its own visual composition.

Do not force the existing application/public navbar onto the landing hero.

However:

- the landing page still needs clear navigation/access to important destinations
- the logo should remain usable if included in the landing design
- navigation should be handled in a way that fits the experimental landing experience

For example, a minimal floating menu, logo treatment, or section-specific navigation may be used if it improves the design.

Do not simply reproduce the old navbar at the top.

---

# LOGO

The Doceeto logo/wordmark must remain recognizable.

If the logo appears on the landing page:

- clicking it should return to `/`
- it should use the existing brand component
- do not recreate the logo manually

Be careful with nested links.

Do NOT wrap an existing `Wordmark` that already renders a `<Link>` inside another `<Link>`.

This causes:

`<a>` inside `<a>`

and produces React hydration errors.

---

# AUTHENTICATION — DO NOT BREAK THIS

This is extremely important.

The existing signup/login system must remain intact.

There should NOT be two separate signup experiences.

Use the existing signup flow.

Do not create a new signup implementation for the landing page.

Landing-page CTAs should point to the existing signup/login routes.

Examples:

Patient CTA:

`/signup?as=patient`

Doctor CTA:

`/signup?as=doctor`

OR use the project's existing canonical signup route if the current implementation has changed.

Before changing these links, inspect the existing authentication flow.

DO NOT duplicate:

- signup forms
- authentication logic
- OAuth logic
- doctor onboarding
- patient onboarding
- validation
- session handling

The landing page only needs to link into the existing system.

---

# DASHBOARD / APPLICATION

DO NOT redesign the dashboard.

DO NOT apply the landing-page brutalism/glassmorphism direction to:

- patient dashboard
- doctor dashboard
- admin/ops dashboard
- consultation interfaces
- authentication internals
- existing application workflows

The experimental design is specifically for the public-facing landing/site experience.

---

# EXISTING COMPONENTS

Before creating a new component, inspect whether an existing one can be reused.

Important existing components include things such as:

- `Wordmark`
- `BrandMark`
- `Name`
- `Button`
- `GlassCard`
- `StatCard`
- `StatusPill`
- patient cards
- doctor cards
- existing site/footer components
- existing animation utilities

Reuse where it makes sense.

However, do NOT force existing components into places where they make the design worse.

Creating a new landing-specific component is acceptable when necessary.

---

# COMPONENT STRUCTURE

Keep the landing implementation modular.

For example:

components/
landing/
landing-hero.tsx
landing-story.tsx
landing-services.tsx
landing-patient.tsx
landing-doctor.tsx
landing-product-showcase.tsx
landing-final-cta.tsx

Only create components that are actually needed.

Do not create dozens of tiny components without reason.

---

# ANIMATION

Animation should be a major part of the experience, but controlled.

Use existing animation libraries/utilities where possible.

Good uses:

- entrance animations
- text reveals
- scroll-based storytelling
- floating UI
- subtle 3D movement
- parallax
- hover interactions
- product previews
- section transitions

Avoid:

- constant movement everywhere
- excessive bouncing
- distracting effects
- animation that hurts mobile performance

Respect `prefers-reduced-motion`.

---

# RESPONSIVENESS

The landing page must be intentionally designed for:

- mobile
- tablet
- laptop
- large desktop

Do not simply shrink the desktop layout.

Some experimental compositions should change completely on mobile.

For example:

Desktop:
large overlapping typography + floating visual

Mobile:
stacked typography + controlled visual layering

Make sure:

- text never overflows
- buttons remain usable
- glass elements don't become unreadable
- 3D/visual elements don't cover content
- animations remain performant
- sections don't become excessively tall

---

# EXISTING THEME SYSTEM

The landing page should primarily use the existing Doceeto theme/tokens.

However, landing-specific visual treatments are allowed.

It is acceptable to break from the normal application appearance in individual sections if it creates a stronger visual experience.

For example:

- an unusually colorful hero
- a dark visual interlude
- a large accent-colored section
- a glass-heavy product showcase
- a brutalist typography section

These should feel intentional.

Do not turn every section into a different visual style.

There should still be a clear Doceeto identity tying the page together.

---

# FOOTER

Use the existing public footer where possible.

Update it as necessary to include:

- Services
- About
- Contact
- Terms & Conditions
- Privacy Policy
- relevant public links

Do not expose authenticated dashboard navigation as public-site navigation unless already intended.

---

# WHAT MUST NOT CHANGE

Unless absolutely necessary, DO NOT modify:

- authentication logic
- signup implementation
- login implementation
- OAuth
- patient dashboard
- doctor dashboard
- consultation flow
- backend APIs
- database logic
- existing application workflows
- unrelated pages
- existing global design system

The task is primarily a PUBLIC LANDING/SITE EXPERIENCE redesign.

---

# IMPLEMENTATION PROCESS

Before coding:

1. Read `doceeto_audit_report.md`.
2. Read `LANDING_PAGE_BRIEF.md`.
3. Inspect the current landing page.
4. Inspect existing public pages.
5. Inspect the existing components.
6. Inspect `globals.css`.
7. Inspect theme variables.
8. Inspect existing animation utilities.
9. Inspect the authentication routes.
10. Inspect existing service routes/pages.
11. Inspect the existing footer.
12. Inspect the Zumi reference site.

Then determine:

- what can be reused
- what should be redesigned
- what needs new components
- what routes need to be added

---

# FINAL QUALITY BAR

The result should NOT feel like:

"AI generated a SaaS landing page."

It should feel like:

"Someone deliberately designed a bold, memorable healthcare brand."

It should have:

- strong visual identity
- big typography
- interesting compositions
- color
- depth
- interaction
- personality
- clear product storytelling

while still unmistakably being Doceeto.

The landing page should make someone stop scrolling.

---

# FINAL CHECKLIST

Before finishing:

[ ] Read `doceeto_audit_report.md`
[ ] Read `LANDING_PAGE_BRIEF.md`
[ ] Landing page redesigned
[ ] Landing page feels more expressive than the dashboard
[ ] Big typography
[ ] Colorful but still Doceeto
[ ] Brutalist influence
[ ] Selective glassmorphism
[ ] Interesting visual/3D elements where useful
[ ] Zumi-inspired visual ambition without copying
[ ] AI-style em dashes removed from public copy
[ ] Main landing navbar removed
[ ] Services have appropriate separate public pages
[ ] `/terms` exists
[ ] `/privacy` exists
[ ] Footer links updated
[ ] Existing signup flow preserved
[ ] Only ONE signup system exists
[ ] Patient CTA uses existing signup flow
[ ] Doctor CTA uses existing signup flow
[ ] Dashboard untouched
[ ] Authentication untouched
[ ] Existing public components reused where appropriate
[ ] Mobile responsive
[ ] Tablet responsive
[ ] Desktop responsive
[ ] Reduced-motion behavior considered
[ ] No nested `<a>` / `<Link>` elements
[ ] No hydration errors
[ ] No unnecessary global CSS changes
[ ] Build passes
[ ] Existing application pages still work

DO NOT STOP AFTER MAKING THE PAGE LOOK GOOD.

Verify the existing application still works.
