import type { Metadata } from "next";
import { supabase } from "@/lib/supabase";
import { GalerieClient } from "@/components/galerie-client";

interface GaleriePageProps {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({ params }: GaleriePageProps): Promise<Metadata> {
  const { id } = await params;

  const { data: tour } = await supabase
    .from("tours")
    .select("name, subtitle, cover_photo_url")
    .eq("id", id)
    .single();

  if (!tour) {
    return { title: "Galerie — Die Wandervögel" };
  }

  return {
    title: `Galerie — ${tour.name} — Die Wandervögel`,
    description: `Fotogalerie der Tour ${tour.name} (${tour.subtitle}).`,
    openGraph: {
      title: `Galerie — ${tour.name}`,
      description: `Fotogalerie der Tour ${tour.name} (${tour.subtitle}).`,
      images: tour.cover_photo_url ? [tour.cover_photo_url] : [],
    },
  };
}

export default async function GaleriePage({ params }: GaleriePageProps) {
  const { id } = await params;

  const [tourResult, photosResult] = await Promise.all([
    supabase
      .from("tours")
      .select("name")
      .eq("id", id)
      .single(),
    supabase
      .from("photos")
      .select("*")
      .eq("tour_id", id)
      .order("taken_at", { ascending: false, nullsFirst: false })
      .limit(200),
  ]);

  if (photosResult.error) {
    return (
      <div className="py-12 text-center">
        <p className="text-destructive">Fehler beim Laden der Fotos.</p>
        <p className="text-sm text-muted-foreground mt-1">{photosResult.error.message}</p>
      </div>
    );
  }

  const tourName = tourResult.data?.name ?? "Tour";

  return (
    <GalerieClient
      tourId={id}
      tourName={tourName}
      initialPhotos={photosResult.data ?? []}
    />
  );
}
