import React, { useEffect, useRef } from "react";
import { CircleMarker, MapContainer, Polyline, TileLayer, Tooltip, useMap } from "react-leaflet";
import type { LatLngExpression, Map as LeafletMap } from "leaflet";
import "leaflet/dist/leaflet.css";

export type OperationalMapPoint = {
  id: string | number;
  title: string;
  position: { lat: number; lng: number };
};

interface MapViewProps {
  className?: string;
  initialCenter?: { lat: number; lng: number };
  initialZoom?: number;
  posts?: OperationalMapPoint[];
  supervisors?: OperationalMapPoint[];
  routePath?: Array<{ lat: number; lng: number }>;
  viewportKey?: string | number;
}

function updateMapViewport(
  map: LeafletMap,
  points: OperationalMapPoint[],
  fallbackCenter: { lat: number; lng: number },
  fallbackZoom: number,
) {
  if (points.length) {
    map.fitBounds(points.map((point) => [point.position.lat, point.position.lng] as [number, number]), { padding: [48, 48], maxZoom: 15 });
    return;
  }
  map.setView([fallbackCenter.lat, fallbackCenter.lng], fallbackZoom);
}

function MapViewport({ points, fallbackCenter, fallbackZoom, viewportKey }: { points: OperationalMapPoint[]; fallbackCenter: { lat: number; lng: number }; fallbackZoom: number; viewportKey: string | number }) {
  const map = useMap();
  const initializedRef = useRef(false);
  const previousViewportKeyRef = useRef(viewportKey);

  useEffect(() => {
    const routeChanged = previousViewportKeyRef.current !== viewportKey;
    if (initializedRef.current && !routeChanged) return;

    initializedRef.current = true;
    previousViewportKeyRef.current = viewportKey;
    updateMapViewport(map, points, fallbackCenter, fallbackZoom);
  }, [fallbackCenter.lat, fallbackCenter.lng, fallbackZoom, map, viewportKey]);

  return null;
}

function MapRecenterControl({ points, fallbackCenter, fallbackZoom }: { points: OperationalMapPoint[]; fallbackCenter: { lat: number; lng: number }; fallbackZoom: number }) {
  const map = useMap();

  return (
    <div className="pointer-events-none absolute right-3 top-3 z-[1100]">
      <button
        type="button"
        onClick={() => updateMapViewport(map, points, fallbackCenter, fallbackZoom)}
        className="pointer-events-auto rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-800 shadow-md transition hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-cyan-600"
        aria-label="Recentralizar mapa"
      >
        Recentralizar mapa
      </button>
    </div>
  );
}

export function MapView({ className, initialCenter = { lat: -23.185, lng: -46.884 }, initialZoom = 10, posts = [], supervisors = [], routePath = [], viewportKey = "initial" }: MapViewProps) {
  const allPoints = [...posts, ...supervisors];
  const center: LatLngExpression = [initialCenter.lat, initialCenter.lng];
  const mapClassName = ["relative", className ?? "h-[500px] w-full"].join(" ");

  return (
    <div className={mapClassName} aria-label="Mapa operacional com postos e supervisores">
      <MapContainer center={center} zoom={initialZoom} scrollWheelZoom className="h-full w-full">
        <TileLayer attribution="&copy; <a href='https://www.openstreetmap.org/copyright'>OpenStreetMap</a> contributors" url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
        <MapViewport points={allPoints} fallbackCenter={initialCenter} fallbackZoom={initialZoom} viewportKey={viewportKey} />
        <MapRecenterControl points={allPoints} fallbackCenter={initialCenter} fallbackZoom={initialZoom} />
        {routePath.length > 1 && <Polyline positions={routePath.map((point) => [point.lat, point.lng] as LatLngExpression)} pathOptions={{ color: "#2563eb", weight: 4, opacity: 0.85 }} />}
        {posts.map((post) => <CircleMarker key={`post-${post.id}`} center={[post.position.lat, post.position.lng]} radius={10} pathOptions={{ color: "#ffffff", weight: 2, fillColor: "#1d4ed8", fillOpacity: 1 }}><Tooltip direction="top" offset={[0, -8]} opacity={1}>{post.title}</Tooltip></CircleMarker>)}
        {supervisors.map((supervisor) => <CircleMarker key={`supervisor-${supervisor.id}`} center={[supervisor.position.lat, supervisor.position.lng]} radius={12} pathOptions={{ color: "#ffffff", weight: 2, fillColor: "#059669", fillOpacity: 1 }}><Tooltip direction="top" offset={[0, -10]} opacity={1}>{supervisor.title}</Tooltip></CircleMarker>)}
      </MapContainer>
    </div>
  );
}
