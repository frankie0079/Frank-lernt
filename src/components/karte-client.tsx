"use client";

import dynamic from "next/dynamic";
import { Camera, BookOpen, Map } from "lucide-react";

// Dynamic import -- Leaflet must not be SSR'd
const LeafletMap = dynamic(() => import("@/components/leaflet-map"), {
  ssr: false,
  loading: () => (
    <div className="flex items-center justify-center h-[60vh] bg-muted rounded-lg">
      <div className="text-center text-muted-foreground">
        <Map className="h-8 w-8 mx-auto mb-2 animate-pulse" />
        <p className="text-sm">Karte wird geladen...</p>
      </div>
    </div>
  ),
});

export interface PhotoMarker {
  id: string;
  type: "photo";
  lat: number;
  lng: number;
  thumbnailUrl: string;
  caption: string | null;
}

export interface DiaryMarker {
  id: string;
  type: "diary";
  lat: number;
  lng: number;
  title: string;
  excerpt: string;
}

interface KarteClientProps {
  photoMarkers: PhotoMarker[];
  diaryMarkers: DiaryMarker[];
}

export function KarteClient({ photoMarkers, diaryMarkers }: KarteClientProps) {
  const hasMarkers = photoMarkers.length > 0 || diaryMarkers.length > 0;

  if (!hasMarkers) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <div className="rounded-full bg-muted p-4 mb-4">
          <Map className="h-8 w-8 text-muted-foreground" />
        </div>
        <h2 className="text-lg font-semibold text-foreground mb-1">
          Noch keine GPS-Daten
        </h2>
        <p className="text-muted-foreground max-w-xs">
          Sobald Fotos oder Tagebucheinträge mit Standort vorhanden sind, erscheinen sie hier auf der Karte.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Map */}
      <div className="h-[65vh] min-h-[400px] rounded-lg overflow-hidden border border-border">
        <LeafletMap
          photoMarkers={photoMarkers}
          diaryMarkers={diaryMarkers}
        />
      </div>

      {/* Legend */}
      <div className="flex items-center gap-4 text-xs text-muted-foreground">
        <span className="flex items-center gap-1">
          <Camera className="h-3.5 w-3.5 text-primary" />
          Foto
        </span>
        <span className="flex items-center gap-1">
          <BookOpen className="h-3.5 w-3.5 text-accent" />
          Tagebuch-Eintrag
        </span>
      </div>
    </div>
  );
}
