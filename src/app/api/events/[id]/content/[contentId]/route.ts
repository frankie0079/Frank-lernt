import { createClient } from "@supabase/supabase-js";
import { NextResponse, type NextRequest } from "next/server";
import { isRateLimited, getRateLimitIp } from "@/lib/rate-limit";
import { serverError } from "@/lib/api-error";

async function getCurrentMember(request: NextRequest) {
  const token = request.cookies.get("member_token")?.value;
  if (!token) return null;

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  const { data } = await supabase
    .from("members")
    .select("id, name, role, avatar_url")
    .eq("token", token)
    .single();

  return data;
}

function createSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}

function isValidUUID(id: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
}

// DELETE /api/events/[id]/content/[contentId] — Delete own content item
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; contentId: string }> }
) {
  const { id, contentId } = await params;

  if (!isValidUUID(id) || !isValidUUID(contentId)) {
    return NextResponse.json({ error: "Ungueltiges Format" }, { status: 400 });
  }

  const ip = getRateLimitIp(request);
  if (isRateLimited(ip)) {
    return NextResponse.json(
      { error: "Zu viele Anfragen. Bitte warte kurz." },
      { status: 429 }
    );
  }

  const currentMember = await getCurrentMember(request);
  if (!currentMember) {
    return NextResponse.json({ error: "Nicht angemeldet" }, { status: 401 });
  }

  const supabase = createSupabase();

  // Fetch content item
  const { data: item } = await supabase
    .from("content_items")
    .select("id, event_id, author_id, media_url, thumbnail_url")
    .eq("id", contentId)
    .eq("event_id", id)
    .single();

  if (!item) {
    return NextResponse.json({ error: "Beitrag nicht gefunden" }, { status: 404 });
  }

  // Only author or event organizer can delete
  if (item.author_id !== currentMember.id) {
    const { data: event } = await supabase
      .from("events")
      .select("organizer_id")
      .eq("id", id)
      .single();

    if (!event || event.organizer_id !== currentMember.id) {
      return NextResponse.json(
        { error: "Nur der Autor oder Organisator kann diesen Beitrag loeschen" },
        { status: 403 }
      );
    }
  }

  // Delete storage files if they exist
  const filesToDelete: string[] = [];
  for (const url of [item.media_url, item.thumbnail_url]) {
    if (url) {
      const match = url.match(/\/storage\/v1\/object\/public\/media\/(.+)$/);
      if (match) filesToDelete.push(match[1]);
    }
  }

  if (filesToDelete.length > 0) {
    await supabase.storage.from("media").remove(filesToDelete);
  }

  // Delete content item
  const { error: deleteError } = await supabase
    .from("content_items")
    .delete()
    .eq("id", contentId);

  if (deleteError) {
    return serverError("events/[id]/content/[contentId]:delete", deleteError);
  }

  return NextResponse.json({ success: true });
}
