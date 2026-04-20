// PROJ-34: Storyboard API — calls Claude Haiku 4.5 to plan a slideshow
//   GET  loads existing storyboard + LLM input
//   POST generates a fresh storyboard (rate-limited, max 5/day per agenda item)
//   PUT  saves a manually edited storyboard

import Anthropic from "@anthropic-ai/sdk";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { isKeyRateLimited, isRateLimited, getRateLimitIp } from "@/lib/rate-limit";
import { serverError } from "@/lib/api-error";
import {
  storyboardSchema,
  type StoryboardInput,
  SLIDESHOW_MAX_DURATION_MS,
} from "@/lib/slideshow/storyboard-types";
import {
  buildStoryboardSystemPrompt,
  buildStoryboardUserPrompt,
} from "@/lib/slideshow/storyboard-prompt";
import { MUSIC_LIBRARY, pickDefaultTrack } from "@/lib/slideshow/music-library";

// Claude Haiku calls can take 10-30s with large prompts; Vercel Hobby
// default is 10s which causes Anthropic SDK to throw "Connection error".
export const maxDuration = 60;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
function isValidUUID(id: string) {
  return UUID.test(id);
}

function createSupabase() {
  return getSupabaseAdmin();
}

function mapRpcError(code: string | undefined): { status: number; error: string } {
  switch (code) {
    case "unauthorized":
      return { status: 401, error: "Nicht angemeldet" };
    case "forbidden":
      return { status: 403, error: "Kein Zugriff auf diesen Bericht" };
    case "not_found":
    case "no_report":
      return { status: 404, error: "Bericht nicht gefunden" };
    case "invalid_payload":
      return { status: 400, error: "Ungültige Daten" };
    default:
      return { status: 400, error: "Fehler beim Speichern" };
  }
}

// ----------------------------------------------------------------------------
// GET — load existing storyboard + LLM input data (for editor + initial state)
// ----------------------------------------------------------------------------
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; agendaItemId: string }> }
) {
  const { id, agendaItemId } = await params;
  if (!isValidUUID(id) || !isValidUUID(agendaItemId)) {
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
  const { data, error } = await supabase.rpc("get_report_storyboard_input", {
    p_token: token,
    p_agenda_item_id: agendaItemId,
  });
  if (error) return serverError("storyboard:get", error);

  const result = data as { ok: boolean; error?: string } & Partial<StoryboardInput>;
  if (!result?.ok) {
    const m = mapRpcError(result?.error);
    return NextResponse.json({ error: m.error }, { status: m.status });
  }

  return NextResponse.json({
    input: {
      event: result.event,
      agenda_item: result.agenda_item,
      report_id: result.report_id,
      existing_storyboard: result.existing_storyboard ?? null,
      items: result.items ?? [],
    },
    music_library: MUSIC_LIBRARY.map((t) => ({
      id: t.id,
      title: t.title,
      mood: t.mood,
      bpm: t.bpm,
      file: t.file,
      duration_ms: t.duration_ms,
    })),
  });
}

// ----------------------------------------------------------------------------
// POST — generate storyboard via Claude Haiku
// ----------------------------------------------------------------------------
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

  // Per-agenda-item daily cap (5 LLM calls per 24h to control cost)
  if (
    isKeyRateLimited(`storyboard:${agendaItemId}`, 5, 24 * 60 * 60 * 1000)
  ) {
    return NextResponse.json(
      { error: "Tageslimit für KI-Generierung erreicht (max. 5 pro Tag). Bestehendes Storyboard bearbeiten." },
      { status: 429 }
    );
  }

  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json(
      { error: "ANTHROPIC_API_KEY ist nicht konfiguriert." },
      { status: 500 }
    );
  }

  const supabase = createSupabase();

  // 1. Pull input via RPC (also enforces auth)
  const { data: inputData, error: inputErr } = await supabase.rpc(
    "get_report_storyboard_input",
    { p_token: token, p_agenda_item_id: agendaItemId }
  );
  if (inputErr) return serverError("storyboard:input", inputErr);
  const inputResult = inputData as { ok: boolean; error?: string } & Partial<StoryboardInput>;
  if (!inputResult?.ok) {
    const m = mapRpcError(inputResult?.error);
    return NextResponse.json({ error: m.error }, { status: m.status });
  }
  // Defense in depth: ensure the URL's event_id matches the agenda item's
  // owning event. The RPC already enforces membership via agenda_item_id,
  // but inconsistent URLs should not silently succeed.
  if (inputResult.event?.id !== id) {
    return NextResponse.json({ error: "Bericht nicht gefunden" }, { status: 404 });
  }

  const input: StoryboardInput = {
    event: inputResult.event!,
    agenda_item: inputResult.agenda_item!,
    report_id: inputResult.report_id!,
    existing_storyboard: inputResult.existing_storyboard ?? null,
    items: inputResult.items ?? [],
  };

  if (input.items.length === 0) {
    return NextResponse.json(
      { error: "Keine Beiträge im Bericht — kuratiere zuerst." },
      { status: 400 }
    );
  }

  // 2. Build prompts and call Claude Haiku 4.5
  const system = buildStoryboardSystemPrompt();
  const user = buildStoryboardUserPrompt(
    input,
    MUSIC_LIBRARY.map((t) => t.id)
  );

  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY!.trim() });
  let llmText: string;
  try {
    const response = await client.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 4096,
      system,
      messages: [{ role: "user", content: user }],
    });
    const block = response.content.find((b) => b.type === "text");
    if (!block || block.type !== "text") {
      throw new Error("LLM gab keinen Text zurück");
    }
    llmText = block.text.trim();
  } catch (err) {
    return serverError("storyboard:llm", err);
  }

  // 3. Parse + validate via Zod
  // Strip accidental code fences
  if (llmText.startsWith("```")) {
    llmText = llmText.replace(/^```[a-z]*\n?/, "").replace(/\n?```$/, "");
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(llmText);
  } catch {
    return NextResponse.json(
      { error: "KI hat ungültiges JSON zurückgegeben — bitte erneut versuchen." },
      { status: 502 }
    );
  }

  const validation = storyboardSchema.safeParse(parsed);
  if (!validation.success) {
    return NextResponse.json(
      {
        error: "KI-Storyboard erfüllt nicht die Constraints (Dauer/Schema). Bitte erneut versuchen.",
        details: validation.error.issues.slice(0, 3).map((i) => i.message),
      },
      { status: 502 }
    );
  }
  const storyboard = validation.data;

  // Defensive: enforce hard duration cap server-side as last line of defense
  const totalMs = storyboard.scenes.reduce((s, sc) => s + sc.duration_ms, 0);
  if (totalMs > SLIDESHOW_MAX_DURATION_MS) {
    return NextResponse.json(
      { error: "KI-Storyboard zu lang." },
      { status: 502 }
    );
  }

  // Enforce: every curated photo/video must appear as its own scene.
  // Text/audio items are allowed to be quoted in overlay_text of other scenes.
  const requiredIds = new Set(
    input.items
      .filter((it) => (it.type === "photo" || it.type === "video") && it.content_item_id)
      .map((it) => it.content_item_id)
  );
  const usedIds = new Set(
    storyboard.scenes
      .filter((s) => s.content_item_id != null)
      .map((s) => s.content_item_id as string)
  );
  const missing = [...requiredIds].filter((id) => !usedIds.has(id));
  if (missing.length > 0) {
    return NextResponse.json(
      {
        error: `KI hat ${missing.length} kuratiertes Foto/Video ausgelassen — bitte erneut generieren.`,
      },
      { status: 502 }
    );
  }

  // Default music_track_id if LLM left it null
  if (!storyboard.music_track_id) {
    storyboard.music_track_id = pickDefaultTrack(storyboard.mood).id;
  }

  // 4. Persist
  const { data: saveData, error: saveErr } = await supabase.rpc(
    "save_report_storyboard",
    { p_token: token, p_agenda_item_id: agendaItemId, p_storyboard: storyboard }
  );
  if (saveErr) return serverError("storyboard:save", saveErr);
  const saveResult = saveData as { ok: boolean; error?: string };
  if (!saveResult?.ok) {
    const m = mapRpcError(saveResult?.error);
    return NextResponse.json({ error: m.error }, { status: m.status });
  }

  return NextResponse.json({ storyboard });
}

// ----------------------------------------------------------------------------
// PUT — save user-edited storyboard
// ----------------------------------------------------------------------------
const putBodySchema = z.object({ storyboard: storyboardSchema });

export async function PUT(
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
  const parsed = putBodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Ungültige Daten" },
      { status: 400 }
    );
  }

  const supabase = createSupabase();
  const { data, error } = await supabase.rpc("save_report_storyboard", {
    p_token: token,
    p_agenda_item_id: agendaItemId,
    p_storyboard: parsed.data.storyboard,
  });
  if (error) return serverError("storyboard:put", error);
  const result = data as { ok: boolean; error?: string };
  if (!result?.ok) {
    const m = mapRpcError(result?.error);
    return NextResponse.json({ error: m.error }, { status: m.status });
  }

  return NextResponse.json({ storyboard: parsed.data.storyboard });
}
