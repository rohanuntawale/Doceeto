"use client";

import { useEffect, useState } from "react";
import {
  MapContainer,
  TileLayer,
  CircleMarker,
  Polyline,
  Tooltip,
  useMap,
} from "react-leaflet";
import "leaflet/dist/leaflet.css";
import type { LatLng } from "@/lib/types/domain";

export interface TrackMapProps {
  self: LatLng & { label?: string };
  other: LatLng & { label?: string };
  height?: number;
}

function themeColor(name: string, fallback: string): string {
  if (typeof window === "undefined") return fallback;
  const raw = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  return raw ? `rgb(${raw})` : fallback;
}

/** Fit both points in view whenever either moves. */
function Fit({ a, b }: { a: LatLng; b: LatLng }) {
  const map = useMap();
  useEffect(() => {
    map.fitBounds(
      [
        [a.lat, a.lng],
        [b.lat, b.lng],
      ],
      { padding: [50, 50], maxZoom: 15, animate: true },
    );
  }, [a.lat, a.lng, b.lat, b.lng, map]);
  return null;
}

export default function TrackMapImpl({ self, other, height = 300 }: TrackMapProps) {
  const [c, setC] = useState({ cream: "#E8E9E1", gold: "#C6A64C" });
  useEffect(() => {
    setC({
      cream: themeColor("--c-cream", "#E8E9E1"),
      gold: themeColor("--c-tan", "#C6A64C"),
    });
  }, []);

  const mid: [number, number] = [
    (self.lat + other.lat) / 2,
    (self.lng + other.lng) / 2,
  ];

  return (
    <MapContainer
      center={mid}
      zoom={14}
      scrollWheelZoom={false}
      style={{ height, width: "100%", borderRadius: 14 }}
      preferCanvas
    >
      <Fit a={self} b={other} />
      <TileLayer
        attribution="&copy; OpenStreetMap"
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />

      <Polyline
        positions={[
          [self.lat, self.lng],
          [other.lat, other.lng],
        ]}
        pathOptions={{ color: c.cream, weight: 2, opacity: 0.55, dashArray: "4 7" }}
      />

      {/* The counterpart (doctor for patients / patient for doctors) */}
      <CircleMarker
        center={[other.lat, other.lng]}
        radius={9}
        pathOptions={{ color: c.gold, fillColor: c.gold, fillOpacity: 0.9, weight: 2 }}
      >
        <Tooltip direction="top">{other.label ?? "Them"}</Tooltip>
      </CircleMarker>

      {/* You */}
      <CircleMarker
        center={[self.lat, self.lng]}
        radius={7}
        pathOptions={{ color: c.cream, fillColor: c.cream, fillOpacity: 0.95, weight: 2 }}
      >
        <Tooltip direction="top">{self.label ?? "You"}</Tooltip>
      </CircleMarker>
    </MapContainer>
  );
}
