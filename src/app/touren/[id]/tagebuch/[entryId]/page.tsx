import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { DiaryEntryDetail } from "@/components/diary-entry-detail";

interface EntryPageProps {
  params: Promise<{ id: string; entryId: string }>;
}

export async function generateMetadata({ params }: EntryPageProps): Promise<Metadata> {
  const { id, entryId } = await params;

  const [tourRes, entryRes] = await Promise.all([
    supabase.from("tours").select("name").eq("id", id).single(),
    supabase.from("diary_entries").select("title, content, author_name, entry_date").eq("id", entryId).single(),
  ]);

  if (!entryRes.data || !tourRes.data) {
    return { title: "Eintrag — Die Wandervögel" };
  }

  const entry = entryRes.data;
  const tour = tourRes.data;
  const description = entry.content
    ? entry.content.slice(0, 160)
    : `Tagebucheintrag von ${entry.author_name}`;

  return {
    title: `${entry.title} — ${tour.name} — Die Wandervögel`,
    description,
    openGraph: {
      title: `${entry.title} — ${tour.name}`,
      description,
      type: "article",
      authors: [entry.author_name],
      publishedTime: entry.entry_date,
    },
    twitter: {
      card: "summary_large_image",
    },
  };
}

export default async function EntryDetailPage({ params }: EntryPageProps) {
  const { id, entryId } = await params;

  const [tourRes, entryRes, photosRes, audioRes] = await Promise.all([
    supabase.from("tours").select("name").eq("id", id).single(),
    supabase.from("diary_entries").select("*").eq("id", entryId).eq("tour_id", id).single(),
    supabase.from("photos").select("*").eq("diary_entry_id", entryId).order("taken_at", { ascending: true, nullsFirst: false }),
    supabase.from("audio_notes").select("*").eq("diary_entry_id", entryId).order("created_at", { ascending: true }),
  ]);

  if (!entryRes.data) {
    notFound();
  }

  const entry = {
    ...entryRes.data,
    photos: photosRes.data ?? [],
    audio_notes: audioRes.data ?? [],
  };

  return (
    <DiaryEntryDetail
      entry={entry}
      tourId={id}
      tourName={tourRes.data?.name ?? "Tour"}
    />
  );
}
