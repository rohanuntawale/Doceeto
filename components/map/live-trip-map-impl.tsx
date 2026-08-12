"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { Crosshair } from "lucide-react";
import { useGlMap } from "@/components/map/gl/use-gl-map";
import { mapPalette, type MapPalette } from "@/lib/maps/colors";
import { useTripRoute } from "@/lib/maps/use-route";
import {
  bearing,
  boundsOf,
  easeOut,
  lerpAngle,
  lerpPos,
  lineLengthKm,
  snapToLine,
  toPos,
  type Pos,
} from "@/lib/maps/geo";
import { haversineKm, type LatLng } from "@/lib/utils/geo";

export interface TripEta {
  /** Minutes remaining, rounded up to at least 1. */
  minutes: number;
  /** Distance still to travel, in km — along the road when we have a route. */
  km: number;
  /** True when this came from a straight line, not from the routing engine. */
  estimated: boolean;
}

export interface LiveTripMapProps {
  /** The party that moves — the provider on their way. */
  mover: LatLng & { label?: string };
  /** Where they are going. */
  destination: LatLng & { label?: string };
  /** Draw a road route and a heading puck. Off for a video or clinic consult,
   *  where nobody is driving anywhere and two pins is the honest picture. */
  routing?: boolean;
  /** They are at the door: stop chasing them with the camera. */
  arrived?: boolean;
  height?: number;
  /** Fill the parent instead of a fixed pixel height. */
  fill?: boolean;
  /** Show the ETA chip on the map itself. Defaults to on for a full-bleed map,
   *  off inside a card that already prints the ETA under it. */
  showEta?: boolean;
  /** Reported on every recalculation so a card can render it in its own type. */
  onEta?: (eta: TripEta | null) => void;
}

const SRC = "iy-trip";
const CASING = "iy-trip-casing";
const LINE = "iy-trip-line";

/** Beyond this the fix is genuinely off-route, so showing it snapped to the
 *  road would be a fiction. Within it, snapping cleans up GPS scatter. */
const SNAP_LIMIT_KM = 0.15;

/** Bounds on how long the puck takes to slide to a new fix. Long enough that
 *  motion is continuous between pings, short enough that the marker never lags
 *  so far behind that it is somewhere the provider demonstrably is not. */
const MIN_GLIDE_MS = 700;
const MAX_GLIDE_MS = 6000;

const EMPTY: GeoJSON.FeatureCollection = { type: "FeatureCollection", features: [] };

/**
 * The travelled/remaining split, as a colour ramp along the line rather than
 * as two geometries.
 *
 * Cutting the route into two LineStrings and re-uploading both on every
 * animation frame means serialising several hundred coordinates sixty times a
 * second, which is exactly the kind of thing that turns a smooth puck into a
 * stuttering one on a mid-range phone. `line-gradient` moves the same effect
 * onto the GPU: the geometry is uploaded once and each frame only changes four
 * numbers in a paint expression.
 */
function progressGradient(p: number, palette: MapPalette) {
  // Stops must strictly increase, so the split is clamped away from both ends.
  const at = Math.min(0.998, Math.max(0.001, p));
  return [
    "interpolate",
    ["linear"],
    ["line-progress"],
    0,
    palette.routeDone,
    at,
    palette.routeDone,
    at + 0.001,
    palette.route,
    1,
    palette.route,
  ] as never;
}

/** The provider's marker: a heading arrow inside a soft halo. */
function puckElement(p: MapPalette): HTMLElement {
  const el = document.createElement("div");
  el.style.cssText =
    "width:38px;height:38px;display:grid;place-items:center;will-change:transform;";
  el.innerHTML = `
    <span style="position:absolute;inset:0;border-radius:9999px;background:${p.puck};opacity:0.16"></span>
    <span style="position:absolute;inset:9px;border-radius:9999px;background:${p.puck};opacity:0.28"></span>
    <svg width="20" height="20" viewBox="0 0 24 24" style="position:relative;display:block">
      <path d="M12 2.5 20 21 12 16.6 4 21z" fill="${p.puck}"
            stroke="${p.casing}" stroke-width="1.6" stroke-linejoin="round"/>
    </svg>`;
  return el;
}

/** A pulsing dot — for the destination, and for the mover on a map with no
 *  journey to draw. */
function pinElement(color: string, p: MapPalette): HTMLElement {
  const el = document.createElement("div");
  el.style.cssText = "width:40px;height:40px;display:grid;place-items:center;";
  el.innerHTML = `
    <span class="iy-pulse" style="position:absolute;width:16px;height:16px;border-radius:9999px;background:${color}"></span>
    <span style="position:relative;width:13px;height:13px;border-radius:9999px;background:${color};border:2px solid ${p.casing}"></span>`;
  return el;
}

export default function LiveTripMapImpl({
  mover,
  destination,
  routing = true,
  arrived = false,
  height = 300,
  fill = false,
  showEta,
  onEta,
}: LiveTripMapProps) {
  const { containerRef, map: mapRef, ready } = useGlMap({
    center: mover,
    zoom: 14,
    // A little tilt on the tracking view, none on a flat two-pin view. This is
    // most of what separates "navigation" from "diagram" at a glance.
    pitch: routing ? 40 : 0,
    immediateWheel: fill,
    hideControls: !fill,
  });

  const [palette] = useState<MapPalette>(() => mapPalette());
  const [eta, setEta] = useState<TripEta | null>(null);
  /** Off as soon as the user takes the camera; the re-centre button gives it
   *  back. A map that keeps yanking itself away from where you dragged it is
   *  the fastest way to make a tracking screen feel hostile. */
  const [following, setFollowing] = useState(true);

  const route = useTripRoute(routing ? mover : null, routing ? destination : null, routing);
  const totalKm = useMemo(() => (route ? lineLengthKm(route.line) : 0), [route]);

  const puck = useRef<maplibregl.Marker | null>(null);
  const pin = useRef<maplibregl.Marker | null>(null);
  const frame = useRef<number | null>(null);
  const lastCamera = useRef(0);
  const lastPing = useRef(0);

  // The animation is driven by rAF against refs, never through React state:
  // sixty setStates a second would re-render the tree for something only the
  // map canvas can see.
  const anim = useRef({
    from: null as Pos | null,
    to: null as Pos | null,
    fromH: 0,
    toH: 0,
    fromP: 0,
    toP: 0,
    t0: 0,
    dur: 0,
    cur: null as Pos | null,
    curH: 0,
    curP: 0,
  });

  const paletteRef = useRef(palette);
  const hasRoute = useRef(false);
  hasRoute.current = Boolean(routing && route && route.line.length >= 2);
  const onEtaRef = useRef(onEta);
  onEtaRef.current = onEta;

  // ── Layers, once ──────────────────────────────────────────
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return;

    if (!map.getSource(SRC)) {
      // lineMetrics is what makes `line-progress` — and therefore the whole
      // travelled/remaining ramp — available at all.
      map.addSource(SRC, { type: "geojson", data: EMPTY, lineMetrics: true });
    }

    // Width grows with zoom so the line stays a road-width ribbon rather than
    // a hairline when zoomed out and a stripe when zoomed in.
    const width = (base: number) =>
      ["interpolate", ["linear"], ["zoom"], 10, base * 0.6, 14, base, 17, base * 1.6] as never;

    if (!map.getLayer(CASING)) {
      map.addLayer({
        id: CASING,
        type: "line",
        source: SRC,
        layout: { "line-cap": "round", "line-join": "round" },
        paint: { "line-color": palette.casing, "line-width": width(11) },
      });
    }
    if (!map.getLayer(LINE)) {
      map.addLayer({
        id: LINE,
        type: "line",
        source: SRC,
        layout: { "line-cap": "round", "line-join": "round" },
        paint: {
          "line-width": width(6),
          "line-gradient": progressGradient(0, palette),
        },
      });
    }

    pin.current ??= new maplibregl.Marker({ element: pinElement(palette.pin, palette) })
      .setLngLat(toPos(destination))
      .addTo(map);

    puck.current ??= routing
      ? new maplibregl.Marker({
          element: puckElement(palette),
          // Map-aligned: the arrow points down the road as the user rotates
          // the map, instead of always pointing at the top of the screen.
          rotationAlignment: "map",
        })
          .setLngLat(toPos(mover))
          .addTo(map)
      : new maplibregl.Marker({ element: pinElement(palette.puck, palette) })
          .setLngLat(toPos(mover))
          .addTo(map);

    return () => {
      puck.current?.remove();
      pin.current?.remove();
      puck.current = null;
      pin.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, routing, palette]);

  // ── Route geometry: uploaded once per route, not per frame ─
  useEffect(() => {
    const map = mapRef.current;
    const src = map?.getSource(SRC) as maplibregl.GeoJSONSource | undefined;
    if (!ready || !src) return;
    src.setData(
      route && route.line.length >= 2
        ? {
            type: "FeatureCollection",
            features: [
              {
                type: "Feature",
                properties: {},
                geometry: { type: "LineString", coordinates: route.line },
              },
            ],
          }
        : EMPTY,
    );
  }, [ready, route, mapRef]);

  // Destination is fixed for the life of a trip, but a patient can correct
  // their address mid-visit, so keep the pin honest.
  useEffect(() => {
    pin.current?.setLngLat(toPos(destination));
  }, [destination.lat, destination.lng]); // eslint-disable-line react-hooks/exhaustive-deps

  // Hand the camera back to the user the moment they touch it.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return;
    const release = (e: { originalEvent?: unknown }) => {
      if (e.originalEvent) setFollowing(false);
    };
    map.on("dragstart", release);
    map.on("zoomstart", release);
    map.on("rotatestart", release);
    return () => {
      map.off("dragstart", release);
      map.off("zoomstart", release);
      map.off("rotatestart", release);
    };
  }, [ready, mapRef]);

  /** Paint one animation frame: puck, route ramp, camera. */
  const draw = useCallback(() => {
    const map = mapRef.current;
    const a = anim.current;
    if (!map || !a.cur) return;

    puck.current?.setLngLat(a.cur);
    if (routing) puck.current?.setRotation(a.curH);

    if (hasRoute.current && map.getLayer(LINE)) {
      map.setPaintProperty(LINE, "line-gradient", progressGradient(a.curP, paletteRef.current));
    }

    // Keep both ends framed rather than locking the camera to the puck: on a
    // tracking screen the question is "how far off are they", and an answer
    // that needs a pinch-out to see is no answer.
    const now = performance.now();
    if (following && !arrived && now - lastCamera.current > 1200) {
      lastCamera.current = now;
      const b = boundsOf([a.cur, toPos(destination)]);
      if (b) {
        map.fitBounds(b, {
          padding: fill
            ? { top: 90, bottom: 200, left: 48, right: 48 }
            : { top: 44, bottom: 44, left: 44, right: 44 },
          maxZoom: 16,
          duration: 1100,
          essential: true,
        });
      }
    }
  }, [routing, following, arrived, fill, destination.lat, destination.lng]); // eslint-disable-line react-hooks/exhaustive-deps

  const tick = useCallback(() => {
    const a = anim.current;
    if (!a.from || !a.to) return;
    const p = a.dur <= 0 ? 1 : Math.min(1, (performance.now() - a.t0) / a.dur);
    const e = easeOut(p);
    a.cur = lerpPos(a.from, a.to, e);
    a.curH = lerpAngle(a.fromH, a.toH, e);
    a.curP = a.fromP + (a.toP - a.fromP) * e;
    draw();
    frame.current = p < 1 ? requestAnimationFrame(tick) : null;
  }, [draw]);

  // ── A new fix arrives ─────────────────────────────────────
  useEffect(() => {
    if (!ready) return;
    const raw = toPos(mover);
    const line = route?.line;
    const usable = line && line.length >= 2;

    // Snap onto the road when the fix is plausibly on it. This is what stops
    // the puck sitting in the middle of a block, and it is what makes the
    // travelled/remaining ramp land on a real point of the line.
    const at = usable ? snapToLine(line, raw) : null;
    const onRoad = at && at.offsetKm <= SNAP_LIMIT_KM;
    const target: Pos = onRoad ? at.point : raw;

    // Heading comes from the ROUTE ahead when we have one — the direction the
    // road goes is what a driver is actually pointing, whereas two consecutive
    // GPS fixes at a red light differ only by noise and spin the arrow.
    const a = anim.current;
    const prev = a.cur ?? target;
    const ahead =
      onRoad && line && at.index + 1 < line.length ? line[at.index + 1] : null;
    const moved = haversineKm(
      { lat: prev[1], lng: prev[0] },
      { lat: target[1], lng: target[0] },
    );
    const heading = ahead
      ? bearing(target, ahead)
      : moved > 0.005
        ? bearing(prev, target)
        : a.curH;

    const now = performance.now();
    const gap = lastPing.current ? now - lastPing.current : MIN_GLIDE_MS;
    lastPing.current = now;

    a.from = prev;
    a.to = target;
    a.fromH = a.cur ? a.curH : heading;
    a.toH = heading;
    a.fromP = a.cur ? a.curP : 0;
    a.toP = at && totalKm > 0 ? Math.min(1, at.alongKm / totalKm) : a.curP;
    a.t0 = now;
    // Glide over roughly the interval between pings, so the puck is still
    // moving when the next one lands and the motion never visibly stops.
    a.dur = a.cur ? Math.min(MAX_GLIDE_MS, Math.max(MIN_GLIDE_MS, gap)) : 0;
    if (!a.cur) {
      a.cur = target;
      a.curH = heading;
      a.curP = a.toP;
      a.fromP = a.toP;
    }

    if (frame.current === null) frame.current = requestAnimationFrame(tick);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, mover.lat, mover.lng, route, totalKm, tick]);

  useEffect(
    () => () => {
      if (frame.current !== null) cancelAnimationFrame(frame.current);
      frame.current = null;
    },
    [],
  );

  // ── ETA ───────────────────────────────────────────────────
  useEffect(() => {
    if (!routing || !route) {
      setEta(null);
      onEtaRef.current?.(null);
      return;
    }
    const at = snapToLine(route.line, toPos(mover));
    const leftKm = Math.max(0, totalKm - (at?.alongKm ?? 0));
    // Scale the engine's own duration by the fraction still to drive, rather
    // than re-deriving speed: it already accounts for road class and turns.
    const share = totalKm > 0 ? leftKm / totalKm : 0;
    const next: TripEta = {
      minutes: Math.max(1, Math.round((route.durationS * share) / 60)),
      km: leftKm,
      estimated: route.straight,
    };
    setEta(next);
    onEtaRef.current?.(next);
  }, [routing, route, totalKm, mover.lat, mover.lng]); // eslint-disable-line react-hooks/exhaustive-deps

  // Frame both ends once on a non-routing map, which has nothing to animate.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready || routing) return;
    puck.current?.setLngLat(toPos(mover));
    const b = boundsOf([toPos(mover), toPos(destination)]);
    if (b) map.fitBounds(b, { padding: 56, maxZoom: 15, duration: 800 });
  }, [ready, routing, mover.lat, mover.lng, destination.lat, destination.lng]); // eslint-disable-line react-hooks/exhaustive-deps

  const recenter = () => {
    setFollowing(true);
    lastCamera.current = 0;
    const map = mapRef.current;
    const b = boundsOf([anim.current.cur ?? toPos(mover), toPos(destination)]);
    if (map && b) map.fitBounds(b, { padding: 56, maxZoom: 16, duration: 900 });
  };

  const withChip = showEta ?? fill;

  return (
    <div
      className="relative overflow-hidden"
      style={{ height: fill ? "100%" : height, width: "100%", borderRadius: fill ? 0 : 14 }}
    >
      <div ref={containerRef} className="h-full w-full" />

      {withChip && eta && !arrived && (
        <div className="pointer-events-none absolute left-1/2 top-3 z-10 -translate-x-1/2">
          <span className="rounded-full border border-[var(--border)] bg-[rgb(var(--c-espresso-800)/0.88)] px-3 py-1.5 text-xs font-medium text-cream backdrop-blur-sm">
            <span className="font-mono text-tan">{eta.minutes} min</span>
            <span className="text-[var(--text-muted)]">
              {" · "}
              {eta.km < 1 ? `${Math.round(eta.km * 1000)}m away` : `${eta.km.toFixed(1)}km away`}
            </span>
          </span>
        </div>
      )}

      {!following && !arrived && (
        <button
          type="button"
          onClick={recenter}
          className="absolute bottom-9 right-3 z-10 grid h-9 w-9 place-items-center rounded-full border border-[var(--border)] bg-[rgb(var(--c-espresso-800)/0.9)] text-cream backdrop-blur-sm transition hover:text-tan"
          aria-label="Re-centre the map on the journey"
        >
          <Crosshair className="h-4 w-4" />
        </button>
      )}
    </div>
  );
}
