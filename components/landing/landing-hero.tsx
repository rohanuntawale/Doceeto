"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { ArrowRight, UserCheck, HeartHandshake } from "lucide-react";
import { Button } from "@/components/ui/button";

export function LandingHero() {
  return (
    <section className="relative min-h-[85vh] flex items-center justify-center overflow-hidden pt-20 pb-16 px-6">
      {/* Background ambient glow washes */}
      <div
        className="absolute inset-0 overflow-hidden pointer-events-none"
        aria-hidden="true"
      >
        <div className="absolute -top-40 -right-40 w-[600px] h-[600px] rounded-full bg-[rgb(var(--c-terracotta)/0.08)] blur-[140px]" />
        <div className="absolute -bottom-60 -left-40 w-[650px] h-[650px] rounded-full bg-[rgb(var(--c-salmon)/0.07)] blur-[160px]" />
        <div className="absolute inset-0 pattern-dots opacity-40 [mask-image:radial-gradient(ellipse_60%_50%_at_50%_45%,#000_0%,transparent_75%)]" />
      </div>

      <div className="relative z-10 max-w-4xl mx-auto text-center flex flex-col items-center">
        {/* Status chip */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="inline-flex items-center gap-2 rounded-full border border-[var(--border)] bg-[var(--surface)]/80 backdrop-blur-md px-4 py-1.5 text-xs font-medium text-[var(--text-muted)] mb-8 shadow-soft"
        >
          <span className="h-2 w-2 rounded-full bg-[rgb(var(--c-status-ok))] animate-pulse" />
          <span>Care that reaches you · Direct patient-doctor connection</span>
        </motion.div>

        {/* Hero Editorial Headline */}
        <motion.h1
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.1, ease: [0.16, 1, 0.3, 1] }}
          className="font-serif text-[clamp(2.8rem,7vw,5.5rem)] font-bold leading-[0.96] tracking-tight text-[var(--text)] text-balance"
        >
          Care that reaches{" "}
          <span className="italic text-[var(--accent)] relative inline-block">
            you.
            <svg
              className="absolute -bottom-1 left-0 w-full h-2 text-[var(--accent)] opacity-50"
              viewBox="0 0 200 8"
              fill="none"
              preserveAspectRatio="none"
            >
              <path
                d="M2 6c40-4 80-4 196-2"
                stroke="currentColor"
                strokeWidth="3"
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
          className="mt-7 text-lg sm:text-xl text-[var(--text-muted)] max-w-2xl leading-relaxed text-balance"
        >
          Express what you need or offer your medical expertise. Doceeto creates
          the direct connection between patient care and doctor services.
        </motion.p>

        {/* Dual Primary CTAs -> /login?tab=signup */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.4 }}
          className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4 w-full max-w-md"
        >
          <Link href="/signup" className="w-full sm:w-auto flex-1">
            <Button
              size="lg"
              className="w-full h-13 px-7 text-base font-semibold shadow-soft group"
            >
              <HeartHandshake className="w-5 h-5 mr-2 text-on-accent" />
              I need help
              <ArrowRight className="w-4 h-4 ml-2 transition-transform group-hover:translate-x-1" />
            </Button>
          </Link>

          <Link href="/signup?as=doctor" className="w-full sm:w-auto flex-1">
            <Button
              variant="outline"
              size="lg"
              className="w-full h-13 px-7 text-base font-semibold border-[var(--border)] text-[var(--text)] hover:border-[var(--accent)]"
            >
              <UserCheck className="w-5 h-5 mr-2 text-[var(--accent)]" />
              I&apos;m a doctor
            </Button>
          </Link>
        </motion.div>

        {/* Nurses join through the same door — blue, like every nurse surface. */}
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.6, delay: 0.55 }}
          className="mt-4 text-sm text-[var(--text-muted)]"
        >
          Are you a nurse?{" "}
          <Link
            href="/signup?as=nurse"
            className="font-semibold text-[#2F7BC4] underline-offset-4 hover:underline"
          >
            Join as a home-care nurse →
          </Link>
        </motion.p>

        {/* Subtle scroll cue */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.8, duration: 1 }}
          className="mt-16 flex flex-col items-center gap-2 text-[var(--text-faint)]"
        >
          <span className="text-[10px] uppercase tracking-label font-medium">
            Scroll to explore
          </span>
          <div className="w-px h-8 bg-gradient-to-b from-[var(--text-faint)] to-transparent" />
        </motion.div>
      </div>
    </section>
  );
}
