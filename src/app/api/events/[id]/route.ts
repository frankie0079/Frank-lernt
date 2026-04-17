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
    return NextResponse.json({ error: "Ungueltiges Event-Format" }, { status: 400 });
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
    .select("id, event_id, date, title, description, admin_member_id, sort_order")
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

// PATCH /api/events/[id] — Update event + replace agenda items (organizer only)
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  if (!isValidUUID(id)) {
    return NextResponse.json({ error: "Ungueltiges Event-Format" }, { status: 400 });
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
    return NextResponse.json({ error: "Ungueltige Anfrage" }, { status: 400 });
  }

  // Use the same schema for validation
  const parsed = eventCreateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0].message },
      { status: 400 }
    );
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

  // Only replace agenda items if explicitly provided in the payload
  const agendaItems = parsed.data.agenda_items;
  let newAgendaItems: unknown[] = [];

  if (agendaItems !== undefined) {
    const { error: deleteAgendaError } = await supabase
      .from("agenda_items")
      .delete()
      .eq("event_id", id);

    if (deleteAgendaError) {
      console.error("Failed to delete agenda items:", deleteAgendaError.message);
    }

    if (agendaItems && agendaItems.length > 0) {
      const agendaRows = agendaItems.map((item, index) => ({
        event_id: id,
        date: item.date,
        title: item.title,
        description: item.description || null,
        sort_order: item.sort_order ?? index,
      }));

      const { data: insertedAgenda, error: agendaError } = await supabase
        .from("agenda_items")
        .insert(agendaRows)
        .select("id, event_id, date, title, description, admin_member_id, sort_order");

      if (agendaError) {
        console.error("Failed to insert agenda items:", agendaError.message);
      } else {
        newAgendaItems = insertedAgenda || [];
      }
    }
  } else {
    // agenda_items not in payload — fetch existing ones to return
    const { data: existingAgenda } = await supabase
      .from("agenda_items")
      .select("id, event_id, date, title, description, admin_member_id, sort_order")
      .eq("event_id", id)
      .order("sort_order", { ascending: true });
    newAgendaItems = existingAgenda || [];
  }

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
    return NextResponse.json({ error: "Ungueltiges Event-Format" }, { status: 400 });
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
      { error: "Nur der Organisator kann das Event loeschen" },
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
