import { NextResponse, type NextRequest } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { isRateLimited, getRateLimitIp } from "@/lib/rate-limit";
import { contentCreateSchema } from "@/lib/validations/content";
import { serverError } from "@/lib/api-error";

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
    return NextResponse.json({ error: "Ungültiges Event-Format" }, { status: 400 });
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
    return NextResponse.json({ error: "Ungültiges ID-Format" }, { status: 400 });
  }
  if (agendaId && !isValidUUID(agendaId)) {
    return NextResponse.json({ error: "Ungültiges Agenda-ID-Format" }, { status: 400 });
  }
  // Validate cursor is a plausible ISO timestamp
  if (cursor && isNaN(Date.parse(cursor))) {
    return NextResponse.json({ error: "Ungültiges Cursor-Format" }, { status: 400 });
  }

  let query = supabase
    .from("content_items")
    .select("id, event_id, agenda_item_id, author_id, type, media_url, thumbnail_url, caption, latitude, longitude, exif_date, created_at", { count: "exact" })
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

  // Type filter ("notes" = text + audio combined)
  if (filterType && !singleId) {
    if (filterType === "notes") {
      query = query.in("type", ["text", "audio"]);
    } else if (["photo", "video", "text", "audio"].includes(filterType)) {
      query = query.eq("type", filterType);
    }
  }

  // Agenda filter
  if (agendaId && !singleId) {
    query = query.eq("agenda_item_id", agendaId);
  }

  const { data: items, error, count: totalCount } = await query;

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

  // Comment counts per item — direct table read is gone; use the secure RPC
  // helper. Aggregation is still single-pass: we count comments via a single
  // SELECT through the service-role-bypassing RLS on comments. Since the
  // comments table has RLS revoked from anon, we use the RPC.
  // Simplest: use a single SELECT with a specifically-granted view-like RPC.
  // For now, we re-grant SELECT-via-RPC by counting through a tiny helper.
  const commentCountByItem = new Map<string, number>();
  for (const itemId of itemIds) commentCountByItem.set(itemId, 0);
  if (itemIds.length > 0) {
    const { data: countRows } = await supabase.rpc("count_comments_by_items", {
      p_item_ids: itemIds,
    });
    for (const row of (countRows as Array<{ content_item_id: string; cnt: number }> | null) || []) {
      commentCountByItem.set(row.content_item_id, Number(row.cnt) || 0);
    }
  }

  // Daily-admin lookup: who is admin of which agenda item in this event?
  const { data: agendaRows } = await supabase
    .from("agenda_items")
    .select("id, admin_member_id")
    .eq("event_id", id);
  const agendaAdminMap = new Map<string, string | null>();
  for (const row of agendaRows || []) {
    agendaAdminMap.set(row.id, row.admin_member_id);
  }

  // Is the requesting user the event organizer?
  const { data: eventRow } = await supabase
    .from("events")
    .select("organizer_id")
    .eq("id", id)
    .single();
  const isEventOrganizer = eventRow?.organizer_id === currentMember.id;

  const enrichedItems = (items || []).map((item) => {
    const dailyAdminMatch =
      item.agenda_item_id != null &&
      agendaAdminMap.get(item.agenda_item_id) === currentMember.id;
    return {
      ...item,
      author_name: authorMap[item.author_id]?.name || null,
      author_avatar_url: authorMap[item.author_id]?.avatar_url || null,
      reactions: reactionsByItem.get(item.id) ?? {
        counts: emptyCounts(),
        userReactions: [],
      },
      comment_count: commentCountByItem.get(item.id) ?? 0,
      viewer_can_moderate_comments: isEventOrganizer || dailyAdminMatch,
    };
  });

  return NextResponse.json({ content_items: enrichedItems, total_count: totalCount ?? enrichedItems.length });
}

// POST /api/events/[id]/content — Create content item
export async function POST(
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
    return NextResponse.json({ error: "Ungültige Anfrage" }, { status: 400 });
  }

  const parsed = contentCreateSchema.safeParse(body);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    const field = issue.path.length > 0 ? issue.path.join(".") : "body";
    return NextResponse.json(
      { error: `${field}: ${issue.message}` },
      { status: 400 }
    );
  }

  const { type, agenda_item_id, media_url, thumbnail_url, caption, latitude, longitude, exif_date } = parsed.data;

  // Photo/video/audio require media_url
  if (type !== "text" && !media_url) {
    return NextResponse.json(
      { error: "Medien-URL ist erforderlich für diesen Beitragstyp" },
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
        { error: "Medien-URL ist ungültig" },
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
      { error: "Text-Beitrag benötigt einen Kommentar" },
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
        { error: "Agenda-Punkt gehört nicht zu diesem Event" },
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
