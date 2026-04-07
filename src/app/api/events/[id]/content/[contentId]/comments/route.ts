import { createClient } from "@supabase/supabase-js";
import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import {
  isRateLimited,
  isKeyRateLimited,
  getRateLimitIp,
} from "@/lib/rate-limit";
import { serverError } from "@/lib/api-error";

const PAGE_SIZE_DEFAULT = 20;
const PAGE_SIZE_MAX = 100;
const TEXT_MAX = 500;
const PER_USER_COMMENTS_PER_MIN = 5;

const commentCreateSchema = z.object({
  text: z
    .string()
    .min(1, "Kommentar darf nicht leer sein")
    .max(TEXT_MAX, `Maximal ${TEXT_MAX} Zeichen`),
});

function createSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}

function isValidUUID(id: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
}

function memberToken(request: NextRequest): string | null {
  return request.cookies.get("member_token")?.value ?? null;
}

// Map RPC error codes to HTTP responses
function rpcErrorResponse(code: string): NextResponse {
  switch (code) {
    case "unauthorized":
      return NextResponse.json({ error: "Nicht angemeldet" }, { status: 401 });
    case "forbidden":
      return NextResponse.json(
        { error: "Kein Zugriff auf dieses Event" },
        { status: 403 }
      );
    case "not_found":
      return NextResponse.json(
        { error: "Beitrag nicht gefunden" },
        { status: 404 }
      );
    case "empty":
      return NextResponse.json(
        { error: "Kommentar darf nicht leer sein" },
        { status: 400 }
      );
    case "too_long":
      return NextResponse.json(
        { error: `Maximal ${TEXT_MAX} Zeichen` },
        { status: 400 }
      );
    default:
      return NextResponse.json({ error: "Fehler" }, { status: 500 });
  }
}

// GET /api/events/[id]/content/[contentId]/comments
//   ?cursor=<iso>&limit=20  → page (older than cursor)
//   ?id=<commentId>         → single comment (Realtime enrichment)
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

  const token = memberToken(request);
  if (!token) {
    return NextResponse.json({ error: "Nicht angemeldet" }, { status: 401 });
  }

  const url = new URL(request.url);
  const singleId = url.searchParams.get("id");
  const cursor = url.searchParams.get("cursor");
  const limitParam = url.searchParams.get("limit");
  const limit = Math.min(
    Math.max(parseInt(limitParam || String(PAGE_SIZE_DEFAULT), 10) || PAGE_SIZE_DEFAULT, 1),
    PAGE_SIZE_MAX
  );

  if (singleId && !isValidUUID(singleId)) {
    return NextResponse.json(
      { error: "Ungueltiges Comment-ID-Format" },
      { status: 400 }
    );
  }
  if (cursor && isNaN(Date.parse(cursor))) {
    return NextResponse.json({ error: "Ungueltiges Cursor-Format" }, { status: 400 });
  }

  const supabase = createSupabase();
  const { data, error } = await supabase.rpc("read_comments", {
    p_token: token,
    p_content_item_id: contentId,
    p_cursor: cursor || null,
    p_limit: limit,
    p_single_id: singleId || null,
  });

  if (error) {
    return serverError("comments:read_rpc", error);
  }

  const result = data as { ok: boolean; error?: string; comments?: unknown[] };
  if (!result?.ok) {
    return rpcErrorResponse(result?.error || "unknown");
  }

  return NextResponse.json({ comments: result.comments ?? [] });
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

  // First-line IP-based defense
  const ip = getRateLimitIp(request);
  if (isRateLimited(ip, "write")) {
    return NextResponse.json(
      { error: "Zu viele Anfragen. Bitte warte kurz." },
      { status: 429 }
    );
  }

  const token = memberToken(request);
  if (!token) {
    return NextResponse.json({ error: "Nicht angemeldet" }, { status: 401 });
  }

  // Spec-mandated per-user limit: 5 comments / minute / member token
  if (isKeyRateLimited(`comments:${token}`, PER_USER_COMMENTS_PER_MIN)) {
    return NextResponse.json(
      { error: "Zu viele Kommentare. Bitte warte einen Moment." },
      { status: 429 }
    );
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

  const supabase = createSupabase();
  const { data, error } = await supabase.rpc("create_comment", {
    p_token: token,
    p_content_item_id: contentId,
    p_text: parsed.data.text,
  });

  if (error) {
    return serverError("comments:create_rpc", error);
  }

  const result = data as {
    ok: boolean;
    error?: string;
    comment?: {
      id: string;
      content_item_id: string;
      author_id: string;
      text: string;
      created_at: string;
    };
  };

  if (!result?.ok) {
    return rpcErrorResponse(result?.error || "unknown");
  }

  // Enrich with author info for the response
  const inserted = result.comment!;
  const { data: author } = await supabase.rpc("read_comments", {
    p_token: token,
    p_content_item_id: contentId,
    p_single_id: inserted.id,
  });
  const authorComments = (author as { comments?: Array<{ id: string; author_name: string | null; author_avatar_url: string | null }> })?.comments;
  const enriched = authorComments?.[0];

  return NextResponse.json({
    comment: enriched ?? {
      ...inserted,
      author_name: null,
      author_avatar_url: null,
    },
  });
}
