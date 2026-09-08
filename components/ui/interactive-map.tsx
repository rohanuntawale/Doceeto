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
  icon?: L.Icon | L.DivIcon;
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
  /** Renders a compact source notice instead of Leaflet's default branding. */
  showAttribution?: boolean;
  mapLayers?: {
    openstreetmap?: boolean;
    satellite?: boolean;
    traffic?: boolean;
  };
  className?: string;
  style?: React.CSSProperties;
}

const MARKER_SIZES: Record<MarkerSize, number> = {
  small: 18,
  medium: 24,
  large: 30,
};

function markerIcon(color: MarkerColor = "blue", size: MarkerSize = "medium") {
  const diameter = MARKER_SIZES[size];
  const fill: Record<MarkerColor, string> = {
    blue: "#3b82f6",
    red: "#d45738",
    green: "#187057",
    orange: "#dd8a24",
    violet: "#7359c7",
  };
  return L.divIcon({
    className: "doceeto-map-marker",
    html: `<span style="display:block;width:${diameter}px;height:${diameter}px;border:3px solid #fff;border-radius:9999px;background:${fill[color]};box-shadow:0 4px 10px rgb(22 52 43 / .34)"></span>`,
    iconSize: [diameter, diameter],
    iconAnchor: [diameter / 2, diameter / 2],
    popupAnchor: [0, -(diameter / 2)],
  });
}

function MapClickEvents({
  onMapClick,
}: {
  onMapClick?: (latlng: L.LatLng) => void;
}) {
  useMapEvents({ click: (event) => onMapClick?.(event.latlng) });
  return null;
}

function MapResizeHandler() {
  const map = useMap();
  useEffect(() => {
    map.invalidateSize();
    const timer = setTimeout(() => map.invalidateSize(), 200);
    const raf = requestAnimationFrame(() => map.invalidateSize());

    const container = map.getContainer();
    if (!container) return;
    const ro = new ResizeObserver(() => {
      map.invalidateSize();
    });
    ro.observe(container);

    return () => {
      clearTimeout(timer);
      cancelAnimationFrame(raf);
      ro.disconnect();
    };
  }, [map]);
  return null;
}

/**
 * Leaflet forwards events from anywhere inside the map container to the map
 * itself, so a click on a control also panned or zoomed it and a scroll over
 * one zoomed the map underneath. Real L.Control instances opt out of that in
 * their constructor; these are plain React nodes, so they opt out by hand.
 */
function useControlRef() {
  return useCallback((node: HTMLDivElement | null) => {
    if (!node) return;
    L.DomEvent.disableClickPropagation(node);
    L.DomEvent.disableScrollPropagation(node);
  }, []);
}

/** Re-centres when the caller's center changes; MapContainer reads it once. */
function Recenter({ center, zoom }: { center: Point; zoom: number }) {
  const map = useMap();
  const [lat, lng] = center;
  useEffect(() => {
    map.flyTo([lat, lng], zoom, { duration: 0.8 });
  }, [map, lat, lng, zoom]);
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

function SearchControl({
  onResult,
}: {
  onResult: (point: Point, name: string) => void;
}) {
  const map = useMap();
  const controlRef = useControlRef();
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
      const results = (await response.json()) as Array<{
        lat: string;
        lon: string;
        display_name: string;
      }>;
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
    <div className="leaflet-top leaflet-left !mt-3 !ml-3 z-[1000]">
      <div
        ref={controlRef}
        className="leaflet-control flex overflow-hidden rounded-2xl border border-white/70 bg-white/90 p-1 shadow-[0_8px_24px_rgb(16_45_35/0.14)] backdrop-blur-md"
      >
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          onKeyDown={(event) => event.key === "Enter" && search()}
          placeholder="Search an area"
          aria-label="Search an area"
          className="w-32 bg-transparent px-2.5 py-2 text-xs text-[#173b31] outline-none placeholder:text-[#6f817a] sm:w-44"
        />
        <button
          type="button"
          onClick={search}
          disabled={busy}
          aria-label="Search"
          className="grid h-8 w-8 place-items-center rounded-xl bg-[#1f6a50] text-white disabled:opacity-50"
        >
          <Search className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}

function MapControls({
  satellite,
  onSatellite,
}: {
  satellite: boolean;
  onSatellite: () => void;
}) {
  const map = useMap();
  const controlRef = useControlRef();

  /* map.locate fires the locationfound event LocateHandler listens for, which
     is what actually moves the map. The old handler called
     navigator.geolocation directly, so it dropped a marker at the patient's
     position without ever centring on it, and the button looked dead. */
  const locate = () => map.locate({ setView: false, enableHighAccuracy: true });

  return (
    <div className="leaflet-top leaflet-right !mt-3 !mr-3 z-[1000]">
      <div
        ref={controlRef}
        className="leaflet-control flex gap-1 rounded-2xl border border-white/70 bg-white/90 p-1 shadow-[0_8px_24px_rgb(16_45_35/0.14)] backdrop-blur-md"
      >
        <button
          type="button"
          onClick={() => map.zoomIn()}
          title="Zoom in"
          aria-label="Zoom in"
          className="grid h-8 w-8 place-items-center rounded-xl text-lg font-medium text-[#1f6a50] transition-colors hover:bg-[#e9f4ee]"
        >
          +
        </button>
        <button
          type="button"
          onClick={() => map.zoomOut()}
          title="Zoom out"
          aria-label="Zoom out"
          className="grid h-8 w-8 place-items-center rounded-xl text-lg font-medium text-[#1f6a50] transition-colors hover:bg-[#e9f4ee]"
        >
          −
        </button>
        <button
          type="button"
          onClick={locate}
          title="Use my location"
          aria-label="Use my location"
          className="grid h-8 w-8 place-items-center rounded-xl text-[#1f6a50] transition-colors hover:bg-[#e9f4ee]"
        >
          <LocateFixed className="h-4 w-4" />
        </button>
        <button
          type="button"
          onClick={onSatellite}
          title="Toggle satellite"
          aria-label="Toggle satellite"
          className={cn(
            "grid h-8 w-8 place-items-center rounded-xl transition-colors",
            satellite
              ? "bg-[#1f6a50] text-white"
              : "text-[#1f6a50] hover:bg-[#e9f4ee]",
          )}
        >
          <Satellite className="h-4 w-4" />
        </button>
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
  showAttribution = true,
  mapLayers = { openstreetmap: true, satellite: false },
  className,
  style = { height: 500, width: "100%" },
}: AdvancedMapProps) {
  const [satellite, setSatellite] = useState(Boolean(mapLayers.satellite));
  const [userLocation, setUserLocation] = useState<Point | null>(null);
  const [searchResult, setSearchResult] = useState<{
    point: Point;
    name: string;
  } | null>(null);
  const [clickedLocation, setClickedLocation] = useState<L.LatLng | null>(null);
  const icons = useMemo(() => new Map<string, L.Icon | L.DivIcon>(), []);

  const getIcon = useCallback(
    (marker: InteractiveMapMarker) => {
      if (marker.icon) return marker.icon;
      const key = `${marker.color ?? "blue"}-${marker.size ?? "medium"}`;
      const existing = icons.get(key);
      if (existing) return existing;
      const icon = markerIcon(marker.color, marker.size);
      icons.set(key, icon);
      return icon;
    },
    [icons],
  );

  const markerNodes = markers.map((marker, index) => (
    <Marker
      key={marker.id ?? index}
      position={marker.position}
      icon={getIcon(marker)}
      eventHandlers={{ click: () => onMarkerClick?.(marker) }}
    >
      {marker.popup && (
        <Popup>
          <div className="min-w-32">
            <strong>{marker.popup.title}</strong>
            {marker.popup.content && (
              <p className="mt-1 text-xs">{marker.popup.content}</p>
            )}
            {marker.popup.image && (
              <img
                src={marker.popup.image}
                alt={marker.popup.title}
                className="mt-2 max-w-[200px] rounded-lg"
              />
            )}
          </div>
        </Popup>
      )}
    </Marker>
  ));

  return (
    <div
      className={cn("relative z-0 overflow-hidden", className)}
      style={style}
    >
      <MapContainer
        center={center}
        zoom={zoom}
        zoomControl={false}
        attributionControl={false}
        scrollWheelZoom
        className="h-full w-full"
      >
        <MapResizeHandler />
        {!satellite && (
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap contributors</a>'
            url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
        )}
        {satellite && (
          <TileLayer
            attribution="&copy; Esri"
            url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
          />
        )}
        <MapClickEvents
          onMapClick={(latlng) => {
            setClickedLocation(latlng);
            onMapClick?.(latlng);
          }}
        />
        <Recenter center={center} zoom={zoom} />
        <LocateHandler onLocated={setUserLocation} />
        {enableSearch && (
          <SearchControl
            onResult={(point, name) => setSearchResult({ point, name })}
          />
        )}
        {enableControls && (
          <MapControls
            satellite={satellite}
            onSatellite={() => setSatellite((value) => !value)}
          />
        )}
        {enableClustering ? (
          <MarkerClusterGroup>{markerNodes}</MarkerClusterGroup>
        ) : (
          markerNodes
        )}
        {userLocation && (
          <Marker position={userLocation} icon={markerIcon("red")}>
            <Popup>Your current location</Popup>
          </Marker>
        )}
        {searchResult && (
          <Marker
            position={searchResult.point}
            icon={markerIcon("green", "large")}
          >
            <Popup>{searchResult.name}</Popup>
          </Marker>
        )}
        {clickedLocation && (
          <Marker
            position={clickedLocation}
            icon={markerIcon("orange", "small")}
          >
            <Popup>
              {clickedLocation.lat.toFixed(5)}, {clickedLocation.lng.toFixed(5)}
            </Popup>
          </Marker>
        )}
        {polygons.map((polygon, index) => (
          <Polygon
            key={polygon.id ?? index}
            positions={polygon.positions as LatLngExpression[][]}
            pathOptions={
              polygon.style ?? {
                color: "#1f6a50",
                weight: 2,
                fillOpacity: 0.18,
              }
            }
          >
            {polygon.popup && <Popup>{polygon.popup}</Popup>}
          </Polygon>
        ))}
        {circles.map((circle, index) => (
          <Circle
            key={circle.id ?? index}
            center={circle.center}
            radius={circle.radius}
            pathOptions={
              circle.style ?? { color: "#c96c32", weight: 2, fillOpacity: 0.12 }
            }
          >
            {circle.popup && <Popup>{circle.popup}</Popup>}
          </Circle>
        ))}
        {polylines.map((line, index) => (
          <Polyline
            key={line.id ?? index}
            positions={line.positions}
            pathOptions={line.style ?? { color: "#c96c32", weight: 3 }}
          >
            {line.popup && <Popup>{line.popup}</Popup>}
          </Polyline>
        ))}
      </MapContainer>
      {showAttribution && (
        <div className="absolute bottom-2 left-3 z-[1000] flex items-center gap-1.5 rounded-full bg-white/88 px-2.5 py-1 text-[10px] font-semibold text-[#45645a] shadow-sm backdrop-blur-md">
          <MapIcon className="h-3 w-3" />
          <span>Live care map</span>
          <span className="text-[#94a59f]">·</span>
          <a
            href={satellite ? "https://www.esri.com" : "https://www.openstreetmap.org/copyright"}
            target="_blank"
            rel="noreferrer"
            className="text-[#45645a] underline decoration-[#94a59f]/50 underline-offset-2 hover:text-[#173b31]"
          >
            © {satellite ? "Esri" : "OpenStreetMap"}
          </a>
        </div>
      )}
    </div>
  );
}

export default AdvancedMap;
