"use client";

import { useRef } from "react";
import { motion, useInView } from "framer-motion";

/**
 * The three headline figures that close the hero panel.
 *
 * These are properties of the platform itself, not traction claims — Doceeto
 * has no published usage numbers, and a landing page is the wrong place to
 * invent them. Each one restates a promise the page already makes above.
 */
const STATS = [
  { value: "₹0", label: "Upfront booking fees" },
  { value: "24/7", label: "Care requests accepted" },
  { value: "3 Roles", label: "Patients · Doctors · Nurses" },
];

export function LandingHeroStats() {
  const ref = useRef<HTMLDivElement>(null);
  const isInView = useInView(ref, { once: true, margin: "-80px" });

  return (
    <div ref={ref} className="mx-auto w-full max-w-7xl px-6">
      {/* Scrub rail — the hairline with a knob riding its left end. Purely
          decorative pacing between the hero card and the figures. */}
      <div className="relative h-4" aria-hidden="true">
        <motion.div
          initial={{ scaleX: 0 }}
          animate={isInView ? { scaleX: 1 } : {}}
          transition={{ duration: 1.1, ease: [0.16, 1, 0.3, 1] }}
          className="absolute inset-x-0 top-1/2 h-px origin-left bg-[var(--border)]"
        />
        <motion.span
          initial={{ opacity: 0, x: -12 }}
          animate={isInView ? { opacity: 1, x: 0 } : {}}
          transition={{ duration: 0.6, delay: 0.15 }}
          className="absolute left-0 top-1/2 -translate-y-1/2 h-4 w-4 rounded-full border-2 border-[rgb(var(--accent-rgb)/0.45)] bg-[var(--surface)] shadow-soft"
        />
        <motion.span
          initial={{ opacity: 0 }}
          animate={isInView ? { opacity: 1 } : {}}
          transition={{ duration: 0.6, delay: 0.5 }}
          className="absolute left-[32%] top-1/2 -translate-y-1/2 h-1.5 w-1.5 rounded-full bg-[rgb(var(--accent-rgb)/0.35)]"
        />
      </div>

      <dl className="mt-10 grid grid-cols-1 gap-10 sm:grid-cols-3 sm:gap-8">
        {STATS.map((stat, idx) => (
          <motion.div
            key={stat.value}
            initial={{ opacity: 0, y: 24 }}
            animate={isInView ? { opacity: 1, y: 0 } : {}}
            transition={{
              duration: 0.6,
              delay: 0.15 + idx * 0.12,
              ease: [0.16, 1, 0.3, 1],
            }}
          >
            <dt className="font-sans text-[clamp(2.6rem,5.4vw,4.25rem)] font-extrabold leading-[0.95] tracking-[-0.035em] text-[var(--text)]">
              {stat.value}
            </dt>
            <dd className="mt-2 text-sm sm:text-base text-[var(--text-muted)]">
              {stat.label}
            </dd>
          </motion.div>
        ))}
      </dl>
    </div>
  );
}
