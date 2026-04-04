import { createClient } from "@supabase/supabase-js";
import { NextResponse, type NextRequest } from "next/server";

// Helper: get current member from token cookie
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

// GET /api/events/[id]/members — List event members
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  if (!isValidUUID(id)) {
    return NextResponse.json({ error: "Ungueltiges Event-Format" }, { status: 400 });
  }

  const currentMember = await getCurrentMember(request);
  if (!currentMember) {
    return NextResponse.json({ error: "Nicht angemeldet" }, { status: 401 });
  }

  const supabase = createSupabase();

  // Check if the requesting user is a member of the event
  const { data: membership } = await supabase
    .from("event_members")
    .select("role")
    .eq("event_id", id)
    .eq("member_id", currentMember.id)
    .single();

  if (!membership) {
    return NextResponse.json(
      { error: "Kein Zugriff auf dieses Event" },
      { status: 403 }
    );
  }

  // Fetch all event members with their member profile info
  const { data: eventMembers, error: membersError } = await supabase
    .from("event_members")
    .select("id, event_id, member_id, role, joined_at")
    .eq("event_id", id)
    .order("joined_at", { ascending: true })
    .limit(50);

  if (membersError) {
    return NextResponse.json({ error: membersError.message }, { status: 500 });
  }

  // Fetch member profiles for all member_ids
  const memberIds = (eventMembers || []).map((em) => em.member_id);
  const { data: profiles } = await supabase
    .from("members")
    .select("id, name, avatar_url")
    .in("id", memberIds);

  const profileMap = new Map(
    (profiles || []).map((p) => [p.id, p])
  );

  const membersWithProfiles = (eventMembers || []).map((em) => {
    const profile = profileMap.get(em.member_id);
    return {
      ...em,
      member_name: profile?.name ?? null,
      member_avatar_url: profile?.avatar_url ?? null,
    };
  });

  return NextResponse.json({ members: membersWithProfiles });
}
