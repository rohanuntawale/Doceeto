"use client";

import { useEffect, useState } from "react";
import { MapContainer, TileLayer, CircleMarker, Polyline, Tooltip, useMap } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import type { LatLng } from "@/lib/types/domain";

export interface TrackMapProps {
  patient: LatLng;
  doctor: LatLng; // current (interpolated) doctor position
  doctorName: string;
  height?: number;
}

function themeColor(varName: string, fallback: string): string {
  if (typeof window === "undefined") return fallback;
  const raw = getComputedStyle(document.documentElement).getPropertyValue(varName).trim();
  return raw ? `rgb(${raw})` : fallback;
}

/** Keep both markers in view as the doctor moves toward the patient. */
function FitBoth({ a, b }: { a: LatLng; b: LatLng }) {
  const map = useMap();
  useEffect(() => {
    map.fitBounds(
      [
        [a.lat, a.lng],
        [b.lat, b.lng],
      ],
      { padding: [48, 48], maxZoom: 15, animate: true },
    );
  }, [a, b, map]);
  return null;
}

export default function TrackMapImpl({
  patient,
  doctor,
  doctorName,
  height = 300,
}: TrackMapProps) {
  const [c, setC] = useState({ accent: "#C15A38", accentSoft: "#E0A890", cream: "#F1E9D8" });
  useEffect(() => {
    setC({
      accent: themeColor("--c-terracotta", "#C15A38"),
      accentSoft: themeColor("--c-terracotta-300", "#E0A890"),
      cream: themeColor("--c-cream", "#F1E9D8"),
    });
  }, []);

  return (
    <MapContainer
      center={[patient.lat, patient.lng]}
      zoom={14}
      scrollWheelZoom={false}
      style={{ height, width: "100%", borderRadius: 14 }}
      preferCanvas
    >
      <FitBoth a={patient} b={doctor} />
      <TileLayer
        attribution="&copy; OpenStreetMap"
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />

      {/* route line */}
      <Polyline
        positions={[
          [doctor.lat, doctor.lng],
          [patient.lat, patient.lng],
        ]}
        pathOptions={{ color: c.accent, weight: 3, opacity: 0.7, dashArray: "6 8" }}
      />

      {/* you */}
      <CircleMarker
        center={[patient.lat, patient.lng]}
        radius={8}
        pathOptions={{ color: c.cream, fillColor: c.cream, fillOpacity: 0.95, weight: 2 }}
      >
        <Tooltip direction="top" permanent>
          You
        </Tooltip>
      </CircleMarker>

      {/* doctor, moving toward you */}
      <CircleMarker
        center={[doctor.lat, doctor.lng]}
        radius={11}
        pathOptions={{ color: c.cream, fillColor: c.accent, fillOpacity: 0.95, weight: 3 }}
      >
        <Tooltip direction="top" permanent>
          {doctorName}
        </Tooltip>
      </CircleMarker>
    </MapContainer>
  );
}
