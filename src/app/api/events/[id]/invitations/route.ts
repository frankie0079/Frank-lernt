import { createClient } from "@supabase/supabase-js";
import { NextResponse, type NextRequest } from "next/server";
import { isRateLimited, getRateLimitIp } from "@/lib/rate-limit";
import crypto from "crypto";

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

// GET /api/events/[id]/invitations — Get current invitation link (organizer only)
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

  // Verify organizer
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
      { error: "Nur der Organisator kann Einladungslinks verwalten" },
      { status: 403 }
    );
  }

  // Fetch the current invitation (latest one, not expired)
  const { data: invitation } = await supabase
    .from("invitations")
    .select("id, event_id, token, expires_at, created_at")
    .eq("event_id", id)
    .order("created_at", { ascending: false })
    .limit(1)
    .single();

  if (!invitation) {
    return NextResponse.json({ error: "Kein Einladungslink vorhanden" }, { status: 404 });
  }

  return NextResponse.json({ invitation });
}

// POST /api/events/[id]/invitations — Generate new invitation link (organizer only)
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  if (!isValidUUID(id)) {
    return NextResponse.json({ error: "Ungueltiges Event-Format" }, { status: 400 });
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

  // Verify organizer
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
      { error: "Nur der Organisator kann Einladungslinks erstellen" },
      { status: 403 }
    );
  }

  // Delete existing invitations for this event (one active link at a time)
  await supabase
    .from("invitations")
    .delete()
    .eq("event_id", id);

  // Generate cryptographically secure token
  const token = crypto.randomBytes(24).toString("base64url"); // 32 chars

  // Set expiry to 7 days from now
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + 7);

  // Insert new invitation
  const { data: invitation, error: insertError } = await supabase
    .from("invitations")
    .insert({
      event_id: id,
      token,
      created_by: currentMember.id,
      expires_at: expiresAt.toISOString(),
    })
    .select("id, event_id, token, expires_at, created_at")
    .single();

  if (insertError) {
    return NextResponse.json({ error: insertError.message }, { status: 500 });
  }

  return NextResponse.json({ invitation });
}
