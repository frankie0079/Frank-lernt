import { createClient } from "@supabase/supabase-js";
import { NextResponse, type NextRequest } from "next/server";
import { isRateLimited, getRateLimitIp } from "@/lib/rate-limit";
import { serverError } from "@/lib/api-error";

// Helper: get current member from token cookie
async function getCurrentMember(request: NextRequest) {
  const token = request.cookies.get("member_token")?.value;
  if (!token) return null;

  // Service-role: anon SELECT on members was revoked by
  // 20260408_lockdown_anon_rls.sql to close BUG-1 (members.token leak).
  const supabase = createSupabaseAdmin();

  const { data } = await supabase
    .from("members")
    .select("id, name, role, avatar_url")
    .eq("token", token)
    .single();

  return data;
}

// Service-role client for privileged operations (bypasses RLS).
// After 20260408_lockdown_anon_rls.sql the anon fallback path no longer
// works for these tables, so SUPABASE_SERVICE_ROLE_KEY is now mandatory.
function createSupabaseAdmin() {
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceKey) {
    throw new Error(
      "SUPABASE_SERVICE_ROLE_KEY is required (anon SELECT on members/events/event_members is locked down)"
    );
  }
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
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

  // BUG-6 fix: use service-role client for privileged invite/join operations
  const supabase = createSupabaseAdmin();

  // Find invitation by token
  const { data: invitation } = await supabase
    .from("invitations")
    .select("id, event_id, expires_at")
    .eq("token", token)
    .single();

  if (!invitation) {
    return NextResponse.json(
      { error: "Einladungslink ungültig" },
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

  // BUG-2 fix: atomic join via Postgres RPC with advisory lock.
  // See supabase/migrations/20260406_join_event_rpc.sql.
  // Race-free: count + insert run inside a transaction-scoped lock keyed on
  // event_id, so concurrent join attempts for the same event serialize.
  const { data: rpcResult, error: rpcError } = await supabase.rpc("join_event", {
    p_event_id: invitation.event_id,
    p_member_id: currentMember.id,
  });

  if (rpcError) {
    return serverError("invite/[token]:join_rpc", rpcError);
  }

  const result = rpcResult as { ok: boolean; status: string } | null;

  if (result?.status === "already_member") {
    return NextResponse.json({
      already_member: true,
      event_id: invitation.event_id,
      event_name: event.name,
    });
  }

  if (result?.status === "full") {
    return NextResponse.json(
      { error: "Maximale Teilnehmerzahl (50) erreicht" },
      { status: 422 }
    );
  }

  if (result?.status !== "joined") {
    return NextResponse.json(
      { error: "Beitritt fehlgeschlagen" },
      { status: 500 }
    );
  }

  return NextResponse.json({
    success: true,
    event_id: invitation.event_id,
    event_name: event.name,
  });
}
