/**
 * The clinician mark on the sign-in cover plate.
 *
 * A stethoscope whose tubing draws a heart. Where DoctorFigure is a portrait —
 * a person who greets you — this is an emblem, which is what the glass lens on
 * the sign-in plate wants: the lens is a small circular aperture, and a face
 * inside it has to fight for every feature, while a single continuous line
 * survives being shrunk.
 *
 * The two halves are drawn as separate open strokes rather than one closed
 * heart, because the free ends ARE the earpieces. They sit in the heart's
 * cleft, exactly where a binaural sits, so the instrument and the symbol are
 * the same drawing rather than one laid over the other.
 *
 * Two colours, following the same rule the rest of the brand uses: one for
 * the mass, gold used once — here on the chestpiece, the point where care
 * actually arrives. The tubing is drawn in currentColor, so the caller sets
 * it from context: bone on a dark plate, forest on a light one. The gold rings this mark sits inside are care reaching
 * outward; the chestpiece is the same circle at the end of the journey.
 */
export function DoctorMark({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 200 200"
      className={className}
      role="img"
      aria-label="A stethoscope drawn as a heart"
    >
      {/* Re-centres the drawing, which runs from the ear tips (y≈38) to the
          bottom of the chestpiece (y≈166), inside the box and therefore
          inside the circular lens. */}
      <g transform="translate(0 -2)">
        {/*
         * Each half is one stroke: ear tip → down into the cleft → out over
         * the lobe → down to the point.
         *
         * The prongs standing up out of the cleft are what stop this reading
         * as a pendant on a chain. Without them the eye finds a closed loop
         * with something hanging off it — a necklace — and the instrument
         * disappears. They are deliberately long enough to be a shape rather
         * than a serif on the heart.
         */}
        <path
          d="M84 44 L95 66 C88 52, 62 50, 54 70 C47 88, 64 108, 100 138"
          fill="none"
          className="stroke-current"
          strokeWidth="9"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          d="M116 44 L105 66 C112 52, 138 50, 146 70 C153 88, 136 108, 100 138"
          fill="none"
          className="stroke-current"
          strokeWidth="9"
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        {/* Ear tips — terminals, not beads. */}
        <circle cx="84" cy="44" r="6" className="fill-current" />
        <circle cx="116" cy="44" r="6" className="fill-current" />

        {/* Chestpiece, sitting at the heart's point — the one gold thing, and
            the only part that must still read at avatar size. */}
        <circle
          cx="100"
          cy="152"
          r="14"
          fill="none"
          className="stroke-tan"
          strokeWidth="5"
        />
        <circle cx="100" cy="152" r="4.5" className="fill-tan" />
      </g>
    </svg>
  );
}
