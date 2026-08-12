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
import { LandingHeroStats } from "./landing-hero-stats";
import { LandingTicker } from "./landing-ticker";

export function LandingHero() {
  return (
    /* The first screen is a paper panel resting on the forest band that runs
       through the rest of the page. Its bottom corners curve away, so the
       green reads through at the edges and the manifesto below continues the
       same colour — the panel lifts off the page rather than ending on it. */
    <section className="relative bg-forest">
      <div className="paper-panel relative overflow-hidden rounded-b-[2rem] sm:rounded-b-[3rem] lg:rounded-b-[4.5rem]">
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

