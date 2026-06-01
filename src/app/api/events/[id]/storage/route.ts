import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { serverError } from "@/lib/api-error";
import {
  buildEventStorageReport,
  cleanupEventStorage,
  deleteEventSlideshows,
  deleteEventVideosNotInBook,
} from "@/lib/storage-report";
import { isRateLimited, getRateLimitIp } from "@/lib/rate-limit";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const isValidUUID = (id: string) => UUID.test(id);

async function getCurrentMember(request: NextRequest) {
  const token = request.cookies.get("member_token")?.value;
  if (!token) return null;

  const supabase = getSupabaseAdmin();
  const { data } = await supabase
    .from("members")
    .select("id, name, role")
    .eq("token", token)
    .single();

  return data;
}

async function assertOrganizer(eventId: string, memberId: string) {
  const supabase = getSupabaseAdmin();
  const { data: event } = await supabase
    .from("events")
    .select("id, organizer_id")
    .eq("id", eventId)
    .single();

  if (!event) return { ok: false as const, status: 404, error: "Event nicht gefunden" };
  if (event.organizer_id !== memberId) {
    return { ok: false as const, status: 403, error: "Nur der Organisator kann den Speicher verwalten" };
  }
  return { ok: true as const };
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  if (!isValidUUID(id)) {
    return NextResponse.json({ error: "Ungültiges ID-Format" }, { status: 400 });
  }

  const ip = getRateLimitIp(request);
  if (isRateLimited(ip, "read")) {
    return NextResponse.json({ error: "Zu viele Anfragen." }, { status: 429 });
  }

  const currentMember = await getCurrentMember(request);
  if (!currentMember) {
    return NextResponse.json({ error: "Nicht angemeldet" }, { status: 401 });
  }

  const access = await assertOrganizer(id, currentMember.id);
  if (!access.ok) {
    return NextResponse.json({ error: access.error }, { status: access.status });
  }

  try {
    const report = await buildEventStorageReport(id);
    if (!report) {
      return NextResponse.json({ error: "Event nicht gefunden" }, { status: 404 });
    }
    return NextResponse.json({ report });
  } catch (error) {
    return serverError("events/[id]/storage:get", error);
  }
}

const postSchema = z.object({
  action: z.enum(["cleanup", "delete_slideshows", "delete_videos"]),
  execute: z.boolean().default(true),
});

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  if (!isValidUUID(id)) {
    return NextResponse.json({ error: "Ungültiges ID-Format" }, { status: 400 });
  }

  const ip = getRateLimitIp(request);
  if (isRateLimited(ip)) {
    return NextResponse.json({ error: "Zu viele Anfragen." }, { status: 429 });
  }

  const currentMember = await getCurrentMember(request);
  if (!currentMember) {
    return NextResponse.json({ error: "Nicht angemeldet" }, { status: 401 });
  }

  const access = await assertOrganizer(id, currentMember.id);
  if (!access.ok) {
    return NextResponse.json({ error: access.error }, { status: access.status });
  }

  const body = await request.json().catch(() => null);
  const parsed = postSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Ungültige Daten" }, { status: 400 });
  }

  try {
    if (parsed.data.action === "delete_slideshows") {
      const result = await deleteEventSlideshows(id);
      if (!result) {
        return NextResponse.json({ error: "Event nicht gefunden" }, { status: 404 });
      }
      return NextResponse.json({ result });
    }

    if (parsed.data.action === "delete_videos") {
      const result = await deleteEventVideosNotInBook(id);
      if (!result) {
        return NextResponse.json({ error: "Event nicht gefunden" }, { status: 404 });
      }
      return NextResponse.json({ result });
    }

    const result = await cleanupEventStorage(id, parsed.data.execute);
    if (!result) {
      return NextResponse.json({ error: "Event nicht gefunden" }, { status: 404 });
    }
    return NextResponse.json({ result });
  } catch (error) {
    return serverError("events/[id]/storage:cleanup", error);
  }
}
