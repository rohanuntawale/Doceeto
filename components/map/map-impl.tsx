"use client";

import { useEffect, useRef, useState } from "react";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { useGlMap } from "@/components/map/gl/use-gl-map";
import { ZoomHint } from "@/components/map/gl/zoom-hint";
import { mapPalette } from "@/lib/maps/colors";
import { MAP_CENTER, MAP_ZOOM } from "@/lib/config";
import { consultTypeOf } from "@/lib/labels";
import type { ConsultRequest, Doctor, LatLng } from "@/lib/types/domain";

export interface MapProps {
  doctors?: Doctor[];
  /** Patient consult requests — shown to doctors/ops as patient pins. */
  requests?: ConsultRequest[];
  /** The viewer's own position ("You are here"). */
  self?: (LatLng & { label?: string }) | null;
  /** Explicit center; falls back to `self`, then the city default. */
  center?: LatLng;
  height?: number;
}

const DOC_SRC = "iy-live-doctors";
const REQ_SRC = "iy-live-requests";
const DOC_LAYER = "iy-live-doctors-dots";
const REQ_LAYER = "iy-live-requests-dots";

export default function MapImpl({
  doctors = [],
  requests = [],
  self = null,
  center,
  height = 420,
}: MapProps) {
  const start = center ?? self ?? MAP_CENTER;
  const { containerRef, map: mapRef, ready, armed } = useGlMap({
    center: start,
    zoom: MAP_ZOOM,
  });
  const [palette] = useState(() => mapPalette());
  const me = useRef<maplibregl.Marker | null>(null);
  const popup = useRef<maplibregl.Popup | null>(null);

  // ── Layers ────────────────────────────────────────────────
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return;

    for (const id of [DOC_SRC, REQ_SRC]) {
      if (!map.getSource(id)) {
        map.addSource(id, {
          type: "geojson",
          data: { type: "FeatureCollection", features: [] },
        });
      }
    }

    if (!map.getLayer(DOC_LAYER)) {
      map.addLayer({
        id: DOC_LAYER,
        type: "circle",
        source: DOC_SRC,
        paint: {
          "circle-radius": 5,
          "circle-color": palette.pin,
          "circle-opacity": 0.9,
          "circle-stroke-width": 1,
          "circle-stroke-color": palette.casing,
        },
      });
    }

    // Waiting requests read as hollow rings, accepted ones as filled discs —
    // the same language the Leaflet map used, so ops does not have to relearn
    // the board.
    if (!map.getLayer(REQ_LAYER)) {
      map.addLayer({
        id: REQ_LAYER,
        type: "circle",
        source: REQ_SRC,
        paint: {
          "circle-radius": 8,
          "circle-color": palette.route,
          "circle-opacity": ["case", ["get", "pending"], 0, 0.7] as never,
          "circle-stroke-width": 2,
          "circle-stroke-color": palette.route,
        },
      });
    }

    popup.current = new maplibregl.Popup({
      closeButton: false,
      closeOnClick: false,
      offset: 12,
      className: "iy-map-popup",
    });

    const hover = (e: maplibregl.MapLayerMouseEvent) => {
      const f = e.features?.[0];
      if (!f) return;
      map.getCanvas().style.cursor = "pointer";
      popup.current
        ?.setLngLat((f.geometry as GeoJSON.Point).coordinates as [number, number])
        .setText(String((f.properties as { label?: string }).label ?? ""))
        .addTo(map);
    };
    const leave = () => {
      map.getCanvas().style.cursor = "";
      popup.current?.remove();
    };

    for (const layer of [DOC_LAYER, REQ_LAYER]) {
      map.on("mousemove", layer, hover);
      map.on("mouseleave", layer, leave);
    }
    return () => {
      for (const layer of [DOC_LAYER, REQ_LAYER]) {
        map.off("mousemove", layer, hover);
        map.off("mouseleave", layer, leave);
      }
      popup.current?.remove();
      popup.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, palette]);

  // ── Online doctors ────────────────────────────────────────
  useEffect(() => {
    const map = mapRef.current;
    const src = map?.getSource(DOC_SRC) as maplibregl.GeoJSONSource | undefined;
    if (!ready || !src) return;
    src.setData({
      type: "FeatureCollection",
      features: doctors
        .filter((d) => d.status !== "offline" && d.lat && d.lng)
        .map((d) => ({
          type: "Feature",
          properties: { label: `${d.fullName} · ${d.specialty}` },
          geometry: { type: "Point", coordinates: [d.lng, d.lat] },
        })),
    });
  }, [ready, doctors, mapRef]);

  // ── Open requests ─────────────────────────────────────────
  useEffect(() => {
    const map = mapRef.current;
    const src = map?.getSource(REQ_SRC) as maplibregl.GeoJSONSource | undefined;
    if (!ready || !src) return;
    src.setData({
      type: "FeatureCollection",
      features: requests
        .filter((r) => (r.status === "pending" || r.status === "accepted") && r.lat && r.lng)
        .map((r) => {
          const pending = r.status === "pending";
          return {
            type: "Feature",
            properties: {
              pending,
              label: `${r.patientName} · ${consultTypeOf(r.type).label}${
                pending ? " (waiting)" : " (accepted)"
              }`,
            },
            geometry: { type: "Point", coordinates: [r.lng, r.lat] },
          };
        }),
    });
  }, [ready, requests, mapRef]);

  // ── The viewer ────────────────────────────────────────────
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return;
    if (!self) {
      me.current?.remove();
      me.current = null;
      return;
    }
    if (!me.current) {
      const el = document.createElement("div");
      el.style.cssText = "width:32px;height:32px;display:grid;place-items:center";
      el.innerHTML = `
        <span class="iy-pulse" style="position:absolute;width:14px;height:14px;border-radius:9999px;background:${palette.route}"></span>
        <span style="position:relative;width:12px;height:12px;border-radius:9999px;background:${palette.route};border:2px solid ${palette.casing}"></span>`;
      me.current = new maplibregl.Marker({ element: el }).setLngLat([self.lng, self.lat]).addTo(map);
    } else {
      me.current.setLngLat([self.lng, self.lat]);
    }
  }, [ready, self?.lat, self?.lng, palette, mapRef]); // eslint-disable-line react-hooks/exhaustive-deps

  // Explicit center wins, then the viewer's own position.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return;
    const c = center ?? self;
    if (c) map.easeTo({ center: [c.lng, c.lat], duration: 700 });
  }, [ready, center?.lat, center?.lng, self?.lat, self?.lng, mapRef]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(
    () => () => {
      me.current?.remove();
      me.current = null;
    },
    [],
  );

  return (
    <div
      className="relative overflow-hidden"
      style={{ height, width: "100%", borderRadius: 14 }}
    >
      <div ref={containerRef} className="h-full w-full" />
      <ZoomHint armed={armed} />
    </div>
  );
}
