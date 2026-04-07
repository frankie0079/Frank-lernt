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
    .select("id, role")
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

// DELETE /api/events/[id]/content/[contentId]/comments/[commentId]
//
// Allowed if requesting member is:
//   * the comment author, OR
//   * the event organizer, OR
//   * the agenda's daily admin (if comment's content item is in an agenda
//     item with admin_member_id matching the requester)
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; contentId: string; commentId: string }> }
) {
  const { id, contentId, commentId } = await params;

  if (!isValidUUID(id) || !isValidUUID(contentId) || !isValidUUID(commentId)) {
    return NextResponse.json({ error: "Ungueltiges ID-Format" }, { status: 400 });
  }

  const ip = getRateLimitIp(request);
  if (isRateLimited(ip, "write")) {
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

  // Load comment + content_item + event in one chain
  const { data: comment } = await supabase
    .from("comments")
    .select("id, author_id, content_item_id")
    .eq("id", commentId)
    .single();

  if (!comment || comment.content_item_id !== contentId) {
    return NextResponse.json({ error: "Kommentar nicht gefunden" }, { status: 404 });
  }

  const { data: item } = await supabase
    .from("content_items")
    .select("id, event_id, agenda_item_id")
    .eq("id", contentId)
    .single();

  if (!item || item.event_id !== id) {
    return NextResponse.json({ error: "Beitrag nicht gefunden" }, { status: 404 });
  }

  let allowed = comment.author_id === currentMember.id;

  if (!allowed) {
    // Organizer of the event?
    const { data: event } = await supabase
      .from("events")
      .select("organizer_id")
      .eq("id", id)
      .single();
    if (event?.organizer_id === currentMember.id) {
      allowed = true;
    }
  }

  if (!allowed && item.agenda_item_id) {
    // Daily admin of the agenda item?
    const { data: agenda } = await supabase
      .from("agenda_items")
      .select("admin_member_id")
      .eq("id", item.agenda_item_id)
      .single();
    if (agenda?.admin_member_id === currentMember.id) {
      allowed = true;
    }
  }

  if (!allowed) {
    return NextResponse.json(
      { error: "Du darfst diesen Kommentar nicht loeschen" },
      { status: 403 }
    );
  }

  const { error: deleteError } = await supabase
    .from("comments")
    .delete()
    .eq("id", commentId);

  if (deleteError) {
    return serverError("comments:delete", deleteError);
  }

  return NextResponse.json({ success: true });
}
