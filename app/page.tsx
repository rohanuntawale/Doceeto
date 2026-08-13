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
  // Each of these lands on a PREVIEW that works without an account (see
  // app/try). Pointing them straight at /patient/* sent every curious visitor
  // to a sign-in form before they had seen anything worth signing in for —
  // the nav was a wall with labels on it.
  { id: "doctors", tile: "Doctors", href: "/try/doctors" },
  { id: "nurses", tile: "Nurses", href: "/try/nurses" },
  { id: "urgent", tile: "Urgent care", href: "/try/urgent" },
  { id: "checker", tile: "Symptom check", href: "/try/checker" },
];

/**
 * The two links that are not things a patient came here to get.
 *
 * They sit beside Log in rather than in the rail, which is how every
 * marketplace with two sides handles it: the centre belongs to what you can
 * buy, the edge to joining the other side of it and to finding a human. Six
 * tabs in one rail also forced the whole nav to `lg:` — below that width it
 * collided with the buttons and had to be hidden outright, so a tablet got no
 * navigation at all. Four fits from `md:` up.
 */
const SECONDARY_NAV = [
  // The signup page opens directly on the doctor form.
  { label: "For providers", href: "/signup?as=doctor" },
  // The company, the mechanism, the policies and the ways to reach a person.
  // Not the bare contact form it used to be — most people who click "Support"
  // want an answer, not a text box.
  { label: "Support", href: "/support" },
];

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
        <div className="mx-auto max-w-7xl px-6 flex items-center justify-between">
          <Link href="/" className="hover:opacity-90 transition-opacity">
            <Wordmark />
          </Link>

          {/* Centre rail. `activeId={null}` on purpose: these tabs are
              destinations elsewhere in the app, so none of them is ever "where
              you are" while you're reading the landing page. A persistent
              underline would claim otherwise; the hover wash is the feedback. */}
          <AnimatedNavigationTabs
            items={NAV_ITEMS}
            activeId={null}
            className="hidden md:block text-xs font-semibold uppercase tracking-wider"
          />

          {/* Right Action Cluster */}
          <div className="flex items-center gap-3">
            {/* Own flex row with its own gap. Sharing the cluster's gap-3 with
                the buttons squeezed these two labels together — buttons carry
                their own padding, bare text does not. */}
            <div className="hidden items-center gap-6 lg:flex">
              {SECONDARY_NAV.map((l) => (
                <Link
                  key={l.href}
                  href={l.href}
                  className="whitespace-nowrap text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)] transition-colors hover:text-[var(--accent)]"
                >
                  {l.label}
                </Link>
              ))}
              <span aria-hidden className="h-4 w-px bg-[var(--border)]" />
            </div>
            <Link href="/login" className="hidden sm:inline-block">
              <Button
                variant="ghost"
                size="sm"
                className="font-semibold text-xs"
              >
                Log in
              </Button>
            </Link>
            <Link href="/signup">
              <Button
                size="sm"
                className="font-bold text-xs bg-[var(--accent)] text-on-accent shadow-soft border-0"
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
