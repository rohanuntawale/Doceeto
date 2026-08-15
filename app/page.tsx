"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Wordmark } from "@/components/brand/wordmark";
import { Button } from "@/components/ui/button";
import { LandingHero } from "@/components/landing/landing-hero";
import { LandingStory } from "@/components/landing/landing-story";
import { LandingFilm } from "@/components/landing/landing-film";
import { LandingTwoSides } from "@/components/landing/landing-two-sides";
import { LandingClinicMap } from "@/components/landing/landing-clinic-map";
import { LandingFinalCta } from "@/components/landing/landing-final-cta";
import { CheckerFab } from "@/components/landing/checker-fab";
import {
  SectionRail,
  type RailSection,
} from "@/components/landing/section-rail";
import { SiteFooter } from "@/components/site/site-footer";
import {
  LandingSidebar,
  type SidebarLink,
} from "@/components/landing/landing-sidebar";

/**
 * The nav is a list of WHAT DOCEETO DOES, not a table of contents for this
 * page.
 *
 * It used to be four anchors — Manifesto, Roles, How it works, Experience —
 * which is a description of the landing page rather than of the product. A
 * visitor who needs a doctor tonight has no way to know which of those four
 * words gets them one, and someone who already has an account has to scroll
 * past all of them to find a way in.
 *
 * So: one item per thing you can actually get, in the order people want them,
 * ending with the way out to a human. Every one is a real destination. An
 * anonymous visitor tapping "Doctors" is sent to sign in and then lands
 * exactly there (the middleware carries `next`), which is a better funnel than
 * a marketing section about doctors.
 */
/**
 * The section rail, in document order.
 *
 * `tone` is what sits BEHIND the rail in that section, not the section's own
 * mood: the page alternates forest bands and paper panels, and a single dot
 * colour disappears against one of them. Keep this list in step with <main>.
 */
const RAIL_SECTIONS: RailSection[] = [
  { id: "hero", label: "Top", tone: "light" },
  { id: "story", label: "Manifesto", tone: "dark" },
  // Same forest band as the manifesto — the film continues it rather than
  // starting a new colour, so the rail stays on its dark treatment here.
  { id: "film", label: "The film", tone: "dark" },
  { id: "patient-doctor", label: "Roles", tone: "light" },
  { id: "clinics", label: "Clinics", tone: "light" },
  { id: "start", label: "Get started", tone: "dark" },
];

const NAV_ITEMS: SidebarLink[] = [
  // Each lands on a PREVIEW that works without an account (see app/try).
  // Pointing them straight at /patient/* sent every curious visitor to a
  // sign-in form before they had seen anything worth signing in for.
  {
    id: "doctors",
    label: "Doctors",
    href: "/try/doctors",
    hint: "Browse verified doctors by specialty, language and fee.",
  },
  {
    id: "nurses",
    label: "Nurses",
    href: "/try/nurses",
    hint: "Home nursing — wound care, injections, vitals, elder care.",
  },
  {
    id: "checker",
    label: "Symptom check",
    href: "/try/checker",
    hint: "Describe what's wrong and find out who to see.",
  },
  // The company, the mechanism, the policies and the ways to reach a person.
  {
    id: "support",
    label: "Support",
    href: "/support",
    hint: "How it works, verification, and who to contact.",
  },
];

/*
 * ── What was cut from this rail, and why it is still reachable ──
 *
 * A header is a place to make four choices, not eight. Two came out:
 *
 *   Urgent care   — a filtered view of Doctors ("free right now"), not a
 *                   separate thing. It is the first tab on every /try page and
 *                   the loudest link on /try/doctors.
 *   For providers — the hero already carries "I'm a doctor" and "I'm a nurse"
 *                   as full-size buttons a few hundred pixels below this, and
 *                   /support opens with a provider card. A third copy in the
 *                   header was competing with itself.
 *
 * Both still appear in the footer sitemap and in /sitemap.xml, so nothing was
 * hidden — only un-duplicated.
 */

export default function Page() {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 20);
    };
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  /* Arriving with a hash from another page — the footer's /#how-it-works, say.
     The browser performs its hash scroll as soon as the document is ready, but
     this page's sections are laid out by framer-motion after hydration, so at
     that moment the target is either absent or thousands of pixels from where
     it will end up. Re-run the scroll once the element actually exists.

     Instant, not smooth: you asked to arrive at a section, not to watch the
     whole page scroll past. Same-page nav bar clicks are unaffected — they are
     plain anchors and keep the smooth behaviour from globals.css. */
  useEffect(() => {
    const id = decodeURIComponent(window.location.hash.slice(1));
    if (!id) return;

    let frame = 0;
    const settle = (attempt = 0) => {
      const el = document.getElementById(id);
      if (el) {
        el.scrollIntoView({ behavior: "instant", block: "start" });
      } else if (attempt < 30) {
        frame = requestAnimationFrame(() => settle(attempt + 1));
      }
    };
    frame = requestAnimationFrame(() => settle());
    return () => cancelAnimationFrame(frame);
  }, []);

  return (
    <div className="min-h-screen bg-[var(--bg)] text-[var(--text)] relative selection:bg-[var(--accent)] selection:text-white">
      {/* ── Floating glass pill header ──
          A capsule that hugs its own content, centred, detached from the
          page edges — not a bar spanning the viewport. Full-width chrome was
          claiming ~90px of every screen for four controls; sized to fit, the
          same controls read as an object floating over the page, and the hero
          shows through around it.

          The glass is real glassmorphism, not a tinted rectangle: a
          translucent surface + backdrop-blur so the forest band and paper
          panel genuinely refract through it as you scroll, a hairline border
          to give the pane an edge, and an inset top highlight — the catch
          light that makes it read as glass rather than fog. Opacity firms up
          once scrolled, when busier content starts passing underneath. */}
      <header className="fixed inset-x-0 top-0 z-50 flex justify-center px-4 pt-3 sm:pt-4">
        {/* Frosted WHITE glass, in every state. A smoked-green variant was
            tried for "over the hero" — but the pill keys on scroll position,
            not on what is actually behind it, and at the top of the page
            that's the white paper panel: green glass over white paper read as
            a muddy grey-green capsule. White glass is correct over paper and
            still legible passing the forest bands, so one recipe it is. The
            blur + saturate is what keeps it glass rather than paint — content
            scrolling underneath visibly refracts through it. */}
        <div
          className={`flex items-center gap-1 rounded-full border border-white/50 py-1.5 pl-3 pr-1.5 shadow-[inset_0_1px_0_rgb(255_255_255/0.6),0_8px_32px_rgb(16_45_35/0.15)] backdrop-blur-2xl backdrop-saturate-150 transition-colors duration-300 ${
            scrolled ? "bg-white/[0.6]" : "bg-white/[0.35]"
          }`}
        >
          {/* Compact wordmark: the tagline is what made the old bar tall. */}
          <Link href="/" className="transition-opacity hover:opacity-90">
            <Wordmark compact />
          </Link>

          <span aria-hidden className="mx-2 h-5 w-px bg-[var(--border)]" />

          {/* The destinations live in the drawer (see NAV_ITEMS); the pill
              carries only the two account actions and the menu trigger. */}
          <Link href="/login" className="hidden sm:inline-block">
            <Button
              variant="ghost"
              size="sm"
              className="rounded-full text-xs font-semibold"
            >
              Log in
            </Button>
          </Link>
          <Link href="/signup" className="ml-1">
            <Button
              size="sm"
              className="rounded-full border-0 bg-[var(--accent)] text-xs font-bold text-on-accent shadow-soft"
            >
              Get Started
            </Button>
          </Link>

          <span className="ml-1">
            <LandingSidebar links={NAV_ITEMS} />
          </span>
        </div>
      </header>

      {/* Main Content Sections */}
      <main>
        <LandingHero />
        <LandingStory />
        <LandingFilm />
        <LandingTwoSides />
        <LandingClinicMap />
        <LandingFinalCta />
      </main>

      {/* Where you are on the page, and a way to jump. Order and `tone` must
          track <main> above: tone is what sits behind the rail in each
          section, so it can stay legible as the page alternates between the
          forest bands and the paper panels. */}
      <SectionRail sections={RAIL_SECTIONS} />

      {/* Site Footer */}
      <SiteFooter />

      {/* Follows the scroll — the checker stays one tap away all the way down. */}
      <CheckerFab />
    </div>
  );
}
