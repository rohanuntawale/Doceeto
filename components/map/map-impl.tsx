"use client";

import { useEffect, useState } from "react";
import { MapContainer, TileLayer, CircleMarker, Tooltip, useMap } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import { MAP_CENTER, MAP_ZOOM } from "@/lib/config";
import { sosCategory, consultType } from "@/lib/labels";
import type { Ambulance, ConsultRequest, Doctor, LatLng, SosEvent } from "@/lib/types/domain";

export interface MapProps {
  events?: SosEvent[];
  ambulances?: Ambulance[];
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
  events = [],
  ambulances = [],
  doctors = [],
  requests = [],
  self = null,
  center,
  height = 420,
}: MapProps) {
  const [colors, setColors] = useState({
    critical: "#BB4A2A",
    criticalSoft: "#E39B80",
    ok: "#5D8A6E",
    gold: "#C6A64C",
    cream: "#E8E9E1",
  });
  useEffect(() => {
    setColors({
      // SOS pins stay warning-colored (status token) even when the UI
      // accent is white, so emergencies remain unmistakable on the map.
      critical: themeColor("--c-status-critical", "#BB4A2A"),
      criticalSoft: themeColor("--c-status-critical", "#BB4A2A"),
      ok: themeColor("--c-status-ok", "#5D8A6E"),
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

      {/* Ambulances */}
      {ambulances
        .filter((a) => a.lat && a.lng)
        .map((a) => (
          <CircleMarker
            key={`amb-${a.id}`}
            center={[a.lat, a.lng]}
            radius={6}
            pathOptions={{ color: colors.ok, fillColor: colors.ok, fillOpacity: 0.9, weight: 1 }}
          >
            <Tooltip>
              {a.vehicleNo} · {a.status}
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
                {r.patientName} · {consultType[r.type].label}
                {pending ? " (waiting)" : " (accepted)"}
              </Tooltip>
            </CircleMarker>
          );
        })}

      {/* Active SOS */}
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
                color: open ? colors.critical : colors.criticalSoft,
                fillColor: open ? colors.critical : colors.criticalSoft,
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
