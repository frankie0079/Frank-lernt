import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";

export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;
  const code = searchParams.get("code");
  const redirect = searchParams.get("redirect") || "/events";
  const error = searchParams.get("error");
  const errorDescription = searchParams.get("error_description");

  // Handle errors from Supabase (e.g., expired magic link)
  if (error) {
    const loginUrl = new URL("/login", origin);
    loginUrl.searchParams.set("error", error);
    if (errorDescription) {
      loginUrl.searchParams.set("error_description", errorDescription);
    }
    return NextResponse.redirect(loginUrl);
  }

  if (code) {
    const response = NextResponse.redirect(new URL(redirect, origin));

    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return request.cookies.getAll();
          },
          setAll(cookiesToSet) {
            cookiesToSet.forEach(({ name, value, options }) =>
              response.cookies.set(name, value, options)
            );
          },
        },
      }
    );

    const { data, error: exchangeError } =
      await supabase.auth.exchangeCodeForSession(code);

    if (!exchangeError && data.session) {
      // Ensure a profile row exists for the new user
      const { data: existingProfile } = await supabase
        .from("profiles")
        .select("id")
        .eq("id", data.session.user.id)
        .single();

      if (!existingProfile) {
        await supabase.from("profiles").insert({
          id: data.session.user.id,
          display_name: null,
          avatar_url: null,
        });
      }

      return response;
    }
  }

  // Fallback: redirect to login on any failure
  return NextResponse.redirect(new URL("/login", origin));
}
