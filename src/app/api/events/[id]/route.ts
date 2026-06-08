import { NextResponse, type NextRequest } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { isRateLimited, getRateLimitIp } from "@/lib/rate-limit";
import { eventCreateSchema } from "@/lib/validations/event";
import { generateSlug } from "@/lib/event-utils";
import { serverError } from "@/lib/api-error";

// Helper: get current member from token cookie
async function getCurrentMember(request: NextRequest) {
  const token = request.cookies.get("member_token")?.value;
  if (!token) return null;

  const supabase = getSupabaseAdmin();

  const { data } = await supabase
    .from("members")
    .select("id, name, role, avatar_url")
    .eq("token", token)
    .single();

  return data;
}

function createSupabase() {
  return getSupabaseAdmin();
}

// Validate UUID format
function isValidUUID(id: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
}

// GET /api/events/[id] — Get event details + agenda items + member count
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  if (!isValidUUID(id)) {
    return NextResponse.json({ error: "Ungültiges Event-Format" }, { status: 400 });
  }

  const currentMember = await getCurrentMember(request);
  if (!currentMember) {
    return NextResponse.json({ error: "Nicht angemeldet" }, { status: 401 });
  }

  const supabase = createSupabase();

  // Check if member is part of this event
  const { data: membership } = await supabase
    .from("event_members")
    .select("role")
    .eq("event_id", id)
    .eq("member_id", currentMember.id)
    .single();

  if (!membership) {
    return NextResponse.json(
      { error: "Kein Zugriff auf dieses Event" },
      { status: 403 }
    );
  }

  // Fetch event
  const { data: event, error: eventError } = await supabase
    .from("events")
    .select("id, name, description, start_date, end_date, cover_url, cover_position, cover_scale, slug, organizer_id, created_at")
    .eq("id", id)
    .single();

  if (eventError || !event) {
    return NextResponse.json({ error: "Event nicht gefunden" }, { status: 404 });
  }

  // Fetch agenda items
  const { data: agendaItems } = await supabase
    .from("agenda_items")
    .select("id, event_id, date, title, description, admin_member_id, sort_order, latitude, longitude")
    .eq("event_id", id)
    .order("sort_order", { ascending: true })
    .limit(30);

  // Fetch member count
  const { count } = await supabase
    .from("event_members")
    .select("*", { count: "exact", head: true })
    .eq("event_id", id);

  return NextResponse.json({
    event: {
      ...event,
      member_count: count || 0,
    },
    agenda_items: agendaItems || [],
  });
}

// PATCH /api/events/[id] — Update event + synchronize agenda items (organizer only)
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  if (!isValidUUID(id)) {
    return NextResponse.json({ error: "Ungültiges Event-Format" }, { status: 400 });
  }

  const ip = getRateLimitIp(request);
  if (isRateLimited(ip)) {
    return NextResponse.json(
      { error: "Zu viele Anfragen. Bitte warte kurz." },
      { status: 429 }
    );
  }

  const currentMember = await getCurrentMember(request);
  if (!currentMember) {
    return NextResponse.json({ error: "Nicht angemeldet" }, { status: 401 });
  }

  const supabase = createSupabase();

  // Check if the event exists and current member is the organizer
  const { data: event } = await supabase
    .from("events")
    .select("id, organizer_id")
    .eq("id", id)
    .single();

  if (!event) {
    return NextResponse.json({ error: "Event nicht gefunden" }, { status: 404 });
  }

  if (event.organizer_id !== currentMember.id) {
    return NextResponse.json(
      { error: "Nur der Organisator kann das Event bearbeiten" },
      { status: 403 }
    );
  }

  const body = await request.json().catch(() => null);
  if (!body) {
    return NextResponse.json({ error: "Ungültige Anfrage" }, { status: 400 });
  }

  // Use the same schema for validation
  const parsed = eventCreateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0].message },
      { status: 400 }
    );
  }

  const agendaItems = parsed.data.agenda_items;
  let removedAgendaIds: string[] = [];

  if (agendaItems !== undefined) {
    const { data: existingAgenda, error: agendaReadError } = await supabase
      .from("agenda_items")
      .select("id")
      .eq("event_id", id);
    if (agendaReadError) return serverError("events/[id]:agenda-read", agendaReadError);

    const existingIds = new Set((existingAgenda ?? []).map((item) => item.id));
    const submittedIds = agendaItems
      .map((item) => item.id)
      .filter((itemId): itemId is string => Boolean(itemId));

    if (new Set(submittedIds).size !== submittedIds.length) {
      return NextResponse.json({ error: "Agenda enthält doppelte Einträge" }, { status: 400 });
    }
    if (submittedIds.some((itemId) => !existingIds.has(itemId))) {
      return NextResponse.json(
        { error: "Ein Agenda-Punkt gehört nicht zu diesem Event" },
        { status: 400 }
      );
    }

    const submittedIdSet = new Set(submittedIds);
    removedAgendaIds = [...existingIds].filter((itemId) => !submittedIdSet.has(itemId));

    if (removedAgendaIds.length > 0) {
      const [content, reports, pages] = await Promise.all([
        supabase
          .from("content_items")
          .select("agenda_item_id", { count: "exact", head: true })
          .in("agenda_item_id", removedAgendaIds),
        supabase
          .from("daily_reports")
          .select("agenda_item_id", { count: "exact", head: true })
          .in("agenda_item_id", removedAgendaIds),
        supabase
          .from("book_pages")
          .select("agenda_item_id", { count: "exact", head: true })
          .in("agenda_item_id", removedAgendaIds),
      ]);
      if (content.error || reports.error || pages.error) {
        return serverError(
          "events/[id]:agenda-dependency-check",
          content.error ?? reports.error ?? pages.error
        );
      }
      const linkedCount = (content.count ?? 0) + (reports.count ?? 0) + (pages.count ?? 0);
      if (linkedCount > 0) {
        return NextResponse.json(
          {
            error:
              "Dieser Agenda-Punkt wird bereits von Fotos, Kuratierung oder Tagebuch verwendet. Benenne ihn um oder ordne die Inhalte zuerst neu zu.",
            code: "agenda_in_use",
          },
          { status: 409 }
        );
      }
    }
  }

  // Re-generate slug if name changed
  let slug: string | undefined;
  const { data: currentEvent } = await supabase
    .from("events")
    .select("name, slug")
    .eq("id", id)
    .single();

  if (currentEvent && parsed.data.name !== currentEvent.name) {
    const baseSlug = generateSlug(parsed.data.name);
    slug = baseSlug;
    let suffix = 2;

    while (true) {
      const { data: existing } = await supabase
        .from("events")
        .select("id")
        .eq("slug", slug)
        .neq("id", id)
        .single();

      if (!existing) break;
      slug = `${baseSlug}-${suffix}`;
      suffix++;

      if (suffix > 100) {
        slug = `${baseSlug}-${Date.now()}`;
        break;
      }
    }
  }

  // Update event
  const updateData: Record<string, unknown> = {
    name: parsed.data.name,
    description: parsed.data.description || null,
    start_date: parsed.data.start_date,
    end_date: parsed.data.end_date,
    cover_url: parsed.data.cover_url ?? null,
    cover_position: parsed.data.cover_position ?? "center",
    cover_scale: parsed.data.cover_scale ?? 1.0,
  };

  if (slug) {
    updateData.slug = slug;
  }

  const { data: updatedEvent, error: updateError } = await supabase
    .from("events")
    .update(updateData)
    .eq("id", id)
    .select("id, name, description, start_date, end_date, cover_url, cover_position, cover_scale, slug, organizer_id, created_at")
    .single();

  if (updateError) {
    return serverError("events/[id]:update", updateError);
  }

  // Synchronize agenda items without replacing IDs. Existing IDs are stable
  // links used by content, daily reports, book pages and archives.
  let newAgendaItems: unknown[] = [];

  if (agendaItems !== undefined) {
    for (const [index, item] of agendaItems.entries()) {
      if (!item.id) continue;
      const { error } = await supabase
        .from("agenda_items")
        .update({
          date: item.date,
          title: item.title,
          description: item.description || null,
          sort_order: item.sort_order ?? index,
          latitude: item.latitude ?? null,
          longitude: item.longitude ?? null,
        })
        .eq("id", item.id)
        .eq("event_id", id);
      if (error) return serverError("events/[id]:agenda-update", error);

      const { error: bookOrderError } = await supabase
        .from("book_pages")
        .update({ sort_order: item.sort_order ?? index })
        .eq("agenda_item_id", item.id)
        .eq("event_id", id);
      if (bookOrderError) return serverError("events/[id]:book-order-update", bookOrderError);
    }

    const addedItems = agendaItems.filter((item) => !item.id);
    if (addedItems.length > 0) {
      const agendaRows = addedItems.map((item, index) => ({
        event_id: id,
        date: item.date,
        title: item.title,
        description: item.description || null,
        sort_order: item.sort_order ?? agendaItems.length - addedItems.length + index,
        latitude: item.latitude ?? null,
        longitude: item.longitude ?? null,
      }));
      const { error } = await supabase.from("agenda_items").insert(agendaRows);
      if (error) return serverError("events/[id]:agenda-insert", error);
    }

    if (removedAgendaIds.length > 0) {
      const { error } = await supabase
        .from("agenda_items")
        .delete()
        .eq("event_id", id)
        .in("id", removedAgendaIds);
      if (error) return serverError("events/[id]:agenda-delete", error);
    }
  }

  const { data: currentAgenda, error: currentAgendaError } = await supabase
    .from("agenda_items")
    .select("id, event_id, date, title, description, admin_member_id, sort_order, latitude, longitude")
    .eq("event_id", id)
    .order("sort_order", { ascending: true });
  if (currentAgendaError) return serverError("events/[id]:agenda-read-updated", currentAgendaError);
  newAgendaItems = currentAgenda || [];

  return NextResponse.json({
    event: updatedEvent,
    agenda_items: newAgendaItems,
  });
}

// DELETE /api/events/[id] — Delete event (organizer only, CASCADE handles cleanup)
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  if (!isValidUUID(id)) {
    return NextResponse.json({ error: "Ungültiges Event-Format" }, { status: 400 });
  }

  const ip = getRateLimitIp(request);
  if (isRateLimited(ip)) {
    return NextResponse.json(
      { error: "Zu viele Anfragen. Bitte warte kurz." },
      { status: 429 }
    );
  }

  const currentMember = await getCurrentMember(request);
  if (!currentMember) {
    return NextResponse.json({ error: "Nicht angemeldet" }, { status: 401 });
  }

  const supabase = createSupabase();

  // Check if the event exists and current member is the organizer
  const { data: event } = await supabase
    .from("events")
    .select("id, organizer_id")
    .eq("id", id)
    .single();

  if (!event) {
    return NextResponse.json({ error: "Event nicht gefunden" }, { status: 404 });
  }

  if (event.organizer_id !== currentMember.id) {
    return NextResponse.json(
      { error: "Nur der Organisator kann das Event löschen" },
      { status: 403 }
    );
  }

  // Delete (CASCADE handles event_members and agenda_items)
  const { error: deleteError } = await supabase
    .from("events")
    .delete()
    .eq("id", id);

  if (deleteError) {
    return serverError("events/[id]:delete", deleteError);
  }

  return NextResponse.json({ success: true });
}
