"use client";

// PROJ-35: GPS map for the public landing page.
// Leaflet must run client-side only — this file is the client wrapper that
// dynamically imports the actual MapInner with ssr:false.

import dynamic from "next/dynamic";
import { Card } from "@/components/ui/card";
import { MapPin } from "lucide-react";

export interface MapMarker {
  id: string;
  latitude: number;
  longitude: number;
  thumbnailUrl: string | null;
  authorName: string | null;
  agendaTitle: string;
}

interface Props {
  markers: MapMarker[];
  totalCount?: number;
  loading?: boolean;
}

const MapInner = dynamic(
  () => import("@/components/public-event-map-inner").then((m) => m.MapInner),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-[360px] w-full items-center justify-center rounded-md bg-muted text-sm text-muted-foreground">
        Karte wird geladen...
      </div>
    ),
  },
);

export function PublicEventMap({ markers, totalCount, loading }: Props) {
  if (markers.length === 0) return null;

  const displayCount = totalCount ?? markers.length;

  return (
    <Card className="overflow-hidden p-4">
      <div className="mb-3 flex items-center gap-2">
        <MapPin className="h-4 w-4 text-primary" aria-hidden="true" />
        <h2 className="text-lg font-semibold">Auf der Karte</h2>
        <span className="text-xs text-muted-foreground">
          {loading ? "(wird geladen …)" : `(${displayCount} ${displayCount === 1 ? "Beitrag" : "Beiträge"})`}
        </span>
      </div>
      <div className="h-[360px] w-full overflow-hidden rounded-md sm:h-[480px]">
        <MapInner markers={markers} />
      </div>
    </Card>
  );
}
