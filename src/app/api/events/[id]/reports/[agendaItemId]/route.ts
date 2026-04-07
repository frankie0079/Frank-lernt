import { createClient } from "@supabase/supabase-js";
import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
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

const reportItemSchema = z.object({
  content_item_id: z.string().uuid("Ungueltige Content-ID"),
  sort_order: z.number().int().min(0).max(100000),
});

const putBodySchema = z.object({
  items: z.array(reportItemSchema).max(500, "Zu viele Beitraege"),
});

function mapRpcError(code: string | undefined): { status: number; error: string } {
  switch (code) {
    case "unauthorized":
      return { status: 401, error: "Nicht angemeldet" };
    case "forbidden":
      return { status: 403, error: "Kein Zugriff auf diesen Bericht" };
    case "not_found":
      return { status: 404, error: "Bericht nicht gefunden" };
    case "invalid_payload":
    case "invalid_item":
      return { status: 400, error: "Ungueltige Daten" };
    case "content_not_in_event":
      return { status: 400, error: "Beitrag gehoert nicht zu diesem Event" };
    case "no_items":
      return { status: 400, error: "Mindestens 1 Beitrag auswaehlen" };
    default:
      return { status: 400, error: "Fehler beim Speichern" };
  }
}

// GET /api/events/[id]/reports/[agendaItemId] — Load report + items
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; agendaItemId: string }> }
) {
  const { id, agendaItemId } = await params;

  if (!isValidUUID(id) || !isValidUUID(agendaItemId)) {
    return NextResponse.json({ error: "Ungueltiges ID-Format" }, { status: 400 });
  }

  const ip = getRateLimitIp(request);
  if (isRateLimited(ip, "read")) {
    return NextResponse.json({ error: "Zu viele Anfragen." }, { status: 429 });
  }

  const token = request.cookies.get("member_token")?.value;
  if (!token) {
    return NextResponse.json({ error: "Nicht angemeldet" }, { status: 401 });
  }

  const supabase = createSupabase();
  const { data, error } = await supabase.rpc("get_report", {
    p_token: token,
    p_agenda_item_id: agendaItemId,
  });

  if (error) {
    return serverError("events/[id]/reports/[agendaItemId]:get", error);
  }

  const result = data as { ok: boolean; error?: string; report?: unknown; items?: unknown };
  if (!result?.ok) {
    const m = mapRpcError(result?.error);
    return NextResponse.json({ error: m.error }, { status: m.status });
  }

  return NextResponse.json({ report: result.report, items: result.items ?? [] });
}

// PUT /api/events/[id]/reports/[agendaItemId] — Bulk save items + order
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; agendaItemId: string }> }
) {
  const { id, agendaItemId } = await params;

  if (!isValidUUID(id) || !isValidUUID(agendaItemId)) {
    return NextResponse.json({ error: "Ungueltiges ID-Format" }, { status: 400 });
  }

  const ip = getRateLimitIp(request);
  if (isRateLimited(ip)) {
    return NextResponse.json({ error: "Zu viele Anfragen." }, { status: 429 });
  }

  const token = request.cookies.get("member_token")?.value;
  if (!token) {
    return NextResponse.json({ error: "Nicht angemeldet" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  if (!body) {
    return NextResponse.json({ error: "Ungueltige Anfrage" }, { status: 400 });
  }

  const parsed = putBodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0].message },
      { status: 400 }
    );
  }

  // Reject duplicate content_item_id within payload
  const ids = parsed.data.items.map((i) => i.content_item_id);
  if (new Set(ids).size !== ids.length) {
    return NextResponse.json(
      { error: "Doppelte Beitraege im Bericht" },
      { status: 400 }
    );
  }

  const supabase = createSupabase();
  const { data, error } = await supabase.rpc("save_report_items", {
    p_token: token,
    p_agenda_item_id: agendaItemId,
    p_items: parsed.data.items,
  });

  if (error) {
    return serverError("events/[id]/reports/[agendaItemId]:put", error);
  }

  const result = data as {
    ok: boolean;
    error?: string;
    report?: unknown;
    item_count?: number;
  };
  if (!result?.ok) {
    const m = mapRpcError(result?.error);
    return NextResponse.json({ error: m.error }, { status: m.status });
  }

  return NextResponse.json({ report: result.report, item_count: result.item_count });
}
