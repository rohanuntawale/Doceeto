"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import {
  ArrowRight,
  HeartHandshake,
  UserCheck,
  Stethoscope,
  Sparkles,
  Activity,
  ShieldCheck,
} from "lucide-react";
import { Button } from "@/components/ui/button";

export function LandingHero() {
  return (
    <section className="relative min-h-[90vh] flex flex-col justify-between overflow-hidden pt-24 pb-16 px-6">
      {/* Background ambient glow washes + brutalist grid lines */}
      <div
        className="absolute inset-0 overflow-hidden pointer-events-none"
        aria-hidden="true"
      >
        <div className="absolute top-10 right-[-10%] w-[500px] h-[500px] rounded-full bg-[rgb(var(--c-terracotta)/0.12)] blur-[120px] mix-blend-screen" />
        <div className="absolute bottom-[-10%] left-[-5%] w-[600px] h-[600px] rounded-full bg-[#2F7BC4]/10 blur-[150px]" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] rounded-full bg-[rgb(var(--c-tan)/0.06)] blur-[180px]" />
        <div className="absolute inset-0 pattern-dots opacity-25 [mask-image:radial-gradient(ellipse_70%_60%_at_50%_40%,#000_0%,transparent_80%)]" />
      </div>

      <div className="relative z-10 max-w-7xl mx-auto w-full grid lg:grid-cols-[1.1fr_0.9fr] gap-12 items-center my-auto">
        {/* Left Column: Bold Editorial Typography + CTAs */}
        <div className="flex flex-col items-start text-left">
          {/* Status badge */}
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="inline-flex items-center gap-2.5 rounded-full border-2 border-[var(--border)] bg-[var(--surface)]/90 backdrop-blur-md px-4 py-2 text-xs font-semibold text-[var(--text)] mb-8 shadow-soft"
          >
            <span className="relative flex h-2.5 w-2.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[rgb(var(--c-status-ok))] opacity-75" />
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-[rgb(var(--c-status-ok))]" />
            </span>
            <span className="tracking-wide">
              Direct Patient & Provider Healthcare
            </span>
            <Sparkles className="w-3.5 h-3.5 text-tan" />
          </motion.div>

          {/* Main Headline */}
          <motion.h1
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.1, ease: [0.16, 1, 0.3, 1] }}
            className="font-serif text-[clamp(3.2rem,7vw,6.5rem)] font-extrabold leading-[0.94] tracking-tight text-[var(--text)]"
          >
            Care that <br />
            reaches{" "}
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
            Express what care you need, or bring your medical practice directly
            to patients. Doceeto bridges the front door to health.
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
                className="w-full h-14 px-6 text-base font-semibold shadow-soft group bg-[var(--accent)] text-[var(--c-on-accent)] hover:brightness-110 border-2 border-transparent transition-all duration-200 hover:-translate-y-0.5"
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
                className="w-full h-14 px-6 text-base font-semibold border-2 border-[var(--border)] text-[var(--text)] hover:border-[var(--accent)] hover:bg-[var(--surface)] transition-all duration-200 hover:-translate-y-0.5"
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
              <ShieldCheck className="w-4 h-4 text-status-ok" /> Instant role
              access
            </span>
            <span>•</span>
            <span>No upfront booking fees</span>
            <span>•</span>
            <span>Verified medical practitioners</span>
          </motion.div>
        </div>

        {/* Right Column: Selectively Glassmorphic Interactive Preview Card */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 30 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.3 }}
          className="relative lg:pl-6"
        >
          {/* Decorative frame elements */}
          <div className="relative rounded-[2.5rem] border-2 border-[var(--border)] bg-[var(--surface)]/80 backdrop-blur-xl p-8 shadow-card overflow-hidden">
            <div className="absolute top-0 right-0 w-32 h-32 bg-[var(--accent)]/10 rounded-full blur-2xl pointer-events-none" />

            {/* Top card header */}
            <div className="flex items-center justify-between border-b border-[var(--border)] pb-5">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-2xl bg-[var(--accent)]/15 grid place-items-center border border-[var(--accent)]/30">
                  <Activity className="h-5 w-5 text-[var(--accent)] animate-pulse" />
                </div>
                <div>
                  <h3 className="font-semibold text-base text-[var(--text)]">
                    Live Care Connection
                  </h3>
                  <p className="text-xs text-[var(--text-muted)]">
                    Real-time matching active
                  </p>
                </div>
              </div>
              <span className="rounded-full bg-status-ok/15 text-status-ok px-3 py-1 text-xs font-semibold border border-status-ok/30">
                Online
              </span>
            </div>

            {/* Floating Glass Panels */}
            <div className="mt-6 space-y-4">
              {/* Patient request snippet */}
              <div className="rounded-2xl border border-[var(--border)] bg-[var(--bg)]/90 p-4 shadow-soft">
                <div className="flex items-center justify-between text-xs text-[var(--text-muted)] mb-2">
                  <span className="font-semibold text-[var(--accent)] uppercase tracking-wider text-[10px]">
                    Patient Request
                  </span>
                  <span>Just now</span>
                </div>
                <p className="font-serif text-lg font-medium text-[var(--text)]">
                  &ldquo;Need home visit checkup &amp; prescription renewal for
                  my mother in Nagpur.&rdquo;
                </p>
                <div className="mt-3 flex items-center justify-between text-xs">
                  <span className="rounded-md bg-espresso-700 px-2.5 py-1 text-[var(--text-muted)]">
                    General Medicine
                  </span>
                  <span className="font-semibold text-cream">
                    ₹499 consultation
                  </span>
                </div>
              </div>

              {/* Doctor / Nurse response match */}
              <div className="rounded-2xl border-2 border-[var(--accent)]/40 bg-[var(--surface)] p-4 shadow-soft relative">
                <div className="flex items-center justify-between text-xs text-[var(--text-muted)] mb-2">
                  <span className="font-semibold text-status-ok uppercase tracking-wider text-[10px]">
                    Direct Match Ready
                  </span>
                  <span className="h-2 w-2 rounded-full bg-status-ok animate-ping" />
                </div>
                <div className="flex items-center gap-3 mt-1">
                  <div className="h-11 w-11 rounded-xl bg-tan/20 border border-tan/30 grid place-items-center font-serif text-lg font-bold text-cream">
                    Dr
                  </div>
                  <div>
                    <p className="font-semibold text-sm text-[var(--text)]">
                      Dr. Ananya Sharma, MD
                    </p>
                    <p className="text-xs text-[var(--text-muted)]">
                      General Physician • 8 yrs exp • Available today
                    </p>
                  </div>
                </div>
              </div>

              {/* Home Nurse Service Card */}
              <div className="rounded-2xl border border-[#2F7BC4]/30 bg-[#2F7BC4]/5 p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <Stethoscope className="h-4 w-4 text-[#2F7BC4]" />
                    <span className="text-xs font-semibold text-[#2F7BC4]">
                      Home Care Nurse Support
                    </span>
                  </div>
                  <span className="text-xs font-medium text-[var(--text-muted)]">
                    Vitals &amp; Dressing
                  </span>
                </div>
              </div>
            </div>
          </div>
        </motion.div>
      </div>

      {/* Subtle Scroll Cue */}
      <div className="relative z-10 flex flex-col items-center gap-2 text-[var(--text-faint)] mt-8">
        <span className="text-[10px] uppercase tracking-widest font-semibold">
          Scroll to explore Doceeto
        </span>
        <div className="w-px h-6 bg-gradient-to-b from-[var(--text-faint)] to-transparent" />
      </div>
    </section>
  );
}
