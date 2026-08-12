"use client";

import { useEffect, useRef, useState } from "react";
import maplibregl, { type Map as GLMap } from "maplibre-gl";
import { basemapStyle } from "@/lib/maps/style";
import { isLightShell } from "@/lib/maps/colors";
import { MAP_CENTER, MAP_ZOOM } from "@/lib/config";

export interface GlMapOptions {
  center?: { lat: number; lng: number };
  zoom?: number;
  /** Camera tilt in degrees. A few degrees of pitch is what separates a
   *  navigation view from a floor plan; 0 keeps it flat for browse maps. */
  pitch?: number;
  /** Let the wheel zoom from the first turn. Only for a map that owns the
   *  whole screen — see the cooperative-gesture note below. */
  immediateWheel?: boolean;
  /** Hide the compass/zoom buttons (a small embedded card has no room). */
  hideControls?: boolean;
}

/**
 * One MapLibre instance bound to a container, created once and torn down
 * cleanly. Everything map-specific — sources, layers, markers — is added by
 * the caller against the returned instance after `ready`.
 *
 * `ready` matters: adding a source before the style has loaded throws, and
 * MapLibre's style load is async even when the style is an inline object.
 */
export function useGlMap(opts: GlMapOptions = {}) {
  const {
    center = MAP_CENTER,
    zoom = MAP_ZOOM,
    pitch = 0,
    immediateWheel = false,
    hideControls = false,
  } = opts;

  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<GLMap | null>(null);
  const [ready, setReady] = useState(false);
  const [armed, setArmed] = useState(immediateWheel);

  // Only the FIRST values are used — afterwards the camera belongs to the user
  // and to the follow logic, so re-centering on a prop change would fight
  // whichever of them moved it last.
  const initial = useRef({ center, zoom, pitch });

  useEffect(() => {
    const container = containerRef.current;
    if (!container || mapRef.current) return;

    const map = new maplibregl.Map({
      container,
      // Read once, at construction: swapping a whole style at runtime tears
      // down every source and layer the callers have added on top of it.
      style: basemapStyle(isLightShell()),
      center: [initial.current.center.lng, initial.current.center.lat],
      zoom: initial.current.zoom,
      pitch: initial.current.pitch,
      attributionControl: false,
      // The basemaps we use stop well short of these; letting the camera go
      // past them just yields a grey screen the user has to zoom back out of.
      minZoom: 3,
      maxZoom: 19,
      // Two-finger drag rotates on touch; a one-finger drag must stay a pan or
      // the map spins every time someone scrolls the page over it.
      dragRotate: true,
      pitchWithRotate: true,
      // Past ~60° the horizon comes into view and the basemap runs out of
      // tiles to draw above it.
      maxPitch: 60,
    });
    mapRef.current = map;

    map.addControl(
      new maplibregl.AttributionControl({ compact: true }),
      "bottom-right",
    );
    if (!hideControls) {
      map.addControl(
        new maplibregl.NavigationControl({ showCompass: true, visualizePitch: true }),
        "top-right",
      );
    }

    const onLoad = () => setReady(true);
    map.on("load", onLoad);

    return () => {
      map.off("load", onLoad);
      map.remove();
      mapRef.current = null;
      setReady(false);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hideControls]);

  /**
   * Cooperative gestures, same contract the Leaflet map had: pinch and
   * double-click always zoom (deliberate gestures, unmistakable), but the
   * wheel is armed by interacting with the map and disarmed when the pointer
   * leaves — so scrolling the page past an embedded map scrolls the page.
   */
  useEffect(() => {
    const map = mapRef.current;
    const container = containerRef.current;
    if (!map || !container) return;

    if (immediateWheel) {
      map.scrollZoom.enable();
      setArmed(true);
      return;
    }

    map.scrollZoom.disable();
    const arm = () => {
      map.scrollZoom.enable();
      setArmed(true);
    };
    const disarm = () => {
      map.scrollZoom.disable();
      setArmed(false);
    };

    container.addEventListener("mousedown", arm);
    container.addEventListener("touchstart", arm, { passive: true });
    container.addEventListener("mouseleave", disarm);
    return () => {
      container.removeEventListener("mousedown", arm);
      container.removeEventListener("touchstart", arm);
      container.removeEventListener("mouseleave", disarm);
    };
  }, [immediateWheel, ready]);

  /**
   * MapLibre reads its canvas size once. A box that changes size after mount —
   * a detail panel collapsing, a card expanding to full screen — leaves the
   * new area blank until told, exactly as Leaflet did.
   */
  useEffect(() => {
    const map = mapRef.current;
    const container = containerRef.current;
    if (!map || !container) return;
    const ro = new ResizeObserver(() => map.resize());
    ro.observe(container);
    return () => ro.disconnect();
  }, [ready]);

  return { containerRef, map: mapRef, ready, armed };
}
