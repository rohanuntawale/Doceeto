"use client";

import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";

/**
 * Three cuts of the same film, so nobody downloads pixels they cannot see.
 *
 * A single 4K file would be the simple answer and the wrong one. This product's
 * visitors are largely on Indian 4G, the section is decorative, and 16 MB is
 * indefensible on a phone that renders it 390px wide. Equally, a 720p master
 * stretched across a 1232px plate on a retina laptop is the softness that
 * started this: the browser is asked for ~2464 device pixels and given 1280.
 *
 * So the master is 4K for the screens that resolve it, 1440p for ordinary
 * laptops and metered links, and phones get a DEDICATED PORTRAIT CUT rather
 * than a landscape frame with two thirds of its width thrown away by
 * object-cover — same footage, reframed on the action, a fifth of the bytes.
 */
const SOURCES = {
  uhd: "/landing/care-at-home-2160.mp4",
  hd: "/landing/care-at-home-1440.mp4",
  portrait: "/landing/care-at-home-portrait.mp4",
} as const;

const POSTERS = {
  wide: "/landing/care-at-home-poster.jpg",
  portrait: "/landing/care-at-home-poster-portrait.jpg",
} as const;

interface NetworkInfo {
  saveData?: boolean;
  effectiveType?: string;
}

/** Which cut this device has any use for. Runs on the client only. */
function pickCut(): { src: string; poster: string } {
  const width = window.innerWidth;
  // Capped at 3: past that the extra pixels are beyond what the panel resolves.
  const dpr = Math.min(window.devicePixelRatio || 1, 3);

  // The phone breakpoint matches the CSS: below `sm` the frame is 4:5.
  if (width < 640) return { src: SOURCES.portrait, poster: POSTERS.portrait };

  const conn = (navigator as Navigator & { connection?: NetworkInfo }).connection;
  const metered =
    conn?.saveData === true ||
    (conn?.effectiveType ? /^(slow-2g|2g|3g)$/.test(conn.effectiveType) : false);
  if (metered) return { src: SOURCES.hd, poster: POSTERS.wide };

  // 4K only where there are genuinely that many device pixels to fill.
  return { src: width * dpr >= 2400 ? SOURCES.uhd : SOURCES.hd, poster: POSTERS.wide };
}

/**
 * The film — a doctor arriving at a patient's front door.
 *
 * ── Why it sits here ──
 *
 * The manifesto directly above states the promise in type ("Doceeto brings the
 * two directly together"). This is the same sentence, shown instead of said, so
 * it reads as the proof of the claim rather than as decoration bolted onto it.
 * It is deliberately an INTERSTITIAL, not a numbered chapter: the chapters
 * (01 manifesto → 02 roles → 03 words → 04 experience) are the argument, and a
 * full-bleed image break between two of them is a beat, not a new point.
 *
 * ── Footage, not a player ──
 *
 * There are no controls, and that is the whole design. A play button, a mute
 * toggle and a caption plate turned this into an embedded video WIDGET sitting
 * on the page — the visual language of a YouTube embed, which reads as someone
 * else's content quoted here rather than as part of Doceeto. Moving image with
 * no chrome reads as the page itself. So: it plays, it loops, it is silent, and
 * there is nothing to press. The <video> is pointer-events-none, so a tap goes
 * to the page behind it and the long-press "save video" menu never appears.
 *
 * ── Why it is still not a plain <video autoplay loop> ──
 *
 * A hero-sized clip that plays forever is a battery and data tax on people who
 * scrolled past it in a second, so the same restraint the forest gets applies:
 *
 *   • It does not begin until it is actually on screen, and it stops the moment
 *     it leaves. Off-screen decode is invisible by definition.
 *   • preload="none" until then, so the download is spent on visitors who
 *     reach it.
 *   • prefers-reduced-motion never starts it at all and keeps the poster frame,
 *     which is a finished composition on its own.
 */
export function LandingFilm() {
  const videoRef = useRef<HTMLVideoElement>(null);
  // Poster only until the client has decided which cut this screen deserves.
  // The wide poster is the server-rendered default; on a phone it is swapped
  // for the portrait one, and object-cover means the swap is not visible.
  const [poster, setPoster] = useState<string>(POSTERS.wide);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    /* Chosen here rather than in `src`, because a src attribute in the markup
       is a download decision made before anything is known about the device.
       With preload="none" nothing is fetched until play() is called anyway, so
       assigning it now costs nothing and buys the right file. */
    const cut = pickCut();
    setPoster(cut.poster);
    video.src = cut.src;

    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    /* Play only while visible. `play()` rejects routinely — a tab restored in
       the background, a policy that wants a gesture first — and that is not an
       error worth surfacing: with no controls there is nothing to fall back to
       except the poster, which is already a finished frame. */
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) void video.play().catch(() => undefined);
        else video.pause();
      },
      { threshold: 0.2 },
    );
    observer.observe(video);
    return () => observer.disconnect();
  }, []);

  return (
    /* Continues the manifesto's forest band — the green runs unbroken from the
       statements into the film, and the roles section curves paper back up out
       of it. No new colour is introduced for a section that is mostly image. */
    <section
      id="film"
      className="forest-band relative overflow-hidden py-16 sm:py-24 lg:py-32"
    >
      <div className="absolute inset-0 pointer-events-none" aria-hidden="true">
        <div className="absolute left-1/2 top-1/2 h-[700px] w-[1100px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[rgb(var(--c-forest-600)/0.5)] blur-[150px]" />
      </div>

      <div className="relative z-10 mx-auto max-w-7xl px-5 sm:px-6">
        {/* The caption sits ABOVE the film and stays short. Anything longer
            competes with the thing it is introducing.

            On a phone this block was the whole problem: at the desktop type
            scale the eyebrow, a four-line serif headline and a four-line
            paragraph filled the entire screen, and the film — the reason the
            section exists — began below the fold. Nobody scrolled to it. The
            type steps down properly now, and the supporting paragraph is held
            back until there is a second column to put it in. */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-80px" }}
          transition={{ duration: 0.6 }}
          className="mb-6 flex flex-col items-start gap-3 sm:mb-10 lg:mb-14 lg:flex-row lg:items-end lg:justify-between"
        >
          <div className="max-w-2xl">
            <span className="label border-l-2 border-[var(--accent)] pl-3 text-[10px] tracking-[0.2em] sm:text-xs">
              THE HOUSE CALL
            </span>
            <h2 className="mt-3 font-serif text-[1.75rem] font-bold leading-[1.1] tracking-tight text-[var(--text)] sm:mt-4 sm:text-4xl lg:text-5xl xl:text-6xl">
              This is what{" "}
              <span className="italic text-[var(--accent)]">
                care reaching you
              </span>{" "}
              looks like.
            </h2>
          </div>
          <p className="hidden max-w-sm text-base leading-relaxed text-[var(--text-muted)] lg:block">
            No waiting room, no queue at a counter. A verified doctor or nurse
            at your door, and the consultation happening where you already are.
          </p>
        </motion.div>

        {/* The film itself. On a phone a 16:9 strip is 190px of a 844px screen —
            present but not worth the download, so the frame goes taller and the
            footage is cropped to it rather than shrunk into it. */}
        <motion.div
          initial={{ opacity: 0, y: 40, scale: 0.97 }}
          whileInView={{ opacity: 1, y: 0, scale: 1 }}
          viewport={{ once: true, margin: "-60px" }}
          transition={{ duration: 0.9, ease: [0.16, 1, 0.3, 1] }}
          className="relative overflow-hidden rounded-[1.25rem] shadow-[0_50px_90px_-40px_rgb(0_0_0/0.65)] ring-1 ring-[var(--border)] sm:rounded-[2rem] lg:rounded-[2.5rem]"
        >
          <video
            ref={videoRef}
            className="pointer-events-none aspect-[4/5] w-full object-cover sm:aspect-[16/10] lg:aspect-video"
            poster={poster}
            muted
            loop
            playsInline
            preload="none"
            disablePictureInPicture
            // eslint-disable-next-line jsx-a11y/media-has-caption
            controls={false}
            controlsList="nodownload noplaybackrate noremoteplayback"
            aria-hidden="true"
          />

          {/* Vignette. The film is warm and bright and the band behind it is
              dark; without this the plate's edges dissolve into the section. */}
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 bg-[radial-gradient(120%_100%_at_50%_45%,transparent_58%,rgb(0_0_0/0.32)_100%)]"
          />

          {/* The supporting line, on phones only — it was cut from the header
              above to get the film on screen, and it belongs somewhere. Over
              the footage it costs no vertical space at all. */}
          <div
            aria-hidden
            className="pointer-events-none absolute inset-x-0 bottom-0 bg-[linear-gradient(to_top,rgb(0_0_0/0.72),transparent)] px-5 pb-5 pt-16 lg:hidden"
          >
            <p className="text-sm leading-relaxed text-white/90">
              A verified doctor or nurse at your door, and the consultation
              happening where you already are.
            </p>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
