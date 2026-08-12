import { haversineKm, type LatLng } from "@/lib/utils/geo";

/**
 * The geometry behind the moving puck.
 *
 * Everything here works on `[lng, lat]` pairs — GeoJSON order, which is what
 * MapLibre speaks — while the rest of the app uses `{lat, lng}` objects.
 * `toPos`/`toLatLng` are the only places that conversion should happen.
 */

/** A GeoJSON position: [lng, lat]. */
export type Pos = [number, number];

export const toPos = (p: LatLng): Pos => [p.lng, p.lat];
export const toLatLng = (p: Pos): LatLng => ({ lat: p[1], lng: p[0] });

const RAD = Math.PI / 180;
const DEG = 180 / Math.PI;

/**
 * Compass bearing from `a` to `b`, in degrees clockwise from north.
 *
 * This is what points the puck. Without it a vehicle marker slides sideways
 * and backwards down the road, which reads as broken instantly even when the
 * position is perfectly correct.
 */
export function bearing(a: Pos, b: Pos): number {
  const lat1 = a[1] * RAD;
  const lat2 = b[1] * RAD;
  const dLng = (b[0] - a[0]) * RAD;
  const y = Math.sin(dLng) * Math.cos(lat2);
  const x =
    Math.cos(lat1) * Math.sin(lat2) -
    Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLng);
  return (Math.atan2(y, x) * DEG + 360) % 360;
}

/**
 * Interpolate an angle the short way round.
 *
 * Plain lerp between 350° and 10° spins the marker 340° backwards through a
 * full turn. Taking the signed shortest delta makes it flick 20° forwards,
 * which is what the vehicle actually did.
 */
export function lerpAngle(from: number, to: number, t: number): number {
  const delta = ((((to - from) % 360) + 540) % 360) - 180;
  return (from + delta * t + 360) % 360;
}

/** Straight-line interpolation between two positions. */
export function lerpPos(a: Pos, b: Pos, t: number): Pos {
  return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
}

/** Cubic ease-out — fast start, gentle settle. Matches how a car decelerates
 *  into a stop far better than a linear ramp, which arrives with a jolt. */
export const easeOut = (t: number) => 1 - Math.pow(1 - t, 3);

/** Total length of a line, in km. */
export function lineLengthKm(line: Pos[]): number {
  let total = 0;
  for (let i = 1; i < line.length; i++) {
    total += haversineKm(toLatLng(line[i - 1]), toLatLng(line[i]));
  }
  return total;
}

export interface Snapped {
  /** The point on the line closest to the query. */
  point: Pos;
  /** Index of the segment it fell on (point lies between i and i+1). */
  index: number;
  /** How far along the whole line that point is, in km. */
  alongKm: number;
  /** How far the query was from the line, in km. */
  offsetKm: number;
}

/**
 * Project a position onto a route line.
 *
 * Two jobs at once. It tells us how far along the route the provider has got
 * — which is what lets the travelled part of the line be greyed out behind
 * them, the single strongest "they are moving" cue in the whole UI — and it
 * pulls a GPS fix that landed in a building back onto the road.
 */
export function snapToLine(line: Pos[], p: Pos): Snapped | null {
  if (line.length === 0) return null;
  if (line.length === 1) {
    return {
      point: line[0],
      index: 0,
      alongKm: 0,
      offsetKm: haversineKm(toLatLng(line[0]), toLatLng(p)),
    };
  }

  let best: Snapped | null = null;
  let travelled = 0;

  for (let i = 0; i < line.length - 1; i++) {
    const a = line[i];
    const b = line[i + 1];
    const segKm = haversineKm(toLatLng(a), toLatLng(b));

    // Over one road segment the earth is flat enough to treat lng/lat as
    // planar, provided lng is scaled by cos(lat) so a degree of each covers
    // the same ground. Below city scale the error is centimetres.
    const cos = Math.cos(a[1] * RAD) || 1e-6;
    const ax = a[0] * cos;
    const bx = b[0] * cos;
    const px = p[0] * cos;
    const dx = bx - ax;
    const dy = b[1] - a[1];
    const denom = dx * dx + dy * dy;
    const t =
      denom === 0
        ? 0
        : Math.max(0, Math.min(1, ((px - ax) * dx + (p[1] - a[1]) * dy) / denom));

    const point: Pos = lerpPos(a, b, t);
    const offsetKm = haversineKm(toLatLng(point), toLatLng(p));

    if (!best || offsetKm < best.offsetKm) {
      best = { point, index: i, alongKm: travelled + segKm * t, offsetKm };
    }
    travelled += segKm;
  }

  return best;
}

/** Bounding box of a set of positions, as MapLibre's [[w,s],[e,n]]. */
export function boundsOf(points: Pos[]): [[number, number], [number, number]] | null {
  if (points.length === 0) return null;
  let w = points[0][0];
  let e = points[0][0];
  let s = points[0][1];
  let n = points[0][1];
  for (const [lng, lat] of points) {
    if (lng < w) w = lng;
    if (lng > e) e = lng;
    if (lat < s) s = lat;
    if (lat > n) n = lat;
  }
  return [
    [w, s],
    [e, n],
  ];
}
