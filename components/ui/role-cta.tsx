"use client";

import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import { ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils/cn";

/**
 * The three front-door choices on the hero.
 *
 * This replaces the generic animated button that came in with the site-down
 * page kit. That one centred short labels and left-aligned long ones, so
 * "I need care" and "I'm a doctor" never lined up, and its expanding-circle
 * hover is a stock effect you have seen on a hundred template sites.
 *
 * Here every button is the same object: icon in a fixed-width well, label on
 * a baseline shared across all three, caption underneath, arrow pinned right.
 * Because the icon well is a fixed width, the labels align to the pixel no
 * matter how long the text is. Hover fills from the left, the way a highlighter
 * crosses a word, rather than blooming from the middle.
 */
export function RoleCta({
  href,
  icon: Icon,
  label,
  caption,
  primary = false,
  className,
}: {
  href: string;
  icon: LucideIcon;
  label: string;
  caption: string;
  primary?: boolean;
  className?: string;
}) {
  return (
    <Link
      href={href}
      className={cn(
        "group relative isolate flex w-full items-center gap-4 overflow-hidden rounded-2xl px-4 py-3.5 text-left",
        "border transition-[transform,border-color,box-shadow] duration-300 ease-[cubic-bezier(0.16,1,0.3,1)]",
        "hover:-translate-y-0.5 active:translate-y-0",
        primary
          ? "border-transparent bg-[var(--accent)] text-on-accent shadow-[0_10px_30px_-12px_rgb(var(--accent-rgb)/0.75)]"
          : "border-[var(--border)] bg-[rgb(var(--bg-rgb)/0.55)] text-[var(--text)] backdrop-blur-md hover:border-[rgb(var(--accent-rgb)/0.55)]",
        className,
      )}
    >
      {/* Hover wash, sweeps left to right, sits under the content */}
      {!primary && (
        <span
          aria-hidden
          className="absolute inset-0 -z-10 origin-left scale-x-0 bg-[rgb(var(--accent-rgb)/0.08)] transition-transform duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] group-hover:scale-x-100"
        />
      )}

      {/* Fixed-width icon well: this is what keeps all three labels aligned */}
      <span
        className={cn(
          "grid h-10 w-10 shrink-0 place-items-center rounded-xl border transition-colors duration-300",
          primary
            ? "border-white/25 bg-white/15"
            : "border-[var(--border)] bg-[var(--surface)] group-hover:border-[rgb(var(--accent-rgb)/0.45)]",
        )}
      >
        <Icon className="h-[18px] w-[18px]" strokeWidth={1.75} />
      </span>

      <span className="min-w-0 flex-1">
        <span className="block text-[15px] font-semibold leading-tight tracking-[-0.01em]">
          {label}
        </span>
        {/* Wraps rather than truncates. On a 390px phone the caption does not
            fit on one line, and an ellipsis ("at home or…") tells the reader
            less than a second line does. */}
        <span
          className={cn(
            "mt-0.5 block text-[12.5px] leading-snug",
            primary ? "text-on-accent/75" : "text-[var(--text-muted)]",
          )}
        >
          {caption}
        </span>
      </span>

      <ArrowRight
        className="h-4 w-4 shrink-0 translate-x-0 opacity-45 transition-all duration-300 group-hover:translate-x-1 group-hover:opacity-100"
        strokeWidth={2}
      />
    </Link>
  );
}
