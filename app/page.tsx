"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Wordmark } from "@/components/brand/wordmark";
import { Button } from "@/components/ui/button";
import { LandingHero } from "@/components/landing/landing-hero";
import { LandingStory } from "@/components/landing/landing-story";
import { LandingTwoSides } from "@/components/landing/landing-two-sides";
import { LandingTestimonials } from "@/components/landing/landing-testimonials";
import { LandingProductShowcase } from "@/components/landing/landing-product-showcase";
import { LandingFinalCta } from "@/components/landing/landing-final-cta";
import { CheckerFab } from "@/components/landing/checker-fab";
import { SiteFooter } from "@/components/site/site-footer";
import {
  AnimatedNavigationTabs,
  type AnimatedNavigationTab,
} from "@/components/ui/animated-navigation-tabs";

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
const NAV_ITEMS: AnimatedNavigationTab[] = [
  // Each lands on a PREVIEW that works without an account (see app/try).
  // Pointing them straight at /patient/* sent every curious visitor to a
  // sign-in form before they had seen anything worth signing in for.
  { id: "doctors", tile: "Doctors", href: "/try/doctors" },
  { id: "nurses", tile: "Nurses", href: "/try/nurses" },
  { id: "checker", tile: "Symptom check", href: "/try/checker" },
  // The company, the mechanism, the policies and the ways to reach a person.
  { id: "support", tile: "Support", href: "/support" },
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
      {/* Inline Floating Landing Header (Replaces global SiteHeader for landing only) */}
      <header
        className={`fixed top-0 inset-x-0 z-50 transition-all duration-300 ${
          scrolled
            ? "py-3 bg-[rgb(var(--surface-rgb)/0.85)] backdrop-blur-xl border-b border-[var(--border)] shadow-soft"
            : "py-5 bg-transparent"
        }`}
      >
        {/* Two groups, not three. The rail used to sit in the middle of a
            justify-between row, which meant the gap on its left (to the
            wordmark) and the gap on its right (to the buttons) were whatever
            the viewport happened to leave over — never equal, and never the
            same at two window widths. Everything except the wordmark now lives
            in ONE right-hand group, so the spacing inside it is set by the
            items themselves rather than by leftover space. */}
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-6 px-6">
          <Link href="/" className="transition-opacity hover:opacity-90">
            <Wordmark />
          </Link>

          <div className="flex items-center">
            {/* `activeId={null}` on purpose: these tabs are destinations
                elsewhere in the app, so none of them is ever "where you are"
                while you're reading the landing page. A persistent underline
                would claim otherwise; the hover wash is the feedback. */}
            <AnimatedNavigationTabs
              items={NAV_ITEMS}
              activeId={null}
              className="hidden text-xs font-semibold uppercase tracking-wider md:block"
            />

            {/* The one seam in the group: what you can get, then who you are.
                Its margin matches the tabs' own horizontal padding, so the
                rhythm carries straight through it. */}
            <span aria-hidden className="mx-3 hidden h-4 w-px bg-[var(--border)] md:block" />

            <Link href="/login" className="hidden sm:inline-block">
              <Button variant="ghost" size="sm" className="text-xs font-semibold">
                Log in
              </Button>
            </Link>
            {/* ml-2 rather than a gap on the row: a filled button reads as
                heavier than bare text at the same distance, so it needs a
                little more air to look like the same gap. */}
            <Link href="/signup" className="ml-2">
              <Button
                size="sm"
                className="border-0 bg-[var(--accent)] text-xs font-bold text-on-accent shadow-soft"
              >
                Get Started
              </Button>
            </Link>
          </div>
        </div>
      </header>

      {/* Main Content Sections */}
      <main>
        <LandingHero />
        <LandingStory />
        <LandingTwoSides />
        <LandingTestimonials />
        <LandingProductShowcase />
        <LandingFinalCta />
      </main>

      {/* Site Footer */}
      <SiteFooter />

      {/* Follows the scroll — the checker stays one tap away all the way down. */}
      <CheckerFab />
    </div>
  );
}
