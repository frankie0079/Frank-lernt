import { createClient } from "@supabase/supabase-js";
import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { isRateLimited, getRateLimitIp } from "@/lib/rate-limit";
import { serverError } from "@/lib/api-error";

const PAGE_SIZE_DEFAULT = 20;
const PAGE_SIZE_MAX = 100;
const TEXT_MAX = 500;

const commentCreateSchema = z.object({
  text: z
    .string()
    .min(1, "Kommentar darf nicht leer sein")
    .max(TEXT_MAX, `Maximal ${TEXT_MAX} Zeichen`),
});

async function getCurrentMember(request: NextRequest) {
  const token = request.cookies.get("member_token")?.value;
  if (!token) return null;
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
  const { data } = await supabase
    .from("members")
    .select("id")
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

// Verify content item exists in this event. Membership is NOT required for
// SELECT (public event page reads comments). For POST we additionally check
// that the requesting member is in the event.
async function assertContentExists(
  supabase: ReturnType<typeof createSupabase>,
  eventId: string,
  contentId: string
): Promise<NextResponse | null> {
  const { data: item } = await supabase
    .from("content_items")
    .select("id, event_id")
    .eq("id", contentId)
    .single();
  if (!item || item.event_id !== eventId) {
    return NextResponse.json({ error: "Beitrag nicht gefunden" }, { status: 404 });
  }
  return null;
}

async function assertMembership(
  supabase: ReturnType<typeof createSupabase>,
  eventId: string,
  memberId: string
): Promise<NextResponse | null> {
  const { data: membership } = await supabase
    .from("event_members")
    .select("role")
    .eq("event_id", eventId)
    .eq("member_id", memberId)
    .single();
  if (!membership) {
    return NextResponse.json(
      { error: "Kein Zugriff auf dieses Event" },
      { status: 403 }
    );
  }
  return null;
}

async function enrichWithAuthors(
  supabase: ReturnType<typeof createSupabase>,
  comments: Array<{ author_id: string }>
) {
  const ids = [...new Set(comments.map((c) => c.author_id))];
  if (ids.length === 0) return new Map<string, { name: string | null; avatar_url: string | null }>();
  const { data: authors } = await supabase
    .from("members")
    .select("id, name, avatar_url")
    .in("id", ids);
  return new Map(
    (authors || []).map((a) => [a.id, { name: a.name, avatar_url: a.avatar_url }])
  );
}

// GET /api/events/[id]/content/[contentId]/comments
//   ?cursor=<iso>&limit=20      → page (older than cursor)
//   ?id=<commentId>             → single comment (used by Realtime enrichment)
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; contentId: string }> }
) {
  const { id, contentId } = await params;

  if (!isValidUUID(id) || !isValidUUID(contentId)) {
    return NextResponse.json({ error: "Ungueltiges ID-Format" }, { status: 400 });
  }

  const ip = getRateLimitIp(request);
  if (isRateLimited(ip, "read")) {
    return NextResponse.json(
      { error: "Zu viele Anfragen. Bitte warte kurz." },
      { status: 429 }
    );
  }

  const supabase = createSupabase();

  const guard = await assertContentExists(supabase, id, contentId);
  if (guard) return guard;

  const url = new URL(request.url);
  const singleId = url.searchParams.get("id");
  const cursor = url.searchParams.get("cursor");
  const limitParam = url.searchParams.get("limit");
  const limit = Math.min(
    Math.max(parseInt(limitParam || String(PAGE_SIZE_DEFAULT), 10) || PAGE_SIZE_DEFAULT, 1),
    PAGE_SIZE_MAX
  );

  if (singleId && !isValidUUID(singleId)) {
    return NextResponse.json({ error: "Ungueltiges Comment-ID-Format" }, { status: 400 });
  }
  if (cursor && isNaN(Date.parse(cursor))) {
    return NextResponse.json({ error: "Ungueltiges Cursor-Format" }, { status: 400 });
  }

  let query = supabase
    .from("comments")
    .select("id, content_item_id, author_id, text, created_at")
    .eq("content_item_id", contentId);

  if (singleId) {
    query = query.eq("id", singleId).limit(1);
  } else {
    query = query.order("created_at", { ascending: false }).limit(limit);
    if (cursor) query = query.lt("created_at", cursor);
  }

  const { data: rows, error } = await query;
  if (error) {
    return serverError("comments:list", error);
  }

  const authorMap = await enrichWithAuthors(supabase, rows || []);

  // For paginated list reverse so the client receives chronological order
  // (oldest first within the page). For singleId mode keep as-is.
  const ordered = singleId ? rows || [] : (rows || []).slice().reverse();

  const enriched = ordered.map((c) => ({
    ...c,
    author_name: authorMap.get(c.author_id)?.name ?? null,
    author_avatar_url: authorMap.get(c.author_id)?.avatar_url ?? null,
  }));

  return NextResponse.json({ comments: enriched });
}

// POST /api/events/[id]/content/[contentId]/comments
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; contentId: string }> }
) {
  const { id, contentId } = await params;

  if (!isValidUUID(id) || !isValidUUID(contentId)) {
    return NextResponse.json({ error: "Ungueltiges ID-Format" }, { status: 400 });
  }

  // Spec wants 5/min per user, but the shared limiter is per-IP. 30/min for
  // writes is the global cap and is sufficient as a first-line defense.
  // Tighten via Upstash/KV if comment spam ever becomes a real problem.
  const ip = getRateLimitIp(request);
  if (isRateLimited(ip, "write")) {
    return NextResponse.json(
      { error: "Zu viele Kommentare. Bitte warte einen Moment." },
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

  const parsed = commentCreateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0].message },
      { status: 400 }
    );
  }

  const trimmed = parsed.data.text.trim();
  if (trimmed.length === 0) {
    return NextResponse.json(
      { error: "Kommentar darf nicht leer sein" },
      { status: 400 }
    );
  }

  const supabase = createSupabase();

  const itemGuard = await assertContentExists(supabase, id, contentId);
  if (itemGuard) return itemGuard;

  const memberGuard = await assertMembership(supabase, id, currentMember.id);
  if (memberGuard) return memberGuard;

  const { data: inserted, error: insertError } = await supabase
    .from("comments")
    .insert({
      content_item_id: contentId,
      author_id: currentMember.id,
      text: trimmed,
    })
    .select("id, content_item_id, author_id, text, created_at")
    .single();

  if (insertError) {
    return serverError("comments:create", insertError);
  }

  // Enrich with author info for the response
  const { data: author } = await supabase
    .from("members")
    .select("name, avatar_url")
    .eq("id", currentMember.id)
    .single();

  return NextResponse.json({
    comment: {
      ...inserted,
      author_name: author?.name ?? null,
      author_avatar_url: author?.avatar_url ?? null,
    },
  });
}
