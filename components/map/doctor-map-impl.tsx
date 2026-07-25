"use client";

import { useEffect, useState } from "react";
import { MapContainer, TileLayer, CircleMarker, Tooltip, useMap } from "react-leaflet";
import "leaflet/dist/leaflet.css";
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

/** Read a themed color from the CSS variables so markers match the theme. */
function themeColor(varName: string, fallback: string): string {
  if (typeof window === "undefined") return fallback;
  const raw = getComputedStyle(document.documentElement)
    .getPropertyValue(varName)
    .trim();
  return raw ? `rgb(${raw})` : fallback;
}

/** Keep the view centered on the patient when it changes. */
function Recenter({ center }: { center: [number, number] }) {
  const map = useMap();
  useEffect(() => {
    map.setView(center, map.getZoom(), { animate: true });
  }, [center, map]);
  return null;
}

export default function DoctorMapImpl({
  patient,
  doctors,
  selectedId,
  onSelect,
  height = 340,
  fill = false,
}: DoctorMapProps) {
  // Recompute themed colors whenever the selection changes (cheap) so a
  // theme switch is reflected the next time the map re-renders.
  const [colors, setColors] = useState({
    accent: "#C15A38",
    accentSoft: "#E0A890",
    cream: "#F1E9D8",
  });
  useEffect(() => {
    setColors({
      // Doctors render in gold so they stay distinct from the white
      // "you are here" marker now that the UI accent is white.
      accent: themeColor("--c-tan", "#C6A64C"),
      accentSoft: themeColor("--c-salmon", "#D6BA6A"),
      cream: themeColor("--c-cream", "#F1E9D8"),
    });
  }, [selectedId]);

  const center: [number, number] = [patient.lat, patient.lng];

  return (
    <MapContainer
      center={center}
      zoom={13}
      scrollWheelZoom={false}
      style={{ height: fill ? "100%" : height, width: "100%", borderRadius: fill ? 0 : 14 }}
      preferCanvas
    >
      <Recenter center={center} />
      <TileLayer
        attribution="&copy; OpenStreetMap"
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />

      {/* You */}
      <CircleMarker
        center={center}
        radius={7}
        pathOptions={{
          color: colors.cream,
          fillColor: colors.cream,
          fillOpacity: 0.9,
          weight: 2,
        }}
      >
        <Tooltip direction="top">You are here</Tooltip>
      </CircleMarker>

      {/* Doctors matching the patient's filters */}
      {doctors
        .filter((d) => d.lat && d.lng)
        .map((d) => {
          const selected = d.id === selectedId;
          return (
            <CircleMarker
              key={d.id}
              center={[d.lat, d.lng]}
              radius={selected ? 12 : 8}
              eventHandlers={{ click: () => onSelect(d.id) }}
              pathOptions={{
                color: selected ? colors.cream : colors.accent,
                fillColor: selected ? colors.accent : colors.accentSoft,
                fillOpacity: selected ? 0.95 : 0.7,
                weight: selected ? 3 : 1.5,
              }}
            >
              <Tooltip direction="top">
                {d.fullName} · {d.specialty}
              </Tooltip>
            </CircleMarker>
          );
        })}
    </MapContainer>
  );
}
