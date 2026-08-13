"use client";

/**
 * The reviews rail — vertical video cards drifting past, on the brand's
 * forest band.
 *
 * ── Adding a video ──
 * Drop the file in /public/reviews and fill in the slot below:
 *
 *     { id: "r1", src: "/reviews/asha.mp4", name: "Asha M.", role: "Patient, Nagpur" }
 *
 * That is the whole job. A slot with a `src` renders the video (muted, looping,
 * inline — it has to autoplay on mobile); a slot without one renders the empty
 * frame, so the rail keeps its shape and rhythm while the shelf fills up.
 *
 * The slots are deliberately blank rather than seeded with sample quotes.
 * Invented reviews on a healthcare page are not a placeholder, they are a
 * fabricated endorsement, and they have a way of surviving to production.
 */

import Link from "next/link";
import { motion } from "framer-motion";
import { ArrowUpRight, Play } from "lucide-react";

type Review = {
  id: string;
  /** Video URL. Empty = an unfilled slot. */
  src?: string;
  /** Poster frame, shown while the video loads. */
  poster?: string;
  /** Shown under the video once there is one. */
  name?: string;
  role?: string;
};

const REVIEWS: Review[] = [
  { id: "r1" },
  { id: "r2" },
  { id: "r3" },
  { id: "r4" },
  { id: "r5" },
  { id: "r6" },
];

export function LandingTestimonials() {
  // The marquee translates by -50%, so the track has to be exactly two copies
  // for the loop to land on an identical frame.
  const track = [...REVIEWS, ...REVIEWS];

  return (
    <section
      id="reviews"
      className="forest-band relative overflow-hidden py-24 sm:py-32"
    >
      {/* Motion graphics: two slow blooms drifting behind the rail, so the
          flat green has depth and the section is never fully still. */}
      <div className="pointer-events-none absolute inset-0" aria-hidden>
        <div className="animate-float absolute -top-24 left-[8%] h-[26rem] w-[26rem] rounded-full bg-[rgb(var(--c-forest-600)/0.55)] blur-[130px]" />
        <div
          className="animate-float absolute -bottom-32 right-[4%] h-[30rem] w-[30rem] rounded-full bg-[rgb(var(--c-forest-mint)/0.10)] blur-[150px]"
          style={{ animationDelay: "-4.5s" }}
        />
        <div className="pattern-dots absolute inset-0 opacity-[0.06]" />
      </div>

      <div className="relative z-10 mx-auto max-w-7xl px-6">
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-80px" }}
          transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
          className="flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between"
        >
          <div>
            <span className="label border-l-2 border-[var(--accent)] pl-3 text-xs tracking-[0.2em]">
              03 / IN THEIR WORDS
            </span>
            <h2 className="mt-4 font-serif text-[clamp(2.5rem,6vw,4.5rem)] font-extrabold leading-[0.95] tracking-tight text-[var(--text)]">
              The reviews.
            </h2>
          </div>

          <Link
            href="/contact"
            className="group inline-flex shrink-0 items-center gap-2 self-start rounded-full border border-[var(--border)] px-6 py-3.5 text-xs font-semibold uppercase tracking-[0.18em] text-[var(--text)] transition-colors hover:border-[var(--accent)] hover:text-[var(--accent)] sm:self-auto"
          >
            Share your story
            <ArrowUpRight className="h-4 w-4 transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
          </Link>
        </motion.div>
      </div>

      {/* The rail. Full-bleed and dissolving at both ends, so it reads as
          something passing through rather than a row that stops. */}
      <motion.div
        initial={{ opacity: 0 }}
        whileInView={{ opacity: 1 }}
        viewport={{ once: true, margin: "-60px" }}
        transition={{ duration: 0.9, delay: 0.15 }}
        className="edge-fade-x relative z-10 mt-14 overflow-hidden"
      >
        <div
          className="animate-marquee-left flex w-max gap-5 hover:[animation-play-state:paused] sm:gap-6"
          style={{ animationDuration: "56s" }}
        >
          {track.map((review, i) => (
            <ReviewCard key={`${review.id}-${i}`} review={review} index={i} />
          ))}
        </div>
      </motion.div>

      <div className="relative z-10 mx-auto mt-12 max-w-7xl px-6">
        <p className="text-sm text-[var(--text-faint)]">
          Real patients, in their own words — the shelf fills as they come in.
        </p>
      </div>
    </section>
  );
}

function ReviewCard({ review, index }: { review: Review; index: number }) {
  const filled = Boolean(review.src);

  return (
    <figure
      className="relative aspect-[9/16] w-[14rem] shrink-0 overflow-hidden rounded-[1.75rem] border border-[var(--border)] bg-[rgb(var(--c-forest-800))] sm:w-[16rem]"
      // Nothing to announce for an empty frame.
      aria-hidden={!filled}
    >
      {filled ? (
        <video
          className="h-full w-full object-cover"
          src={review.src}
          poster={review.poster}
          autoPlay
          muted
          loop
          playsInline
        />
      ) : (
        <EmptySlot index={index} />
      )}

      {filled && (review.name || review.role) && (
        <figcaption className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/75 to-transparent px-4 pb-4 pt-10">
          {review.name && (
            <p className="text-sm font-semibold text-[var(--text)]">
              {review.name}
            </p>
          )}
          {review.role && (
            <p className="text-xs text-[var(--text-muted)]">{review.role}</p>
          )}
        </figcaption>
      )}
    </figure>
  );
}

/** An unfilled slot: a designed empty frame, not a broken one. */
function EmptySlot({ index }: { index: number }) {
  return (
    <>
      <span
        aria-hidden
        className="absolute inset-0 bg-[radial-gradient(120%_80%_at_50%_0%,rgb(var(--c-forest-mint)/0.12),transparent_70%)]"
      />
      <span aria-hidden className="absolute inset-0 grid place-items-center">
        <span className="grid h-14 w-14 place-items-center rounded-full border border-[rgb(var(--c-forest-paper)/0.22)]">
          <Play className="h-5 w-5 translate-x-[1px] text-[rgb(var(--c-forest-paper)/0.45)]" />
        </span>
      </span>
      {/* A light sweeping across the empty frame — the slot reads as waiting
          for something rather than as a hole in the page. Offset per card so
          the rail does not flash in unison. */}
      <span
        aria-hidden
        className="animate-sheen pointer-events-none absolute inset-0 bg-gradient-to-r from-transparent via-[rgb(var(--c-forest-paper)/0.07)] to-transparent"
        style={{ animationDelay: `${(index % 6) * 1.1}s` }}
      />
      {/* Caption plate, empty, holding the space a name will take. */}
      <span
        aria-hidden
        className="absolute inset-x-4 bottom-4 flex flex-col gap-1.5"
      >
        <span className="h-2 w-2/3 rounded-full bg-[rgb(var(--c-forest-paper)/0.10)]" />
        <span className="h-2 w-1/3 rounded-full bg-[rgb(var(--c-forest-paper)/0.07)]" />
      </span>
    </>
  );
}
