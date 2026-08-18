import { useEffect } from "react";
import { CircleMarker, MapContainer, Polyline, TileLayer, Tooltip, useMap } from "react-leaflet";
import type { LatLngExpression } from "leaflet";
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
}

function MapViewport({ points, fallbackCenter, fallbackZoom }: { points: OperationalMapPoint[]; fallbackCenter: LatLngExpression; fallbackZoom: number }) {
  const map = useMap();

  useEffect(() => {
    if (points.length) {
      map.fitBounds(points.map((point) => [point.position.lat, point.position.lng] as [number, number]), { padding: [48, 48], maxZoom: 15 });
      return;
    }
    map.setView(fallbackCenter, fallbackZoom);
  }, [fallbackCenter, fallbackZoom, map, points]);

  return null;
}

export function MapView({ className, initialCenter = { lat: -23.185, lng: -46.884 }, initialZoom = 10, posts = [], supervisors = [], routePath = [] }: MapViewProps) {
  const allPoints = [...posts, ...supervisors];
  const center: LatLngExpression = [initialCenter.lat, initialCenter.lng];

  return <MapContainer center={center} zoom={initialZoom} scrollWheelZoom className={className ?? "h-[500px] w-full"} aria-label="Mapa operacional com postos e supervisores">
    <TileLayer attribution="&copy; <a href='https://www.openstreetmap.org/copyright'>OpenStreetMap</a> contributors" url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
    <MapViewport points={allPoints} fallbackCenter={center} fallbackZoom={initialZoom} />
    {routePath.length > 1 && <Polyline positions={routePath.map((point) => [point.lat, point.lng] as LatLngExpression)} pathOptions={{ color: "#2563eb", weight: 4, opacity: 0.85 }} />}
    {posts.map((post) => <CircleMarker key={`post-${post.id}`} center={[post.position.lat, post.position.lng]} radius={10} pathOptions={{ color: "#ffffff", weight: 2, fillColor: "#1d4ed8", fillOpacity: 1 }}><Tooltip direction="top" offset={[0, -8]} opacity={1}>{post.title}</Tooltip></CircleMarker>)}
    {supervisors.map((supervisor) => <CircleMarker key={`supervisor-${supervisor.id}`} center={[supervisor.position.lat, supervisor.position.lng]} radius={12} pathOptions={{ color: "#ffffff", weight: 2, fillColor: "#059669", fillOpacity: 1 }}><Tooltip direction="top" offset={[0, -10]} opacity={1}>{supervisor.title}</Tooltip></CircleMarker>)}
  </MapContainer>;
}
