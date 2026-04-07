// PROJ-34: Publish/unpublish slideshow URL after rendering.

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
      return { status: 403, error: "Kein Zugriff" };
    case "not_found":
      return { status: 404, error: "Bericht nicht gefunden" };
    case "invalid_payload":
      return { status: 400, error: "Ungültige Daten" };
    default:
      return { status: 400, error: "Fehler" };
  }
}

const postBodySchema = z.object({
  slideshow_url: z.string().min(1).max(500),
  duration_sec: z.number().int().min(1).max(60),
});

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; agendaItemId: string }> }
) {
  const { id, agendaItemId } = await params;
  if (!isValidUUID(id) || !isValidUUID(agendaItemId)) {
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
  const parsed = postBodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Ungültige Daten" },
      { status: 400 }
    );
  }

  const supabase = createSupabase();
  const { data, error } = await supabase.rpc("publish_slideshow", {
    p_token: token,
    p_agenda_item_id: agendaItemId,
    p_slideshow_url: parsed.data.slideshow_url,
    p_duration_sec: parsed.data.duration_sec,
  });
  if (error) return serverError("publish-slideshow:post", error);
  const result = data as { ok: boolean; error?: string; report?: unknown };
  if (!result?.ok) {
    const m = mapRpcError(result?.error);
    return NextResponse.json({ error: m.error }, { status: m.status });
  }

  return NextResponse.json({ report: result.report });
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; agendaItemId: string }> }
) {
  const { id, agendaItemId } = await params;
  if (!isValidUUID(id) || !isValidUUID(agendaItemId)) {
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

  const supabase = createSupabase();
  const { data, error } = await supabase.rpc("unpublish_slideshow", {
    p_token: token,
    p_agenda_item_id: agendaItemId,
  });
  if (error) return serverError("publish-slideshow:delete", error);
  const result = data as { ok: boolean; error?: string };
  if (!result?.ok) {
    const m = mapRpcError(result?.error);
    return NextResponse.json({ error: m.error }, { status: m.status });
  }

  return NextResponse.json({ ok: true });
}
