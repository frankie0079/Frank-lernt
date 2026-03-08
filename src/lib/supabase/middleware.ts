import { createClient } from "@supabase/supabase-js";
import { NextResponse, type NextRequest } from "next/server";

export async function updateSession(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Public routes: no auth needed
  const isPublic =
    pathname === "/" ||
    pathname.startsWith("/join/") ||
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
    url.searchParams.set("redirect", pathname);
    return NextResponse.redirect(url);
  }

  // Validate token against database
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

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
