import { NextResponse, type NextRequest } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { z } from "zod";
import { isRateLimited, getRateLimitIp } from "@/lib/rate-limit";
import { serverError } from "@/lib/api-error";

const updateMemberSchema = z.object({
  name: z.string().max(50, "Max 50 Zeichen").nullable().optional(),
  avatar_url: z.string().url().refine(
    (url) => !url || url.includes("supabase.co"),
    { message: "Avatar-URL muss vom Supabase Storage stammen" }
  ).nullable().optional(),
});

// Service-role client: anon SELECT on members was revoked by
// 20260408_lockdown_anon_rls.sql to close BUG-1 (members.token leak).
function getSupabase() {
  return getSupabaseAdmin();
}

// GET /api/members/me — Get current member (without token!)
export async function GET(request: NextRequest) {
  const token = request.cookies.get("member_token")?.value;
  if (!token) {
    return NextResponse.json({ member: null }, { status: 401 });
  }

  const { data: member } = await getSupabase()
    .from("members")
    .select("id, name, role, avatar_url, created_at, updated_at")
    .eq("token", token)
    .single();

  if (!member) {
    return NextResponse.json({ member: null }, { status: 401 });
  }

  const response = NextResponse.json({ member });
  response.cookies.set("member_token", token, {
    path: "/",
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 60 * 60 * 24 * 365 * 3,
  });
  return response;
}

// PATCH /api/members/me — Update own profile (name, avatar_url)
export async function PATCH(request: NextRequest) {
  const ip = getRateLimitIp(request);
  if (isRateLimited(ip)) {
    return NextResponse.json(
      { error: "Zu viele Anfragen. Bitte warte kurz." },
      { status: 429 }
    );
  }

  const token = request.cookies.get("member_token")?.value;
  if (!token) {
    return NextResponse.json({ error: "Nicht angemeldet" }, { status: 401 });
  }

  // Get current member ID from token
  const supabase = getSupabase();
  const { data: currentMember } = await supabase
    .from("members")
    .select("id")
    .eq("token", token)
    .single();

  if (!currentMember) {
    return NextResponse.json({ error: "Nicht angemeldet" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  if (!body) {
    return NextResponse.json({ error: "Ungültige Anfrage" }, { status: 400 });
  }

  const parsed = updateMemberSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0].message },
      { status: 400 }
    );
  }

  // Only update fields that were provided
  const updates: Record<string, unknown> = {};
  if (parsed.data.name !== undefined) updates.name = parsed.data.name;
  if (parsed.data.avatar_url !== undefined) updates.avatar_url = parsed.data.avatar_url;

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: "Keine Änderungen" }, { status: 400 });
  }

  const { data: updated, error } = await supabase
    .from("members")
    .update(updates)
    .eq("id", currentMember.id)
    .select("id, name, role, avatar_url, created_at, updated_at")
    .single();

  if (error) {
    return serverError("members/me:update", error);
  }

  return NextResponse.json({ member: updated });
}

// DELETE /api/members/me — Sign out (clear cookie)
export async function DELETE() {
  const response = NextResponse.json({ ok: true });
  response.cookies.delete("member_token");
  return response;
}
