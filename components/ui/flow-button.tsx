"use client";

import { ArrowRight } from "lucide-react";
import type { ButtonHTMLAttributes } from "react";

/**
 * Animated arrow button (vendor dependency of the site-down page kit),
 * recolored from the original #111-on-white palette to Doceeto theme tokens
 * so it works on every data-theme.
 */
export function FlowButton({
  text = "Modern Button",
  ...props
}: { text?: string } & ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      {...props}
      className="group relative flex cursor-pointer items-center gap-1 overflow-hidden rounded-[100px] border-[1.5px] border-cream/40 bg-transparent px-8 py-3 text-sm font-semibold text-cream transition-all duration-[600ms] ease-[cubic-bezier(0.23,1,0.32,1)] hover:rounded-[12px] hover:border-transparent hover:text-on-accent active:scale-[0.95]"
    >
      {/* Left arrow (arr-2) */}
      <ArrowRight className="absolute left-[-25%] z-[9] h-4 w-4 fill-none stroke-cream transition-all duration-[800ms] ease-[cubic-bezier(0.34,1.56,0.64,1)] group-hover:left-4 group-hover:stroke-[rgb(var(--c-on-accent))]" />

      {/* Text */}
      <span className="relative z-[1] -translate-x-3 transition-all duration-[800ms] ease-out group-hover:translate-x-3">
        {text}
      </span>

      {/* Circle */}
      <span className="absolute left-1/2 top-1/2 h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-[50%] bg-terracotta opacity-0 transition-all duration-[800ms] ease-[cubic-bezier(0.19,1,0.22,1)] group-hover:h-[220px] group-hover:w-[220px] group-hover:opacity-100"></span>

      {/* Right arrow (arr-1) */}
      <ArrowRight className="absolute right-4 z-[9] h-4 w-4 fill-none stroke-cream transition-all duration-[800ms] ease-[cubic-bezier(0.34,1.56,0.64,1)] group-hover:right-[-25%] group-hover:stroke-[rgb(var(--c-on-accent))]" />
    </button>
  );
}
