"use client";

import { useEffect, useRef, useState } from "react";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { useGlMap } from "@/components/map/gl/use-gl-map";
import { ZoomHint } from "@/components/map/gl/zoom-hint";
import { mapPalette } from "@/lib/maps/colors";
import type { Doctor, LatLng } from "@/lib/types/domain";

export interface DoctorMapProps {
  patient: LatLng;
  doctors: Doctor[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  height?: number;
  /** Fill the parent (height 100%) instead of a fixed px height. */
  fill?: boolean;
}

const SRC = "iy-doctors";
const HALO = "iy-doctors-halo";
const DOTS = "iy-doctors-dots";

export default function DoctorMapImpl({
  patient,
  doctors,
  selectedId,
  onSelect,
  height = 340,
  fill = false,
}: DoctorMapProps) {
  const { containerRef, map: mapRef, ready, armed } = useGlMap({
    center: patient,
    zoom: 13,
    immediateWheel: fill,
    hideControls: !fill,
  });
  const [palette] = useState(() => mapPalette());
  const me = useRef<maplibregl.Marker | null>(null);
  const popup = useRef<maplibregl.Popup | null>(null);
  const selectRef = useRef(onSelect);
  selectRef.current = onSelect;

  // ── Layers, once ──────────────────────────────────────────
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return;

    if (!map.getSource(SRC)) {
      map.addSource(SRC, {
        type: "geojson",
        data: { type: "FeatureCollection", features: [] },
        // The doctor id is a string, so it has to be promoted before
        // setFeatureState can address a feature by it.
        promoteId: "id",
      });
    }

    const selected = ["boolean", ["feature-state", "selected"], false];

    if (!map.getLayer(HALO)) {
      map.addLayer({
        id: HALO,
        type: "circle",
        source: SRC,
        filter: ["==", ["get", "id"], ""], // narrowed to the selection below
        paint: {
          "circle-radius": 18,
          "circle-color": palette.route,
          "circle-opacity": 0.18,
        },
      });
    }

    if (!map.getLayer(DOTS)) {
      map.addLayer({
        id: DOTS,
        type: "circle",
        source: SRC,
        paint: {
          "circle-radius": ["case", selected, 10, 7] as never,
          // Unselected providers sit in brand gold; the selected one flips to
          // the accent, which is the loudest colour on a quiet basemap.
          "circle-color": ["case", selected, palette.route, palette.pin] as never,
          "circle-opacity": ["case", selected, 1, 0.9] as never,
          "circle-stroke-width": ["case", selected, 3, 1.5] as never,
          "circle-stroke-color": palette.casing,
        },
      });
    }

    // Hover: a name is the only way to tell one gold dot from another.
    const hover = (e: maplibregl.MapLayerMouseEvent) => {
      const f = e.features?.[0];
      if (!f) return;
      map.getCanvas().style.cursor = "pointer";
      const p = f.properties as { name?: string; specialty?: string };
      popup.current
        ?.setLngLat((f.geometry as GeoJSON.Point).coordinates as [number, number])
        .setText([p.name, p.specialty].filter(Boolean).join(" · "))
        .addTo(map);
    };
    const leave = () => {
      map.getCanvas().style.cursor = "";
      popup.current?.remove();
    };
    const click = (e: maplibregl.MapLayerMouseEvent) => {
      const id = e.features?.[0]?.properties?.id;
      if (typeof id === "string") selectRef.current(id);
    };

    popup.current = new maplibregl.Popup({
      closeButton: false,
      closeOnClick: false,
      offset: 14,
      className: "iy-map-popup",
    });

    map.on("mousemove", DOTS, hover);
    map.on("mouseleave", DOTS, leave);
    map.on("click", DOTS, click);

    return () => {
      map.off("mousemove", DOTS, hover);
      map.off("mouseleave", DOTS, leave);
      map.off("click", DOTS, click);
      popup.current?.remove();
      popup.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, palette]);

  // ── Doctor pins ───────────────────────────────────────────
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return;
    const src = map.getSource(SRC) as maplibregl.GeoJSONSource | undefined;
    if (!src) return;

    src.setData({
      type: "FeatureCollection",
      features: doctors
        .filter((d) => d.lat && d.lng)
        .map((d) => ({
          type: "Feature",
          id: d.id,
          properties: { id: d.id, name: d.fullName, specialty: d.specialty },
          geometry: { type: "Point", coordinates: [d.lng, d.lat] },
        })),
    });
  }, [ready, doctors, mapRef]);

  // ── Selection ─────────────────────────────────────────────
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return;

    // feature-state survives a data update, so every id has to be cleared —
    // otherwise a previous selection keeps its ring after the list re-filters.
    for (const d of doctors) {
      map.setFeatureState({ source: SRC, id: d.id }, { selected: d.id === selectedId });
    }
    if (map.getLayer(HALO)) {
      map.setFilter(HALO, ["==", ["get", "id"], selectedId ?? ""]);
    }
  }, [ready, selectedId, doctors, mapRef]);

  // ── "You are here" ────────────────────────────────────────
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return;

    if (!me.current) {
      const el = document.createElement("div");
      el.style.cssText = "width:34px;height:34px;display:grid;place-items:center";
      el.innerHTML = `
        <span class="iy-pulse" style="position:absolute;width:14px;height:14px;border-radius:9999px;background:${palette.route}"></span>
        <span style="position:relative;width:12px;height:12px;border-radius:9999px;background:${palette.route};border:2px solid ${palette.casing}"></span>`;
      me.current = new maplibregl.Marker({ element: el }).setLngLat([patient.lng, patient.lat]).addTo(map);
    } else {
      me.current.setLngLat([patient.lng, patient.lat]);
    }
    // Follow the patient rather than re-fitting to the roster: the roster
    // changes on every filter keystroke, and a map that re-frames itself as
    // you type is unusable.
    map.easeTo({ center: [patient.lng, patient.lat], duration: 700 });
  }, [ready, patient.lat, patient.lng, palette, mapRef]);

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
      style={{ height: fill ? "100%" : height, width: "100%", borderRadius: fill ? 0 : 14 }}
    >
      <div ref={containerRef} className="h-full w-full" />
      <ZoomHint armed={armed} />
    </div>
  );
}
