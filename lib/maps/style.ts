import type { StyleSpecification } from "maplibre-gl";

/**
 * Where the basemap comes from.
 *
 * MapLibre needs a style, and a style needs tiles. We resolve that in two
 * tiers so the app keeps its "works with zero env" promise:
 *
 *  1. NEXT_PUBLIC_MAPTILER_KEY set -> a real VECTOR style. Vector is what
 *     makes the map read like Uber rather than like a scanned atlas: labels
 *     stay upright while the map rotates, roads stay crisp at every zoom,
 *     and the whole scene can tilt.
 *  2. No key -> a RASTER style built from CARTO's free basemaps. The renderer
 *     is still MapLibre, so the puck still animates smoothly and the camera
 *     still eases; only the tiles are flat images. Nothing breaks, nobody has
 *     to sign up, and the upgrade is one env var later.
 *
 * Both tiers come in a light and a dark cut, chosen from the active shell —
 * a dark map inside a paper-white app reads as a screenshot of a different
 * product.
 *
 * The key is public by design — it travels in every tile request from the
 * browser. Restrict it by HTTP referrer in the MapTiler dashboard, which is
 * the only control that actually protects it.
 */

const MAPTILER_KEY = process.env.NEXT_PUBLIC_MAPTILER_KEY ?? "";

/** True when a real vector basemap is configured. */
export const hasVectorBasemap = Boolean(MAPTILER_KEY);

/**
 * MapTiler's `dataviz` styles, over `streets`, deliberately: they draw the
 * road network without the shop-and-restaurant label soup, so our own route
 * line and markers stay the loudest thing on screen — the same reason
 * ride-hailing apps strip their basemaps back.
 */
const vectorStyle = (light: boolean) =>
  `https://api.maptiler.com/maps/${light ? "dataviz-light" : "dataviz-dark"}/style.json?key=${MAPTILER_KEY}`;

/** CARTO's free, keyless basemaps as a MapLibre style. Attribution required
 *  and carried on the source, which surfaces it in the attribution control. */
function rasterStyle(light: boolean): StyleSpecification {
  const set = light ? "light_all" : "dark_all";
  return {
    version: 8,
    sources: {
      carto: {
        type: "raster",
        tiles: ["a", "b", "c"].map(
          (h) => `https://${h}.basemaps.cartocdn.com/${set}/{z}/{x}/{y}@2x.png`,
        ),
        tileSize: 256,
        maxzoom: 20,
        attribution:
          '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>',
      },
    },
    layers: [
      // Painted under the tiles so a tile that is still loading shows the
      // shell's own ground rather than the browser's white, which flashes
      // hard against a dark page.
      {
        id: "bg",
        type: "background",
        paint: { "background-color": light ? "#EDF3EF" : "#1A1210" },
      },
      {
        id: "carto",
        type: "raster",
        source: "carto",
        // Quiet the basemap at the SOURCE rather than with a CSS filter over
        // the canvas: MapLibre draws the route into that same canvas, so a
        // filter there would recolour the journey along with the tiles.
        paint: { "raster-saturation": -0.25, "raster-contrast": -0.05 },
      },
    ],
  };
}

/** The style to hand MapLibre: a URL when keyed, an inline spec otherwise. */
export function basemapStyle(light: boolean): string | StyleSpecification {
  return hasVectorBasemap ? vectorStyle(light) : rasterStyle(light);
}
