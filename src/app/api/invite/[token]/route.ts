import { createClient } from "@supabase/supabase-js";
import { NextResponse, type NextRequest } from "next/server";
import { isRateLimited, getRateLimitIp } from "@/lib/rate-limit";

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

// POST /api/invite/[token] — Join event via invitation token
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;

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

  // Find invitation by token
  const { data: invitation } = await supabase
    .from("invitations")
    .select("id, event_id, expires_at")
    .eq("token", token)
    .single();

  if (!invitation) {
    return NextResponse.json(
      { error: "Einladungslink ungueltig" },
      { status: 404 }
    );
  }

  // Check expiry
  const now = new Date();
  const expiresAt = new Date(invitation.expires_at);
  if (now > expiresAt) {
    return NextResponse.json(
      { error: "Einladungslink abgelaufen" },
      { status: 410 }
    );
  }

  // Get event name for response
  const { data: event } = await supabase
    .from("events")
    .select("id, name")
    .eq("id", invitation.event_id)
    .single();

  if (!event) {
    return NextResponse.json(
      { error: "Event nicht gefunden" },
      { status: 404 }
    );
  }

  // Check if already a member
  const { data: existingMembership } = await supabase
    .from("event_members")
    .select("id")
    .eq("event_id", invitation.event_id)
    .eq("member_id", currentMember.id)
    .single();

  if (existingMembership) {
    return NextResponse.json({
      already_member: true,
      event_id: invitation.event_id,
      event_name: event.name,
    });
  }

  // Check member count (max 50)
  const { count } = await supabase
    .from("event_members")
    .select("*", { count: "exact", head: true })
    .eq("event_id", invitation.event_id);

  if (count !== null && count >= 50) {
    return NextResponse.json(
      { error: "Maximale Teilnehmerzahl (50) erreicht" },
      { status: 422 }
    );
  }

  // Add member to event
  const { error: insertError } = await supabase
    .from("event_members")
    .insert({
      event_id: invitation.event_id,
      member_id: currentMember.id,
      role: "member",
    });

  if (insertError) {
    // Handle unique constraint violation (race condition)
    if (insertError.code === "23505") {
      return NextResponse.json({
        already_member: true,
        event_id: invitation.event_id,
        event_name: event.name,
      });
    }
    return NextResponse.json({ error: insertError.message }, { status: 500 });
  }

  return NextResponse.json({
    success: true,
    event_id: invitation.event_id,
    event_name: event.name,
  });
}
