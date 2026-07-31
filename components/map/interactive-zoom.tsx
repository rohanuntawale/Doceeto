"use client";

import { useEffect, useState } from "react";
import { useMap } from "react-leaflet";

/**
 * Makes a Leaflet map zoom by gesture, not just by the +/- buttons.
 *
 * Pinch and double-click zoom are always on — they are deliberate gestures
 * that can't be mistaken for scrolling the page. The mouse wheel is armed by
 * clicking the map and disarmed when the pointer leaves it, so scrolling past
 * an embedded map (the dashboard card, the tracker) still scrolls the page
 * instead of zooming under the cursor. A map that owns the whole screen has
 * nothing to hijack, so it passes `immediate` and zooms from the first turn
 * of the wheel.
 */
export function InteractiveZoom({ immediate = false }: { immediate?: boolean }) {
  const map = useMap();
  const [armed, setArmed] = useState(immediate);

  useEffect(() => {
    map.touchZoom.enable();
    map.doubleClickZoom.enable();
  }, [map]);

  useEffect(() => {
    if (immediate) {
      map.scrollWheelZoom.enable();
      setArmed(true);
      return;
    }

    const container = map.getContainer();
    const arm = () => {
      map.scrollWheelZoom.enable();
      setArmed(true);
    };
    const disarm = () => {
      map.scrollWheelZoom.disable();
      setArmed(false);
    };

    map.scrollWheelZoom.disable();
    container.addEventListener("mousedown", arm);
    container.addEventListener("touchstart", arm, { passive: true });
    container.addEventListener("mouseleave", disarm);
    return () => {
      container.removeEventListener("mousedown", arm);
      container.removeEventListener("touchstart", arm);
      container.removeEventListener("mouseleave", disarm);
    };
  }, [map, immediate]);

  if (armed) return null;

  // Sits above the tiles (Leaflet panes stop at ~700) but takes no clicks, so
  // the click that dismisses it is the same one that arms the wheel.
  return (
    <div className="pointer-events-none absolute inset-x-0 bottom-3 z-[700] flex justify-center">
      <span className="rounded-full bg-black/55 px-2.5 py-1 text-[10px] font-medium text-white/90 backdrop-blur-sm">
        Click to zoom · pinch on touch
      </span>
    </div>
  );
}
