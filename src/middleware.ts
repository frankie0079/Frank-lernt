import { updateSession } from "@/lib/supabase/middleware";
import type { NextRequest } from "next/server";

export async function middleware(request: NextRequest) {
  return await updateSession(request);
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - icons/ (PWA icons)
     * - manifest.json (PWA manifest)
     * - sw.js (service worker)
     * - api/ (API routes handle their own auth)
     */
    "/((?!_next/static|_next/image|favicon\\.ico|icons/|manifest\\.json|sw\\.js|api/).*)",
  ],
};
