"use client";

/**
 * AnimatedNavigationTabs — a tab rail where the underline and the hover pill
 * slide between items instead of popping, via framer-motion shared layout.
 *
 * Works either uncontrolled (it tracks its own clicks) or controlled by
 * passing `activeId` — the landing header drives it from a scroll spy so the
 * underline reports where you actually are, not where you last clicked.
 */

import { useId, useState, type ElementType } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils/cn";

export type AnimatedNavigationTab = {
  id: string | number;
  tile: string;
  /**
   * Renders the tab as an anchor. Same-page hashes stay plain <a> rather than
   * next/link so they keep the browser's own smooth scrolling.
   */
  href?: string;
};

type AnimatedNavigationTabsProps = {
  items: AnimatedNavigationTab[];
  /**
   * Controlled active tab. Omit to let the rail track clicks itself; pass
   * `null` to mean "nothing is active" (no underline).
   */
  activeId?: AnimatedNavigationTab["id"] | null;
  onSelect?: (item: AnimatedNavigationTab) => void;
  className?: string;
};

export function AnimatedNavigationTabs({
  items,
  activeId,
  onSelect,
  className,
}: AnimatedNavigationTabsProps) {
  const [clicked, setClicked] = useState<AnimatedNavigationTab["id"] | null>(
    items[0]?.id ?? null,
  );
  const [hovered, setHovered] = useState<AnimatedNavigationTab["id"] | null>(
    null,
  );

  // layoutId is global to framer-motion, so namespace it per instance —
  // two rails both using "active" would animate their underlines into
  // each other across the page.
  const group = useId();
  const active = activeId !== undefined ? activeId : clicked;

  return (
    <nav className={cn("relative", className)}>
      <ul className="flex items-center justify-center">
        {items.map((item) => {
          const isActive = item.id === active;
          const isHovered = hovered === item.id;

          // Three cases, and the middle one is the reason this isn't a
          // one-liner. A same-page hash stays a plain <a> so the browser's own
          // smooth scrolling (set in globals.css) still applies — next/link
          // would intercept it and jump. A real route uses next/link, so
          // leaving the page is a client-side navigation rather than a full
          // reload. Anything with no href is a button: it changes state, it
          // doesn't navigate, and screen readers should be told which.
          const isHash = item.href?.startsWith("#");
          const Tag: ElementType = !item.href ? "button" : isHash ? "a" : Link;
          const tagProps = item.href
            ? { href: item.href }
            : { type: "button" as const };

          return (
            <li key={item.id}>
              <Tag
                {...tagProps}
                aria-current={isActive ? "page" : undefined}
                onClick={() => {
                  setClicked(item.id);
                  onSelect?.(item);
                }}
                onMouseEnter={() => setHovered(item.id)}
                onMouseLeave={() => setHovered(null)}
                onFocus={() => setHovered(item.id)}
                onBlur={() => setHovered(null)}
                className={cn(
                  "relative block py-2 transition-colors duration-300",
                  "focus-visible:outline-none",
                  isActive
                    ? "text-primary"
                    : "text-[var(--text-muted)] hover:text-primary",
                )}
              >
                {/* Tightens up before it has to wrap: seven product entries
                    at the old flat px-5 pushed the rail into the CTA cluster
                    on a 1024px laptop. */}
                <span className="relative block px-3 py-2 xl:px-4">
                  {isHovered && (
                    <motion.span
                      layoutId={`${group}-hover-bg`}
                      className="absolute inset-0 block bg-primary/10"
                      style={{ borderRadius: 6 }}
                    />
                  )}
                  {/* Positioned so the hover wash paints behind the label
                      rather than over it. */}
                  <span className="relative z-10">{item.tile}</span>
                </span>

                {isActive && (
                  <motion.span
                    layoutId={`${group}-active`}
                    className="absolute inset-x-0 bottom-0 block h-0.5 bg-primary"
                  />
                )}
                {isHovered && (
                  <motion.span
                    layoutId={`${group}-hover`}
                    className="absolute inset-x-0 bottom-0 block h-0.5 bg-primary"
                  />
                )}
              </Tag>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
