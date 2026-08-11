"use client";

import { useRef } from "react";
import { motion, useInView } from "framer-motion";
import { LandingTicker } from "./landing-ticker";

export function LandingStory() {
  const containerRef = useRef<HTMLDivElement>(null);
  const isInView = useInView(containerRef, { once: true, margin: "-100px" });

  return (
    <section id="story" className="relative overflow-hidden bg-[var(--surface)] py-28 sm:py-36 border-t-2 border-b-2 border-[var(--border)]">
      {/* Background brutalist typography watermark */}
      <div
        className="absolute inset-0 flex items-center justify-center overflow-hidden opacity-[0.03] pointer-events-none select-none"
        aria-hidden="true"
      >
        <span className="font-serif text-[28vw] font-extrabold leading-none text-[var(--text)] tracking-tighter">
          DOCEETO
        </span>
      </div>

      <div ref={containerRef} className="relative z-10 mx-auto max-w-6xl px-6">
        <div className="flex flex-col items-start space-y-12">
          {/* Label */}
          <motion.span
            initial={{ opacity: 0, x: -20 }}
            animate={isInView ? { opacity: 1, x: 0 } : {}}
            transition={{ duration: 0.5 }}
            className="label border-l-2 border-[var(--accent)] pl-3 text-xs tracking-[0.2em]"
          >
            01 / THE MANIFESTO
          </motion.span>

          {/* Editorial Headline Statement Sequence */}
          <div className="space-y-6 max-w-5xl">
            <motion.h2
              initial={{ opacity: 0, y: 30 }}
              animate={isInView ? { opacity: 1, y: 0 } : {}}
              transition={{ duration: 0.7, delay: 0.1 }}
              className="font-serif text-[clamp(2.2rem,5.5vw,4.5rem)] font-bold tracking-tight text-[var(--text)] leading-[1.08]"
            >
              Healthcare starts with a <span className="italic text-[var(--accent)] font-normal">need</span>.
            </motion.h2>

            <motion.h2
              initial={{ opacity: 0, y: 30 }}
              animate={isInView ? { opacity: 1, y: 0 } : {}}
              transition={{ duration: 0.7, delay: 0.3 }}
              className="font-serif text-[clamp(2.2rem,5.5vw,4.5rem)] font-bold tracking-tight text-[var(--text)] leading-[1.08]"
            >
              Expertise starts with a <span className="underline decoration-[var(--c-tan)] underline-offset-8">practitioner</span>.
            </motion.h2>

            <motion.h2
              initial={{ opacity: 0, y: 30 }}
              animate={isInView ? { opacity: 1, y: 0 } : {}}
              transition={{ duration: 0.7, delay: 0.5 }}
              className="font-serif text-[clamp(2.2rem,5.5vw,4.5rem)] font-extrabold tracking-tight text-[var(--text)] leading-[1.08]"
            >
              Doceeto brings the two <span className="text-[var(--accent)]">directly together</span>.
            </motion.h2>
          </div>

          {/* Explanation paragraph */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={isInView ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: 0.6, delay: 0.65 }}
            className="grid lg:grid-cols-2 gap-8 pt-6 border-t border-[var(--border)] w-full text-[var(--text-muted)] text-lg leading-relaxed font-sans"
          >
            <p>
              Traditional healthcare booking forces patients into opaque directory searches, clinic call loops, and layered gatekeeping. Doceeto replaces friction with direct connection.
            </p>
            <p>
              Whether you are a patient needing home care or a doctor/nurse publishing your practice schedule, Doceeto provides a singular, transparent front door to care across India.
            </p>
          </motion.div>
        </div>
      </div>

      {/* Infinite Care Ticker marquee */}
      <div className="mt-20">
        <LandingTicker />
      </div>
    </section>
  );
}
