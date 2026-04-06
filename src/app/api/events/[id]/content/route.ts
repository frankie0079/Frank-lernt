import { createClient } from "@supabase/supabase-js";
import { NextResponse, type NextRequest } from "next/server";
import { isRateLimited, getRateLimitIp } from "@/lib/rate-limit";
import { contentCreateSchema } from "@/lib/validations/content";
import { serverError } from "@/lib/api-error";

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

  const ip = getRateLimitIp(request);
  if (isRateLimited(ip, "read")) {
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

  // Parse and validate query params
  const url = new URL(request.url);
  const cursor = url.searchParams.get("cursor");
  const filterType = url.searchParams.get("filter");
  const agendaId = url.searchParams.get("agenda");
  const singleId = url.searchParams.get("id");
  const limitParam = url.searchParams.get("limit");
  const limit = Math.min(Math.max(parseInt(limitParam || "20", 10) || 20, 1), 200);

  // Validate UUID params
  if (singleId && !isValidUUID(singleId)) {
    return NextResponse.json({ error: "Ungueltiges ID-Format" }, { status: 400 });
  }
  if (agendaId && !isValidUUID(agendaId)) {
    return NextResponse.json({ error: "Ungueltiges Agenda-ID-Format" }, { status: 400 });
  }
  // Validate cursor is a plausible ISO timestamp
  if (cursor && isNaN(Date.parse(cursor))) {
    return NextResponse.json({ error: "Ungueltiges Cursor-Format" }, { status: 400 });
  }

  let query = supabase
    .from("content_items")
    .select("id, event_id, agenda_item_id, author_id, type, media_url, thumbnail_url, caption, latitude, longitude, exif_date, created_at")
    .eq("event_id", id)
    .order("created_at", { ascending: false })
    .limit(limit);

  // Single item fetch (for Realtime enrichment)
  if (singleId) {
    query = supabase
      .from("content_items")
      .select("id, event_id, agenda_item_id, author_id, type, media_url, thumbnail_url, caption, latitude, longitude, exif_date, created_at")
      .eq("event_id", id)
      .eq("id", singleId)
      .limit(1);
  }

  // Cursor pagination
  if (cursor && !singleId) {
    query = query.lt("created_at", cursor);
  }

  // Type filter
  if (filterType && ["photo", "video", "text", "audio"].includes(filterType) && !singleId) {
    query = query.eq("type", filterType);
  }

  // Agenda filter
  if (agendaId && !singleId) {
    query = query.eq("agenda_item_id", agendaId);
  }

  const { data: items, error } = await query;

  if (error) {
    return serverError("events/[id]/content:list", error);
  }

  // Enrich with author data
  const authorIds = [...new Set((items || []).map((i) => i.author_id))];
  let authorMap: Record<string, { name: string | null; avatar_url: string | null }> = {};

  if (authorIds.length > 0) {
    const { data: authors } = await supabase
      .from("members")
      .select("id, name, avatar_url")
      .in("id", authorIds);

    if (authors) {
      authorMap = Object.fromEntries(
        authors.map((a) => [a.id, { name: a.name, avatar_url: a.avatar_url }])
      );
    }
  }

  // Reactions aggregate per item: counts by emoji + which emojis the
  // current user has reacted with. Single query, no N+1.
  const itemIds = (items || []).map((i) => i.id);
  const REACTION_EMOJIS = ["❤️", "🔥", "😂", "👏", "😮"] as const;
  type ReactionEmoji = (typeof REACTION_EMOJIS)[number];
  const emptyCounts = (): Record<ReactionEmoji, number> => ({
    "❤️": 0, "🔥": 0, "😂": 0, "👏": 0, "😮": 0,
  });

  const reactionsByItem = new Map<
    string,
    { counts: Record<ReactionEmoji, number>; userReactions: ReactionEmoji[] }
  >();
  for (const itemId of itemIds) {
    reactionsByItem.set(itemId, { counts: emptyCounts(), userReactions: [] });
  }

  if (itemIds.length > 0) {
    const { data: reactions } = await supabase
      .from("reactions")
      .select("content_item_id, emoji, member_id")
      .in("content_item_id", itemIds);

    for (const r of reactions || []) {
      const bucket = reactionsByItem.get(r.content_item_id);
      if (!bucket) continue;
      const emoji = r.emoji as ReactionEmoji;
      if (!REACTION_EMOJIS.includes(emoji)) continue;
      bucket.counts[emoji] += 1;
      if (r.member_id === currentMember.id) {
        bucket.userReactions.push(emoji);
      }
    }
  }

  const enrichedItems = (items || []).map((item) => ({
    ...item,
    author_name: authorMap[item.author_id]?.name || null,
    author_avatar_url: authorMap[item.author_id]?.avatar_url || null,
    reactions: reactionsByItem.get(item.id) ?? {
      counts: emptyCounts(),
      userReactions: [],
    },
  }));

  return NextResponse.json({ content_items: enrichedItems });
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

  // Validate media_url points to our Supabase storage (prevent stored content
  // injection). Robust check via URL parsing — string prefix matching is
  // fragile against trailing slashes / IPv6 / encoding differences.
  let supabaseHost: string;
  try {
    supabaseHost = new URL(process.env.NEXT_PUBLIC_SUPABASE_URL!).host;
  } catch {
    return serverError("events/[id]/content:create_env", new Error("invalid SUPABASE_URL"));
  }
  for (const url of [media_url, thumbnail_url]) {
    if (!url) continue;
    let parsed: URL;
    try {
      parsed = new URL(url);
    } catch {
      return NextResponse.json(
        { error: "Medien-URL ist ungueltig" },
        { status: 400 }
      );
    }
    if (parsed.host !== supabaseHost || !parsed.pathname.startsWith("/storage/")) {
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
    return serverError("events/[id]/content:create", insertError);
  }

  return NextResponse.json({ content_item: item }, { status: 201 });
}
