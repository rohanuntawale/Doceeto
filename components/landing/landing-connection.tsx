"use client";

import { motion } from "framer-motion";
import { ArrowRight, User, Stethoscope, ShieldCheck, Heart } from "lucide-react";

export function LandingConnection() {
  return (
    <section id="how-it-works" className="relative overflow-hidden bg-[var(--surface)] py-28 sm:py-36 border-y-2 border-[var(--border)]">
      <div className="mx-auto max-w-7xl px-6">
        <div className="grid gap-16 lg:grid-cols-[0.9fr_1.1fr] lg:items-center">
          {/* Left Narrative Column */}
          <div className="max-w-xl">
            <span className="label border-l-2 border-[var(--accent)] pl-3 text-xs tracking-[0.2em] mb-4 inline-block">
              03 / HOW IT WORKS
            </span>

            <h2 className="text-4xl sm:text-5xl font-serif font-bold tracking-tight text-[var(--text)] leading-tight">
              A single connection bridging patient need and clinical expertise.
            </h2>

            <div className="mt-8 space-y-6 text-lg leading-relaxed text-[var(--text-muted)] font-sans">
              <p>
                Whether you need urgent consultation or specialized home nursing, your request enters Doceeto&apos;s intelligent matching ring.
              </p>
              <p>
                Practitioners see structured patient requirements in real-time, accept consultations directly, and provide verified care — eliminating middleman delays.
              </p>
            </div>

            <div className="mt-10 grid grid-cols-2 gap-6 pt-6 border-t border-[var(--border)]">
              <div>
                <div className="font-serif text-2xl font-bold text-[var(--accent)]">Direct Door</div>
                <div className="text-xs text-[var(--text-muted)] mt-1">Single signup portal for all roles</div>
              </div>
              <div>
                <div className="font-serif text-2xl font-bold text-tan">Verified Care</div>
                <div className="text-xs text-[var(--text-muted)] mt-1">Certified state registration checks</div>
              </div>
            </div>
          </div>

          {/* Right SVG Connection Diagram Box */}
          <div className="relative overflow-hidden rounded-[2.5rem] border-2 border-[var(--border)] bg-[var(--bg)]/90 p-8 shadow-card">
            {/* Ambient backdrop glow */}
            <div className="absolute inset-0 opacity-30 pointer-events-none" style={{ background: "radial-gradient(circle at 50% 50%, rgba(190,100,45,0.15), transparent 70%)" }} aria-hidden />

            <div className="relative z-10 flex flex-col items-center">
              <div className="w-full flex items-center justify-between text-xs font-mono text-[var(--text-faint)] mb-6 border-b border-[var(--border)] pb-4">
                <span>CONNECTION FLOW</span>
                <span className="flex items-center gap-1 text-status-ok"><ShieldCheck className="w-3.5 h-3.5" /> E2E Encrypted</span>
              </div>

              {/* Animated Connection Diagram Nodes */}
              <div className="w-full grid grid-cols-3 gap-4 items-center text-center my-6">
                {/* Node 1: Patient Need */}
                <motion.div
                  initial={{ opacity: 0, scale: 0.9 }}
                  whileInView={{ opacity: 1, scale: 1 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.5 }}
                  className="flex flex-col items-center p-4 rounded-2xl border border-[var(--border)] bg-[var(--surface)] shadow-soft"
                >
                  <div className="h-12 w-12 rounded-full bg-[var(--accent)]/15 border border-[var(--accent)]/30 grid place-items-center mb-3">
                    <User className="h-6 w-6 text-[var(--accent)]" />
                  </div>
                  <span className="font-serif text-sm font-bold text-[var(--text)]">Patient</span>
                  <span className="text-[11px] text-[var(--text-muted)] mt-1">Express Need</span>
                </motion.div>

                {/* Node 2: Doceeto Engine (Center Node) */}
                <motion.div
                  initial={{ opacity: 0, scale: 0.9 }}
                  whileInView={{ opacity: 1, scale: 1 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.5, delay: 0.2 }}
                  className="flex flex-col items-center p-5 rounded-2xl border-2 border-[var(--accent)] bg-[var(--surface)] shadow-card relative"
                >
                  <div className="absolute -top-3 rounded-full bg-[var(--accent)] text-[var(--c-on-accent)] px-2.5 py-0.5 text-[9px] font-extrabold uppercase tracking-wider">
                    Core Ring
                  </div>
                  <div className="h-14 w-14 rounded-full bg-[var(--accent)] grid place-items-center mb-2 text-white shadow-glow">
                    <Heart className="h-7 w-7 text-white fill-white animate-pulse" />
                  </div>
                  <span className="font-serif text-base font-extrabold text-[var(--text)]">Doceeto</span>
                  <span className="text-[11px] text-[var(--text-muted)] mt-0.5">Match &amp; Direct</span>
                </motion.div>

                {/* Node 3: Medical Expertise */}
                <motion.div
                  initial={{ opacity: 0, scale: 0.9 }}
                  whileInView={{ opacity: 1, scale: 1 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.5, delay: 0.4 }}
                  className="flex flex-col items-center p-4 rounded-2xl border border-[var(--border)] bg-[var(--surface)] shadow-soft"
                >
                  <div className="h-12 w-12 rounded-full bg-[#2F7BC4]/15 border border-[#2F7BC4]/30 grid place-items-center mb-3">
                    <Stethoscope className="h-6 w-6 text-[#2F7BC4]" />
                  </div>
                  <span className="font-serif text-sm font-bold text-[var(--text)]">Practitioner</span>
                  <span className="text-[11px] text-[var(--text-muted)] mt-1">Doctor / Nurse</span>
                </motion.div>
              </div>

              {/* Connecting Animation Bar */}
              <div className="w-full relative h-2 bg-espresso-700 rounded-full overflow-hidden my-4 border border-[var(--border)]">
                <div className="absolute inset-y-0 left-0 w-1/3 bg-gradient-to-r from-[var(--accent)] via-tan to-[#2F7BC4] rounded-full animate-marquee-left" />
              </div>

              {/* Workflow Steps Bullet Points */}
              <div className="w-full grid sm:grid-cols-3 gap-3 mt-4 text-xs text-[var(--text-muted)]">
                <div className="p-3 rounded-xl border border-[var(--border)] bg-[var(--surface)]">
                  <span className="font-mono font-bold text-[var(--accent)] block mb-1">01. REQUEST</span>
                  Patient posts symptoms &amp; location
                </div>
                <div className="p-3 rounded-xl border border-[var(--border)] bg-[var(--surface)]">
                  <span className="font-mono font-bold text-tan block mb-1">02. ROUTE</span>
                  Matched to nearest doctor or nurse
                </div>
                <div className="p-3 rounded-xl border border-[var(--border)] bg-[var(--surface)]">
                  <span className="font-mono font-bold text-[#2F7BC4] block mb-1">03. CARE</span>
                  Consultation &amp; medicine delivered
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
