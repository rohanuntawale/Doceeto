"use client";

import { MapContainer, TileLayer, CircleMarker, Tooltip } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import { MAP_CENTER, MAP_ZOOM } from "@/lib/config";
import { sosCategory } from "@/lib/labels";
import type { Ambulance, Doctor, SosEvent } from "@/lib/types/domain";

export interface MapProps {
  events?: SosEvent[];
  ambulances?: Ambulance[];
  doctors?: Doctor[];
  height?: number;
}

const COLORS = {
  sosOpen: "#C15A38",
  sosActive: "#E0A890",
  ambulance: "#7C8B63",
  doctor: "#C9A876",
};

export default function MapImpl({
  events = [],
  ambulances = [],
  doctors = [],
  height = 420,
}: MapProps) {
  return (
    <MapContainer
      center={[MAP_CENTER.lat, MAP_CENTER.lng]}
      zoom={MAP_ZOOM}
      scrollWheelZoom={false}
      style={{ height, width: "100%", borderRadius: 14 }}
      preferCanvas
    >
      <TileLayer
        attribution='&copy; OpenStreetMap'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />

      {doctors
        .filter((d) => d.status !== "offline" && d.lat && d.lng)
        .map((d) => (
          <CircleMarker
            key={`doc-${d.id}`}
            center={[d.lat, d.lng]}
            radius={5}
            pathOptions={{ color: COLORS.doctor, fillColor: COLORS.doctor, fillOpacity: 0.85, weight: 1 }}
          >
            <Tooltip>{d.fullName} · {d.specialty}</Tooltip>
          </CircleMarker>
        ))}

      {ambulances.map((a) => (
        <CircleMarker
          key={`amb-${a.id}`}
          center={[a.lat, a.lng]}
          radius={6}
          pathOptions={{ color: COLORS.ambulance, fillColor: COLORS.ambulance, fillOpacity: 0.9, weight: 1 }}
        >
          <Tooltip>{a.vehicleNo} · {a.status}</Tooltip>
        </CircleMarker>
      ))}

      {events
        .filter((e) => e.status !== "resolved" && e.status !== "cancelled")
        .map((e) => {
          const open = e.status === "open";
          return (
            <CircleMarker
              key={`sos-${e.id}`}
              center={[e.lat, e.lng]}
              radius={open ? 11 : 9}
              pathOptions={{
                color: open ? COLORS.sosOpen : COLORS.sosActive,
                fillColor: open ? COLORS.sosOpen : COLORS.sosActive,
                fillOpacity: open ? 0.55 : 0.35,
                weight: 2,
              }}
            >
              <Tooltip>
                {sosCategory[e.category].label} · {e.patientName} ({e.status})
              </Tooltip>
            </CircleMarker>
          );
        })}
    </MapContainer>
  );
}
