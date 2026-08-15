"use client";

import { useEffect, useRef, useState } from "react";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { useGlMap } from "@/components/map/gl/use-gl-map";
import { mapPalette } from "@/lib/maps/colors";
import { MAP_CENTER } from "@/lib/config";

export interface ClinicPin {
  id: string;
  fullName: string;
  specialty: string;
  clinicAddress: string;
  lat: number;
  lng: number;
}

export interface ClinicMapProps {
  clinics: ClinicPin[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  userLocation?: { lat: number; lng: number } | null;
}

const SRC = "iy-clinics";
const HALO = "iy-clinics-halo";
const DOTS = "iy-clinics-dots";
const USER_SRC = "iy-user-location";
const USER_HALO = "iy-user-location-halo";
const USER_DOT = "iy-user-location-dot";

/**
 * The clinic map behind the landing section.
 *
 * Deliberately thinner than the patient app's DoctorMap: no live positions, no
 * routing, no availability pulse. It answers one question — "is there a doctor
 * near me?" — for someone who has not signed in and may never. Everything it
 * draws comes from /api/public, which publishes clinic coordinates and refuses
 * to publish a provider's live lat/lng.
 */
export default function ClinicMapImpl({
  clinics,
  selectedId,
  onSelect,
  userLocation = null,
}: ClinicMapProps) {
  const { containerRef, map: mapRef, ready, armed } = useGlMap({
    center: MAP_CENTER,
    zoom: 12,
    hideControls: true,
  });
  const [palette] = useState(() => mapPalette());
  const popup = useRef<maplibregl.Popup | null>(null);
  const selectRef = useRef(onSelect);
  selectRef.current = onSelect;
  const userLocationRef = useRef(userLocation);
  userLocationRef.current = userLocation;

  // ── Layers, once ──────────────────────────────────────────
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return;

    if (!map.getSource(SRC)) {
      map.addSource(SRC, {
        type: "geojson",
        data: { type: "FeatureCollection", features: [] },
        // Clinic ids are strings; promoteId is what lets setFeatureState
        // address a feature by one.
        promoteId: "id",
      });
    }

    if (!map.getLayer(HALO)) {
      map.addLayer({
        id: HALO,
        type: "circle",
        source: SRC,
        paint: {
          "circle-radius": ["case", ["boolean", ["feature-state", "on"], false], 20, 14],
          "circle-color": palette.pin,
          "circle-opacity": 0.18,
        },
      });
      // Set through the runtime API, not the paint literal: `-transition` keys
      // are real in the MapLibre STYLE SPEC but missing from its TypeScript
      // paint types, so declaring one inline fails the build. Same 220ms grow
      // on hover, expressed where the types allow it.
      map.setPaintProperty(HALO, "circle-radius-transition", { duration: 220 });
    }

    if (!map.getLayer(DOTS)) {
      map.addLayer({
        id: DOTS,
        type: "circle",
        source: SRC,
        paint: {
          "circle-radius": ["case", ["boolean", ["feature-state", "on"], false], 9, 6.5],
          "circle-color": palette.pin,
          "circle-stroke-width": 2,
          "circle-stroke-color": palette.light ? "#ffffff" : palette.ink,
        },
      });
      map.setPaintProperty(DOTS, "circle-radius-transition", { duration: 220 });
    }

    if (!map.getSource(USER_SRC)) {
      map.addSource(USER_SRC, {
        type: "geojson",
        data: { type: "FeatureCollection", features: [] },
      });
    }
    if (!map.getLayer(USER_HALO)) {
      map.addLayer({
        id: USER_HALO,
        type: "circle",
        source: USER_SRC,
        paint: {
          "circle-radius": 18,
          "circle-color": "#2f7bc4",
          "circle-opacity": 0.16,
        },
      });
    }
    if (!map.getLayer(USER_DOT)) {
      map.addLayer({
        id: USER_DOT,
        type: "circle",
        source: USER_SRC,
        paint: {
          "circle-radius": 7,
          "circle-color": "#2f7bc4",
          "circle-stroke-width": 3,
          "circle-stroke-color": "#ffffff",
        },
      });
    }

    const click = (e: maplibregl.MapLayerMouseEvent) => {
      const id = e.features?.[0]?.properties?.id;
      if (typeof id === "string") selectRef.current(id);
    };
    const enter = () => void (map.getCanvas().style.cursor = "pointer");
    const leave = () => void (map.getCanvas().style.cursor = "");
    const userEnter = () => void (map.getCanvas().style.cursor = "pointer");
    const userLeave = () => void (map.getCanvas().style.cursor = "");
    const userClick = () => {
      popup.current?.remove();
      popup.current = new maplibregl.Popup({
        closeButton: false,
        offset: 16,
        className: "iy-clinic-popup",
      })
        .setLngLat(userLocationRef.current
          ? [userLocationRef.current.lng, userLocationRef.current.lat]
          : map.getCenter())
        .setHTML("<strong>You are here</strong><span>Your current location</span>")
        .addTo(map);
    };

    map.on("click", DOTS, click);
    map.on("mouseenter", DOTS, enter);
    map.on("mouseleave", DOTS, leave);
    map.on("click", USER_DOT, userClick);
    map.on("mouseenter", USER_DOT, userEnter);
    map.on("mouseleave", USER_DOT, userLeave);
    return () => {
      map.off("click", DOTS, click);
      map.off("mouseenter", DOTS, enter);
      map.off("mouseleave", DOTS, leave);
      map.off("click", USER_DOT, userClick);
      map.off("mouseenter", USER_DOT, userEnter);
      map.off("mouseleave", USER_DOT, userLeave);
    };
  }, [ready, mapRef, palette]);

  // ── Data ──────────────────────────────────────────────────
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return;
    const src = map.getSource(SRC) as maplibregl.GeoJSONSource | undefined;
    if (!src) return;

    src.setData({
      type: "FeatureCollection",
      features: clinics.map((c) => ({
        type: "Feature" as const,
        id: c.id,
        properties: { id: c.id },
        geometry: { type: "Point" as const, coordinates: [c.lng, c.lat] },
      })),
    });

    const userSource = map.getSource(USER_SRC) as maplibregl.GeoJSONSource | undefined;
    userSource?.setData({
      type: "FeatureCollection",
      features: userLocation
        ? [{
            type: "Feature" as const,
            properties: {},
            geometry: { type: "Point" as const, coordinates: [userLocation.lng, userLocation.lat] },
          }]
        : [],
    });

    // Frame every pin. Without this the camera sits on the city default and a
    // clinic three suburbs out is simply off-screen with no hint it exists.
    if (clinics.length > 0) {
      const b = new maplibregl.LngLatBounds();
      clinics.forEach((c) => b.extend([c.lng, c.lat]));
      if (userLocation) b.extend([userLocation.lng, userLocation.lat]);
      map.fitBounds(b, { padding: 64, maxZoom: 13.5, duration: 700 });
    }
  }, [clinics, userLocation, ready, mapRef]);

  // ── Selection: highlight the pin, and say whose it is ──────
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return;

    clinics.forEach((c) =>
      map.setFeatureState({ source: SRC, id: c.id }, { on: c.id === selectedId }),
    );

    popup.current?.remove();
    popup.current = null;

    const chosen = clinics.find((c) => c.id === selectedId);
    if (!chosen) return;

    // Name and clinic only. A landing map is a shop window, not a profile —
    // fees, ratings and availability belong behind the card, not on a pin.
    popup.current = new maplibregl.Popup({
      closeButton: false,
      offset: 16,
      className: "iy-clinic-popup",
    })
      .setLngLat([chosen.lng, chosen.lat])
      .setHTML(
        `<strong>${esc(chosen.fullName)}</strong><span>${esc(chosen.clinicAddress)}</span>`,
      )
      .addTo(map);

    map.easeTo({ center: [chosen.lng, chosen.lat], duration: 500 });
  }, [selectedId, clinics, ready, mapRef]);

  return (
    <div className="relative h-full w-full">
      <div ref={containerRef} className="h-full w-full" />
      <div className="pointer-events-none absolute left-4 top-4 flex flex-wrap gap-2 rounded-2xl border border-white/70 bg-white/85 px-3 py-2 shadow-lg backdrop-blur-md">
        <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-[var(--text)]">
          <span className="h-3 w-3 rounded-full border-2 border-white bg-[#2f7bc4] shadow-[0_0_0_3px_rgb(47_123_196/0.16)]" />
          You are here
        </span>
        <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-[var(--text)]">
          <span className="h-3 w-3 rounded-full border-2 border-white bg-[#c99a34] shadow-[0_0_0_2px_rgb(201_154_52/0.18)]" />
          Doctor clinic
        </span>
      </div>
      {!armed && (
        <div className="pointer-events-none absolute inset-x-0 bottom-3 flex justify-center">
          <span className="rounded-full bg-black/55 px-3 py-1 text-[11px] text-white backdrop-blur">
            Click the map to zoom
          </span>
        </div>
      )}
    </div>
  );
}

/** Popups take raw HTML, and a clinic name is user-supplied text. */
function esc(s: string) {
  return s.replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!,
  );
}
