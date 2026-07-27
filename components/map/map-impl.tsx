"use client";

import { useEffect, useState } from "react";
import { MapContainer, TileLayer, CircleMarker, Tooltip, useMap } from "react-leaflet";
import "leaflet/dist/leaflet.css";
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

/** Read a themed color from the CSS variables so markers follow the theme. */
function themeColor(varName: string, fallback: string): string {
  if (typeof window === "undefined") return fallback;
  const raw = getComputedStyle(document.documentElement)
    .getPropertyValue(varName)
    .trim();
  return raw ? `rgb(${raw})` : fallback;
}

/** Keep the view on the center when it meaningfully changes. */
function Recenter({ center }: { center: [number, number] }) {
  const map = useMap();
  useEffect(() => {
    map.setView(center, map.getZoom(), { animate: true });
  }, [center, map]);
  return null;
}

export default function MapImpl({
  doctors = [],
  requests = [],
  self = null,
  center,
  height = 420,
}: MapProps) {
  const [colors, setColors] = useState({
    gold: "#C6A64C",
    cream: "#E8E9E1",
  });
  useEffect(() => {
    setColors({
      gold: themeColor("--c-tan", "#C6A64C"),
      cream: themeColor("--c-cream", "#E8E9E1"),
    });
  }, []);

  const c: [number, number] = center
    ? [center.lat, center.lng]
    : self
      ? [self.lat, self.lng]
      : [MAP_CENTER.lat, MAP_CENTER.lng];

  return (
    <MapContainer
      center={c}
      zoom={MAP_ZOOM}
      scrollWheelZoom={false}
      style={{ height, width: "100%", borderRadius: 14 }}
      preferCanvas
    >
      <Recenter center={c} />
      <TileLayer
        attribution="&copy; OpenStreetMap"
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />

      {/* Online doctors */}
      {doctors
        .filter((d) => d.status !== "offline" && d.lat && d.lng)
        .map((d) => (
          <CircleMarker
            key={`doc-${d.id}`}
            center={[d.lat, d.lng]}
            radius={5}
            pathOptions={{ color: colors.gold, fillColor: colors.gold, fillOpacity: 0.85, weight: 1 }}
          >
            <Tooltip>
              {d.fullName} · {d.specialty}
            </Tooltip>
          </CircleMarker>
        ))}

      {/* Patient consult requests (pending = hollow, accepted = filled) */}
      {requests
        .filter((r) => (r.status === "pending" || r.status === "accepted") && r.lat && r.lng)
        .map((r) => {
          const pending = r.status === "pending";
          return (
            <CircleMarker
              key={`req-${r.id}`}
              center={[r.lat, r.lng]}
              radius={8}
              pathOptions={{
                color: colors.cream,
                fillColor: pending ? "transparent" : colors.cream,
                fillOpacity: pending ? 0 : 0.7,
                weight: 2,
                dashArray: pending ? "4 4" : undefined,
              }}
            >
              <Tooltip>
                {r.patientName} · {consultTypeOf(r.type).label}
                {pending ? " (waiting)" : " (accepted)"}
              </Tooltip>
            </CircleMarker>
          );
        })}

      {/* You */}
      {self && (
        <CircleMarker
          center={[self.lat, self.lng]}
          radius={7}
          pathOptions={{ color: colors.cream, fillColor: colors.cream, fillOpacity: 0.95, weight: 2 }}
        >
          <Tooltip direction="top">{self.label ?? "You are here"}</Tooltip>
        </CircleMarker>
      )}
    </MapContainer>
  );
}
