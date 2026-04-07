import { createClient } from "@supabase/supabase-js";
import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { isRateLimited, getRateLimitIp } from "@/lib/rate-limit";
import { serverError } from "@/lib/api-error";

function isValidUUID(id: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
}

function createSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}

const patchBodySchema = z.object({
  publish: z.boolean(),
});

// PATCH /api/events/[id]/reports/[agendaItemId]/publish — Toggle status
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; agendaItemId: string }> }
) {
  const { id, agendaItemId } = await params;

  if (!isValidUUID(id) || !isValidUUID(agendaItemId)) {
    return NextResponse.json({ error: "Ungueltiges ID-Format" }, { status: 400 });
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
  const parsed = patchBodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0].message },
      { status: 400 }
    );
  }

  const supabase = createSupabase();
  const { data, error } = await supabase.rpc("toggle_report_publish", {
    p_token: token,
    p_agenda_item_id: agendaItemId,
    p_publish: parsed.data.publish,
  });

  if (error) {
    return serverError("events/[id]/reports/[agendaItemId]/publish:patch", error);
  }

  const result = data as { ok: boolean; error?: string; report?: unknown };
  if (!result?.ok) {
    const code = result?.error;
    if (code === "unauthorized")
      return NextResponse.json({ error: "Nicht angemeldet" }, { status: 401 });
    if (code === "forbidden")
      return NextResponse.json({ error: "Kein Zugriff" }, { status: 403 });
    if (code === "not_found")
      return NextResponse.json({ error: "Bericht nicht gefunden" }, { status: 404 });
    if (code === "no_items")
      return NextResponse.json(
        { error: "Mindestens 1 Beitrag auswaehlen, um zu veroeffentlichen" },
        { status: 400 }
      );
    return NextResponse.json({ error: "Fehler beim Aktualisieren" }, { status: 400 });
  }

  return NextResponse.json({ report: result.report });
}
