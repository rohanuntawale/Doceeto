"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import {
  ArrowRight,
  HeartHandshake,
  UserCheck,
  Stethoscope,
  CheckCircle2,
} from "lucide-react";
import { Button } from "@/components/ui/button";

export function LandingTwoSides() {
  return (
    /* Mirror of the hero: the page returns to paper here, curving back up
       out of the manifesto's forest band. */
    <section id="patient-doctor" className="relative bg-forest">
      <div className="paper-panel-up rounded-t-[2rem] sm:rounded-t-[3rem] lg:rounded-t-[4.5rem] py-28 sm:py-36">
        <div className="mx-auto max-w-7xl px-6">
          {/* Section Header */}
          <div className="flex flex-col items-start max-w-3xl mb-16">
            <span className="label border-l-2 border-[var(--accent)] pl-3 text-xs tracking-[0.2em] mb-3">
              02 / THREE ROLES, ONE PLATFORM
            </span>
            <h2 className="font-serif text-4xl sm:text-5xl font-bold tracking-tight text-[var(--text)] leading-tight">
              Designed for patients, doctors, and nurses alike.
            </h2>
            <p className="mt-4 text-lg text-[var(--text-muted)] leading-relaxed">
              Doceeto eliminates fragmented onboarding. Pick your role to enter
              your dedicated experience through a unified door.
            </p>
          </div>

          {/* Asymmetric 3-Role Brutalist Card Grid */}
          <div className="grid gap-8 lg:grid-cols-12 items-stretch">
            {/* Card 1: Patient Role (Featured Color-Block Terracotta Card - Spans 7 Cols) */}
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6 }}
              className="lg:col-span-7 rounded-[2.5rem] border-2 border-transparent bg-[var(--accent)] p-8 sm:p-10 text-on-accent flex flex-col justify-between shadow-card relative overflow-hidden group"
            >
              <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full blur-3xl pointer-events-none" />

              <div>
                <div className="flex items-center justify-between mb-6">
                  <span className="inline-flex items-center gap-2 rounded-full bg-white/20 backdrop-blur-md px-3.5 py-1 text-xs font-semibold uppercase tracking-wider text-white">
                    <HeartHandshake className="w-4 h-4" /> For Patients
                  </span>
                  <span className="text-xs font-mono font-bold text-white/80">
                    ROLE 01
                  </span>
                </div>

                <h3 className="font-serif text-3xl sm:text-4xl font-extrabold tracking-tight leading-tight text-white">
                  Start with what you need. <br />
                  Care comes directly to you.
                </h3>

                <p className="mt-5 text-base sm:text-lg text-white/90 leading-relaxed max-w-xl font-sans">
                  Express symptoms, view certified doctors and home-visit nurses
                  in your area, and book care without navigating confusing
                  clinic phone systems.
                </p>

                <ul className="mt-6 space-y-2.5 text-sm text-white/95">
                  {[
                    "Clear upfront consultation pricing",
                    "Direct messaging with your assigned practitioner",
                    "Digital prescriptions delivered straight to your account",
                  ].map((item) => (
                    <li key={item} className="flex items-center gap-2.5">
                      <CheckCircle2 className="w-4 h-4 shrink-0 text-white" />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="mt-10 pt-6 border-t border-white/20">
                <Link href="/signup">
                  <Button
                    size="lg"
                    className="w-full sm:w-auto h-13 px-8 text-base font-bold bg-white text-[var(--accent)] hover:bg-white/95 shadow-md border-0 group"
                  >
                    I need care
                    <ArrowRight className="w-4 h-4 ml-2 transition-transform group-hover:translate-x-1" />
                  </Button>
                </Link>
              </div>
            </motion.div>

            {/* Right Column: Doctor & Nurse Roles (Spans 5 Cols) */}
            <div className="lg:col-span-5 flex flex-col gap-8">
              {/* Card 2: Doctor Role */}
              <motion.div
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.6, delay: 0.15 }}
                className="rounded-[2.5rem] border-2 border-[var(--border)] bg-[var(--surface)] p-8 flex flex-col justify-between shadow-card hover:border-[var(--accent)] transition-all duration-300 group"
              >
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <span className="inline-flex items-center gap-2 rounded-full bg-[rgb(var(--accent-rgb)/0.1)] px-3.5 py-1 text-xs font-semibold uppercase tracking-wider text-[var(--accent)] border border-[rgb(var(--accent-rgb)/0.2)]">
                      <UserCheck className="w-4 h-4" /> For Doctors
                    </span>
                    <span className="text-xs font-mono font-bold text-[var(--text-faint)]">
                      ROLE 02
                    </span>
                  </div>

                  <h3 className="font-serif text-2xl font-bold text-[var(--text)] tracking-tight">
                    Put your practice directly in patients&apos; hands.
                  </h3>

                  <p className="mt-3 text-sm text-[var(--text-muted)] leading-relaxed">
                    Publish your credentials, set consultation fees, and accept
                    verified patient requests on your schedule.
                  </p>
                </div>

                <div className="mt-6 pt-4 border-t border-[var(--border)]">
                  <Link href="/signup?as=doctor">
                    <Button
                      variant="outline"
                      size="lg"
                      className="w-full h-12 text-sm font-semibold border-2 border-[var(--border)] text-[var(--text)] hover:border-[var(--accent)] hover:bg-[rgb(var(--accent-rgb)/0.1)]"
                    >
                      I&apos;m a doctor →
                    </Button>
                  </Link>
                </div>
              </motion.div>

              {/* Card 3: Nurse Role */}
              <motion.div
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.6, delay: 0.3 }}
                className="rounded-[2.5rem] border-2 border-[#2F7BC4]/40 bg-[#2F7BC4]/5 p-8 flex flex-col justify-between shadow-card hover:border-[#2F7BC4] transition-all duration-300 group"
              >
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <span className="inline-flex items-center gap-2 rounded-full bg-[#2F7BC4]/15 px-3.5 py-1 text-xs font-semibold uppercase tracking-wider text-[#2F7BC4] border border-[#2F7BC4]/30">
                      <Stethoscope className="w-4 h-4" /> For Home Nurses
                    </span>
                    <span className="text-xs font-mono font-bold text-[var(--text-faint)]">
                      ROLE 03
                    </span>
                  </div>

                  <h3 className="font-serif text-2xl font-bold text-[var(--text)] tracking-tight">
                    Deliver expert nursing &amp; home care.
                  </h3>

                  <p className="mt-3 text-sm text-[var(--text-muted)] leading-relaxed">
                    Provide essential home-visit care including dressing,
                    vitals, post-op support, and elderly assistance.
                  </p>
                </div>

                <div className="mt-6 pt-4 border-t border-[#2F7BC4]/30">
                  <Link href="/signup?as=nurse">
                    <Button
                      variant="outline"
                      size="lg"
                      className="w-full h-12 text-sm font-semibold border-2 border-[#2F7BC4]/60 text-[#2F7BC4] hover:bg-[#2F7BC4] hover:text-white transition-colors"
                    >
                      I&apos;m a nurse →
                    </Button>
                  </Link>
                </div>
              </motion.div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
