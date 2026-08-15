"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import {
  ArrowRight,
  HeartHandshake,
  UserCheck,
  Stethoscope,
  ShieldCheck,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { ForestScene } from "./forest-scene";
import { LandingHeroStats } from "./landing-hero-stats";
import { LandingTicker } from "./landing-ticker";

export function LandingHero() {
  return (
    /* The first screen is a paper panel resting on the forest band that runs
       through the rest of the page. Its bottom corners curve away, so the
       green reads through at the edges and the manifesto below continues the
       same colour — the panel lifts off the page rather than ending on it. */
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

        {/* ── The forest, behind the whole screen ──
            Full-bleed scenery, not an object parked in the right half: the
            camera frames the landscape to the container's width (see
            ForestScene), so it spans the section and reads as the horizon the
            copy is standing in front of. It stays BEHIND the copy (z-0 under
            the z-10 content), and the wash layer directly below this one is
            what keeps the headline legible where the two overlap — the model
            itself is only masked at its edges so the canvas has no visible
            border.

            lg and up only. Below that the hero is already a full screen of
            headline and three buttons, and there is no room for scenery worth
            12 MB — ForestScene declines to load at all under 1024px. */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 z-0 hidden overflow-hidden opacity-60 [mask-image:radial-gradient(125%_105%_at_50%_58%,#000_35%,rgb(0_0_0/0.55)_72%,transparent_100%)] lg:block"
        >
          <ForestScene className="h-full w-full" />
        </div>

        {/* ── Readability wash ──
            The one layer that makes the forest survivable behind type. A flat
            paper veil knocks the whole scene back, a left-to-right gradient
            buries it entirely under the headline and buttons, and the top and
            bottom fades hand the panel back to solid paper — at the top so the
            glass header has something quiet to float on, at the bottom so the
            stats row starts on clean ground. */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 z-0"
        >
          <div className="absolute inset-0 bg-[rgb(var(--bg-rgb)/0.38)]" />
          <div className="absolute inset-0 bg-[linear-gradient(to_right,rgb(var(--bg-rgb)/0.92)_0%,rgb(var(--bg-rgb)/0.72)_38%,rgb(var(--bg-rgb)/0.28)_66%,rgb(var(--bg-rgb)/0)_100%)]" />
          <div className="absolute inset-x-0 top-0 h-28 bg-[linear-gradient(to_bottom,rgb(var(--bg-rgb)/0.85),rgb(var(--bg-rgb)/0))]" />
          <div className="absolute inset-x-0 bottom-0 h-[42%] bg-[linear-gradient(to_top,rgb(var(--bg-rgb))_0%,rgb(var(--bg-rgb))_28%,rgb(var(--bg-rgb)/0)_100%)]" />
        </div>

        <div className="relative z-10 flex min-h-[82vh] items-center px-6 pt-28 pb-16">
          <div className="max-w-7xl mx-auto w-full">
            {/* One column. The promise carries the screen on its own — the
                headline takes the width the old side panel was using. */}
            <div className="flex max-w-5xl flex-col items-start text-left">
              {/* Main Headline — the first thing on the page is the promise
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

              {/* Triple CTAs (Patient, Doctor, Nurse) */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: 0.4 }}
                className="mt-10 flex flex-col sm:flex-row items-stretch sm:items-center gap-3.5 w-full max-w-xl"
              >
                {/* Patient CTA */}
                <Link href="/signup" className="flex-1">
                  <Button
                    size="lg"
                    className="w-full h-14 px-6 text-base font-semibold shadow-soft group bg-[var(--accent)] text-on-accent hover:brightness-110 border-2 border-transparent transition-all duration-200 hover:-translate-y-0.5"
                  >
                    <HeartHandshake className="w-5 h-5 mr-2" />
                    I need care
                    <ArrowRight className="w-4 h-4 ml-auto sm:ml-2 transition-transform group-hover:translate-x-1" />
                  </Button>
                </Link>

                {/* Doctor CTA */}
                <Link href="/signup?as=doctor" className="flex-1">
                  <Button
                    variant="outline"
                    size="lg"
                    className="w-full h-14 px-6 text-base font-semibold border-2 border-[rgb(var(--accent-rgb)/0.3)] text-[var(--text)] hover:border-[var(--accent)] hover:bg-[rgb(var(--accent-rgb)/0.1)] transition-all duration-200 hover:-translate-y-0.5"
                  >
                    <UserCheck className="w-5 h-5 mr-2 text-[var(--accent)]" />
                    I&apos;m a doctor
                  </Button>
                </Link>

                {/* Nurse CTA */}
                <Link href="/signup?as=nurse" className="flex-1">
                  <Button
                    variant="outline"
                    size="lg"
                    className="w-full h-14 px-6 text-base font-semibold border-2 border-[#2F7BC4]/40 text-[#2F7BC4] hover:border-[#2F7BC4] hover:bg-[#2F7BC4]/10 transition-all duration-200 hover:-translate-y-0.5"
                  >
                    <Stethoscope className="w-5 h-5 mr-2 text-[#2F7BC4]" />
                    I&apos;m a nurse
                  </Button>
                </Link>
              </motion.div>

              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.55, duration: 0.6 }}
                className="mt-6 flex items-center gap-6 text-xs text-[var(--text-faint)]"
              >
                <span className="flex items-center gap-1.5">
                  <ShieldCheck className="w-4 h-4 text-status-ok" /> Instant
                  role access
                </span>
                <span>•</span>
                <span>No upfront booking fees</span>
                <span>•</span>
                <span>Verified medical practitioners</span>
              </motion.div>
            </div>
          </div>
        </div>

        {/* Headline figures closing the panel */}
        <div className="relative z-10">
          <LandingHeroStats />
        </div>

        {/* Quiet care rail */}
        <div className="relative z-10 mt-14">
          <LandingTicker variant="minimal" />
        </div>

        {/* Subtle Scroll Cue, sitting just above the curve */}
        <div className="relative z-10 flex flex-col items-center gap-2 pt-10 pb-14 text-[var(--text-faint)]">
          <span className="text-[10px] uppercase tracking-widest font-semibold">
            Scroll to explore Doceeto
          </span>
          <div className="w-px h-6 bg-gradient-to-b from-[var(--text-faint)] to-transparent" />
        </div>
      </div>
    </section>
  );
}

