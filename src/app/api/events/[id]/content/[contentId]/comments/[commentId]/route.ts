import { createClient } from "@supabase/supabase-js";
import { NextResponse, type NextRequest } from "next/server";
import { isRateLimited, getRateLimitIp } from "@/lib/rate-limit";
import { serverError } from "@/lib/api-error";

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

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; contentId: string; commentId: string }> }
) {
  const { id, contentId, commentId } = await params;

  if (!isValidUUID(id) || !isValidUUID(contentId) || !isValidUUID(commentId)) {
    return NextResponse.json({ error: "Ungueltiges ID-Format" }, { status: 400 });
  }

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

  const supabase = createSupabase();
  const { data, error } = await supabase.rpc("delete_comment", {
    p_token: token,
    p_comment_id: commentId,
  });

  if (error) {
    return serverError("comments:delete_rpc", error);
  }

  const result = data as { ok: boolean; error?: string };
  if (!result?.ok) {
    switch (result?.error) {
      case "unauthorized":
        return NextResponse.json({ error: "Nicht angemeldet" }, { status: 401 });
      case "forbidden":
        return NextResponse.json(
          { error: "Du darfst diesen Kommentar nicht loeschen" },
          { status: 403 }
        );
      case "not_found":
        return NextResponse.json(
          { error: "Kommentar nicht gefunden" },
          { status: 404 }
        );
      default:
        return NextResponse.json({ error: "Fehler" }, { status: 500 });
    }
  }

  return NextResponse.json({ success: true });
}
