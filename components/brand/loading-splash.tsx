"use client";

import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils/cn";

/**
 * Brand loading splash, plays the Doceeto load video on entry, then fades to
 * the app. Tap to skip; a safety timer dismisses it if the video stalls. It
 * sits in the app shell layouts, so it plays once on open and not on internal
 * navigation.
 *
 * ── Why the phone gets different treatment ──
 *
 * app-load.mp4 is 1920 wide, a landscape frame. It used to be laid out with
 * `object-cover` on small screens, which fills a portrait phone by cropping
 * the sides away, roughly two thirds of the picture, so whatever the animation
 * was doing in the middle of a wide canvas arrived on a phone as a slice of it.
 *
 * So: contain, not cover. The whole frame is shown, centred on the brand
 * espresso field, which reads as a deliberate title card rather than a
 * mis-cropped video.
 *
 * If a properly re-framed portrait cut exists, pass it as `mobileSrc` (or drop
 * it at the default path below) and phones will play that instead. The
 * decision is made once on mount rather than with a CSS media rule, so only
 * one file is ever fetched.
 */
export function LoadingSplash({
  src = "/loading/app-load.mp4",
  mobileSrc,
}: {
  src?: string;
  /** Portrait re-cut for phones. Falls back to `src`, letterboxed, if absent. */
  mobileSrc?: string;
}) {
  const [show, setShow] = useState(true);
  const [fade, setFade] = useState(false);
  const [isPhone, setIsPhone] = useState(false);
  const done = useRef(false);

  function end() {
    if (done.current) return;
    done.current = true;
    setFade(true);
    setTimeout(() => setShow(false), 550);
  }

  useEffect(() => {
    setIsPhone(window.matchMedia("(max-width: 767px)").matches);
  }, []);

  useEffect(() => {
    const t = setTimeout(end, 5500); // safety cap
    return () => clearTimeout(t);
  }, []);

  if (!show) return null;

  const source = isPhone && mobileSrc ? mobileSrc : src;
  // A purpose-made portrait file can fill the screen; the landscape one must
  // not, or we are back to cropping it.
  const fit = isPhone && mobileSrc ? "object-cover" : "object-contain";

  return (
    <div
      onClick={end}
      className={cn(
        "fixed inset-0 z-[100] grid cursor-pointer place-items-center bg-[rgb(var(--c-espresso))] transition-opacity duration-500",
        fade && "pointer-events-none opacity-0",
      )}
    >
      <video
        key={source}
        src={source}
        autoPlay
        muted
        playsInline
        onEnded={end}
        onError={end}
        className={cn(
          "max-h-full max-w-full",
          fit,
          isPhone && mobileSrc
            ? "h-full w-full"
            : "h-auto w-full md:max-h-[72vh] md:w-auto",
        )}
      />
      <span className="absolute bottom-8 text-[11px] tracking-wide text-[var(--text-faint)]">
        tap to skip
      </span>
    </div>
  );
}
