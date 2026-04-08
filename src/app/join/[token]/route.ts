import { NextResponse, type NextRequest } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { isRateLimited, getRateLimitIp } from "@/lib/rate-limit";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const ip = getRateLimitIp(request);
  if (isRateLimited(ip)) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("error", "rate_limited");
    return NextResponse.redirect(url);
  }

  const { token } = await params;

  // Validate token via service-role: anon SELECT on members was revoked by
  // 20260408_lockdown_anon_rls.sql to close BUG-1 (members.token leak).
  const supabase = getSupabaseAdmin();

  // BUG-9 fix: .single() throws PGRST116 on zero rows and bubbles up as a
  // 500 with empty body. Use .maybeSingle() so "no match" returns null data
  // and we can redirect to /login?error=invalid_link.
  const { data: member } = await supabase
    .from("members")
    .select("id, name")
    .eq("token", token)
    .maybeSingle();

  if (!member) {
    // Invalid token: redirect to login with error
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("error", "invalid_link");
    return NextResponse.redirect(url);
  }

  // Set member_token cookie (30 days)
  const url = request.nextUrl.clone();
  url.pathname = "/events";
  url.search = "";
  const response = NextResponse.redirect(url);

  response.cookies.set("member_token", token, {
    path: "/",
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 60 * 60 * 24 * 30, // 30 days
  });

  return response;
}
