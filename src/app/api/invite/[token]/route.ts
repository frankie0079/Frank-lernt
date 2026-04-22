import { createClient } from "@supabase/supabase-js";
import { NextResponse, type NextRequest } from "next/server";
import { isRateLimited, getRateLimitIp } from "@/lib/rate-limit";
import { serverError } from "@/lib/api-error";
import { z } from "zod";

const joinBodySchema = z.object({
  name: z.string().trim().min(1, "Name ist erforderlich").max(50, "Max 50 Zeichen"),
});

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

// POST /api/invite/[token] — Join event via invitation token.
//
// Two modes:
//   (a) Returning user (has member_token cookie): joins the event under the
//       existing member identity.
//   (b) NEW user (no cookie): client posts `{ name }` → we create a fresh
//       member with a random token, set the cookie, and join them to the
//       event. Before 2026-04-22 this path 401'd and redirected to /login,
//       which was a dead-end for first-time invitees.
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

  const supabase = createSupabaseAdmin();

  // Validate the invitation up-front so we don't create a member for a
  // broken/expired link.
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

  const now = new Date();
  const expiresAt = new Date(invitation.expires_at);
  if (now > expiresAt) {
    return NextResponse.json(
      { error: "Einladungslink abgelaufen" },
      { status: 410 }
    );
  }

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

  // Resolve the acting member:
  //   - existing cookie → lookup
  //   - no cookie       → create new member from provided name
  let currentMember = await getCurrentMember(request);
  let memberTokenToSet: string | null = null;

  if (!currentMember) {
    const body = await request.json().catch(() => null);
    const parsed = joinBodySchema.safeParse(body);
    if (!parsed.success) {
      // Client uses `code` to flip to the name form; the `error` string is
      // only shown on raw-API debugging, keep it simple.
      const firstIssue = parsed.error.issues[0];
      const userFacing =
        firstIssue && firstIssue.path.includes("name") && firstIssue.code !== "invalid_type"
          ? firstIssue.message
          : "Name erforderlich";
      return NextResponse.json(
        { error: userFacing, code: "name_required" },
        { status: 400 }
      );
    }

    const newToken =
      typeof crypto !== "undefined" && crypto.randomUUID
        ? crypto.randomUUID()
        : Math.random().toString(36).slice(2) + Date.now().toString(36);

    const { data: created, error: createErr } = await supabase
      .from("members")
      .insert({
        name: parsed.data.name,
        role: "member",
        token: newToken,
      })
      .select("id, name, role, avatar_url")
      .single();

    if (createErr || !created) {
      return serverError("invite/[token]:create_member", createErr);
    }

    currentMember = created;
    memberTokenToSet = newToken;
  }

  // Check if already a member
  const { data: existingMembership } = await supabase
    .from("event_members")
    .select("id")
    .eq("event_id", invitation.event_id)
    .eq("member_id", currentMember.id)
    .single();

  if (existingMembership) {
    const res = NextResponse.json({
      already_member: true,
      event_id: invitation.event_id,
      event_name: event.name,
    });
    if (memberTokenToSet) setMemberCookie(res, memberTokenToSet);
    return res;
  }

  // BUG-2 fix: atomic join via Postgres RPC with advisory lock.
  // See supabase/migrations/20260406_join_event_rpc.sql.
  const { data: rpcResult, error: rpcError } = await supabase.rpc("join_event", {
    p_event_id: invitation.event_id,
    p_member_id: currentMember.id,
  });

  if (rpcError) {
    return serverError("invite/[token]:join_rpc", rpcError);
  }

  const result = rpcResult as { ok: boolean; status: string } | null;

  if (result?.status === "already_member") {
    const res = NextResponse.json({
      already_member: true,
      event_id: invitation.event_id,
      event_name: event.name,
    });
    if (memberTokenToSet) setMemberCookie(res, memberTokenToSet);
    return res;
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

  const res = NextResponse.json({
    success: true,
    event_id: invitation.event_id,
    event_name: event.name,
  });
  if (memberTokenToSet) setMemberCookie(res, memberTokenToSet);
  return res;
}

// Matches the /join/[token] cookie: 3 years, httpOnly, Secure in prod.
function setMemberCookie(response: NextResponse, token: string) {
  response.cookies.set("member_token", token, {
    path: "/",
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 60 * 60 * 24 * 365 * 3,
  });
}
