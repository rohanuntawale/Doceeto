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
    <span className={cn("font-serif font-bold lowercase tracking-tight text-[var(--text)]", className)}>
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
      viewBox="0 0 100 100"
      className={cn("h-[34px] w-[34px] shrink-0", className)}
      role="img"
      aria-label="Doceeto"
    >
      {/* green app-icon squircle */}
      <rect x="2" y="2" width="96" height="96" rx="24" fill={BRAND.green} />
      {/* the D — stem and arms, open at the break */}
      <path
        d="M 69.5 39 C 65.5 32.6 57.5 29 48 29 L 31 29 L 31 71 L 48 71 C 57.5 71 65.5 67.4 69.5 61"
        fill="none"
        stroke={BRAND.bone}
        strokeWidth="13"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* the patient — gold dot held in the break of the arms */}
      <circle cx="79" cy="50" r="5.2" fill={BRAND.gold} />
      {!reduced && (
        <>
          {/* stethoscope crossing the chest */}
          <circle cx="46.5" cy="47" r="8.3" fill={BRAND.bone} />
          <circle cx="46.5" cy="47" r="3.2" fill={BRAND.green} />
          <path
            d="M 38 51 C 38.4 57.8 42.8 61.8 48.6 61.2"
            fill="none"
            stroke={BRAND.gold}
            strokeWidth="2.8"
            strokeLinecap="round"
          />
          <circle cx="53.8" cy="60" r="2.7" fill={BRAND.gold} />
        </>
      )}
    </svg>
  );
}
