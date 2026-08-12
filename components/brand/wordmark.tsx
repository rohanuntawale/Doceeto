import { cn } from "@/lib/utils/cn";

/** Doceeto brand colours from the logo reference sheet. */
const BRAND = {
  green: "#1C3A2E",
  gold: "#C9A24A",
  bone: "#ECEAE0",
};

/** Doceeto wordmark — the D-mark app icon beside the lowercase name
 *  ("doc·ee·to" with the middle pair in brand gold). `compact` drops the
 *  tagline for app bars and uses the reduced-cut mark (no stethoscope
 *  detail below 40px, per the logo reference). */
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
      <BrandMark
        className={compact ? "h-[34px] w-[34px]" : "h-10 w-10"}
        reduced={compact}
      />

      {compact ? (
        <Name className="text-xl" />
      ) : (
        <div className="leading-none">
          <Name className="text-xl" />
          <div
            className="mt-1 text-[10px] font-semibold uppercase tracking-[0.14em]"
            style={{ color: BRAND.gold }}
          >
            Care that reaches you
          </div>
        </div>
      )}
    </div>
  );
}

/** The "doc·ee·to" lockup with the middle pair in brand gold. */
export function Name({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        "font-serif font-bold lowercase tracking-tight text-[var(--text)]",
        className,
      )}
    >
      doc<span style={{ color: BRAND.gold }}>ee</span>to
    </span>
  );
}

/** The Doceeto mark — a D read as a doctor seen from directly above:
 *  shoulders form the stem, a stethoscope crosses the chest, and both arms
 *  curve in to close around the patient, shown as the gold dot in the break.
 *  Rendered as the on-dark app-icon tile so it holds up on every theme.
 *  `reduced` drops the stethoscope detail for sizes under 40px. */
export function BrandMark({
  className,
  reduced = false,
}: {
  subtle?: boolean;
  className?: string;
  reduced?: boolean;
}) {
  return (
    <svg
      viewBox="0 0 512 512"
      className={cn("h-[34px] w-[34px] shrink-0", className)}
      xmlns="http://www.w3.org/2000/svg"
      role="img"
      aria-label="Doceeto"
    >
      {/* Background */}
      <rect width="512" height="512" rx="80" fill="#ffffff00" />

      {/* Main green D-shaped logo */}
      <path
        d="
          M 145 135
          H 255
          C 305 135 340 165 362 210
          C 367 220 365 232 356 238
          C 347 244 336 240 330 230
          C 315 204 295 190 255 190
          H 185
          V 322
          H 255
          C 295 322 315 308 330 282
          C 336 272 347 268 356 274
          C 365 280 367 292 362 302
          C 340 347 305 377 255 377
          H 145
          C 125 377 110 362 110 342
          V 170
          C 110 150 125 135 145 135
          Z
        "
        fill="#153D32"
      />

      {/* Inner green circle */}
      <circle cx="245" cy="256" r="38" fill="#153D32" />

      {/* Top gold arc */}
      <path
        d="M 195 220 C 220 198 260 198 285 220"
        fill="none"
        stroke="#C9A13F"
        strokeWidth="12"
        strokeLinecap="round"
      />

      {/* Bottom gold arc */}
      <path
        d="M 195 292 C 220 314 260 314 285 292"
        fill="none"
        stroke="#C9A13F"
        strokeWidth="12"
        strokeLinecap="round"
      />

      {/* Gold node on bottom arc */}
      <circle cx="285" cy="292" r="15" fill="#C9A13F" />

      {/* Floating gold dot */}
      <circle cx="420" cy="256" r="28" fill="#C9A13F" />
    </svg>
  );
}
