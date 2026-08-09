import "server-only";

/**
 * Reverse geocoding — lat/lng → a short human address ("Sadar, Nagpur").
 *
 * Runs SERVER-side on purpose: OpenStreetMap's Nominatim requires an
 * identifying User-Agent and rate-limits per caller, neither of which a browser
 * can honour. The same tiles already back the maps, so no new vendor and no
 * API key enters the stack.
 *
 * Every failure path returns null — a location fix is still useful without a
 * name for it, so a lookup that times out or gets throttled must never break
 * the caller.
 */

const ENDPOINT = "https://nominatim.openstreetmap.org/reverse";
const UA = "Iyashi/1.0 (healthcare app; reverse geocoding for patient location)";

/** Cache keyed on ~110m-resolution coordinates: walking around a
 *  neighbourhood should not re-query for every step. */
export interface ResolvedAddress {
  /** "Sadar, Nagpur" — the header label. */
  short: string | null;
  /**
   * The postal address, house number included. A doctor standing outside has
   * to find a door, and "Sadar, Nagpur" cannot get them there — so the full
   * line is kept alongside the label rather than thrown away.
   */
  full: string | null;
}

const cache = new Map<string, { address: ResolvedAddress; at: number }>();
const CACHE_TTL = 24 * 60 * 60_000; // a street name does not change hourly
const CACHE_MAX = 500;

/** Nominatim's policy is at most one request per second, process-wide. */
let lastCallAt = 0;
const MIN_GAP_MS = 1100;

function key(lat: number, lng: number) {
  return `${lat.toFixed(3)},${lng.toFixed(3)}`;
}

/**
 * Compose the short label. The full Nominatim display_name is a postal essay
 * ("12, Ring Road, Sadar, Nagpur, Nagpur District, Maharashtra, 440001,
 * India"); the header line wants "Sadar, Nagpur".
 */
function shorten(json: Record<string, unknown>): string | null {
  const a = (json.address ?? {}) as Record<string, string | undefined>;
  const locality =
    a.suburb ??
    a.neighbourhood ??
    a.village ??
    a.town ??
    a.city_district ??
    a.hamlet ??
    a.road;
  const city = a.city ?? a.town ?? a.municipality ?? a.county ?? a.state_district;
  const parts = [locality, city].filter(
    (p, i, all): p is string => Boolean(p) && all.indexOf(p) === i,
  );
  if (parts.length) return parts.join(", ").slice(0, 120);

  const display = typeof json.display_name === "string" ? json.display_name : "";
  return display ? display.split(",").slice(0, 2).join(",").trim().slice(0, 120) : null;
}

/**
 * The complete postal line, tidied. Nominatim's display_name ends in
 * ", India" and repeats the district; both are noise to someone driving there,
 * but the house number and street at the front are exactly what they need.
 */
function fullLine(json: Record<string, unknown>): string | null {
  const display = typeof json.display_name === "string" ? json.display_name : "";
  if (!display) return null;
  const parts = display
    .split(",")
    .map((p) => p.trim())
    .filter(Boolean)
    .filter((p, i, all) => all.indexOf(p) === i)
    .filter((p) => !/^india$/i.test(p));
  return parts.join(", ").slice(0, 200) || null;
}

export async function reverseGeocode(lat: number, lng: number): Promise<ResolvedAddress> {
  const k = key(lat, lng);
  const hit = cache.get(k);
  if (hit && Date.now() - hit.at < CACHE_TTL) return hit.address;

  // Space out calls rather than firing them off in parallel; being blocked by
  // Nominatim would cost every user their address, not just this one.
  const wait = lastCallAt + MIN_GAP_MS - Date.now();
  if (wait > 0) await new Promise((r) => setTimeout(r, wait));
  lastCallAt = Date.now();

  // Nominatim spells it "lon" — the rest of the codebase says lng.
  // zoom=18 resolves to a building, so the full line carries a house number;
  // the short label is still derived from the same response.
  const url = `${ENDPOINT}?format=jsonv2&zoom=18&addressdetails=1&lat=${lat}&lon=${lng}`;

  try {
    const res = await fetch(url, {
      headers: { "User-Agent": UA, Accept: "application/json" },
      signal: AbortSignal.timeout(6000),
      cache: "no-store",
    });
    if (!res.ok) throw new Error(`nominatim ${res.status}`);
    const json = (await res.json()) as Record<string, unknown>;
    const address: ResolvedAddress = { short: shorten(json), full: fullLine(json) };

    if (cache.size > CACHE_MAX) cache.clear();
    cache.set(k, { address, at: Date.now() });
    return address;
  } catch {
    // Remember the miss briefly so a dead network is not retried on every
    // position update, but do not poison the cache for a day.
    const miss: ResolvedAddress = { short: null, full: null };
    cache.set(k, { address: miss, at: Date.now() - CACHE_TTL + 60_000 });
    return miss;
  }
}
