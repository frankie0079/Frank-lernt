// PROJ-34: List published slideshows for an event (visible to all members).

import { NextResponse, type NextRequest } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { isRateLimited, getRateLimitIp } from "@/lib/rate-limit";
import { serverError } from "@/lib/api-error";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const isValidUUID = (id: string) => UUID.test(id);

function createSupabase() {
  return getSupabaseAdmin();
}

function mapRpcError(code: string | undefined) {
  switch (code) {
    case "unauthorized":
      return { status: 401, error: "Nicht angemeldet" };
    case "forbidden":
      return { status: 403, error: "Kein Zugriff" };
    case "not_found":
      return { status: 404, error: "Event nicht gefunden" };
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
  const { data, error } = await supabase.rpc("list_event_slideshows", {
    p_token: token,
    p_event_id: id,
  });
  if (error) return serverError("slideshows:get", error);
  const result = data as { ok: boolean; error?: string; slideshows?: unknown };
  if (!result?.ok) {
    const m = mapRpcError(result?.error);
    return NextResponse.json({ error: m.error }, { status: m.status });
  }

  return NextResponse.json({ slideshows: result.slideshows ?? [] });
}
