import { NextResponse, type NextRequest } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { isRateLimited, getRateLimitIp } from "@/lib/rate-limit";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
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

    // BUG-9 fix: .maybeSingle() so unknown tokens return null data instead
    // of throwing PGRST116.
    const { data: member, error } = await supabase
      .from("members")
      .select("id, name")
      .eq("token", token)
      .maybeSingle();

    if (error) {
      console.error("[join/token] supabase error", {
        code: error.code,
        message: error.message,
        details: error.details,
      });
      const url = request.nextUrl.clone();
      url.pathname = "/login";
      url.searchParams.set("error", "invalid_link");
      return NextResponse.redirect(url);
    }

    if (!member) {
      // Invalid token: redirect to login with error
      const url = request.nextUrl.clone();
      url.pathname = "/login";
      url.searchParams.set("error", "invalid_link");
      return NextResponse.redirect(url);
    }

    // Set member_token cookie (3 years). Tippen eines neuen Tokens auf dem
    // iPhone ist so muehsam, dass Re-Login selten sein muss — 3 Jahre
    // umfassen auch Folge-Events der gleichen Gruppe.
    const url = request.nextUrl.clone();
    url.pathname = "/events";
    url.search = "";
    const response = NextResponse.redirect(url);

    response.cookies.set("member_token", token, {
      path: "/",
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 60 * 60 * 24 * 365 * 3, // 3 years
    });

    return response;
  } catch (err) {
    // Defensive: never let the /join route return an opaque 500. Log the
    // actual error to Vercel runtime logs and redirect to /login.
    console.error("[join/token] unhandled error", {
      message: err instanceof Error ? err.message : String(err),
      stack: err instanceof Error ? err.stack : undefined,
    });
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("error", "invalid_link");
    return NextResponse.redirect(url);
  }
}
