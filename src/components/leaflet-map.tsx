"use client";

import { useEffect, useMemo } from "react";
import { MapContainer, TileLayer, Marker, Popup, useMap } from "react-leaflet";
import L from "leaflet";
import type { PhotoMarker, DiaryMarker } from "@/components/karte-client";

// Import Leaflet CSS
import "leaflet/dist/leaflet.css";

// Fix Leaflet default icon issue in webpack/next.js
// We create custom icons instead of relying on the default marker images
const photoIcon = L.divIcon({
  html: `<div style="background:#25918a;border:2px solid white;border-radius:50%;width:28px;height:28px;display:flex;align-items:center;justify-content:center;box-shadow:0 2px 4px rgba(0,0,0,0.3);">
    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3z"/>
      <circle cx="12" cy="13" r="3"/>
    </svg>
  </div>`,
  className: "",
  iconSize: [28, 28],
  iconAnchor: [14, 14],
  popupAnchor: [0, -14],
});

const diaryIcon = L.divIcon({
  html: `<div style="background:#e5a020;border:2px solid white;border-radius:50%;width:28px;height:28px;display:flex;align-items:center;justify-content:center;box-shadow:0 2px 4px rgba(0,0,0,0.3);">
    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H19a1 1 0 0 1 1 1v18a1 1 0 0 1-1 1H6.5a1 1 0 0 1 0-5H20"/>
    </svg>
  </div>`,
  className: "",
  iconSize: [28, 28],
  iconAnchor: [14, 14],
  popupAnchor: [0, -14],
});

interface LeafletMapProps {
  photoMarkers: PhotoMarker[];
  diaryMarkers: DiaryMarker[];
}

/** Auto-fit the map bounds to include all markers */
function FitBounds({ markers }: { markers: { lat: number; lng: number }[] }) {
  const map = useMap();

  useEffect(() => {
    if (markers.length === 0) return;

    if (markers.length === 1) {
      map.setView([markers[0].lat, markers[0].lng], 13);
      return;
    }

    const bounds = L.latLngBounds(
      markers.map((m) => [m.lat, m.lng] as [number, number])
    );
    map.fitBounds(bounds, { padding: [40, 40] });
  }, [map, markers]);

  return null;
}

export default function LeafletMap({ photoMarkers, diaryMarkers }: LeafletMapProps) {
  const allMarkers = useMemo(
    () => [
      ...photoMarkers.map((m) => ({ lat: m.lat, lng: m.lng })),
      ...diaryMarkers.map((m) => ({ lat: m.lat, lng: m.lng })),
    ],
    [photoMarkers, diaryMarkers]
  );

  // Default center (roughly center of Portugal/Europe if no markers)
  const defaultCenter: [number, number] = allMarkers.length > 0
    ? [allMarkers[0].lat, allMarkers[0].lng]
    : [39.5, -8.0];

  return (
    <MapContainer
      center={defaultCenter}
      zoom={10}
      className="h-full w-full"
      scrollWheelZoom={true}
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />

      <FitBounds markers={allMarkers} />

      {/* Photo markers */}
      {photoMarkers.map((marker) => (
        <Marker
          key={`photo-${marker.id}`}
          position={[marker.lat, marker.lng]}
          icon={photoIcon}
        >
          <Popup>
            <div className="w-48">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={marker.thumbnailUrl}
                alt={marker.caption || "Foto"}
                className="w-full h-32 object-cover rounded mb-1"
              />
              {marker.caption && (
                <p className="text-xs text-gray-700">{marker.caption}</p>
              )}
            </div>
          </Popup>
        </Marker>
      ))}

      {/* Diary markers */}
      {diaryMarkers.map((marker) => (
        <Marker
          key={`diary-${marker.id}`}
          position={[marker.lat, marker.lng]}
          icon={diaryIcon}
        >
          <Popup>
            <div className="w-48">
              <p className="font-semibold text-sm mb-1">{marker.title}</p>
              {marker.excerpt && (
                <p className="text-xs text-gray-600">{marker.excerpt}</p>
              )}
            </div>
          </Popup>
        </Marker>
      ))}
    </MapContainer>
  );
}
