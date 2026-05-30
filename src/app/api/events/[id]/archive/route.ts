import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { getCommunityArchiveToken } from "@/lib/archive-data";
import { serverError } from "@/lib/api-error";

const archiveSettingsSchema = z.object({
  archive_visibility: z.enum(["draft", "community", "private"]),
  archive_published: z.boolean(),
});

function isValidUUID(id: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
}

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

async function getOrganizerEvent(id: string, memberId: string) {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("events")
    .select(
      "id, name, slug, organizer_id, archive_visibility, archive_published_at, archive_token"
    )
    .eq("id", id)
    .maybeSingle();

  if (error) throw error;
  if (!data) return { status: 404 as const, error: "Event nicht gefunden" };
  if (data.organizer_id !== memberId) {
    return {
      status: 403 as const,
      error: "Nur der Organisator kann Archiv-Einstellungen bearbeiten",
    };
  }
  return { event: data };
}

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

  try {
    const result = await getOrganizerEvent(id, currentMember.id);
    if (!("event" in result) || !result.event) {
      return NextResponse.json({ error: result.error }, { status: result.status });
    }
    const event = result.event;

    const communityToken = await getCommunityArchiveToken();
    return NextResponse.json({
      archive: {
        event_id: event.id,
        event_name: event.name,
        slug: event.slug,
        archive_visibility: event.archive_visibility,
        archive_published_at: event.archive_published_at,
        archive_token: event.archive_token,
        community_token: communityToken,
      },
    });
  } catch (error) {
    return serverError("events/[id]/archive:get", error);
  }
}

export async function PATCH(
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

  const body = await request.json().catch(() => null);
  const parsed = archiveSettingsSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0].message },
      { status: 400 }
    );
  }

  try {
    const result = await getOrganizerEvent(id, currentMember.id);
    if (!("event" in result) || !result.event) {
      return NextResponse.json({ error: result.error }, { status: result.status });
    }
    const event = result.event;

    const publishedAt = parsed.data.archive_published
      ? event.archive_published_at ?? new Date().toISOString()
      : null;

    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from("events")
      .update({
        archive_visibility: parsed.data.archive_visibility,
        archive_published_at:
          parsed.data.archive_visibility === "draft" ? null : publishedAt,
      })
      .eq("id", id)
      .select(
        "id, name, slug, archive_visibility, archive_published_at, archive_token"
      )
      .single();

    if (error) return serverError("events/[id]/archive:update", error);

    const communityToken = await getCommunityArchiveToken();
    return NextResponse.json({
      archive: {
        event_id: data.id,
        event_name: data.name,
        slug: data.slug,
        archive_visibility: data.archive_visibility,
        archive_published_at: data.archive_published_at,
        archive_token: data.archive_token,
        community_token: communityToken,
      },
    });
  } catch (error) {
    return serverError("events/[id]/archive:patch", error);
  }
}
