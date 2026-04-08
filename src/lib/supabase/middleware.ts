import { NextResponse, type NextRequest } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

export async function updateSession(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Public routes: no auth needed
  const isPublic =
    pathname === "/" ||
    pathname.startsWith("/join/") ||
    pathname.startsWith("/invite/") ||
    pathname.startsWith("/e/") ||
    pathname.startsWith("/touren");

  if (isPublic) {
    return NextResponse.next({ request });
  }

  // Check for member_token cookie
  const token = request.cookies.get("member_token")?.value;

  // Login page: redirect to /events if already authenticated
  if (pathname === "/login") {
    if (token) {
      const url = request.nextUrl.clone();
      url.pathname = "/events";
      return NextResponse.redirect(url);
    }
    return NextResponse.next({ request });
  }

  // Protected routes: require valid token
  if (!token) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    // Note: redirect param is set but not consumed after /join — users always
    // land on /events. This is acceptable since join links are the primary entry.
    url.searchParams.set("redirect", pathname);
    return NextResponse.redirect(url);
  }

  // Validate token against database on every request.
  // Trade-off: one DB query per request for security. Could add in-memory
  // caching later if this becomes a performance concern.
  // Service-role client: anon SELECT on members was revoked by
  // 20260408_lockdown_anon_rls.sql to close BUG-1 (members.token leak).
  const supabase = getSupabaseAdmin();

  const { data: member } = await supabase
    .from("members")
    .select("id")
    .eq("token", token)
    .single();

  if (!member) {
    // Invalid token: clear cookie and redirect to login
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    const response = NextResponse.redirect(url);
    response.cookies.delete("member_token");
    return response;
  }

  return NextResponse.next({ request });
}
