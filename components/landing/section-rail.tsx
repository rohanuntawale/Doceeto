"use client";

import { useEffect, useRef, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { cn } from "@/lib/utils/cn";

/**
 * The vertical section rail — a scroll indicator that doubles as navigation.
 *
 * ── How "active" is decided ──
 *
 * An IntersectionObserver with a symmetric negative rootMargin turns the middle
 * of the viewport into a thin trip-wire: a section is active exactly while it
 * crosses that band. That is far steadier than comparing scroll offsets on
 * every frame, which flickers between two sections at the seam and costs a
 * layout read per event. It also means the rail never disagrees with what you
 * are actually looking at, however tall or short the section is.
 *
 * ── Why the rail changes colour ──
 *
 * The landing page alternates between deep forest bands and paper panels. One
 * fixed colour is invisible against one of them, so each section declares its
 * `tone` and the rail crossfades. mix-blend-difference would do this
 * automatically but fights backdrop-blur and renders unpredictably across
 * browsers — an explicit two-tone swap is duller to write and correct
 * everywhere.
 */

export interface RailSection {
  /** Element id to observe and scroll to. */
  id: string;
  /** Shown in the hover label and to screen readers. */
  label: string;
  /** What sits behind the rail here, so it can stay legible. */
  tone: "dark" | "light";
}

export function SectionRail({ sections }: { sections: RailSection[] }) {
  const [activeId, setActiveId] = useState(sections[0]?.id ?? "");
  const [hovered, setHovered] = useState<string | null>(null);
  const reduceMotion = useReducedMotion();

  // Which sections are currently crossing the middle band, in document order.
  // A Set rather than a single id because two short sections can share the
  // band mid-scroll; the first in document order wins, so the rail moves
  // forward and back monotonically instead of jumping.
  const crossing = useRef<Set<string>>(new Set());

  useEffect(() => {
    const els = sections
      .map((s) => document.getElementById(s.id))
      .filter((el): el is HTMLElement => Boolean(el));
    if (els.length === 0) return;

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) crossing.current.add(entry.target.id);
          else crossing.current.delete(entry.target.id);
        }
        const first = sections.find((s) => crossing.current.has(s.id));
        if (first) setActiveId(first.id);
      },
      // The middle 10% of the viewport. Tight enough that the active dot
      // changes when the section visually takes over, wide enough that a fast
      // scroll never skips straight past a section without registering it.
      { rootMargin: "-45% 0px -45% 0px", threshold: 0 },
    );

    els.forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, [sections]);

  function go(id: string) {
    const el = document.getElementById(id);
    if (!el) return;
    // scrollIntoView rather than a hash change: this keeps the URL clean while
    // scrolling, and `scroll-padding-top` on <html> still clears the fixed
    // header. "smooth" defers to prefers-reduced-motion via the CSS rule.
    el.scrollIntoView({ behavior: reduceMotion ? "auto" : "smooth", block: "start" });
    setActiveId(id);
  }

  const activeTone = sections.find((s) => s.id === activeId)?.tone ?? "dark";
  const onDark = activeTone === "dark";

  return (
    <nav
      aria-label="Page sections"
      className="fixed right-4 top-1/2 z-40 hidden -translate-y-1/2 md:block lg:right-6"
    >
      <motion.ul
        className={cn(
          "flex flex-col items-center gap-1 rounded-full border p-1.5 backdrop-blur-xl transition-colors duration-500",
          onDark ? "border-white/10 bg-black/25" : "border-black/5 bg-white/50",
        )}
      >
        {sections.map((s) => {
          const isActive = s.id === activeId;
          const isHovered = hovered === s.id;
          return (
            <li key={s.id} className="relative">
              <button
                type="button"
                onClick={() => go(s.id)}
                onMouseEnter={() => setHovered(s.id)}
                onMouseLeave={() => setHovered(null)}
                onFocus={() => setHovered(s.id)}
                onBlur={() => setHovered(null)}
                aria-label={`Go to ${s.label}`}
                aria-current={isActive ? "true" : undefined}
                // A 28px hit area around a 6px dot: the dot is the affordance,
                // the button is what a finger or a shaky cursor actually hits.
                className="group grid h-7 w-7 place-items-center rounded-full outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
              >
                <motion.span
                  aria-hidden
                  animate={{
                    scale: isActive ? 1 : isHovered ? 0.8 : 0.55,
                    opacity: isActive ? 1 : isHovered ? 0.85 : 0.45,
                  }}
                  transition={
                    reduceMotion
                      ? { duration: 0 }
                      : // Spring, not a linear tween — the dot should settle
                        // like a physical object rather than arrive on a clock.
                        { type: "spring", stiffness: 420, damping: 32, mass: 0.6 }
                  }
                  className={cn(
                    "block h-[9px] w-[9px] rounded-full transition-colors duration-500",
                    onDark ? "bg-white" : "bg-[var(--text)]",
                  )}
                />
              </button>

              {/* Hover label, sliding out to the left. pointer-events-none so
                  it can never intercept the click it is describing. */}
              <motion.span
                aria-hidden
                initial={false}
                animate={{
                  opacity: isHovered ? 1 : 0,
                  x: isHovered ? 0 : 8,
                }}
                transition={
                  reduceMotion
                    ? { duration: 0 }
                    : { type: "spring", stiffness: 500, damping: 40 }
                }
                className={cn(
                  "pointer-events-none absolute right-full top-1/2 mr-2 -translate-y-1/2 whitespace-nowrap rounded-full px-2.5 py-1 text-[11px] font-medium backdrop-blur-xl transition-colors duration-500",
                  onDark
                    ? "bg-black/60 text-white"
                    : "bg-white/80 text-[var(--text)] shadow-soft",
                )}
              >
                {s.label}
              </motion.span>
            </li>
          );
        })}
      </motion.ul>
    </nav>
  );
}
