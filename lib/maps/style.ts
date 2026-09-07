import type { StyleSpecification } from "maplibre-gl";

/**
 * Where the basemap comes from.
 *
 * MapLibre needs a style, and a style needs tiles. Doceeto uses OpenStreetMap
 * raster tiles so maps work without a browser-exposed vendor key. The renderer
 * remains MapLibre, so markers, routes and camera movement behave exactly as
 * before; only the visual basemap is keyless.
 */

/** OpenStreetMap's keyless standard tiles as a MapLibre style. Attribution is
 * carried on the source so it is visible in MapLibre's attribution control. */
function rasterStyle(light: boolean): StyleSpecification {
  return {
    version: 8,
    sources: {
      openstreetmap: {
        type: "raster",
        tiles: ["https://tile.openstreetmap.org/{z}/{x}/{y}.png"],
        tileSize: 256,
        maxzoom: 20,
        attribution:
          '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap contributors</a>',
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
        id: "openstreetmap",
        type: "raster",
        source: "openstreetmap",
        // Quiet the basemap at the SOURCE rather than with a CSS filter over
        // the canvas: MapLibre draws the route into that same canvas, so a
        // filter there would recolour the journey along with the tiles.
        paint: { "raster-saturation": -0.25, "raster-contrast": -0.05 },
      },
    ],
  };
}

/** The inline, keyless style handed to MapLibre. */
export function basemapStyle(light: boolean): string | StyleSpecification {
  return rasterStyle(light);
}
