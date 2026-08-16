"use client";

import Link from "next/link";
import { ArrowRight } from "lucide-react";
import type { ButtonHTMLAttributes } from "react";
import { cn } from "@/lib/utils/cn";

/**
 * Animated arrow button (vendor dependency of the site-down page kit),
 * recolored from the original #111-on-white palette to Doceeto theme tokens
 * so it works on every data-theme.
 */
export function FlowButton({
  text = "Modern Button",
  href,
  className,
  ...props
}: { text?: string; href?: string; className?: string } & ButtonHTMLAttributes<HTMLButtonElement>) {
  const buttonClassName = cn(
    "group relative flex h-16 min-h-16 w-full cursor-pointer items-center justify-start overflow-hidden rounded-[18px] border-[1.5px] border-[rgb(var(--c-cream)/0.32)] bg-transparent px-9 text-left text-base font-semibold text-[var(--text)] transition-all duration-300 sm:duration-[600ms] ease-[cubic-bezier(0.23,1,0.32,1)] hover:rounded-[12px] hover:border-transparent hover:text-on-accent active:scale-[0.97]",
    className,
  );

  const content = (
    <>
      {/* Left arrow (arr-2) */}
      <ArrowRight className="absolute left-[-25%] z-[9] h-4 w-4 fill-none stroke-current transition-all duration-[350ms] sm:duration-[800ms] ease-[cubic-bezier(0.34,1.56,0.64,1)] group-hover:left-4" />

      {/* Text */}
      <span className="relative z-[1] min-w-0 translate-x-0 whitespace-nowrap text-left transition-all duration-[350ms] sm:duration-[800ms] ease-out group-hover:translate-x-3">
        {text}
      </span>

      {/* Circle */}
      <span className="absolute left-1/2 top-1/2 h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-[50%] bg-[var(--accent)] opacity-0 transition-all duration-[350ms] sm:duration-[800ms] ease-[cubic-bezier(0.19,1,0.22,1)] group-hover:h-[220px] group-hover:w-[220px] group-hover:opacity-100"></span>

      {/* Right arrow (arr-1) */}
      <ArrowRight className="absolute right-4 z-[9] h-4 w-4 fill-none stroke-current transition-all duration-[350ms] sm:duration-[800ms] ease-[cubic-bezier(0.34,1.56,0.64,1)] group-hover:right-[-25%]" />
    </>
  );

  if (href) {
    return (
      <Link href={href} className={buttonClassName}>
        {content}
      </Link>
    );
  }

  return (
    <button {...props} className={buttonClassName}>
      {content}
    </button>
  );
}
