"use client";

import { useState } from "react";
import { Star } from "lucide-react";
import { cn } from "@/lib/utils/cn";

/** Read-only star display, e.g. an aggregate rating badge. */
export function StarDisplay({
  value,
  count,
  className,
}: {
  value: number;
  count?: number;
  className?: string;
}) {
  return (
    <span className={cn("inline-flex items-center gap-1 text-xs text-tan", className)}>
      <Star className="h-3.5 w-3.5 fill-current" />
      <span className="font-mono">{value.toFixed(1)}</span>
      {typeof count === "number" && count > 0 && (
        <span className="text-[var(--text-faint)]">({count})</span>
      )}
    </span>
  );
}

/** Interactive 1–5 star input. Calls onRate with the chosen value. */
export function StarInput({
  onRate,
  disabled = false,
  size = 5,
}: {
  onRate: (rating: number) => void;
  disabled?: boolean;
  size?: number;
}) {
  const [hover, setHover] = useState(0);
  const [picked, setPicked] = useState(0);
  const active = hover || picked;

  return (
    <div className="inline-flex items-center gap-1" role="radiogroup" aria-label="Rate">
      {Array.from({ length: size }, (_, i) => i + 1).map((n) => (
        <button
          key={n}
          type="button"
          disabled={disabled}
          aria-label={`${n} star${n > 1 ? "s" : ""}`}
          className={cn(
            "rounded p-0.5 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-terracotta/60",
            "disabled:pointer-events-none disabled:opacity-50",
            n <= active ? "text-tan" : "text-[var(--text-faint)] hover:text-tan",
          )}
          onMouseEnter={() => setHover(n)}
          onMouseLeave={() => setHover(0)}
          onClick={() => {
            setPicked(n);
            onRate(n);
          }}
        >
          <Star className={cn("h-5 w-5", n <= active && "fill-current")} />
        </button>
      ))}
    </div>
  );
}
