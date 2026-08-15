"use client";

import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { Volume2, VolumeX, Play, Pause } from "lucide-react";

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
 * ── Why it is not an ordinary <video autoplay loop> ──
 *
 * A hero-sized clip that plays forever is a battery and data tax on people who
 * scrolled past it in a second, so the same restraint the forest gets applies:
 *
 *   • It does not begin until it is actually on screen, and it stops the moment
 *     it leaves. Off-screen decode is invisible by definition.
 *   • preload="none" until then, so the 2 MB is spent on visitors who reach it.
 *   • prefers-reduced-motion gets the poster frame and a play button — the
 *     composition is identical, it simply waits to be asked.
 *
 * Muted is a browser requirement for autoplay, not a preference, so the sound
 * toggle is a real control rather than an afterthought: the ambience is part of
 * the film for anyone who wants it.
 */
export function LandingFilm() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [playing, setPlaying] = useState(false);
  const [muted, setMuted] = useState(true);
  // Reduced motion turns autoplay off, which changes what the overlay says.
  const [manual, setManual] = useState(false);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setManual(true);
      return;
    }

    /* Play only while visible. `play()` rejects routinely — a tab restored in
       the background, a policy that wants a gesture first — and that is not an
       error worth surfacing: the poster is already a finished frame. */
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          video.play().then(
            () => setPlaying(true),
            () => setManual(true),
          );
        } else {
          video.pause();
          setPlaying(false);
        }
      },
      { threshold: 0.25 },
    );
    observer.observe(video);
    return () => observer.disconnect();
  }, []);

  const toggle = () => {
    const video = videoRef.current;
    if (!video) return;
    if (video.paused) {
      void video.play();
      setPlaying(true);
    } else {
      video.pause();
      setPlaying(false);
    }
  };

  const toggleSound = () => {
    const video = videoRef.current;
    if (!video) return;
    video.muted = !video.muted;
    setMuted(video.muted);
    // Unmuting a paused film is a request to watch it.
    if (!video.muted && video.paused) {
      void video.play();
      setPlaying(true);
    }
  };

  return (
    /* Continues the manifesto's forest band — the green runs unbroken from the
       statements into the film, and the roles section curves paper back up out
       of it. No new colour is introduced for a section that is mostly image. */
    <section
      id="film"
      className="forest-band relative overflow-hidden py-24 sm:py-32"
    >
      <div className="absolute inset-0 pointer-events-none" aria-hidden="true">
        <div className="absolute left-1/2 top-1/2 h-[700px] w-[1100px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[rgb(var(--c-forest-600)/0.5)] blur-[150px]" />
      </div>

      <div className="relative z-10 mx-auto max-w-7xl px-6">
        {/* The caption sits ABOVE the film and stays short. Anything longer
            competes with the thing it is introducing. */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-80px" }}
          transition={{ duration: 0.6 }}
          className="mb-10 flex flex-col items-start gap-3 sm:mb-14 lg:flex-row lg:items-end lg:justify-between"
        >
          <div className="max-w-2xl">
            <span className="label border-l-2 border-[var(--accent)] pl-3 text-xs tracking-[0.2em]">
              THE HOUSE CALL
            </span>
            <h2 className="mt-4 font-serif text-4xl font-bold leading-[1.05] tracking-tight text-[var(--text)] sm:text-5xl lg:text-6xl">
              This is what{" "}
              <span className="italic text-[var(--accent)]">
                care reaching you
              </span>{" "}
              looks like.
            </h2>
          </div>
          <p className="max-w-sm text-base leading-relaxed text-[var(--text-muted)]">
            No waiting room, no queue at a counter. A verified doctor or nurse
            at your door, and the consultation happening where you already are.
          </p>
        </motion.div>

        {/* The film itself — one large rounded plate, lifted off the green. */}
        <motion.figure
          initial={{ opacity: 0, y: 40, scale: 0.97 }}
          whileInView={{ opacity: 1, y: 0, scale: 1 }}
          viewport={{ once: true, margin: "-60px" }}
          transition={{ duration: 0.9, ease: [0.16, 1, 0.3, 1] }}
          className="group relative overflow-hidden rounded-[1.75rem] shadow-[0_50px_90px_-40px_rgb(0_0_0/0.65)] ring-1 ring-[var(--border)] sm:rounded-[2.5rem] lg:rounded-[3rem]"
        >
          <video
            ref={videoRef}
            className="aspect-video w-full object-cover"
            src="/landing/care-at-home.mp4"
            poster="/landing/care-at-home-poster.jpg"
            muted
            loop
            playsInline
            preload="none"
            disablePictureInPicture
            onClick={toggle}
            aria-label="A doctor arriving at a patient's home and examining them in their living room"
          />

          {/* Vignette and floor gradient. The film is warm and bright; without
              these the plate's edges dissolve into the band and the controls
              have nothing to sit on. */}
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 bg-[radial-gradient(120%_100%_at_50%_45%,transparent_55%,rgb(0_0_0/0.35)_100%)]"
          />
          <div
            aria-hidden
            className="pointer-events-none absolute inset-x-0 bottom-0 h-1/3 bg-[linear-gradient(to_top,rgb(0_0_0/0.55),transparent)]"
          />

          {/* Controls, TOP right. The bottom-right corner belongs to the
              symptom-checker FAB, which floats over everything and would sit
              straight on top of these as the plate passes it. On a pointer they
              fade up with the plate so the film is uninterrupted until wanted;
              keyboard focus and reduced motion force them visible. */}
          <div className="absolute right-4 top-4 flex items-center gap-2 sm:right-6 sm:top-6">
            <button
              type="button"
              onClick={toggle}
              className="flex h-11 w-11 items-center justify-center rounded-full border border-white/25 bg-black/35 text-white opacity-0 backdrop-blur-md transition-all duration-300 hover:bg-black/55 focus-visible:opacity-100 group-hover:opacity-100 motion-reduce:opacity-100"
              aria-label={playing ? "Pause the film" : "Play the film"}
            >
              {playing ? (
                <Pause className="h-4 w-4" />
              ) : (
                <Play className="ml-0.5 h-4 w-4" />
              )}
            </button>
            <button
              type="button"
              onClick={toggleSound}
              className="flex h-11 w-11 items-center justify-center rounded-full border border-white/25 bg-black/35 text-white backdrop-blur-md transition-colors duration-300 hover:bg-black/55"
              aria-label={muted ? "Unmute the film" : "Mute the film"}
            >
              {muted ? (
                <VolumeX className="h-4 w-4" />
              ) : (
                <Volume2 className="h-4 w-4" />
              )}
            </button>
          </div>

          {/* The one line of copy allowed on top of the image. */}
          <figcaption className="pointer-events-none absolute bottom-5 left-5 max-w-md text-sm font-medium text-white/85 drop-shadow sm:bottom-7 sm:left-8 sm:text-base">
            A doctor at the door — the front door to health.
          </figcaption>

          {/* Only for the visitors who never got autoplay: an unmistakable way
              in, centred on the poster frame. */}
          {manual && !playing && (
            <button
              type="button"
              onClick={toggle}
              className="absolute inset-0 flex items-center justify-center bg-black/15 transition-colors hover:bg-black/25"
              aria-label="Play the film"
            >
              <span className="flex h-20 w-20 items-center justify-center rounded-full border border-white/30 bg-black/40 backdrop-blur-md">
                <Play className="ml-1 h-7 w-7 text-white" />
              </span>
            </button>
          )}
        </motion.figure>
      </div>
    </section>
  );
}
