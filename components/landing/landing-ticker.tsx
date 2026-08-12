"use client";

const ITEMS_ROW_1 = [
  "General Checkup",
  "Specialist Consultation",
  "Home Nurse Care",
  "Urgent Care",
  "Pediatric Visit",
  "Prescription Renewal",
  "Elderly Care",
];

const ITEMS_ROW_2 = [
  "Vitals Monitoring",
  "Post-Op Dressing",
  "Home Visit Doctor",
  "Chronic Disease Care",
  "Diagnostic Help",
  "In-Person Nursing",
  "Emergency Care",
];

/** Marquee rows repeat the source list so the -50% keyframe lands on an
 *  identical frame and the loop reads as continuous. */
function repeat(items: string[], times = 4) {
  return Array.from({ length: times }).flatMap((_, pass) =>
    items.map((item, idx) => ({ item, key: `${pass}-${idx}` })),
  );
}

/**
 * The care ticker.
 *
 * `minimal` is the quiet single rail that closes the hero panel — letterspaced,
 * faint, no chrome, dissolving at both edges so it reads as texture under the
 * headline stats rather than a component with a border. `default` is the louder
 * two-row rail used inside a content section.
 */
export function LandingTicker({
  variant = "default",
}: {
  variant?: "default" | "minimal";
}) {
  if (variant === "minimal") {
    return (
      <div
        className="edge-fade-x overflow-hidden select-none"
        aria-hidden="true"
      >
        <div className="flex animate-marquee-slow whitespace-nowrap text-[11px] sm:text-sm font-semibold uppercase tracking-[0.35em] text-[var(--text-faint)]">
          {repeat([...ITEMS_ROW_1, ...ITEMS_ROW_2], 2).map(({ item, key }) => (
            <span key={key} className="px-8 sm:px-12">
              {item}
            </span>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3 py-4 border-y-2 border-[var(--border)] bg-[rgb(var(--bg-rgb)/0.9)] backdrop-blur-sm overflow-hidden select-none">
      {/* Row 1: Leftward Marquee */}
      <div className="flex overflow-hidden">
        <div className="flex animate-marquee-left gap-8 whitespace-nowrap text-xs sm:text-sm font-bold uppercase tracking-[0.25em] text-[var(--text)] opacity-90">
          {repeat(ITEMS_ROW_1).map(({ item, key }) => (
            <span key={`r1-${key}`} className="flex items-center gap-6">
              <span>{item}</span>
              <span className="text-[var(--accent)]">•</span>
            </span>
          ))}
        </div>
      </div>

      {/* Row 2: Rightward Marquee */}
      <div className="flex overflow-hidden">
        <div className="flex animate-marquee-right gap-8 whitespace-nowrap text-xs font-semibold uppercase tracking-[0.25em] text-[var(--text-muted)] opacity-75">
          {repeat(ITEMS_ROW_2).map(({ item, key }) => (
            <span key={`r2-${key}`} className="flex items-center gap-6">
              <span>{item}</span>
              <span className="text-[#2F7BC4]">•</span>
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
