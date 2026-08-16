"use client";

import { motion } from "framer-motion";
import { HeartHandshake, Stethoscope, Syringe } from "lucide-react";
import { RoleCta } from "@/components/ui/role-cta";
import { LandingHeroStats } from "./landing-hero-stats";
import { LandingTicker } from "./landing-ticker";

export function LandingHero() {
  return (
    /* The first screen is a paper panel resting on the forest band that runs
       through the rest of the page. Its bottom corners curve away, so the
       green reads through at the edges and the manifesto below continues the
       same colour, the panel lifts off the page rather than ending on it. */
    // id: the section rail observes and scrolls to it, and it gives the
    // "back to top" dot somewhere real to land.
    <section id="hero" className="relative bg-forest">
      <div className="paper-panel relative overflow-hidden rounded-b-[2rem] sm:rounded-b-[3rem] lg:rounded-b-[4.5rem]">
        {/* The house-call footage that was briefly staged here now has its own
            section further down (LandingFilm), where it is watched rather than
            washed out. The hero's background is the forest below. */}

        {/* Background ambient glow washes + brutalist grid lines */}
        <div
          className="absolute inset-0 overflow-hidden pointer-events-none"
          aria-hidden="true"
        >
          <div className="absolute top-10 right-[-10%] w-[500px] h-[500px] rounded-full bg-[rgb(var(--c-terracotta)/0.16)] blur-[120px]" />
          <div className="absolute bottom-[-10%] left-[-5%] w-[600px] h-[600px] rounded-full bg-[#2F7BC4]/10 blur-[150px]" />
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] rounded-full bg-[rgb(var(--c-salmon)/0.10)] blur-[180px]" />
          <div className="absolute inset-0 pattern-dots opacity-25 [mask-image:radial-gradient(ellipse_70%_60%_at_50%_40%,#000_0%,transparent_80%)]" />
        </div>

        {/* ── Readability wash ──
            A subtle paper veil keeps the ambient colour and grid texture quiet
            behind the type, with a clean base for the stats row. */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 z-0"
        >
          <div className="absolute inset-0 bg-[rgb(var(--bg-rgb)/0.38)]" />
          <div className="absolute inset-0 bg-[linear-gradient(to_right,rgb(var(--bg-rgb)/0.92)_0%,rgb(var(--bg-rgb)/0.72)_38%,rgb(var(--bg-rgb)/0.28)_66%,rgb(var(--bg-rgb)/0)_100%)]" />
          <div className="absolute inset-x-0 top-0 h-28 bg-[linear-gradient(to_bottom,rgb(var(--bg-rgb)/0.85),rgb(var(--bg-rgb)/0))]" />
          <div className="absolute inset-x-0 bottom-0 h-[42%] bg-[linear-gradient(to_top,rgb(var(--bg-rgb))_0%,rgb(var(--bg-rgb))_28%,rgb(var(--bg-rgb)/0)_100%)]" />
        </div>

        <div className="relative z-10 flex min-h-[68vh] items-center px-6 pt-24 pb-8 sm:min-h-[74vh] sm:pt-28 sm:pb-12 lg:min-h-[82vh] lg:pb-16">
          <div className="max-w-7xl mx-auto w-full">
            {/* One column. The promise carries the screen on its own, the
                headline takes the width the old side panel was using. */}
            <div className="flex max-w-5xl flex-col items-start text-left">
              {/* Main Headline, the first thing on the page is the promise
                  itself. The pill that used to sit above it ("Direct Patient &
                  Provider Healthcare") only restated the headline in smaller
                  type, and it cost the hero its opening beat. */}
              <motion.h1
                initial={{ opacity: 0, y: 24 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{
                  duration: 0.7,
                  delay: 0.1,
                  ease: [0.16, 1, 0.3, 1],
                }}
                className="font-serif text-[clamp(3.2rem,8.5vw,7.5rem)] font-extrabold leading-[0.92] tracking-tight text-[var(--text)]"
              >
                Care that reaches{" "}
                <span className="italic text-[var(--accent)] relative inline-block">
                  you.
                  <svg
                    className="absolute -bottom-2 left-0 w-full h-3 text-[var(--accent)] opacity-60"
                    viewBox="0 0 200 12"
                    fill="none"
                    preserveAspectRatio="none"
                  >
                    <path
                      d="M3 9c45-6 90-6 194-3"
                      stroke="currentColor"
                      strokeWidth="4"
                      strokeLinecap="round"
                    />
                  </svg>
                </span>
              </motion.h1>

              {/* Subtitle */}
              <motion.p
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: 0.25 }}
                className="mt-8 text-lg sm:text-xl text-[var(--text-muted)] max-w-xl leading-relaxed font-sans"
              >
                Express what care you need, or bring your medical practice
                directly to patients. Doceeto bridges the front door to health.
              </motion.p>

              {/* Triple CTAs (Patient, Doctor, Nurse).
                  Stacked, not in a row: three side-by-side buttons squeezed
                  each label into a column narrower than the words, which is
                  what made them read as different widths and alignments. In a
                  column they share one left edge and one icon gutter, so the
                  labels line up exactly. */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: 0.4 }}
                className="mt-10 flex w-full max-w-md flex-col gap-2.5"
              >
                <RoleCta
                  href="/signup"
                  icon={HeartHandshake}
                  label="I need care"
                  caption="Book a doctor or nurse, at home or online"
                  primary
                />
                <RoleCta
                  href="/signup?as=doctor"
                  icon={Stethoscope}
                  label="I'm a doctor"
                  caption="Take consults and home visits near you"
                />
                <RoleCta
                  href="/signup?as=nurse"
                  icon={Syringe}
                  label="I'm a nurse"
                  caption="Offer home nursing on your own schedule"
                />
              </motion.div>
            </div>
          </div>
        </div>

        {/* Headline figures closing the panel */}
        <div className="relative z-10">
          <LandingHeroStats />
        </div>

        {/* Quiet care rail. Closes the panel, the "Scroll to explore Doceeto"
            cue that used to sit under it is gone: the section rail down the
            right edge already shows there is more page, and a panel that ends
            by instructing you to scroll is a panel that doesn't trust its own
            content to pull you down. */}
        <div className="relative z-10 mt-8 pb-8 sm:mt-14 sm:pb-14">
          <LandingTicker variant="minimal" />
        </div>
      </div>
    </section>
  );
}

