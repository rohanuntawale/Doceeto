"use client";

import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils/cn";

/**
 * Only the id and title cross the server/client boundary — deliberately NOT
 * the full LegalSection. Its `content` is the entire body of the document as
 * ReactNode; handing that to a client component would serialise the whole
 * policy a second time just to render a list of links.
 */
export interface ContentsEntry {
  id: string;
  title: string;
}

/**
 * Where the "you are reading this one" line sits, in px from the top of the
 * viewport. Matches `scroll-padding-top: 6rem` in globals.css (the clearance
 * for the fixed header) plus a little air, so a section becomes active at the
 * same moment clicking its link would park it.
 */
const READING_LINE = 112;

/**
 * Sticky contents rail with scroll spy. Hidden on mobile, where it would push
 * the document a full screen down before a single word of it is visible.
 *
 * Position is measured rather than observed. IntersectionObserver is the
 * reflex for this, but it answers "is this section on screen", which is the
 * wrong question when three short clauses share the viewport — they all
 * intersect and the rail flickers between them. Comparing each heading against
 * one reading line answers "which section am I in", which is what the reader
 * is actually asking, and it stays correct for a section taller than the
 * window as well as for one only two lines long.
 */
export function ContentsRail({ sections }: { sections: ContentsEntry[] }) {
  const [active, setActive] = useState<string | null>(sections[0]?.id ?? null);
  const navRef = useRef<HTMLElement | null>(null);
  const itemRefs = useRef(new Map<string, HTMLLIElement>());

  const key = sections.map((s) => s.id).join("|");

  useEffect(() => {
    if (sections.length === 0) return;
    let frame: number | null = null;

    const measure = () => {
      frame = null;
      const doc = document.documentElement;

      // The last sections are often the shortest (Contact, Changes), and at
      // the foot of the page there is no scroll left to push them past the
      // reading line — so without this they could never light up at all.
      if (window.innerHeight + window.scrollY >= doc.scrollHeight - 2) {
        setActive(sections[sections.length - 1].id);
        return;
      }

      let current = sections[0].id;
      for (const s of sections) {
        const el = document.getElementById(s.id);
        if (!el) continue;
        // Sections run in document order, so the last one to have crossed the
        // line is the one being read; the first that has not ends the search.
        if (el.getBoundingClientRect().top - READING_LINE > 0) break;
        current = s.id;
      }
      setActive(current);
    };

    // Scroll fires far faster than the screen repaints; coalescing to one
    // measurement per frame keeps a long policy from doing layout maths
    // dozens of times between paints.
    const onScroll = () => {
      if (frame === null) frame = requestAnimationFrame(measure);
    };

    measure();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      if (frame !== null) cancelAnimationFrame(frame);
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
    };
  }, [key]); // eslint-disable-line react-hooks/exhaustive-deps

  /**
   * Keep the active entry inside the rail's own scroll box on a long contents
   * list. Done by hand rather than with scrollIntoView, which is free to
   * scroll the PAGE to satisfy the request — and a rail that scrolls the
   * document out from under the reader is worse than one that clips.
   */
  useEffect(() => {
    const nav = navRef.current;
    const item = active ? itemRefs.current.get(active) : null;
    if (!nav || !item) return;
    const top = item.offsetTop;
    const bottom = top + item.offsetHeight;
    if (top < nav.scrollTop) nav.scrollTop = top - 8;
    else if (bottom > nav.scrollTop + nav.clientHeight) {
      nav.scrollTop = bottom - nav.clientHeight + 8;
    }
  }, [active]);

  return (
    <aside className="hidden lg:block print:hidden">
      <nav
        ref={navRef}
        aria-label="On this page"
        className="sticky top-24 max-h-[calc(100vh-8rem)] overflow-y-auto pr-2"
      >
        <div className="label mb-3">On this page</div>
        <ol className="space-y-1.5">
          {sections.map((s, i) => {
            const on = s.id === active;
            return (
              <li
                key={s.id}
                ref={(el) => {
                  if (el) itemRefs.current.set(s.id, el);
                  else itemRefs.current.delete(s.id);
                }}
                // The negative margin cancels the padding, so the indicator
                // bar appears in the gutter and no text shifts when it does.
                className={cn(
                  "-ml-3 flex gap-2 border-l-2 pl-3 text-[13px] leading-snug transition-colors",
                  on ? "border-terracotta" : "border-transparent",
                )}
              >
                <span
                  className={cn(
                    "shrink-0 tabular-nums transition-colors",
                    on
                      ? "font-semibold text-terracotta"
                      : "text-[var(--text-faint)]",
                  )}
                >
                  {i + 1}.
                </span>
                <a
                  href={`#${s.id}`}
                  // "location" is the correct token for the current position
                  // within a page; "page" would claim this link IS the page.
                  aria-current={on ? "location" : undefined}
                  className={cn(
                    "transition-colors hover:text-terracotta",
                    on
                      ? "font-medium text-terracotta"
                      : "text-[var(--text-muted)]",
                  )}
                >
                  {s.title}
                </a>
              </li>
            );
          })}
        </ol>
      </nav>
    </aside>
  );
}
