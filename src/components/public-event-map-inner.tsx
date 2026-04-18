"use client";

// PROJ-35: Inner Leaflet component — dynamically imported with ssr:false.

import { MapContainer, TileLayer, Marker, Popup } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import markerIcon from "leaflet/dist/images/marker-icon.png";
import markerIcon2x from "leaflet/dist/images/marker-icon-2x.png";
import markerShadow from "leaflet/dist/images/marker-shadow.png";
import type { MapMarker } from "@/components/public-event-map";

// BUG-5 fix: bundle Leaflet's default icons with the app instead of hotlinking
// unpkg.com (CSP-safe, CDN-independent). Next's webpack resolves PNG imports to
// StaticImageData objects; we only need the `.src` string.
const defaultIcon = L.icon({
  iconUrl: markerIcon.src,
  iconRetinaUrl: markerIcon2x.src,
  shadowUrl: markerShadow.src,
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
});

interface Props {
  markers: MapMarker[];
}

export function MapInner({ markers }: Props) {
  if (markers.length === 0) return null;

  // Compute bounding box from markers
  const lats = markers.map((m) => m.latitude);
  const lngs = markers.map((m) => m.longitude);
  const minLat = Math.min(...lats);
  const maxLat = Math.max(...lats);
  const minLng = Math.min(...lngs);
  const maxLng = Math.max(...lngs);

  const center: [number, number] = [
    (minLat + maxLat) / 2,
    (minLng + maxLng) / 2,
  ];

  // Single marker → fixed zoom; multiple → fitBounds
  const bounds: [[number, number], [number, number]] | undefined =
    markers.length > 1 ? [[minLat, minLng], [maxLat, maxLng]] : undefined;

  return (
    <MapContainer
      center={center}
      zoom={markers.length === 1 ? 13 : undefined}
      bounds={bounds}
      boundsOptions={{ padding: [30, 30] }}
      scrollWheelZoom={false}
      style={{ height: "100%", width: "100%" }}
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        url="https://tile.openstreetmap.de/{z}/{x}/{y}.png"
        maxZoom={18}
      />
      {markers.map((m) => (
        <Marker
          key={m.id}
          position={[m.latitude, m.longitude]}
          icon={defaultIcon}
        >
          <Popup>
            <div className="space-y-1">
              {m.thumbnailUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={m.thumbnailUrl}
                  alt={m.authorName ?? "Foto"}
                  className="h-24 w-32 rounded object-cover"
                />
              ) : null}
              <div className="text-xs font-medium">
                {m.authorName ?? "Unbekannt"}
              </div>
              <div className="text-[11px] text-gray-600">{m.agendaTitle}</div>
            </div>
          </Popup>
        </Marker>
      ))}
    </MapContainer>
  );
}
