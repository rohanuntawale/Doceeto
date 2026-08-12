"use client";

/**
 * Brand colours for map layers.
 *
 * MapLibre paint properties take literal colour strings, not CSS variables, so
 * the tokens have to be read out of the document once and handed over.
 *
 * The catch the tokens themselves do not warn you about: `--c-cream` is the
 * PRIMARY TEXT colour, not a cream. On the default (light) shell it resolves
 * to near-black ink, so painting a route with it puts a dark line on a map and
 * calls it cream. Everything here therefore derives from the shell's LIGHTNESS
 * and from the accent, never from a token whose meaning flips between shells.
 */

export interface MapPalette {
  /** True when the shell is light, and so the basemap should be too. */
  light: boolean;
  /** The live route ahead of the provider — the loudest thing on the map. */
  route: string;
  /** The stretch already driven, deliberately quiet. */
  routeDone: string;
  /** Drawn under the route so it reads over roads, parks and buildings alike. */
  casing: string;
  /** The moving provider. */
  puck: string;
  /** The destination. */
  pin: string;
  /** Outline for markers, against whichever basemap is in play. */
  ink: string;
}

/** Read an "R G B" token as a triplet. */
function triplet(name: string, fallback: [number, number, number]): [number, number, number] {
  if (typeof window === "undefined") return fallback;
  const raw = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  const parts = raw.split(/[\s,]+/).map(Number).filter((n) => Number.isFinite(n));
  return parts.length === 3 ? (parts as [number, number, number]) : fallback;
}

const rgb = ([r, g, b]: [number, number, number]) => `rgb(${r}, ${g}, ${b})`;
const rgba = ([r, g, b]: [number, number, number], a: number) => `rgba(${r}, ${g}, ${b}, ${a})`;

/** Perceived lightness, 0–1. */
const luma = ([r, g, b]: [number, number, number]) =>
  (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;

/** Whether the active shell is a light one. The basemap follows it: a dark
 *  map inside a paper-white app looks like a screenshot of another product. */
export function isLightShell(): boolean {
  return luma(triplet("--c-espresso", [246, 249, 247])) > 0.5;
}

export function mapPalette(): MapPalette {
  const canvas = triplet("--c-espresso", [246, 249, 247]);
  const accent = triplet("--c-terracotta", [31, 106, 80]);
  const gold = triplet("--c-tan", [201, 161, 63]);
  const ink = triplet("--c-ink", [20, 38, 32]);
  const light = luma(canvas) > 0.5;

  return {
    light,
    // The accent is the one token that means the same thing in every shell:
    // "this is the important thing". On a desaturated basemap it is the only
    // saturated line on screen, which is exactly the navigation look.
    route: rgb(accent),
    routeDone: light ? rgba(ink, 0.2) : "rgba(232, 233, 225, 0.26)",
    // A white halo on a light map, a near-black one on a dark map — the same
    // trick road atlases use to keep a route legible over any underlying fill.
    casing: light ? "rgba(255, 255, 255, 0.95)" : "rgba(10, 7, 6, 0.85)",
    puck: rgb(accent),
    pin: rgb(gold),
    ink: light ? rgba(ink, 0.9) : "rgba(10, 7, 6, 0.85)",
  };
}
