import { NextResponse, type NextRequest } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { isRateLimited, getRateLimitIp } from "@/lib/rate-limit";
import { serverError } from "@/lib/api-error";

// PROJ-36: Post-Event Tagebuch — GET /api/events/[id]/book
//
// Returns every book page of an event (one per agenda_item). Pages are
// auto-created by the SQL RPC so the editor always has something to render.
// Access is restricted to event members via the member_token cookie.

function isValidUUID(id: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
}

function createSupabase() {
  return getSupabaseAdmin();
}

function mapRpcError(code: string | undefined): { status: number; error: string } {
  switch (code) {
    case "unauthorized":
      return { status: 401, error: "Nicht angemeldet" };
    case "forbidden":
      return { status: 403, error: "Kein Zugriff auf dieses Event" };
    case "not_found":
      return { status: 404, error: "Event nicht gefunden" };
    default:
      return { status: 400, error: "Fehler beim Laden" };
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  if (!isValidUUID(id)) {
    return NextResponse.json(
      { error: "Ungültiges Event-Format" },
      { status: 400 }
    );
  }

  const ip = getRateLimitIp(request);
  if (isRateLimited(ip, "read")) {
    return NextResponse.json(
      { error: "Zu viele Anfragen. Bitte warte kurz." },
      { status: 429 }
    );
  }

  const token = request.cookies.get("member_token")?.value;
  if (!token) {
    return NextResponse.json({ error: "Nicht angemeldet" }, { status: 401 });
  }

  const supabase = createSupabase();
  const { data, error } = await supabase.rpc("get_event_book", {
    p_token: token,
    p_event_id: id,
  });

  if (error) {
    return serverError("events/[id]/book:get", error);
  }

  const result = data as {
    ok: boolean;
    error?: string;
    event_id?: string;
    is_organizer?: boolean;
    pages?: unknown;
  };

  if (!result?.ok) {
    const m = mapRpcError(result?.error);
    return NextResponse.json({ error: m.error }, { status: m.status });
  }

  // Defence-in-depth: hidden pages must not leak their sections to
  // non-organizers. We keep the page entry in the response (so the read view
  // can render a minimal "day existed but is hidden" placeholder and the
  // chronology stays visible) but strip sensitive fields. A raw curl with
  // only a member_token cookie therefore sees date + title but no photos or
  // organizer comment for hidden pages.
  const allPages = Array.isArray(result.pages)
    ? (result.pages as Array<Record<string, unknown>>)
    : [];
  const isOrganizer = !!result.is_organizer;
  const pages = isOrganizer
    ? allPages
    : allPages.map((p) =>
        p?.is_visible === false
          ? { ...p, sections: [] }
          : p
      );

  return NextResponse.json({
    event_id: result.event_id ?? id,
    is_organizer: isOrganizer,
    pages,
  });
}
