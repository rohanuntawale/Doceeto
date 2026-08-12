"use client";

import { motion } from "framer-motion";

/**
 * The route a request travels, written out rather than diagrammed.
 *
 * This used to be a three-box flow chart with arrows and a progress bar, which
 * is the shape every product page reaches for. The panel is an arch instead —
 * the same doorway the logo is drawn as, and the thing the whole page promises
 * ("the front door to care"), so the section's own idea carries the visual
 * rather than a generic diagram sitting beside it.
 */
const STEPS = [
  {
    n: "01",
    title: "Say what you need",
    body: "Symptoms, where you are, and when. Not a form that reads like paperwork.",
  },
  {
    n: "02",
    title: "It reaches a practitioner",
    body: "A verified doctor or home nurse nearby sees the request and takes it themselves.",
  },
  {
    n: "03",
    title: "Care arrives",
    body: "The consult, the home visit, and the prescription that follows — in one place.",
  },
];

export function LandingConnection() {
  return (
    <section
      id="how-it-works"
      className="relative overflow-hidden bg-[var(--surface)] py-28 sm:py-36 border-y-2 border-[var(--border)]"
    >
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
                Whether you need urgent consultation or specialized home
                nursing, your request enters Doceeto&apos;s intelligent matching
                ring.
              </p>
              <p>
                Practitioners see structured patient requirements in real-time,
                accept consultations directly, and provide verified care —
                eliminating middleman delays.
              </p>
            </div>

            <div className="mt-10 grid grid-cols-2 gap-6 pt-6 border-t border-[var(--border)]">
              <div>
                <div className="font-serif text-2xl font-bold text-[var(--accent)]">
                  Direct Door
                </div>
                <div className="text-xs text-[var(--text-muted)] mt-1">
                  Single signup portal for all roles
                </div>
              </div>
              <div>
                <div className="font-serif text-2xl font-bold text-salmon">
                  Verified Care
                </div>
                <div className="text-xs text-[var(--text-muted)] mt-1">
                  Certified state registration checks
                </div>
              </div>
            </div>
          </div>

          {/* Right: the doorway */}
          <div className="relative flex justify-center lg:justify-end">
            {/* Light spilling from behind the arch, so it reads as an opening
                rather than a shape. */}
            <div
              aria-hidden
              className="pointer-events-none absolute -top-10 left-1/2 h-[26rem] w-[26rem] -translate-x-1/2 rounded-full bg-[rgb(var(--accent-rgb)/0.10)] blur-[90px] lg:left-auto lg:right-16 lg:translate-x-0"
            />

            <motion.div
              initial={{ opacity: 0, y: 28 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-80px" }}
              transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
              /* max-w-xs is 20rem, so a 10rem top radius is exactly half the
                 width — a true semicircle, not a rounded rectangle. */
              className="relative w-full max-w-xs rounded-t-[10rem] rounded-b-xl border border-[var(--border)] bg-[var(--bg)] px-7 pb-7 pt-16 shadow-soft"
            >
              {/* Keystone — the gold dot from the mark, at the apex */}
              <span
                aria-hidden
                className="absolute left-1/2 top-6 h-1.5 w-1.5 -translate-x-1/2 rounded-full bg-tan"
              />
              {/* Inner reveal line following the arch */}
              <span
                aria-hidden
                className="pointer-events-none absolute inset-x-3.5 top-3.5 bottom-3.5 rounded-t-[8.75rem] rounded-b-lg border border-[rgb(var(--accent-rgb)/0.14)]"
              />

              <p className="relative text-center text-[9px] font-semibold uppercase tracking-[0.3em] text-[var(--text-faint)]">
                The route
              </p>

              <ol className="relative mt-8 space-y-5">
                {STEPS.map((step, i) => (
                  <motion.li
                    key={step.n}
                    initial={{ opacity: 0, y: 14 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true, margin: "-60px" }}
                    transition={{ duration: 0.5, delay: 0.25 + i * 0.12 }}
                    className={
                      i > 0 ? "border-t border-[var(--border)] pt-5" : undefined
                    }
                  >
                    <div className="flex items-baseline gap-3">
                      <span className="font-serif text-xl font-medium leading-none text-[var(--accent)]">
                        {step.n}
                      </span>
                      <span
                        aria-hidden
                        className="h-px flex-1 bg-[rgb(var(--accent-rgb)/0.25)]"
                      />
                    </div>
                    <h3 className="mt-2 font-serif text-base font-bold tracking-tight text-[var(--text)]">
                      {step.title}
                    </h3>
                    <p className="mt-1 text-xs leading-relaxed text-[var(--text-muted)]">
                      {step.body}
                    </p>
                  </motion.li>
                ))}
              </ol>

              {/* The threshold you step over */}
              <div className="relative mt-7">
                <span
                  aria-hidden
                  className="block h-0.5 w-full rounded-full bg-tan/70"
                />
                <p className="mt-2.5 text-center text-[9px] font-semibold uppercase tracking-[0.3em] text-[var(--text-faint)]">
                  At your door
                </p>
              </div>
            </motion.div>
          </div>
        </div>
      </div>
    </section>
  );
}
