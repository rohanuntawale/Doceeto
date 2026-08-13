/**
 * The clinician who greets you on the sign-in and sign-up cover plates.
 *
 * Replaces an earlier robot mascot. A robot was the wrong promise for this
 * product: the whole pitch is that a real practitioner comes to you, and the
 * antenna and screen-face said the opposite. This is a person.
 *
 * Drawn in the logo's own two colours — forest for the mass, gold used once —
 * so it reads as part of the mark rather than an illustration dropped beside
 * it. Three deliberate choices:
 *
 *  • A SURGICAL CAP rather than hair. It signals clinical work at a glance and
 *    keeps the figure from picking a gender or a hairstyle, which matters on a
 *    page where doctors, nurses and patients all sign in.
 *  • BONE SHAPES CARRY AN INK OUTLINE, dark shapes don't. The panel behind is
 *    near-white, so an unoutlined face would dissolve into it; the line also
 *    rhymes with the hand-drawn swash under the wordmark.
 *  • THE CHESTPIECE IS A RING INSIDE A RING — the same figure as the gold
 *    circles this drawing sits inside. Those rings are care reaching outward;
 *    the chestpiece is the same shape at the point where it arrives.
 */
export function DoctorFigure({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 200 200"
      className={className}
      role="img"
      aria-label="A Doceeto clinician"
    >
      {/* Neck — drawn first so the jaw and the coat both crop it. */}
      <rect
        x="90"
        y="124"
        width="20"
        height="34"
        rx="9"
        className="fill-paper stroke-forest"
        strokeWidth="3"
      />

      {/* Scrub top. The bust runs off the bottom edge rather than resolving
          into a floating torso — the frame is a crop, not a cut-out.
          Held to the same shoulder width the previous mascot used (x42–158):
          the cover plates sit this drawing beside their body copy with very
          little clearance, and a wider base eats into the paragraph. */}
      <path
        d="M42 200 C42 170 60 154 80 148 L120 148 C140 154 158 170 158 200 Z"
        className="fill-forest-800"
      />

      {/* Open V-neck */}
      <path d="M81 150 L100 180 L119 150 Z" className="fill-paper" />

      {/* Face, tapering to the jaw — a rounded rectangle here read as a
          screen, which is the exact thing this drawing replaced. */}
      <path
        d="M64 94 C64 68 79 55 100 55 C121 55 136 68 136 94 C136 118 120 138 100 138 C80 138 64 118 64 94 Z"
        className="fill-paper stroke-forest"
        strokeWidth="3"
      />

      {/* Cap, sitting slightly wider than the head so it reads as worn */}
      <path
        d="M61 92 C61 60 78 46 100 46 C122 46 139 60 139 92 Z"
        className="fill-forest"
      />
      <rect x="59" y="84" width="82" height="10" rx="5" className="fill-forest-600" />

      {/* Eyes. Two soft arcs, no mouth — the warmth is in the curve, and a
          drawn smile at this size turns a clinician into a cartoon. */}
      <path
        d="M80 110 q7.5 8.5 15 0"
        fill="none"
        className="stroke-forest"
        strokeWidth="4.5"
        strokeLinecap="round"
      />
      <path
        d="M105 110 q7.5 8.5 15 0"
        fill="none"
        className="stroke-forest"
        strokeWidth="4.5"
        strokeLinecap="round"
      />

      {/* Stethoscope — the one gold thing in the drawing, and the only part
          that has to survive being read at 64px in a nav avatar. */}
      <path
        d="M82 149 C66 180 92 200 116 187"
        fill="none"
        className="stroke-tan"
        strokeWidth="5"
        strokeLinecap="round"
      />
      <path
        d="M118 149 C124 160 126 168 125 175"
        fill="none"
        className="stroke-tan"
        strokeWidth="5"
        strokeLinecap="round"
      />
      <circle
        cx="123"
        cy="183"
        r="9.5"
        fill="none"
        className="stroke-tan"
        strokeWidth="3.5"
      />
      <circle cx="123" cy="183" r="3.4" className="fill-tan" />
    </svg>
  );
}
