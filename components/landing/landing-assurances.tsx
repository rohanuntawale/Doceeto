"use client";

import { useRef } from "react";
import { motion, useInView } from "framer-motion";
import { BadgeCheck, ShieldCheck, Wallet } from "lucide-react";

/**
 * The three promises that used to be crammed under the hero buttons as a
 * single line of grey micro-copy, where they were too small to read and stole
 * the attention the buttons needed.
 *
 * They are worth more than a caption, so they get their own band: three glass
 * panes over the forest, each with room to say what it actually means.
 *
 * Real glassmorphism, matching the header pill, a translucent surface plus
 * backdrop-blur so the band genuinely refracts through, a hairline border for
 * the edge, and an inset top highlight for the catch light.
 */
const ASSURANCES = [
  {
    icon: ShieldCheck,
    title: "Instant role access",
    body: "Pick patient, doctor or nurse and you are in. No approval queue, no waiting on us to switch something on.",
  },
  {
    icon: Wallet,
    title: "No upfront booking fees",
    body: "You pay for the visit, nothing to reserve one. The fare is shown before you confirm, and there is no surge.",
  },
  {
    icon: BadgeCheck,
    title: "Verified practitioners",
    body: "Every doctor and nurse is checked against their council registration and qualifications before they can take a patient.",
  },
];

export function LandingAssurances() {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, margin: "-100px" });

  return (
    <section ref={ref} className="relative bg-forest py-16 sm:py-20">
      <div className="mx-auto w-full max-w-7xl px-6">
        <div className="grid gap-4 sm:grid-cols-3 sm:gap-5">
          {ASSURANCES.map((a, i) => (
            <motion.div
              key={a.title}
              initial={{ opacity: 0, y: 22 }}
              animate={inView ? { opacity: 1, y: 0 } : {}}
              transition={{
                duration: 0.6,
                delay: 0.08 * i,
                ease: [0.16, 1, 0.3, 1],
              }}
              className="group relative overflow-hidden rounded-2xl border border-white/15 bg-white/[0.07] p-5 shadow-[inset_0_1px_0_rgb(255_255_255/0.18),0_12px_40px_rgb(0_0_0/0.18)] backdrop-blur-xl backdrop-saturate-150 transition-colors duration-300 hover:bg-white/[0.11] sm:p-6"
            >
              {/* catch light along the top edge */}
              <span
                aria-hidden
                className="pointer-events-none absolute inset-x-6 top-0 h-px bg-gradient-to-r from-transparent via-white/45 to-transparent"
              />

              <span className="grid h-10 w-10 place-items-center rounded-xl border border-white/20 bg-white/10 text-paper">
                <a.icon className="h-[18px] w-[18px]" strokeWidth={1.75} />
              </span>

              <h3 className="mt-4 font-sans text-[15px] font-semibold tracking-[-0.01em] text-paper">
                {a.title}
              </h3>
              <p className="mt-1.5 text-[13.5px] leading-relaxed text-paper/70">
                {a.body}
              </p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
