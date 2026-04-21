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
  SLIDESHOW_MIN_SCENE_MS,
  SLIDESHOW_MAX_SCENE_MS,
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

  const requiredIds = new Set(
    input.items
      .filter((it) => (it.type === "photo" || it.type === "video") && it.content_item_id)
      .map((it) => it.content_item_id)
  );

  type Attempt = {
    ok: true;
    storyboard: z.infer<typeof storyboardSchema>;
  } | {
    ok: false;
    stage: "llm" | "json" | "zod" | "duration" | "missing";
    message: string;
    details?: string[];
    rawText?: string;
  };

  const callLlm = async (extraUser: string | null): Promise<Attempt> => {
    let llmText: string;
    try {
      const response = await client.messages.create({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 4096,
        system,
        messages: [
          { role: "user", content: extraUser ? `${user}\n\n${extraUser}` : user },
        ],
      });
      const block = response.content.find((b) => b.type === "text");
      if (!block || block.type !== "text") {
        return { ok: false, stage: "llm", message: "LLM gab keinen Text zurück" };
      }
      llmText = block.text.trim();
    } catch (err) {
      return {
        ok: false,
        stage: "llm",
        message: err instanceof Error ? err.message : "LLM-Fehler",
      };
    }

    // Strip code fences / prose around the JSON.
    llmText = llmText.replace(/^```[a-zA-Z]*\s*/m, "").replace(/\s*```\s*$/m, "").trim();
    let parsed: unknown;
    try {
      parsed = JSON.parse(llmText);
    } catch {
      const first = llmText.indexOf("{");
      const last = llmText.lastIndexOf("}");
      if (first !== -1 && last > first) {
        try {
          parsed = JSON.parse(llmText.slice(first, last + 1));
        } catch {
          return {
            ok: false,
            stage: "json",
            message: "KI hat ungültiges JSON zurückgegeben",
            rawText: llmText.slice(0, 200),
          };
        }
      } else {
        return {
          ok: false,
          stage: "json",
          message: "KI-Antwort ist kein JSON",
          rawText: llmText.slice(0, 200),
        };
      }
    }

    // Sanitize LLM output: clamp numeric + string fields into the Zod
    // bounds before validation so small LLM schludrichkeiten
    // (duration_ms = 1200, title = 200 chars) don't fail the whole
    // call. We still reject structural / semantic problems below.
    if (parsed && typeof parsed === "object") {
      const p = parsed as Record<string, unknown>;
      if (typeof p.title === "string") {
        p.title = (p.title as string).slice(0, 120);
      }
      if (Array.isArray(p.scenes)) {
        for (const scRaw of p.scenes as unknown[]) {
          if (!scRaw || typeof scRaw !== "object") continue;
          const sc = scRaw as Record<string, unknown>;
          if (typeof sc.duration_ms === "number") {
            sc.duration_ms = Math.max(
              SLIDESHOW_MIN_SCENE_MS,
              Math.min(SLIDESHOW_MAX_SCENE_MS, Math.round(sc.duration_ms))
            );
          }
          if (typeof sc.overlay_text === "string") {
            sc.overlay_text = (sc.overlay_text as string).slice(0, 280);
          }
        }
        // After clamping per-scene, if total still exceeds budget, shrink
        // all scenes proportionally. Floor-clamp to MIN so Zod passes.
        const total = (p.scenes as Record<string, unknown>[]).reduce(
          (sum, sc) =>
            sum + (typeof sc.duration_ms === "number" ? (sc.duration_ms as number) : 0),
          0
        );
        if (total > SLIDESHOW_MAX_DURATION_MS) {
          const scale = SLIDESHOW_MAX_DURATION_MS / total;
          for (const scRaw of p.scenes as unknown[]) {
            const sc = scRaw as Record<string, unknown>;
            if (typeof sc.duration_ms === "number") {
              sc.duration_ms = Math.max(
                SLIDESHOW_MIN_SCENE_MS,
                Math.min(
                  SLIDESHOW_MAX_SCENE_MS,
                  Math.floor((sc.duration_ms as number) * scale)
                )
              );
            }
          }
        }
      }
      if (Array.isArray(p.chapters)) {
        for (const chRaw of p.chapters as unknown[]) {
          if (!chRaw || typeof chRaw !== "object") continue;
          const ch = chRaw as Record<string, unknown>;
          if (typeof ch.title === "string") {
            ch.title = (ch.title as string).slice(0, 80);
          }
        }
      }
    }

    const validation = storyboardSchema.safeParse(parsed);
    if (!validation.success) {
      return {
        ok: false,
        stage: "zod",
        message: "KI-Storyboard verletzt Zod-Constraints",
        details: validation.error.issues.slice(0, 5).map((i) => `${i.path.join(".")}: ${i.message}`),
      };
    }
    const sb = validation.data;

    const total = sb.scenes.reduce((s, sc) => s + sc.duration_ms, 0);
    if (total > SLIDESHOW_MAX_DURATION_MS) {
      return {
        ok: false,
        stage: "duration",
        message: `Gesamtdauer ${total} ms > Budget ${SLIDESHOW_MAX_DURATION_MS} ms`,
      };
    }

    const usedIds = new Set(
      sb.scenes.filter((s) => s.content_item_id != null).map((s) => s.content_item_id as string)
    );
    const missingIds = [...requiredIds].filter((id) => !usedIds.has(id));
    if (missingIds.length > 0) {
      return {
        ok: false,
        stage: "missing",
        message: `${missingIds.length} kuratiertes Foto/Video ausgelassen`,
        details: missingIds.slice(0, 5),
      };
    }

    return { ok: true, storyboard: sb };
  };

  // Attempt 1. If it fails on zod/duration/missing, append an explicit repair
  // instruction and try once more — this keeps a single user click from
  // costing two daily tries while giving the model a second shot.
  let attempt = await callLlm(null);
  if (!attempt.ok && (attempt.stage === "zod" || attempt.stage === "duration" || attempt.stage === "missing")) {
    const repair = [
      "Dein vorheriger Versuch wurde abgewiesen, Grund:",
      `- stage: ${attempt.stage}`,
      `- message: ${attempt.message}`,
      attempt.details && attempt.details.length > 0
        ? `- details: ${attempt.details.join(" | ")}`
        : null,
      "",
      "Bitte erstelle das Storyboard erneut und behebe den Fehler — halte dich streng an die harten Regeln oben.",
    ].filter(Boolean).join("\n");
    console.warn("[storyboard] attempt 1 failed, retrying with repair:", attempt);
    attempt = await callLlm(repair);
  }

  if (!attempt.ok) {
    console.error("[storyboard] both attempts failed:", attempt);
    const msgMap: Record<string, string> = {
      llm: "KI nicht erreichbar",
      json: "KI hat kein gültiges JSON zurückgegeben",
      zod: "KI-Storyboard verletzt Schema-Constraints",
      duration: "KI-Storyboard überschreitet das Dauer-Budget",
      missing: "KI hat kuratierte Fotos ausgelassen",
    };
    return NextResponse.json(
      {
        error: msgMap[attempt.stage] ?? "KI-Generierung fehlgeschlagen",
        details: attempt.details,
        stage: attempt.stage,
      },
      { status: 502 }
    );
  }

  const storyboard = attempt.storyboard;

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
