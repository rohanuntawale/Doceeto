"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { ArrowRight } from "lucide-react";

/**
 * The closing section: a single luminous invitation, then the brand itself.
 *
 * ── The shape ──
 *
 * One headline, one button, and the wordmark set enormous along the bottom
 * edge, cropped mid-letter by the section's end. The crop is the point — a
 * word too large to fit reads as a signature rather than another line of copy,
 * and it gives the page a full stop that copy alone can't.
 *
 * ── The light ──
 *
 * The reference for this section glowed from the centre out. Here that glow is
 * built from the theme rather than a flat colour: the deep forest band carries
 * a wide mint-green bloom (the logo's own greens) with a thin gold pass —
 * the logo's second colour — so the section reads as the brand palette lit
 * from within, not as a tinted copy of someone else's page.
 *
 * ── What happened to the triple CTA ──
 *
 * The old version stacked three buttons here (patient / doctor / nurse). The
 * hero already carries the provider paths as full-size buttons, so this close
 * keeps ONE loud door — care — and leaves the provider routes as quiet text
 * links underneath. A closing section that asks three questions isn't a close.
 */
export function LandingFinalCta() {
  return (
    /* The page closes on the same forest green it opened under, curving up
       out of the paper one last time. */
    <section id="start" className="relative bg-[var(--bg)]">
      {/* Rounded on BOTH ends now — the band is a card floating on the page,
          and a card whose top is curved and whose bottom runs square reads as
          unfinished. The mb puts a sliver of canvas under the bottom curve so
          the corner is actually visible against the footer instead of merging
          into it. */}
      <div className="forest-band relative mb-3 overflow-hidden rounded-[2rem] pt-28 pb-44 sm:mb-4 sm:rounded-[3rem] sm:pt-36 sm:pb-56 lg:rounded-[4.5rem]">
        {/* ── Ambient light ──
            Layered radials, brightest low-centre exactly where the reference
            puts its bloom: a broad mint core, a wider forest wash behind it,
            and one thin warm gold breath so the second brand colour is present
            in the light itself. The top corners stay dark, which is what makes
            the middle read as lit rather than merely lighter. */}
        <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
          {/* Alphas kept low on purpose: the first pass washed the whole band
              toward mid-green because the big bloom sat at 0.85 — the glow was
              repainting the background instead of lighting it. Tighter and
              dimmer, the deep forest base does most of the talking and the
              bloom is just the lamp behind the button. */}
          <div className="absolute left-1/2 top-[64%] h-[700px] w-[1000px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[rgb(var(--c-forest-600)/0.4)] blur-[140px]" />
          <div className="absolute left-1/2 top-[70%] h-[420px] w-[620px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[rgb(var(--c-forest-mint)/0.18)] blur-[120px]" />
          <div className="absolute left-[58%] top-[82%] h-[260px] w-[480px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[rgb(var(--c-tan)/0.1)] blur-[110px]" />
          {/* Vignettes at both curved ends, holding the edges deep. */}
          <div className="absolute inset-x-0 top-0 h-48 bg-gradient-to-b from-black/30 to-transparent" />
          <div className="absolute inset-x-0 bottom-0 h-40 bg-gradient-to-t from-black/25 to-transparent" />
          <div className="absolute inset-0 pattern-dots opacity-[0.06]" />
        </div>

        <div className="relative z-10 mx-auto max-w-4xl px-6 text-center">
          <motion.h2
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.7 }}
            className="font-serif text-[clamp(2.4rem,5.5vw,4.75rem)] font-extrabold leading-[1.08] tracking-tight text-[var(--text)]"
          >
            Your health deserves <br className="hidden sm:block" />
            the right front door.
          </motion.h2>

          {/* The one button. Outline pill with its own halo — on this dark
              band a glowing edge reads louder than a filled block, exactly as
              in the reference. */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="mt-12"
          >
            <Link
              href="/signup"
              className="group inline-flex items-center gap-2.5 rounded-full border border-paper/60 bg-paper/[0.06] px-10 py-4 text-base font-semibold text-paper shadow-[0_0_0_1px_rgb(var(--c-forest-mint)/0.25),0_0_44px_rgb(var(--c-forest-mint)/0.3)] backdrop-blur-sm transition-all duration-300 hover:-translate-y-0.5 hover:border-paper hover:bg-paper/10 hover:shadow-[0_0_0_1px_rgb(var(--c-forest-mint)/0.4),0_0_64px_rgb(var(--c-forest-mint)/0.45)]"
            >
              Get started
              <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
            </Link>
          </motion.div>

          {/* Provider routes, demoted to a whisper — the hero already shouts
              them. Kept so a clinician reaching the end still has a door. */}
          <motion.p
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6, delay: 0.35 }}
            className="mt-7 text-sm text-[var(--text-muted)]"
          >
            <Link href="/signup?as=doctor" className="underline-offset-4 transition-colors hover:text-[var(--text)] hover:underline">
              I&apos;m a doctor
            </Link>
            <span aria-hidden className="mx-3 opacity-40">·</span>
            <Link href="/signup?as=nurse" className="underline-offset-4 transition-colors hover:text-[var(--text)] hover:underline">
              I&apos;m a nurse
            </Link>
          </motion.p>
        </div>

        {/* ── The signature ──
            The wordmark, set too large to fit and cropped by the bottom edge.
            translate-y pushes roughly a third of the letterforms below the
            fold; the band's overflow-hidden does the cutting. "care" sits
            light against it the way the reference floats its second word.
            aria-hidden + select-none: it is a picture of the brand, not text
            anyone should read out or copy. */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 bottom-0 z-0 translate-y-[32%] select-none px-[3vw]"
        >
          {/* SVG, not sized text. A vw-clamped font is a guess about glyph
              widths, and at wide viewports the guess ran past the band and
              cropped the d and the o unevenly at the edges. textLength makes
              the geometry a statement instead: the word is exactly this wide,
              centred, at every viewport — the only crop left is the vertical
              one we do on purpose. */}
          <svg viewBox="0 0 760 190" className="w-full" preserveAspectRatio="xMidYMax meet">
            <text
              x="380"
              y="152"
              textAnchor="middle"
              textLength="720"
              lengthAdjust="spacingAndGlyphs"
              className="font-serif font-bold"
              style={{ fontSize: 172, letterSpacing: "-0.02em" }}
              fill="rgb(var(--c-forest-paper) / 0.09)"
            >
              Doc
              <tspan fill="rgb(var(--c-tan) / 0.16)">ee</tspan>
              to
            </text>
          </svg>
        </div>
      </div>
    </section>
  );
}
