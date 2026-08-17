"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Circle,
  MapContainer,
  Marker,
  Polygon,
  Polyline,
  Popup,
  TileLayer,
  useMap,
  useMapEvents,
} from "react-leaflet";
import MarkerClusterGroup from "react-leaflet-cluster";
import L from "leaflet";
import { LocateFixed, Map as MapIcon, Search, Satellite } from "lucide-react";
import type { LatLngExpression, PathOptions } from "leaflet";
import { cn } from "@/lib/utils/cn";

type Point = [number, number];
type MarkerSize = "small" | "medium" | "large";
type MarkerColor = "blue" | "red" | "green" | "orange" | "violet";

export interface InteractiveMapMarker {
  id?: string | number;
  position: Point;
  color?: MarkerColor;
  size?: MarkerSize;
  icon?: L.Icon;
  popup?: { title: string; content?: string; image?: string };
}

export interface InteractiveMapShape {
  id?: string | number;
  positions: LatLngExpression[] | LatLngExpression[][];
  style?: PathOptions;
  popup?: React.ReactNode;
}

export interface InteractiveMapCircle {
  id?: string | number;
  center: Point;
  radius: number;
  style?: PathOptions;
  popup?: React.ReactNode;
}

export interface InteractiveMapPolyline {
  id?: string | number;
  positions: LatLngExpression[];
  style?: PathOptions;
  popup?: React.ReactNode;
}

export interface AdvancedMapProps {
  center?: Point;
  zoom?: number;
  markers?: InteractiveMapMarker[];
  polygons?: InteractiveMapShape[];
  circles?: InteractiveMapCircle[];
  polylines?: InteractiveMapPolyline[];
  onMarkerClick?: (marker: InteractiveMapMarker) => void;
  onMapClick?: (latlng: L.LatLng) => void;
  enableClustering?: boolean;
  enableSearch?: boolean;
  enableControls?: boolean;
  mapLayers?: { openstreetmap?: boolean; satellite?: boolean; traffic?: boolean };
  className?: string;
  style?: React.CSSProperties;
}

const MARKER_SIZES: Record<MarkerSize, [number, number]> = {
  small: [20, 32],
  medium: [25, 41],
  large: [30, 50],
};

function markerIcon(color: MarkerColor = "blue", size: MarkerSize = "medium") {
  return new L.Icon({
    iconUrl: `https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-${color}.png`,
    shadowUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png",
    iconSize: MARKER_SIZES[size],
    iconAnchor: [12, 41],
    popupAnchor: [1, -34],
    shadowSize: [41, 41],
  });
}

function MapClickEvents({ onMapClick }: { onMapClick?: (latlng: L.LatLng) => void }) {
  useMapEvents({ click: (event) => onMapClick?.(event.latlng) });
  return null;
}

function LocateHandler({ onLocated }: { onLocated: (point: Point) => void }) {
  const map = useMap();
  useMapEvents({
    locationfound: (event) => {
      const point: Point = [event.latlng.lat, event.latlng.lng];
      onLocated(point);
      map.flyTo(event.latlng, Math.max(map.getZoom(), 13), { duration: 0.8 });
    },
  });
  return null;
}

function SearchControl({ onResult }: { onResult: (point: Point, name: string) => void }) {
  const map = useMap();
  const [query, setQuery] = useState("");
  const [busy, setBusy] = useState(false);

  async function search() {
    if (!query.trim() || busy) return;
    setBusy(true);
    try {
      const response = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(query)}`,
        { headers: { Accept: "application/json" } },
      );
      const results = (await response.json()) as Array<{ lat: string; lon: string; display_name: string }>;
      const result = results[0];
      if (!result) return;
      const point: Point = [Number(result.lat), Number(result.lon)];
      map.flyTo(point, 13, { duration: 0.8 });
      onResult(point, result.display_name);
    } catch {
      // Search is an enhancement; the map remains usable when geocoding is unavailable.
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="leaflet-top leaflet-left !mt-3 !ml-3">
      <div className="leaflet-control flex overflow-hidden rounded-2xl border border-white/70 bg-white/90 p-1 shadow-[0_8px_24px_rgb(16_45_35/0.14)] backdrop-blur-md">
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          onKeyDown={(event) => event.key === "Enter" && search()}
          placeholder="Search an area"
          aria-label="Search an area"
          className="w-32 bg-transparent px-2.5 py-2 text-xs text-[#173b31] outline-none placeholder:text-[#6f817a] sm:w-44"
        />
        <button type="button" onClick={search} disabled={busy} aria-label="Search" className="grid h-8 w-8 place-items-center rounded-xl bg-[#1f6a50] text-white disabled:opacity-50">
          <Search className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}

function MapControls({ onLocate, satellite, onSatellite }: { onLocate: () => void; satellite: boolean; onSatellite: () => void }) {
  const map = useMap();

  return (
    <div className="leaflet-top leaflet-right !mt-3 !mr-3">
      <div className="leaflet-control flex gap-1 rounded-2xl border border-white/70 bg-white/90 p-1 shadow-[0_8px_24px_rgb(16_45_35/0.14)] backdrop-blur-md">
        <button type="button" onClick={() => map.zoomIn()} title="Zoom in" aria-label="Zoom in" className="grid h-8 w-8 place-items-center rounded-xl text-lg font-medium text-[#1f6a50] transition-colors hover:bg-[#e9f4ee]">+</button>
        <button type="button" onClick={() => map.zoomOut()} title="Zoom out" aria-label="Zoom out" className="grid h-8 w-8 place-items-center rounded-xl text-lg font-medium text-[#1f6a50] transition-colors hover:bg-[#e9f4ee]">−</button>
        <button type="button" onClick={onLocate} title="Use my location" aria-label="Use my location" className="grid h-8 w-8 place-items-center rounded-xl text-[#1f6a50] transition-colors hover:bg-[#e9f4ee]"><LocateFixed className="h-4 w-4" /></button>
        <button type="button" onClick={onSatellite} title="Toggle satellite" aria-label="Toggle satellite" className={cn("grid h-8 w-8 place-items-center rounded-xl transition-colors", satellite ? "bg-[#1f6a50] text-white" : "text-[#1f6a50] hover:bg-[#e9f4ee]")}><Satellite className="h-4 w-4" /></button>
      </div>
    </div>
  );
}

export function AdvancedMap({
  center = [51.505, -0.09],
  zoom = 13,
  markers = [],
  polygons = [],
  circles = [],
  polylines = [],
  onMarkerClick,
  onMapClick,
  enableClustering = true,
  enableSearch = true,
  enableControls = true,
  mapLayers = { openstreetmap: true, satellite: false },
  className,
  style = { height: 500, width: "100%" },
}: AdvancedMapProps) {
  const [satellite, setSatellite] = useState(Boolean(mapLayers.satellite));
  const [userLocation, setUserLocation] = useState<Point | null>(null);
  const [searchResult, setSearchResult] = useState<{ point: Point; name: string } | null>(null);
  const [clickedLocation, setClickedLocation] = useState<L.LatLng | null>(null);
  const icons = useMemo(() => new Map<string, L.Icon>(), []);

  const getIcon = useCallback((marker: InteractiveMapMarker) => {
    if (marker.icon) return marker.icon;
    const key = `${marker.color ?? "blue"}-${marker.size ?? "medium"}`;
    const existing = icons.get(key);
    if (existing) return existing;
    const icon = markerIcon(marker.color, marker.size);
    icons.set(key, icon);
    return icon;
  }, [icons]);

  function locate() {
    if (typeof navigator !== "undefined" && navigator.geolocation) {
      navigator.geolocation.getCurrentPosition((position) => setUserLocation([position.coords.latitude, position.coords.longitude]));
    }
  }

  const markerNodes = markers.map((marker, index) => (
    <Marker key={marker.id ?? index} position={marker.position} icon={getIcon(marker)} eventHandlers={{ click: () => onMarkerClick?.(marker) }}>
      {marker.popup && <Popup><div className="min-w-32"><strong>{marker.popup.title}</strong>{marker.popup.content && <p className="mt-1 text-xs">{marker.popup.content}</p>}{marker.popup.image && <img src={marker.popup.image} alt={marker.popup.title} className="mt-2 max-w-[200px] rounded-lg" />}</div></Popup>}
    </Marker>
  ));

  return (
    <div className={cn("relative overflow-hidden", className)} style={style}>
      <MapContainer center={center} zoom={zoom} zoomControl={false} scrollWheelZoom className="h-full w-full">
        {!satellite && <TileLayer attribution='&copy; OpenStreetMap contributors' url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />}
        {satellite && <TileLayer attribution='&copy; Esri' url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}" />}
        <MapClickEvents onMapClick={(latlng) => { setClickedLocation(latlng); onMapClick?.(latlng); }} />
        <LocateHandler onLocated={setUserLocation} />
        {enableSearch && <SearchControl onResult={(point, name) => setSearchResult({ point, name })} />}
        {enableControls && <MapControls onLocate={locate} satellite={satellite} onSatellite={() => setSatellite((value) => !value)} />}
        {enableClustering ? <MarkerClusterGroup>{markerNodes}</MarkerClusterGroup> : markerNodes}
        {userLocation && <Marker position={userLocation} icon={markerIcon("red")}><Popup>Your current location</Popup></Marker>}
        {searchResult && <Marker position={searchResult.point} icon={markerIcon("green", "large")}><Popup>{searchResult.name}</Popup></Marker>}
        {clickedLocation && <Marker position={clickedLocation} icon={markerIcon("orange", "small")}><Popup>{clickedLocation.lat.toFixed(5)}, {clickedLocation.lng.toFixed(5)}</Popup></Marker>}
        {polygons.map((polygon, index) => <Polygon key={polygon.id ?? index} positions={polygon.positions as LatLngExpression[][]} pathOptions={polygon.style ?? { color: "#1f6a50", weight: 2, fillOpacity: 0.18 }}>{polygon.popup && <Popup>{polygon.popup}</Popup>}</Polygon>)}
        {circles.map((circle, index) => <Circle key={circle.id ?? index} center={circle.center} radius={circle.radius} pathOptions={circle.style ?? { color: "#c96c32", weight: 2, fillOpacity: 0.12 }}>{circle.popup && <Popup>{circle.popup}</Popup>}</Circle>)}
        {polylines.map((line, index) => <Polyline key={line.id ?? index} positions={line.positions} pathOptions={line.style ?? { color: "#c96c32", weight: 3 }}>{line.popup && <Popup>{line.popup}</Popup>}</Polyline>)}
      </MapContainer>
      <div className="pointer-events-none absolute bottom-3 left-3 rounded-full bg-white/85 px-2.5 py-1 text-[10px] font-semibold text-[#45645a] shadow-sm backdrop-blur-md"><MapIcon className="mr-1 inline h-3 w-3" /> Live care map</div>
    </div>
  );
}

export default AdvancedMap;
