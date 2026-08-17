"use client";

import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils/cn";

/**
 * Brand loading splash, plays the Doceeto load video on entry, then fades to
 * the app. Tap to skip; a safety timer dismisses it if the video stalls. It
 * sits in the app shell layouts, so it plays once on open and not on internal
 * navigation.
 *
 * The video fills the viewport edge to edge. A purpose-made portrait cut can
 * still be supplied through `mobileSrc`; otherwise the landscape source is
 * intentionally cropped with `object-cover` to avoid letterboxing.
 */
export function LoadingSplash({
  src = "/loading/app-load.mp4",
  mobileSrc,
}: {
  src?: string;
  /** Portrait re-cut for phones. Falls back to the main source if absent. */
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
  return (
    <div
      onClick={end}
      className={cn(
        "fixed inset-0 z-[100] grid cursor-pointer place-items-center overflow-hidden bg-[rgb(var(--c-espresso))] transition-opacity duration-500",
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
        className="h-full w-full scale-100 object-cover sm:scale-[1.15]"
      />
      <span className="absolute bottom-8 text-[11px] tracking-wide text-[var(--text-faint)]">
        tap to skip
      </span>
    </div>
  );
}
