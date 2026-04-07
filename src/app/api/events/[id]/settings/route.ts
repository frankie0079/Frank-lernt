// PROJ-34: Event slideshow settings — GET (members) + PUT (organizer only).

import { createClient } from "@supabase/supabase-js";
import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { isRateLimited, getRateLimitIp } from "@/lib/rate-limit";
import { serverError } from "@/lib/api-error";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const isValidUUID = (id: string) => UUID.test(id);

function createSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}

function mapRpcError(code: string | undefined) {
  switch (code) {
    case "unauthorized":
      return { status: 401, error: "Nicht angemeldet" };
    case "forbidden":
      return { status: 403, error: "Nur Organisator" };
    case "not_found":
      return { status: 404, error: "Event nicht gefunden" };
    case "invalid_payload":
      return { status: 400, error: "Ungültige Daten" };
    default:
      return { status: 400, error: "Fehler" };
  }
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
  const token = request.cookies.get("member_token")?.value;
  if (!token) {
    return NextResponse.json({ error: "Nicht angemeldet" }, { status: 401 });
  }

  const supabase = createSupabase();
  const { data, error } = await supabase.rpc("get_event_settings", {
    p_token: token,
    p_event_id: id,
  });
  if (error) return serverError("event-settings:get", error);
  const result = data as { ok: boolean; error?: string; settings?: unknown };
  if (!result?.ok) {
    const m = mapRpcError(result?.error);
    return NextResponse.json({ error: m.error }, { status: m.status });
  }

  return NextResponse.json({ settings: result.settings });
}

const putSchema = z.object({
  slideshow_format: z.enum(["portrait", "landscape"]),
  slideshow_music_mood: z.enum(["auto", "epic", "chill", "joyful", "reflective"]),
  slideshow_photo_duration_sec: z.number().int().min(1).max(8),
});

export async function PUT(
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
  const token = request.cookies.get("member_token")?.value;
  if (!token) {
    return NextResponse.json({ error: "Nicht angemeldet" }, { status: 401 });
  }
  const body = await request.json().catch(() => null);
  const parsed = putSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Ungültige Daten" },
      { status: 400 }
    );
  }

  const supabase = createSupabase();
  const { data, error } = await supabase.rpc("set_event_settings", {
    p_token: token,
    p_event_id: id,
    p_format: parsed.data.slideshow_format,
    p_music_mood: parsed.data.slideshow_music_mood,
    p_photo_duration_sec: parsed.data.slideshow_photo_duration_sec,
  });
  if (error) return serverError("event-settings:put", error);
  const result = data as { ok: boolean; error?: string; settings?: unknown };
  if (!result?.ok) {
    const m = mapRpcError(result?.error);
    return NextResponse.json({ error: m.error }, { status: m.status });
  }

  return NextResponse.json({ settings: result.settings });
}
