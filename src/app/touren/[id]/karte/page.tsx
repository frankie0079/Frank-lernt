import type { Metadata } from "next";
import { supabase } from "@/lib/supabase";
import { KarteClient } from "@/components/karte-client";

interface KartePageProps {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({ params }: KartePageProps): Promise<Metadata> {
  const { id } = await params;

  const { data: tour } = await supabase
    .from("tours")
    .select("name, subtitle, cover_photo_url")
    .eq("id", id)
    .single();

  if (!tour) {
    return { title: "Karte — Die Wandervögel" };
  }

  return {
    title: `Karte — ${tour.name} — Die Wandervögel`,
    description: `Interaktive Karte der Tour ${tour.name} (${tour.subtitle}).`,
    openGraph: {
      title: `Karte — ${tour.name}`,
      description: `Interaktive Karte der Tour ${tour.name} (${tour.subtitle}).`,
      images: tour.cover_photo_url ? [tour.cover_photo_url] : [],
    },
  };
}

export default async function KartePage({ params }: KartePageProps) {
  const { id } = await params;

  // Fetch photos and diary entries with GPS data
  const [photosResult, diaryResult] = await Promise.all([
    supabase
      .from("photos")
      .select("id, gps_lat, gps_lng, thumbnail_url, full_url, caption")
      .eq("tour_id", id)
      .not("gps_lat", "is", null)
      .not("gps_lng", "is", null)
      .limit(200),
    supabase
      .from("diary_entries")
      .select("id, gps_lat, gps_lng, title, content")
      .eq("tour_id", id)
      .not("gps_lat", "is", null)
      .not("gps_lng", "is", null)
      .limit(100),
  ]);

  const photoMarkers = (photosResult.data ?? []).map((p) => ({
    id: p.id,
    type: "photo" as const,
    lat: p.gps_lat!,
    lng: p.gps_lng!,
    thumbnailUrl: p.thumbnail_url || p.full_url,
    caption: p.caption,
  }));

  const diaryMarkers = (diaryResult.data ?? []).map((d) => ({
    id: d.id,
    type: "diary" as const,
    lat: d.gps_lat!,
    lng: d.gps_lng!,
    title: d.title,
    excerpt: d.content ? d.content.slice(0, 100) + (d.content.length > 100 ? "..." : "") : "",
  }));

  return (
    <KarteClient
      photoMarkers={photoMarkers}
      diaryMarkers={diaryMarkers}
    />
  );
}
