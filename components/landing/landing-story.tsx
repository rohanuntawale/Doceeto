"use client";

import { useEffect, useRef, useState } from "react";
import { motion, useInView } from "framer-motion";
import { MaskedHeading } from "@/components/ui/masked-heading";

/** The manifesto statements, read as type cut out of the brand texture.
 *  MaskedHeading takes plain strings — the emphasis that used to be carried
 *  by coloured spans is now carried by the media showing through the words. */
const STATEMENTS = [
  "Healthcare starts with a need.",
  "Expertise starts with a practitioner.",
  "Doceeto brings the two directly together.",
];

/**
 * MaskedHeading sizes type as a fraction of its container width — a straight
 * line. The manifesto's original `clamp(2.2rem, 5.5vw, 4.5rem)` is not, so
 * solve for the fraction that reproduces that clamp at the current viewport.
 * Without this the statements shrink well below the design on phones.
 */
function useManifestoTextScale() {
  const [scale, setScale] = useState(0.07);

  useEffect(() => {
    const measure = () => {
      const vw = window.innerWidth;
      const px = Math.min(72, Math.max(35.2, vw * 0.055));
      // The statements sit in a max-w-5xl block inside a max-w-6xl px-6 column.
      const width = Math.min(1024, Math.min(1152, vw) - 48);
      setScale(px / Math.max(1, width));
    };
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, []);

  return scale;
}

export function LandingStory() {
  const containerRef = useRef<HTMLDivElement>(null);
  const isInView = useInView(containerRef, { once: true, margin: "-100px" });
  const textScale = useManifestoTextScale();

  return (
    /* The forest band the hero panel curves away to reveal — the manifesto is
       read against the brand green, in bone. `.forest-band` re-points the text
       tokens, so everything below styles itself for the dark ground. */
    <section
      id="story"
      className="forest-band relative overflow-hidden pb-16 pt-28 sm:pb-20 sm:pt-36"
    >
      {/* Background brutalist typography watermark */}
      <div
        className="absolute inset-0 flex items-center overflow-hidden opacity-[0.05] pointer-events-none select-none"
        aria-hidden="true"
      >
        <motion.div
          className="flex shrink-0 whitespace-nowrap"
          animate={{ x: ["0%", "-50%"] }}
          transition={{
            duration: 100,
            ease: "linear",
            repeat: Infinity,
          }}
        >
          <span className="font-serif text-[55vw] sm:text-[42vw] md:text-[34vw] lg:text-[28vw] font-extrabold leading-none text-[var(--text)] tracking-tighter pr-[12vw]">
            DOCEETO
          </span>

          <span className="font-serif text-[55vw] sm:text-[42vw] md:text-[34vw] lg:text-[28vw] font-extrabold leading-none text-[var(--text)] tracking-tighter pr-[12vw]">
            DOCEETO
          </span>

          <span className="font-serif text-[55vw] sm:text-[42vw] md:text-[34vw] lg:text-[28vw] font-extrabold leading-none text-[var(--text)] tracking-tighter pr-[12vw]">
            DOCEETO
          </span>

          <span className="font-serif text-[55vw] sm:text-[42vw] md:text-[34vw] lg:text-[28vw] font-extrabold leading-none text-[var(--text)] tracking-tighter pr-[12vw]">
            DOCEETO
          </span>
        </motion.div>
      </div>

      {/* A single low glow so the flat green has depth behind the type */}
      <div className="absolute inset-0 pointer-events-none" aria-hidden="true">
        <div className="absolute -top-40 left-1/2 -translate-x-1/2 w-[900px] h-[520px] rounded-full bg-[rgb(var(--c-forest-600)/0.55)] blur-[140px]" />
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
          <div className="space-y-6 max-w-5xl w-full">
            {STATEMENTS.map((statement, i) => (
              <MaskedHeading
                key={statement}
                text={statement}
                tag="h2"
                src="/brand/manifesto-fill.svg"
                className="font-serif"
                align="left"
                /* The last line is the payoff, so it keeps its heavier cut. */
                weight={i === STATEMENTS.length - 1 ? 800 : 700}
                tracking={-0.025}
                lineHeight={1.08}
                textScale={textScale}
                fillScale={1.4}
                parallax={30}
                drift={14}
                reveal="rise"
                trigger="view"
                replay
                duration={1}
                stagger={0.07}
              />
            ))}
          </div>

          {/* Explanation paragraph */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={isInView ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: 0.6, delay: 0.65 }}
            className="grid lg:grid-cols-2 gap-8 pt-6 border-t border-[var(--border)] w-full text-[var(--text-muted)] text-lg leading-relaxed font-sans"
          >
            <p>
              Traditional healthcare booking forces patients into opaque
              directory searches, clinic call loops, and layered gatekeeping.
              Doceeto replaces friction with direct connection.
            </p>
            <p>
              Whether you are a patient needing home care or a doctor/nurse
              publishing your practice schedule, Doceeto provides a singular,
              transparent front door to care across India.
            </p>
          </motion.div>
        </div>
      </div>
    </section>
  );
}
