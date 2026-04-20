import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { isRateLimited, getRateLimitIp } from "@/lib/rate-limit";
import { serverError } from "@/lib/api-error";
import { BOOK_LAYOUTS, MAX_COMMENT_LENGTH } from "@/lib/book-types";

// PROJ-36: Post-Event Tagebuch — PUT /api/events/[id]/book/[agendaItemId]
//
// Upserts one book page: sets visibility and replaces its sections (each
// section has its own layout + comment + items). Sections are a full bulk
// replace: the RPC deletes all previous sections (cascades items) and inserts
// fresh ones. Organizer-only; enforced both by the RPC and by cookie.

function isValidUUID(id: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
}

function createSupabase() {
  return getSupabaseAdmin();
}

const bookItemSchema = z.object({
  content_item_id: z.string().uuid("Ungültige Content-ID"),
  sort_order: z.number().int().min(0).max(100000),
});

const bookSectionSchema = z.object({
  layout: z.enum(BOOK_LAYOUTS),
  comment: z
    .string()
    .max(MAX_COMMENT_LENGTH, `Kommentar zu lang (max. ${MAX_COMMENT_LENGTH} Zeichen)`),
  sort_order: z.number().int().min(0).max(100000),
  items: z.array(bookItemSchema).max(60, "Zu viele Beiträge auf einer Seite"),
});

const putBodySchema = z.object({
  is_visible: z.boolean(),
  sections: z.array(bookSectionSchema).max(20, "Zu viele Seiten pro Tag"),
});

function mapRpcError(code: string | undefined): { status: number; error: string } {
  switch (code) {
    case "unauthorized":
      return { status: 401, error: "Nicht angemeldet" };
    case "forbidden":
      return { status: 403, error: "Nur der Organisator kann das Tagebuch bearbeiten" };
    case "not_found":
      return { status: 404, error: "Agenda-Tag nicht gefunden" };
    case "invalid_payload":
    case "invalid_item":
      return { status: 400, error: "Ungültige Daten" };
    case "invalid_layout":
      return { status: 400, error: "Ungültiges Layout" };
    case "comment_too_long":
      return { status: 400, error: "Kommentar zu lang" };
    case "content_not_in_event":
      return { status: 400, error: "Beitrag gehört nicht zu diesem Event" };
    default:
      return { status: 400, error: "Fehler beim Speichern" };
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; agendaItemId: string }> }
) {
  const { id, agendaItemId } = await params;

  if (!isValidUUID(id) || !isValidUUID(agendaItemId)) {
    return NextResponse.json({ error: "Ungültiges ID-Format" }, { status: 400 });
  }

  const ip = getRateLimitIp(request);
  if (isRateLimited(ip)) {
    return NextResponse.json(
      { error: "Zu viele Anfragen. Bitte warte kurz." },
      { status: 429 }
    );
  }

  const token = request.cookies.get("member_token")?.value;
  if (!token) {
    return NextResponse.json({ error: "Nicht angemeldet" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  if (!body) {
    return NextResponse.json({ error: "Ungültige Anfrage" }, { status: 400 });
  }

  const parsed = putBodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0].message },
      { status: 400 }
    );
  }

  // Reject duplicate content_item_id within the same section (UNIQUE
  // constraint on (section_id, content_item_id) would catch this, but a
  // clearer error here helps the client). Duplicates across different
  // sections are allowed — the same photo can appear in two sections.
  for (const sec of parsed.data.sections) {
    const ids = sec.items.map((i) => i.content_item_id);
    if (new Set(ids).size !== ids.length) {
      return NextResponse.json(
        { error: "Doppelte Beiträge auf einer Seite" },
        { status: 400 }
      );
    }
  }

  // Defence-in-depth: verify agendaItemId actually belongs to the event in the
  // URL before invoking the RPC. Prevents URL-tampering where someone passes a
  // valid agenda_id from a different event where they happen to be organizer.
  const supabase = createSupabase();
  const { data: agenda, error: agendaError } = await supabase
    .from("agenda_items")
    .select("event_id")
    .eq("id", agendaItemId)
    .single();

  if (agendaError || !agenda) {
    return NextResponse.json(
      { error: "Agenda-Tag nicht gefunden" },
      { status: 404 }
    );
  }

  if (agenda.event_id !== id) {
    return NextResponse.json(
      { error: "Agenda-Tag gehört nicht zu diesem Event" },
      { status: 400 }
    );
  }

  const { data, error } = await supabase.rpc("save_book_page", {
    p_token: token,
    p_agenda_item_id: agendaItemId,
    p_is_visible: parsed.data.is_visible,
    p_sections: parsed.data.sections,
  });

  if (error) {
    return serverError("events/[id]/book/[agendaItemId]:put", error);
  }

  const result = data as { ok: boolean; error?: string; page?: unknown };
  if (!result?.ok) {
    const m = mapRpcError(result?.error);
    return NextResponse.json({ error: m.error }, { status: m.status });
  }

  return NextResponse.json({ page: result.page });
}
