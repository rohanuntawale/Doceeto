import { cn } from "@/lib/utils/cn";

/** Doceeto wordmark — the door-and-plus brand mark beside the lowercase name
 *  ("doc·ee·to" with the middle pair in terracotta). `compact` drops the
 *  tagline for app bars. */
export function Wordmark({
  className,
  compact = false,
}: {
  className?: string;
  subtle?: boolean;
  compact?: boolean;
}) {
  return (
    <div className={cn("flex items-center gap-2.5", className)}>
      <BrandMark />
      {compact ? (
        <Name className="text-xl" />
      ) : (
        <div className="leading-none">
          <Name className="text-xl" />
          <div className="mt-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-[rgb(var(--c-salmon))]">
            Care that reaches you
          </div>
        </div>
      )}
    </div>
  );
}

/** The "doc·ee·to" lockup with the middle pair in terracotta. */
export function Name({ className }: { className?: string }) {
  return (
    <span className={cn("font-serif font-bold lowercase tracking-tight text-[var(--text)]", className)}>
      doc<span className="text-[rgb(var(--c-terracotta))]">ee</span>to
    </span>
  );
}

/** The new mark — a location pin with a medical plus on an olive squircle:
 *  "care that reaches you", right where you are. Inline SVG so it stays crisp
 *  at any size and carries the brand colours without an image file. */
export function BrandMark({ className }: { subtle?: boolean; className?: string }) {
  return (
    <svg
      viewBox="0 0 100 100"
      className={cn("h-[34px] w-[34px] shrink-0", className)}
      role="img"
      aria-label="Doceeto"
    >
      <defs>
        <linearGradient id="dc-bg" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#8C9B6C" />
          <stop offset="1" stopColor="#717E54" />
        </linearGradient>
      </defs>
      {/* olive squircle */}
      <rect x="1" y="1" width="98" height="98" rx="26" fill="url(#dc-bg)" />
      <rect x="1" y="1" width="98" height="49" rx="26" fill="#ffffff" opacity="0.06" />
      {/* soft shadow under the pin */}
      <path
        d="M50 23 C36.7 23 26.5 33.2 26.5 45.5 C26.5 61 50 79 50 79 C50 79 73.5 61 73.5 45.5 C73.5 33.2 63.3 23 50 23 Z"
        fill="#000000"
        opacity="0.12"
        transform="translate(0,2.5)"
      />
      {/* cream location pin */}
      <path
        d="M50 20 C36.7 20 26.5 30.2 26.5 42.5 C26.5 58 50 76 50 76 C50 76 73.5 58 73.5 42.5 C73.5 30.2 63.3 20 50 20 Z"
        fill="#F7F0E4"
      />
      {/* terracotta medical plus in the pin head */}
      <rect x="38.8" y="39" width="22.4" height="7.2" rx="3.6" fill="#C0692F" />
      <rect x="46.4" y="31.4" width="7.2" height="22.4" rx="3.6" fill="#C0692F" />
    </svg>
  );
}
