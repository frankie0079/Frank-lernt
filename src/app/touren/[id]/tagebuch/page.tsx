import type { Metadata } from "next";
import { supabase } from "@/lib/supabase";
import { TagebuchClient } from "@/components/tagebuch-client";

interface TagebuchPageProps {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({ params }: TagebuchPageProps): Promise<Metadata> {
  const { id } = await params;

  const { data: tour } = await supabase
    .from("tours")
    .select("name, subtitle, cover_photo_url")
    .eq("id", id)
    .single();

  if (!tour) {
    return { title: "Tagebuch — Die Wandervögel" };
  }

  return {
    title: `Tagebuch — ${tour.name} — Die Wandervögel`,
    description: `Reisetagebuch der Tour ${tour.name} (${tour.subtitle}).`,
    openGraph: {
      title: `Tagebuch — ${tour.name}`,
      description: `Reisetagebuch der Tour ${tour.name} (${tour.subtitle}).`,
      images: tour.cover_photo_url ? [tour.cover_photo_url] : [],
    },
  };
}

export default async function TagebuchPage({ params }: TagebuchPageProps) {
  const { id } = await params;

  const [tourResult, entriesResult] = await Promise.all([
    supabase
      .from("tours")
      .select("name")
      .eq("id", id)
      .single(),
    supabase
      .from("diary_entries")
      .select("*")
      .eq("tour_id", id)
      .order("entry_date", { ascending: false })
      .limit(100),
  ]);

  if (entriesResult.error) {
    return (
      <div className="py-12 text-center">
        <p className="text-destructive">Fehler beim Laden der Einträge.</p>
        <p className="text-sm text-muted-foreground mt-1">{entriesResult.error.message}</p>
      </div>
    );
  }

  const tourName = tourResult.data?.name ?? "Tour";

  return (
    <TagebuchClient
      tourId={id}
      tourName={tourName}
      initialEntries={entriesResult.data ?? []}
    />
  );
}
