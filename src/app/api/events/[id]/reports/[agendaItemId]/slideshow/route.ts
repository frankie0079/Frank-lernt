// PROJ-34 (2026-04-21): "Löschen" — hard reset the curation + slideshow state
// for a day. Clears slideshow_url/published_at/duration, clears the storyboard,
// deletes all report_items, and removes the rendered video from storage.
//
// Used by the "Löschen" button next to a rendered slideshow in the curation
// view. After success, reopening the section starts from an empty selection.

import { NextResponse, type NextRequest } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { isRateLimited, getRateLimitIp } from "@/lib/rate-limit";
import { serverError } from "@/lib/api-error";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const isValidUUID = (id: string) => UUID.test(id);

function mapRpcError(code: string | undefined) {
  switch (code) {
    case "unauthorized":
      return { status: 401, error: "Nicht angemeldet" };
    case "forbidden":
      return { status: 403, error: "Kein Zugriff" };
    case "not_found":
      return { status: 404, error: "Bericht nicht gefunden" };
    default:
      return { status: 400, error: "Fehler" };
  }
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

  const supabase = getSupabaseAdmin();

  // Clear DB state via RPC (auth enforced inside). The RPC returns the
  // report row AFTER the reset, so slideshow_url is already null — we need
  // to remove both possible file extensions from storage ourselves.
  const { data, error } = await supabase.rpc("delete_slideshow_and_reset", {
    p_token: token,
    p_agenda_item_id: agendaItemId,
  });
  if (error) return serverError("slideshow:delete", error);

  const result = data as { ok: boolean; error?: string };
  if (!result?.ok) {
    const m = mapRpcError(result?.error);
    return NextResponse.json({ error: m.error }, { status: m.status });
  }

  // Best-effort storage cleanup. We don't fail the request if this errors —
  // the DB state is the source of truth and has already been reset.
  try {
    await supabase.storage
      .from("slideshows")
      .remove([`${id}/${agendaItemId}.mp4`, `${id}/${agendaItemId}.webm`]);
  } catch {
    /* non-fatal */
  }

  return NextResponse.json({ ok: true });
}
