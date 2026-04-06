import { createClient } from "@supabase/supabase-js";
import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { isRateLimited, getRateLimitIp } from "@/lib/rate-limit";
import { serverError } from "@/lib/api-error";

const REACTION_EMOJIS = ["❤️", "🔥", "😂", "👏", "😮"] as const;

const reactionSchema = z.object({
  emoji: z.enum(REACTION_EMOJIS),
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

// Verify the content item exists, belongs to the given event, and the
// requesting member is part of that event. Returns null on success or a
// NextResponse to short-circuit on failure.
async function assertMembershipAndContent(
  supabase: ReturnType<typeof createSupabase>,
  eventId: string,
  contentId: string,
  memberId: string
): Promise<NextResponse | null> {
  const { data: item } = await supabase
    .from("content_items")
    .select("id, event_id")
    .eq("id", contentId)
    .single();

  if (!item || item.event_id !== eventId) {
    return NextResponse.json({ error: "Beitrag nicht gefunden" }, { status: 404 });
  }

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

  const currentMember = await getCurrentMember(request);
  if (!currentMember) {
    return NextResponse.json({ error: "Nicht angemeldet" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  if (!body) {
    return NextResponse.json({ error: "Ungueltige Anfrage" }, { status: 400 });
  }

  const parsed = reactionSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Ungueltiges Emoji" },
      { status: 400 }
    );
  }

  const supabase = createSupabase();

  const guard = await assertMembershipAndContent(
    supabase,
    id,
    contentId,
    currentMember.id
  );
  if (guard) return guard;

  // Upsert: idempotent — if the user already has this reaction, no error.
  const { error: insertError } = await supabase
    .from("reactions")
    .upsert(
      {
        content_item_id: contentId,
        member_id: currentMember.id,
        emoji: parsed.data.emoji,
      },
      { onConflict: "content_item_id,member_id,emoji", ignoreDuplicates: true }
    );

  if (insertError) {
    return serverError("reactions:create", insertError);
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

  const currentMember = await getCurrentMember(request);
  if (!currentMember) {
    return NextResponse.json({ error: "Nicht angemeldet" }, { status: 401 });
  }

  const url = new URL(request.url);
  const emojiParam = url.searchParams.get("emoji");
  const parsed = reactionSchema.safeParse({ emoji: emojiParam });
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Ungueltiges Emoji" },
      { status: 400 }
    );
  }

  const supabase = createSupabase();

  const guard = await assertMembershipAndContent(
    supabase,
    id,
    contentId,
    currentMember.id
  );
  if (guard) return guard;

  const { error: deleteError } = await supabase
    .from("reactions")
    .delete()
    .eq("content_item_id", contentId)
    .eq("member_id", currentMember.id)
    .eq("emoji", parsed.data.emoji);

  if (deleteError) {
    return serverError("reactions:delete", deleteError);
  }

  return NextResponse.json({ success: true });
}
