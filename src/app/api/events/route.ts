import { createClient } from "@supabase/supabase-js";
import { NextResponse, type NextRequest } from "next/server";
import { isRateLimited, getRateLimitIp } from "@/lib/rate-limit";
import { eventCreateSchema } from "@/lib/validations/event";
import { generateSlug } from "@/lib/event-utils";

// Helper: get current member from token cookie
async function getCurrentMember(request: NextRequest) {
  const token = request.cookies.get("member_token")?.value;
  if (!token) return null;

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  const { data } = await supabase
    .from("members")
    .select("id, name, role, avatar_url")
    .eq("token", token)
    .single();

  return data;
}

// GET /api/events — List events where current member is a participant
export async function GET(request: NextRequest) {
  const currentMember = await getCurrentMember(request);
  if (!currentMember) {
    return NextResponse.json({ error: "Nicht angemeldet" }, { status: 401 });
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  // Get event IDs where this member is a participant
  const { data: memberships, error: memberError } = await supabase
    .from("event_members")
    .select("event_id")
    .eq("member_id", currentMember.id)
    .limit(100);

  if (memberError) {
    return NextResponse.json({ error: memberError.message }, { status: 500 });
  }

  if (!memberships || memberships.length === 0) {
    return NextResponse.json({ events: [] });
  }

  const eventIds = memberships.map((m) => m.event_id);

  // Fetch events with member count
  const { data: events, error: eventsError } = await supabase
    .from("events")
    .select("id, name, description, start_date, end_date, cover_url, slug, organizer_id, created_at")
    .in("id", eventIds)
    .order("start_date", { ascending: false })
    .limit(100);

  if (eventsError) {
    return NextResponse.json({ error: eventsError.message }, { status: 500 });
  }

  // Get member counts for each event
  const { data: counts, error: countsError } = await supabase
    .from("event_members")
    .select("event_id")
    .in("event_id", eventIds);

  if (countsError) {
    return NextResponse.json({ error: countsError.message }, { status: 500 });
  }

  // Build count map
  const countMap: Record<string, number> = {};
  for (const row of counts || []) {
    countMap[row.event_id] = (countMap[row.event_id] || 0) + 1;
  }

  const eventsWithCount = (events || []).map((event) => ({
    ...event,
    member_count: countMap[event.id] || 0,
  }));

  return NextResponse.json({ events: eventsWithCount });
}

// POST /api/events — Create a new event (any authenticated member can create)
export async function POST(request: NextRequest) {
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

  const body = await request.json().catch(() => null);
  if (!body) {
    return NextResponse.json({ error: "Ungueltige Anfrage" }, { status: 400 });
  }

  const parsed = eventCreateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0].message },
      { status: 400 }
    );
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  // Generate unique slug
  const baseSlug = generateSlug(parsed.data.name);
  let slug = baseSlug;
  let suffix = 2;

  // Check for slug uniqueness
  while (true) {
    const { data: existing } = await supabase
      .from("events")
      .select("id")
      .eq("slug", slug)
      .single();

    if (!existing) break;
    slug = `${baseSlug}-${suffix}`;
    suffix++;

    // Safety: prevent infinite loop
    if (suffix > 100) {
      slug = `${baseSlug}-${Date.now()}`;
      break;
    }
  }

  // 1. Create the event
  const { data: event, error: eventError } = await supabase
    .from("events")
    .insert({
      name: parsed.data.name,
      description: parsed.data.description || null,
      start_date: parsed.data.start_date,
      end_date: parsed.data.end_date,
      cover_url: parsed.data.cover_url || null,
      slug,
      organizer_id: currentMember.id,
    })
    .select("id, name, description, start_date, end_date, cover_url, slug, organizer_id, created_at")
    .single();

  if (eventError) {
    return NextResponse.json({ error: eventError.message }, { status: 500 });
  }

  // 2. Add creator as organizer in event_members
  const { error: memberError } = await supabase
    .from("event_members")
    .insert({
      event_id: event.id,
      member_id: currentMember.id,
      role: "organizer",
    });

  if (memberError) {
    // Cleanup: delete the event if member insertion fails
    await supabase.from("events").delete().eq("id", event.id);
    return NextResponse.json({ error: memberError.message }, { status: 500 });
  }

  // 3. Create agenda items if provided
  const agendaItems = parsed.data.agenda_items;
  if (agendaItems && agendaItems.length > 0) {
    const agendaRows = agendaItems.map((item, index) => ({
      event_id: event.id,
      date: item.date,
      title: item.title,
      description: item.description || null,
      sort_order: item.sort_order ?? index,
    }));

    const { error: agendaError } = await supabase
      .from("agenda_items")
      .insert(agendaRows);

    if (agendaError) {
      // Non-critical: event was created, agenda failed. Log but don't fail.
      console.error("Failed to create agenda items:", agendaError.message);
    }
  }

  return NextResponse.json({
    event: {
      ...event,
      member_count: 1,
    },
  });
}
