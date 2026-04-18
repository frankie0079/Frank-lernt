"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Check, X, Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import "leaflet/dist/leaflet.css";

interface LocationPickerOverlayProps {
  initialLat?: number | null;
  initialLng?: number | null;
  title: string;
  onConfirm: (lat: number, lng: number) => void;
  onCancel: () => void;
}

/**
 * Fullscreen overlay with a Leaflet map. Tap to place a pin, confirm to save.
 * Dynamically imports Leaflet to avoid SSR issues.
 */
export function LocationPickerOverlay({
  initialLat,
  initialLng,
  title,
  onConfirm,
  onCancel,
}: LocationPickerOverlayProps) {
  const [lat, setLat] = useState<number | null>(initialLat ?? null);
  const [lng, setLng] = useState<number | null>(initialLng ?? null);
  const [searchQuery, setSearchQuery] = useState("");
  const [searching, setSearching] = useState(false);
  const mapRef = useRef<HTMLDivElement>(null);
  const leafletMapRef = useRef<unknown>(null);
  const markerRef = useRef<unknown>(null);

  // Initialize Leaflet map
  useEffect(() => {
    let cancelled = false;

    async function init() {
      const L = (await import("leaflet")).default;
      const markerIcon = (await import("leaflet/dist/images/marker-icon.png")).default;
      const markerIcon2x = (await import("leaflet/dist/images/marker-icon-2x.png")).default;
      const markerShadow = (await import("leaflet/dist/images/marker-shadow.png")).default;

      if (cancelled || !mapRef.current) return;

      const icon = L.icon({
        iconUrl: markerIcon.src,
        iconRetinaUrl: markerIcon2x.src,
        shadowUrl: markerShadow.src,
        iconSize: [25, 41],
        iconAnchor: [12, 41],
        popupAnchor: [1, -34],
        shadowSize: [41, 41],
      });

      const center: [number, number] = initialLat && initialLng
        ? [initialLat, initialLng]
        : [22.3193, 114.1694]; // Default: Hong Kong

      const map = L.map(mapRef.current, {
        center,
        zoom: initialLat ? 13 : 4,
        zoomControl: true,
      });

      L.tileLayer("https://tile.openstreetmap.de/{z}/{x}/{y}.png", {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a>',
        maxZoom: 18,
      }).addTo(map);

      leafletMapRef.current = map;

      // Place initial marker if coords exist
      if (initialLat && initialLng) {
        const m = L.marker([initialLat, initialLng], { icon }).addTo(map);
        markerRef.current = m;
      }

      // Click to place marker
      map.on("click", (e: { latlng: { lat: number; lng: number } }) => {
        const { lat: newLat, lng: newLng } = e.latlng;
        setLat(newLat);
        setLng(newLng);

        if (markerRef.current) {
          (markerRef.current as L.Marker).setLatLng([newLat, newLng]);
        } else {
          const m = L.marker([newLat, newLng], { icon }).addTo(map);
          markerRef.current = m;
        }
      });
    }

    init();
    return () => {
      cancelled = true;
      if (leafletMapRef.current) {
        (leafletMapRef.current as L.Map).remove();
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSearch = useCallback(async () => {
    if (!searchQuery.trim() || !leafletMapRef.current) return;
    setSearching(true);
    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(searchQuery)}&limit=1`,
        { headers: { "User-Agent": "EventDocs/1.0" } }
      );
      const results = await res.json();
      if (results.length > 0) {
        const { lat: foundLat, lon: foundLng } = results[0];
        const newLat = parseFloat(foundLat);
        const newLng = parseFloat(foundLng);
        const L = (await import("leaflet")).default;
        const map = leafletMapRef.current as L.Map;
        map.setView([newLat, newLng], 13);
        setLat(newLat);
        setLng(newLng);

        const markerIcon = (await import("leaflet/dist/images/marker-icon.png")).default;
        const markerIcon2x = (await import("leaflet/dist/images/marker-icon-2x.png")).default;
        const markerShadow = (await import("leaflet/dist/images/marker-shadow.png")).default;
        const icon = L.icon({
          iconUrl: markerIcon.src,
          iconRetinaUrl: markerIcon2x.src,
          shadowUrl: markerShadow.src,
          iconSize: [25, 41],
          iconAnchor: [12, 41],
        });

        if (markerRef.current) {
          (markerRef.current as L.Marker).setLatLng([newLat, newLng]);
        } else {
          const m = L.marker([newLat, newLng], { icon }).addTo(map);
          markerRef.current = m;
        }
      }
    } catch {
      // Search failed silently
    } finally {
      setSearching(false);
    }
  }, [searchQuery]);

  return (
    <div className="fixed inset-0 z-[60] flex flex-col bg-background">
      <div className="flex items-center gap-2 border-b px-3 py-2">
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 shrink-0"
          onClick={onCancel}
          aria-label="Abbrechen"
        >
          <X className="h-4 w-4" />
        </Button>
        <span className="flex-1 truncate text-sm font-medium">{title}</span>
        <Button
          size="sm"
          disabled={lat == null || lng == null}
          onClick={() => lat != null && lng != null && onConfirm(lat, lng)}
          className="gap-1"
        >
          <Check className="h-4 w-4" />
          OK
        </Button>
      </div>

      <div className="flex items-center gap-2 border-b px-3 py-2">
        <Input
          placeholder="Ort suchen (z.B. Hong Kong)"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              void handleSearch();
            }
          }}
          className="h-8 text-sm"
        />
        <Button
          variant="outline"
          size="icon"
          className="h-8 w-8 shrink-0"
          onClick={() => void handleSearch()}
          disabled={searching}
        >
          <Search className="h-4 w-4" />
        </Button>
      </div>

      <div ref={mapRef} className="flex-1" />

      {lat == null && (
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2">
          <span className="rounded-full bg-black/60 px-3 py-1.5 text-xs text-white">
            Tippe auf die Karte um den Ort zu setzen
          </span>
        </div>
      )}
    </div>
  );
}
