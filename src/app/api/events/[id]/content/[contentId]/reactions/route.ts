import { createClient } from "@supabase/supabase-js";
import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { isRateLimited, getRateLimitIp } from "@/lib/rate-limit";
import { serverError } from "@/lib/api-error";

const REACTION_EMOJIS = ["❤️", "🔥", "😂", "👏", "😮"] as const;

const reactionSchema = z.object({
  emoji: z.enum(REACTION_EMOJIS),
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
    case "invalid_emoji":
      return NextResponse.json({ error: "Ungueltiges Emoji" }, { status: 400 });
    default:
      return NextResponse.json({ error: "Fehler" }, { status: 500 });
  }
}

// POST /api/events/[id]/content/[contentId]/reactions
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; contentId: string }> }
) {
  const { id, contentId } = await params;

  if (!isValidUUID(id) || !isValidUUID(contentId)) {
    return NextResponse.json({ error: "Ungueltiges ID-Format" }, { status: 400 });
  }

  const ip = getRateLimitIp(request);
  if (isRateLimited(ip)) {
    return NextResponse.json(
      { error: "Zu viele Anfragen. Bitte warte kurz." },
      { status: 429 }
    );
  }

  const token = memberToken(request);
  if (!token) {
    return NextResponse.json({ error: "Nicht angemeldet" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  if (!body) {
    return NextResponse.json({ error: "Ungueltige Anfrage" }, { status: 400 });
  }

  const parsed = reactionSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Ungueltiges Emoji" }, { status: 400 });
  }

  const supabase = createSupabase();
  const { data, error } = await supabase.rpc("create_reaction", {
    p_token: token,
    p_content_item_id: contentId,
    p_emoji: parsed.data.emoji,
  });

  if (error) {
    return serverError("reactions:create_rpc", error);
  }

  const result = data as { ok: boolean; error?: string };
  if (!result?.ok) {
    return rpcErrorResponse(result?.error || "unknown");
  }

  return NextResponse.json({ success: true });
}

// DELETE /api/events/[id]/content/[contentId]/reactions?emoji=❤️
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; contentId: string }> }
) {
  const { id, contentId } = await params;

  if (!isValidUUID(id) || !isValidUUID(contentId)) {
    return NextResponse.json({ error: "Ungueltiges ID-Format" }, { status: 400 });
  }

  const ip = getRateLimitIp(request);
  if (isRateLimited(ip)) {
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
  const emojiParam = url.searchParams.get("emoji");
  const parsed = reactionSchema.safeParse({ emoji: emojiParam });
  if (!parsed.success) {
    return NextResponse.json({ error: "Ungueltiges Emoji" }, { status: 400 });
  }

  const supabase = createSupabase();
  const { data, error } = await supabase.rpc("delete_reaction", {
    p_token: token,
    p_content_item_id: contentId,
    p_emoji: parsed.data.emoji,
  });

  if (error) {
    return serverError("reactions:delete_rpc", error);
  }

  const result = data as { ok: boolean; error?: string };
  if (!result?.ok) {
    return rpcErrorResponse(result?.error || "unknown");
  }

  return NextResponse.json({ success: true });
}
