import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { isRateLimited, getRateLimitIp } from "@/lib/rate-limit";

type Params = { params: Promise<{ id: string; entryId: string }> };

export async function GET(_request: Request, { params }: Params) {
  const { id, entryId } = await params;

  const [entryRes, photosRes, audioRes] = await Promise.all([
    supabase
      .from("diary_entries")
      .select("*")
      .eq("id", entryId)
      .eq("tour_id", id)
      .single(),
    supabase
      .from("photos")
      .select("*")
      .eq("diary_entry_id", entryId)
      .order("taken_at", { ascending: true, nullsFirst: false }),
    supabase
      .from("audio_notes")
      .select("*")
      .eq("diary_entry_id", entryId)
      .order("created_at", { ascending: true }),
  ]);

  if (entryRes.error) {
    return NextResponse.json(
      { error: "Eintrag nicht gefunden" },
      { status: 404 }
    );
  }

  return NextResponse.json({
    ...entryRes.data,
    photos: photosRes.data ?? [],
    audio_notes: audioRes.data ?? [],
  });
}

export async function DELETE(request: Request, { params }: Params) {
  const ip = getRateLimitIp(request);
  if (isRateLimited(ip)) {
    return NextResponse.json(
      { error: "Zu viele Anfragen. Bitte warte kurz." },
      { status: 429 }
    );
  }

  const { id, entryId } = await params;

  const { error } = await supabase
    .from("diary_entries")
    .delete()
    .eq("id", entryId)
    .eq("tour_id", id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
