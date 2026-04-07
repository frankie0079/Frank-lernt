import { createClient } from "@supabase/supabase-js";
import { NextResponse, type NextRequest } from "next/server";
import { isRateLimited, getRateLimitIp } from "@/lib/rate-limit";
import { serverError } from "@/lib/api-error";

function isValidUUID(id: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
}

function createSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}

// GET /api/events/[id]/reports — Organizer/admin overview of all daily reports
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  if (!isValidUUID(id)) {
    return NextResponse.json({ error: "Ungueltiges Event-Format" }, { status: 400 });
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
  const { data, error } = await supabase.rpc("list_event_reports", {
    p_token: token,
    p_event_id: id,
  });

  if (error) {
    return serverError("events/[id]/reports:list", error);
  }

  const result = data as { ok: boolean; error?: string; reports?: unknown };
  if (!result?.ok) {
    const code = result?.error;
    if (code === "unauthorized") {
      return NextResponse.json({ error: "Nicht angemeldet" }, { status: 401 });
    }
    if (code === "forbidden") {
      return NextResponse.json({ error: "Kein Zugriff auf dieses Event" }, { status: 403 });
    }
    if (code === "not_found") {
      return NextResponse.json({ error: "Event nicht gefunden" }, { status: 404 });
    }
    return NextResponse.json({ error: "Fehler beim Laden" }, { status: 400 });
  }

  return NextResponse.json({ reports: result.reports ?? [] });
}
