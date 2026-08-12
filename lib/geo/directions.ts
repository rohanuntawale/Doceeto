import "server-only";
import type { LatLng } from "@/lib/utils/geo";

/**
 * Driving directions — the road-following line a provider will actually take.
 *
 * A straight line between two pins is a lie the moment there is a river, a
 * one-way or a flyover between them, and it is the single thing that made the
 * old tracker read as a diagram rather than as a live journey. This returns
 * the real geometry plus the routing engine's own duration, which is a far
 * better ETA than distance ÷ an assumed speed.
 *
 * Runs SERVER-side: the routing host stays swappable without shipping a new
 * client bundle, the demo host is never called straight from a browser, and a
 * paid provider's key (if one is ever added) never leaves the server.
 */

/**
 * OSRM by default. The public demo host has no SLA and a fair-use policy —
 * fine for development, NOT for production traffic. Point OSRM_URL at your own
 * container (`osrm/osrm-backend` with an India extract) or at any OSRM-
 * compatible host before launch.
 */
const OSRM_URL = process.env.OSRM_URL || "https://router.project-osrm.org";

export interface Directions {
  /** The path, as GeoJSON [lng, lat] positions. */
  line: [number, number][];
  /** Driving distance along that path, in metres. */
  distanceM: number;
  /** The engine's own estimate, in seconds. */
  durationS: number;
}

const cache = new Map<string, { value: Directions | null; at: number }>();
/** A road layout is stable; a route between two fixed points is not worth
 *  recomputing for ten minutes. Traffic is not modelled by OSRM anyway. */
const CACHE_TTL = 10 * 60_000;
const CACHE_MAX = 300;

/** ~11m resolution. Finer than this just fragments the cache: two GPS fixes a
 *  few metres apart produce the same road route. */
const key = (a: LatLng, b: LatLng) =>
  `${a.lat.toFixed(4)},${a.lng.toFixed(4)};${b.lat.toFixed(4)},${b.lng.toFixed(4)}`;

export async function drivingRoute(
  from: LatLng,
  to: LatLng,
): Promise<Directions | null> {
  const k = key(from, to);
  const hit = cache.get(k);
  if (hit && Date.now() - hit.at < CACHE_TTL) return hit.value;

  // overview=full keeps every vertex, so the line hugs the road at the zoom a
  // follow-camera sits at; `simplified` visibly cuts corners there.
  const url =
    `${OSRM_URL}/route/v1/driving/` +
    `${from.lng},${from.lat};${to.lng},${to.lat}` +
    `?overview=full&geometries=geojson&alternatives=false&steps=false`;

  try {
    const res = await fetch(url, {
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(6000),
      cache: "no-store",
    });
    if (!res.ok) throw new Error(`osrm ${res.status}`);

    const json = (await res.json()) as {
      code?: string;
      routes?: Array<{
        distance?: number;
        duration?: number;
        geometry?: { coordinates?: unknown };
      }>;
    };

    const route = json.routes?.[0];
    const coords = route?.geometry?.coordinates;
    if (json.code !== "Ok" || !route || !Array.isArray(coords) || coords.length < 2) {
      throw new Error("osrm: no route");
    }

    const line = coords
      .filter(
        (c): c is [number, number] =>
          Array.isArray(c) &&
          Number.isFinite(c[0]) &&
          Number.isFinite(c[1]),
      )
      .map(([lng, lat]) => [lng, lat] as [number, number]);
    if (line.length < 2) throw new Error("osrm: degenerate geometry");

    const value: Directions = {
      line,
      distanceM: Number(route.distance) || 0,
      durationS: Number(route.duration) || 0,
    };

    if (cache.size > CACHE_MAX) cache.clear();
    cache.set(k, { value, at: Date.now() });
    return value;
  } catch {
    // Remember the miss for a minute. The map falls back to a straight line
    // and a distance-based ETA, so a routing outage degrades the tracker
    // rather than emptying it — but it must not retry on every GPS ping.
    cache.set(k, { value: null, at: Date.now() - CACHE_TTL + 60_000 });
    return null;
  }
}
