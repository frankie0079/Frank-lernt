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

  const { data: member } = await supabase
    .from("members")
    .select("id, name")
    .eq("token", token)
    .single();

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
