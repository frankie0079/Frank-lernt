import { NextResponse, type NextRequest } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { isRateLimited, getRateLimitIp } from "@/lib/rate-limit";
import { serverError } from "@/lib/api-error";

// Helper: get current member from token cookie
async function getCurrentMember(request: NextRequest) {
  const token = request.cookies.get("member_token")?.value;
  if (!token) return null;

  const supabase = getSupabaseAdmin();

  const { data } = await supabase
    .from("members")
    .select("id, name, role, avatar_url")
    .eq("token", token)
    .single();

  return data;
}

function createSupabase() {
  return getSupabaseAdmin();
}

function isValidUUID(id: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
}

// DELETE /api/events/[id]/members/[memberId] — Remove member (organizer only, not self)
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; memberId: string }> }
) {
  const { id, memberId } = await params;

  if (!isValidUUID(id) || !isValidUUID(memberId)) {
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

  // Check if current user is the organizer of this event
  const { data: event } = await supabase
    .from("events")
    .select("id, organizer_id")
    .eq("id", id)
    .single();

  if (!event) {
    return NextResponse.json({ error: "Event nicht gefunden" }, { status: 404 });
  }

  if (event.organizer_id !== currentMember.id) {
    return NextResponse.json(
      { error: "Nur der Organisator kann Teilnehmer entfernen" },
      { status: 403 }
    );
  }

  // Cannot remove self (organizer)
  if (memberId === currentMember.id) {
    return NextResponse.json(
      { error: "Du kannst dich nicht selbst entfernen" },
      { status: 403 }
    );
  }

  // Check target member exists in event
  const { data: targetMembership } = await supabase
    .from("event_members")
    .select("id")
    .eq("event_id", id)
    .eq("member_id", memberId)
    .single();

  if (!targetMembership) {
    return NextResponse.json(
      { error: "Mitglied nicht in diesem Event gefunden" },
      { status: 404 }
    );
  }

  // Remove the member
  const { error: deleteError } = await supabase
    .from("event_members")
    .delete()
    .eq("event_id", id)
    .eq("member_id", memberId);

  if (deleteError) {
    return serverError("events/[id]/members/[memberId]:delete", deleteError);
  }

  return NextResponse.json({ success: true });
}
