import { createClient } from "@supabase/supabase-js";
import { NextResponse, type NextRequest } from "next/server";
import { isRateLimited, getRateLimitIp } from "@/lib/rate-limit";
import { contentCreateSchema } from "@/lib/validations/content";

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

function createSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}

function isValidUUID(id: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
}

// GET /api/events/[id]/content — List content items for event
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

  // Check membership
  const { data: membership } = await supabase
    .from("event_members")
    .select("role")
    .eq("event_id", id)
    .eq("member_id", currentMember.id)
    .single();

  if (!membership) {
    return NextResponse.json({ error: "Kein Zugriff auf dieses Event" }, { status: 403 });
  }

  const { data: items, error } = await supabase
    .from("content_items")
    .select("id, event_id, agenda_item_id, author_id, type, media_url, thumbnail_url, caption, latitude, longitude, exif_date, created_at")
    .eq("event_id", id)
    .order("created_at", { ascending: false })
    .limit(200);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ content_items: items || [] });
}

// POST /api/events/[id]/content — Create content item
export async function POST(
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

  // Check membership
  const { data: membership } = await supabase
    .from("event_members")
    .select("role")
    .eq("event_id", id)
    .eq("member_id", currentMember.id)
    .single();

  if (!membership) {
    return NextResponse.json({ error: "Kein Zugriff auf dieses Event" }, { status: 403 });
  }

  const body = await request.json().catch(() => null);
  if (!body) {
    return NextResponse.json({ error: "Ungueltige Anfrage" }, { status: 400 });
  }

  const parsed = contentCreateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0].message },
      { status: 400 }
    );
  }

  const { type, agenda_item_id, media_url, thumbnail_url, caption, latitude, longitude, exif_date } = parsed.data;

  // Photo/video/audio require media_url
  if (type !== "text" && !media_url) {
    return NextResponse.json(
      { error: "Medien-URL ist erforderlich fuer diesen Beitragstyp" },
      { status: 400 }
    );
  }

  // Validate media_url points to our Supabase storage (prevent stored content injection)
  const supabaseDomain = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  for (const url of [media_url, thumbnail_url]) {
    if (url && !url.startsWith(`${supabaseDomain}/storage/`)) {
      return NextResponse.json(
        { error: "Medien-URL muss auf den eigenen Storage verweisen" },
        { status: 400 }
      );
    }
  }

  // Text requires caption
  if (type === "text" && (!caption || caption.trim().length === 0)) {
    return NextResponse.json(
      { error: "Text-Beitrag benoetigt einen Kommentar" },
      { status: 400 }
    );
  }

  // Validate agenda_item belongs to this event (if provided)
  if (agenda_item_id) {
    const { data: agendaItem } = await supabase
      .from("agenda_items")
      .select("id")
      .eq("id", agenda_item_id)
      .eq("event_id", id)
      .single();

    if (!agendaItem) {
      return NextResponse.json(
        { error: "Agenda-Punkt gehoert nicht zu diesem Event" },
        { status: 400 }
      );
    }
  }

  const { data: item, error: insertError } = await supabase
    .from("content_items")
    .insert({
      event_id: id,
      agenda_item_id: agenda_item_id || null,
      author_id: currentMember.id,
      type,
      media_url: media_url || null,
      thumbnail_url: thumbnail_url || null,
      caption: caption?.trim() || null,
      latitude: latitude ?? null,
      longitude: longitude ?? null,
      exif_date: exif_date || null,
    })
    .select("id, event_id, agenda_item_id, author_id, type, media_url, thumbnail_url, caption, latitude, longitude, exif_date, created_at")
    .single();

  if (insertError) {
    return NextResponse.json({ error: insertError.message }, { status: 500 });
  }

  return NextResponse.json({ content_item: item }, { status: 201 });
}
