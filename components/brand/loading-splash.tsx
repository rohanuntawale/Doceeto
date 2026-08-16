"use client";

import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils/cn";

/**
 * Brand loading splash — plays the Doceeto load video full-screen on entry,
 * then fades to the app. Tap to skip; a safety timer dismisses it if the
 * video stalls. It sits in the app shell layouts, so it plays once on open
 * and not on internal navigation.
 */
export function LoadingSplash({ src = "/loading/app-load.mp4" }: { src?: string }) {
  const [show, setShow] = useState(true);
  const [fade, setFade] = useState(false);
  const done = useRef(false);

  function end() {
    if (done.current) return;
    done.current = true;
    setFade(true);
    setTimeout(() => setShow(false), 550);
  }

  useEffect(() => {
    const t = setTimeout(end, 5500); // safety cap
    return () => clearTimeout(t);
  }, []);

  if (!show) return null;

  return (
    <div
      onClick={end}
      className={cn(
        "fixed inset-0 z-[100] grid cursor-pointer place-items-center bg-[rgb(var(--c-espresso))] transition-opacity duration-500",
        fade && "pointer-events-none opacity-0",
      )}
    >
      <video
        src={src}
        autoPlay
        muted
        playsInline
        onEnded={end}
        className="block h-auto w-auto max-h-[calc(100dvh-2rem)] max-w-full object-contain md:max-h-[82vh] md:max-w-[92vw]"
      />
      <span className="absolute bottom-8 text-[11px] tracking-wide text-[var(--text-faint)]">
        tap to skip
      </span>
    </div>
  );
}
