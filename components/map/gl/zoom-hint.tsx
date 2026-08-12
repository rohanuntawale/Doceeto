"use client";

/**
 * The "you can zoom this" hint, shown until the wheel is armed.
 *
 * Cooperative gestures are the right default for a map embedded in a scrolling
 * page, but they are invisible: without this the first wheel turn does nothing
 * and the map reads as broken. Takes no pointer events, so the click that
 * dismisses it is the same click that arms the wheel.
 */
export function ZoomHint({ armed }: { armed: boolean }) {
  if (armed) return null;
  return (
    <div className="pointer-events-none absolute inset-x-0 bottom-3 z-10 flex justify-center">
      <span className="rounded-full bg-black/55 px-2.5 py-1 text-[10px] font-medium text-white/90 backdrop-blur-sm">
        Click to zoom · pinch on touch
      </span>
    </div>
  );
}
