"use client";

// PROJ-34: Main slideshow workflow panel inside the report editor.
// Steps: load existing storyboard → generate (LLM) → edit → save → render
// (render auto-uploads + publishes; the parent ReportEditor switches to
// the display view with the pinned video via onSlideshowPublished).

import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { createClient } from "@supabase/supabase-js";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Sparkles, Film, Loader2, Save, AlertCircle } from "lucide-react";
import { StoryboardEditor } from "@/components/storyboard-editor";
import {
  renderSlideshow,
  type RenderProgress,
} from "@/lib/slideshow/renderer";
import { reconcileStoryboardWithItems } from "@/lib/slideshow/reconcile";
import {
  SLIDESHOW_MAX_MEDIA_ITEMS,
  stripGeneratedIntroScenes,
  type Storyboard,
  type StoryboardInputItem,
} from "@/lib/slideshow/storyboard-types";

interface MusicTrackOption {
  id: string;
  title: string;
  mood: string;
  file: string;
  bpm: number;
  duration_ms: number;
}

interface InputData {
  event: { id: string; name: string; description: string | null; cover_url: string | null };
  agenda_item: { id: string; title: string; date: string };
  report_id: string;
  existing_storyboard: Storyboard | null;
  items: StoryboardInputItem[];
}

interface Props {
  eventId: string;
  agendaItemId: string;
  hasItems: boolean;
  // Called when a fresh render + upload has just completed. ReportEditor
  // uses this to switch the page back to "display mode" with the new
  // slideshow_url pinned at the top.
  onSlideshowPublished?: (
    slideshowUrl: string,
    durationSec: number,
    posterId: string | null
  ) => void;
}

export function SlideshowGeneratorPanel({
  eventId,
  agendaItemId,
  hasItems,
  onSlideshowPublished,
}: Props) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [input, setInput] = useState<InputData | null>(null);
  const [musicTracks, setMusicTracks] = useState<MusicTrackOption[]>([]);
  const [storyboard, setStoryboard] = useState<Storyboard | null>(null);
  const [generating, setGenerating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [rendering, setRendering] = useState(false);
  const [progress, setProgress] = useState<RenderProgress | null>(null);
  const [abortCtrl, setAbortCtrl] = useState<AbortController | null>(null);

  // Local blob URL held only while rendering is in-flight so we can revoke
  // it on unmount. Once upload completes, onSlideshowPublished fires and the
  // parent unmounts this panel — the user sees the persisted video in the
  // display card instead.
  const blobUrlRef = useRef<string | null>(null);

  const format: "portrait" | "landscape" = "portrait";

  // Serialized snapshot of the last storyboard we loaded or saved. Used to
  // detect whether the user has unsaved local edits when a background refresh
  // fires — we must not clobber those edits.
  const syncedStoryboardJsonRef = useRef<string | null>(null);

  const saveStoryboard = useCallback(
    async (sb: Storyboard): Promise<boolean> => {
      try {
        const res = await fetch(
          `/api/events/${eventId}/reports/${agendaItemId}/storyboard`,
          {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ storyboard: sb }),
          }
        );
        if (res.ok) {
          syncedStoryboardJsonRef.current = JSON.stringify(sb);
          return true;
        }
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Speichern fehlgeschlagen");
      } catch (err) {
        throw err instanceof Error ? err : new Error("Speichern fehlgeschlagen");
      }
    },
    [eventId, agendaItemId]
  );

  const loadInput = useCallback(
    async (opts?: { silent?: boolean }) => {
      const silent = opts?.silent === true;
      if (!silent) setLoading(true);
      try {
        const res = await fetch(`/api/events/${eventId}/reports/${agendaItemId}/storyboard`);
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(data.error || "Storyboard konnte nicht geladen werden.");
        }
        const data = (await res.json()) as { input: InputData; music_library: MusicTrackOption[] };
        setInput(data.input);
        setMusicTracks(data.music_library);

        // Reconcile on load: the photo grid is the single source of
        // truth. Whatever's curated there must appear in the storyboard;
        // whatever's uncurated must not. Scene-delete in the editor was
        // removed (PROJ-34, 2026-04-21) exactly so this invariant holds.
        let serverSb = data.input.existing_storyboard
          ? stripGeneratedIntroScenes(data.input.existing_storyboard)
          : null;
        if (serverSb) {
          const rec = reconcileStoryboardWithItems(serverSb, data.input.items);
          if (rec.added > 0 || rec.removed > 0) {
            serverSb = rec.storyboard;
            // Fire-and-forget persist so the DB matches what we just drew.
            void saveStoryboard(serverSb).catch(() => {});
            if (!silent) {
              const parts: string[] = [];
              if (rec.added > 0)
                parts.push(`${rec.added} Foto${rec.added === 1 ? "" : "s"} hinzugefügt`);
              if (rec.removed > 0)
                parts.push(`${rec.removed} Szene${rec.removed === 1 ? "" : "n"} entfernt`);
              toast.info(`Storyboard an Auswahl angepasst: ${parts.join(", ")}`);
            }
          }
        }
        setStoryboard((prev) => {
          if (!prev) return serverSb;
          // Adopt server version only if local matches what we last synced,
          // i.e. the user has no unsaved local edits.
          const prevJson = JSON.stringify(prev);
          if (prevJson === syncedStoryboardJsonRef.current) {
            return serverSb;
          }
          return prev;
        });
        syncedStoryboardJsonRef.current = serverSb ? JSON.stringify(serverSb) : null;
        setError(null);
      } catch (err) {
        if (!silent) setError(err instanceof Error ? err.message : "Fehler");
      } finally {
        if (!silent) setLoading(false);
      }
    },
    [eventId, agendaItemId, saveStoryboard]
  );

  useEffect(() => {
    loadInput();
  }, [loadInput]);

  // Re-fetch input + storyboard when the user returns to this tab/window so
  // stale captions/storyboard state don't linger after navigating away.
  useEffect(() => {
    const maybeRefetch = () => {
      if (typeof document !== "undefined" && document.visibilityState !== "visible") return;
      if (generating || rendering) return;
      loadInput({ silent: true });
    };
    window.addEventListener("focus", maybeRefetch);
    document.addEventListener("visibilitychange", maybeRefetch);
    return () => {
      window.removeEventListener("focus", maybeRefetch);
      document.removeEventListener("visibilitychange", maybeRefetch);
    };
  }, [generating, rendering, loadInput]);

  // Cleanup any in-flight blob URL on unmount (rendering was aborted or
  // the parent switched to display mode before we revoked it).
  useEffect(() => {
    return () => {
      if (blobUrlRef.current) URL.revokeObjectURL(blobUrlRef.current);
    };
  }, []);

  const handleGenerate = useCallback(async () => {
    const mediaCount = input?.items.filter(
      (item) => item.type === "photo" || item.type === "video"
    ).length ?? 0;
    if (mediaCount > SLIDESHOW_MAX_MEDIA_ITEMS) {
      toast.error(`Maximal ${SLIDESHOW_MAX_MEDIA_ITEMS} Fotos oder Videos pro Film. Bitte reduziere die Auswahl.`);
      return;
    }
    setGenerating(true);
    try {
      const res = await fetch(
        `/api/events/${eventId}/reports/${agendaItemId}/storyboard`,
        { method: "POST" }
      );
      const data = await res.json();
      if (!res.ok) {
        const parts = [data.error || "KI-Generierung fehlgeschlagen"];
        if (Array.isArray(data.details) && data.details.length > 0) {
          parts.push(data.details.slice(0, 3).join(" · "));
        }
        const full = parts.join(" — ");
        console.error("[storyboard] POST failed", { status: res.status, data });
        throw new Error(full);
      }
      const sb = data.storyboard as Storyboard;
      setStoryboard(sb);
      syncedStoryboardJsonRef.current = JSON.stringify(sb);
      toast.success("Storyboard erstellt");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Fehler", { duration: 12000 });
    } finally {
      setGenerating(false);
    }
  }, [eventId, agendaItemId, input]);

  const handleStoryboardChange = useCallback(
    async (next: Storyboard) => {
      setStoryboard(next);
      // Debounced save would be nicer; for MVP we save on render instead.
    },
    []
  );

  const handleSave = useCallback(async () => {
    if (!storyboard) return;
    const mediaCount = input?.items.filter(
      (item) => item.type === "photo" || item.type === "video"
    ).length ?? 0;
    if (mediaCount > SLIDESHOW_MAX_MEDIA_ITEMS) {
      toast.error(`Maximal ${SLIDESHOW_MAX_MEDIA_ITEMS} Fotos oder Videos pro Film. Bitte reduziere die Auswahl.`);
      return;
    }
    setSaving(true);
    try {
      await saveStoryboard(storyboard);
      toast.success("Gespeichert");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Speichern fehlgeschlagen");
    } finally {
      setSaving(false);
    }
  }, [storyboard, saveStoryboard, input]);

  const handleRender = useCallback(async () => {
    if (!storyboard || !input) return;
    const mediaCount = input.items.filter(
      (item) => item.type === "photo" || item.type === "video"
    ).length;
    if (mediaCount > SLIDESHOW_MAX_MEDIA_ITEMS) {
      toast.error(`Maximal ${SLIDESHOW_MAX_MEDIA_ITEMS} Fotos oder Videos pro Film. Bitte reduziere die Auswahl.`);
      return;
    }
    setRendering(true);
    if (blobUrlRef.current) {
      URL.revokeObjectURL(blobUrlRef.current);
      blobUrlRef.current = null;
    }
    setProgress(null);

    // Always re-fetch the curated selection just before rendering so we
    // can't render with a stale itemMeta or a storyboard that drifted
    // from the photo grid.
    let freshInput = input;
    try {
      const res = await fetch(
        `/api/events/${eventId}/reports/${agendaItemId}/storyboard`
      );
      if (res.ok) {
        const data = (await res.json()) as {
          input: InputData;
          music_library: MusicTrackOption[];
        };
        freshInput = data.input;
        setInput(data.input);
        setMusicTracks(data.music_library);
      }
    } catch {
      /* non-fatal — fall back to cached input */
    }

    const freshMediaCount = freshInput.items.filter(
      (item) => item.type === "photo" || item.type === "video"
    ).length;
    if (freshMediaCount > SLIDESHOW_MAX_MEDIA_ITEMS) {
      toast.error(`Maximal ${SLIDESHOW_MAX_MEDIA_ITEMS} Fotos oder Videos pro Film. Bitte reduziere die Auswahl.`);
      setRendering(false);
      return;
    }

    // Reconcile storyboard against the CURRENT curated selection. This
    // is the final safety net: the photo grid is the source of truth, so
    // every marked photo must have a scene and no scene may reference an
    // unmarked photo. Reconcile also guarantees total ≤ SCENE budget.
    const reconciled = reconcileStoryboardWithItems(storyboard, freshInput.items);
    if (reconciled.added > 0 || reconciled.removed > 0) {
      const parts: string[] = [];
      if (reconciled.added > 0)
        parts.push(`${reconciled.added} Foto${reconciled.added === 1 ? "" : "s"} hinzugefügt`);
      if (reconciled.removed > 0)
        parts.push(`${reconciled.removed} Szene${reconciled.removed === 1 ? "" : "n"} entfernt`);
      toast.info(`Storyboard an Auswahl angepasst: ${parts.join(", ")}`);
    }
    const renderSb = reconciled.storyboard;

    // Hard-cap: defensively recompute total, shrink again if reconcile
    // somehow left it over. Before this guard, an over-budget storyboard
    // could sneak into the renderer and produce an 87 s video that
    // exceeded the 50 MB storage limit at upload time.
    {
      const total = renderSb.scenes.reduce((sum, s) => sum + s.duration_ms, 0);
      if (total > 72000) {
        const scale = 72000 / total;
        for (const s of renderSb.scenes) {
          s.duration_ms = Math.max(4000, Math.min(6000, Math.floor(s.duration_ms * scale)));
        }
        console.warn("[slideshow] hard-capped storyboard from", total, "to", renderSb.scenes.reduce((sum, s) => sum + s.duration_ms, 0));
      }
    }
    setStoryboard(renderSb);

    // Persist reconciled storyboard before render
    try {
      await saveStoryboard(renderSb);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Speichern fehlgeschlagen");
      setRendering(false);
      return;
    }

    const ctrl = new AbortController();
    setAbortCtrl(ctrl);

    try {
      const itemMeta = new Map<string, {
        url: string | null;
        thumbnail_url: string | null;
        type: "photo" | "video" | "text" | "audio";
        author_name: string | null;
        author_avatar_url: string | null;
        caption: string | null;
      }>();
      for (const it of freshInput.items) {
        itemMeta.set(it.content_item_id, {
          url: it.media_url,
          thumbnail_url: it.thumbnail_url,
          type: it.type,
          author_name: it.author_name,
          author_avatar_url: it.author_avatar_url,
          caption: it.caption,
        });
      }

      // Defense-in-depth: every photo/video scene in the reconciled
      // storyboard must resolve to a valid media URL. If not, abort
      // loudly so the user doesn't silently get a gradient placeholder.
      const unresolved = renderSb.scenes.filter((sc) => {
        if (sc.type !== "photo" && sc.type !== "video") return false;
        if (!sc.content_item_id) return true;
        const meta = itemMeta.get(sc.content_item_id);
        return !meta?.url && !meta?.thumbnail_url;
      });
      if (unresolved.length > 0) {
        throw new Error(
          `${unresolved.length} Foto${unresolved.length === 1 ? "" : "s"} konnte${unresolved.length === 1 ? "" : "n"} nicht zugeordnet werden — bitte Sammlung neu laden.`
        );
      }

      const result = await renderSlideshow({
        storyboard: renderSb,
        format,
        itemMeta,
        eventName: freshInput.event.name,
        eventCoverUrl: freshInput.event.cover_url,
        agendaTitle: freshInput.agenda_item.title,
        agendaDate: freshInput.agenda_item.date,
        signal: ctrl.signal,
        onProgress: setProgress,
      });

      blobUrlRef.current = URL.createObjectURL(result.blob);
      const durationSec = Math.round(result.durationMs / 1000);
      const sizeMb = (result.blob.size / 1024 / 1024).toFixed(1);

      // Auto-upload + publish: one render = one click. Each step is
      // toasted explicitly so a stuck upload/publish is visible.
      setProgress({ phase: "finalizing", current: 100, total: 100, message: "Lade hoch…" });
      toast.message(`Film gerendert (${sizeMb} MB, ${durationSec}s) — lade hoch…`);

      const supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
      );
      const path = `${eventId}/${agendaItemId}.${result.extension}`;

      let uploadResult;
      try {
        uploadResult = await supabase.storage
          .from("slideshows")
          .upload(path, result.blob, {
            contentType:
              result.blob.type ||
              (result.extension === "mp4" ? "video/mp4" : "video/webm"),
            upsert: true,
          });
      } catch (upErr) {
        console.error("[slideshow] upload threw:", upErr);
        throw new Error(
          `Upload fehlgeschlagen: ${upErr instanceof Error ? upErr.message : "unbekannter Netzwerkfehler"}`
        );
      }
      if (uploadResult.error) {
        console.error("[slideshow] upload error:", uploadResult.error);
        throw new Error(`Upload fehlgeschlagen: ${uploadResult.error.message}`);
      }

      toast.message("Upload fertig — veröffentliche…");

      const {
        data: { publicUrl },
      } = supabase.storage.from("slideshows").getPublicUrl(path);
      // Cache-buster so the video player reloads after re-render (same path).
      const cacheBustedUrl = `${publicUrl}?v=${Date.now()}`;

      let pubRes: Response;
      try {
        pubRes = await fetch(
          `/api/events/${eventId}/reports/${agendaItemId}/publish-slideshow`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              slideshow_url: cacheBustedUrl,
              duration_sec: durationSec,
            }),
          }
        );
      } catch (pubErr) {
        console.error("[slideshow] publish threw:", pubErr);
        throw new Error(
          `Veröffentlichen fehlgeschlagen: ${pubErr instanceof Error ? pubErr.message : "Netzwerkfehler"}`
        );
      }
      if (!pubRes.ok) {
        const data = await pubRes.json().catch(() => ({}));
        console.error("[slideshow] publish non-ok:", pubRes.status, data);
        throw new Error(
          `Veröffentlichen fehlgeschlagen (${pubRes.status}): ${data.error ?? "unbekannt"}`
        );
      }

      toast.success("Film fertig!");
      onSlideshowPublished?.(
        cacheBustedUrl,
        durationSec,
        renderSb.intro.content_item_id
      );
    } catch (err) {
      if (err instanceof Error && err.message === "Abgebrochen") {
        toast.message("Rendering abgebrochen");
      } else {
        const msg = err instanceof Error ? err.message : "Rendering fehlgeschlagen";
        console.error("[slideshow] handleRender failed:", err);
        toast.error(msg, { duration: 10000 });
      }
    } finally {
      setRendering(false);
      setAbortCtrl(null);
      setProgress(null);
    }
  }, [storyboard, input, format, saveStoryboard, eventId, agendaItemId, onSlideshowPublished]);

  const handleCancel = useCallback(() => {
    abortCtrl?.abort();
  }, [abortCtrl]);


  if (loading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Slideshow-Daten werden geladen…
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Alert variant="destructive">
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>{error}</AlertDescription>
      </Alert>
    );
  }

  const progressPct = progress
    ? Math.round((progress.current / Math.max(1, progress.total)) * 100)
    : 0;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Film className="h-5 w-5 text-primary" aria-hidden="true" />
          Slideshow-Film
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {!hasItems && (
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              Keine Beiträge im Bericht — kuratiere zuerst Inhalte oben.
            </AlertDescription>
          </Alert>
        )}

        {(input?.items.filter((item) => item.type === "photo" || item.type === "video").length ?? 0) >
          SLIDESHOW_MAX_MEDIA_ITEMS && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              Maximal {SLIDESHOW_MAX_MEDIA_ITEMS} Fotos oder Videos pro Film. Bitte reduziere die Auswahl.
            </AlertDescription>
          </Alert>
        )}

        {hasItems && !storyboard && (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              KI plant aus maximal 12 kuratierten Fotos oder Videos einen Film mit
              editierbarer Start- und Schlussseite.
            </p>
            <Button onClick={handleGenerate} disabled={generating} className="w-full">
              {generating ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  KI plant deinen Film…
                </>
              ) : (
                <>
                  <Sparkles className="mr-2 h-4 w-4" />
                  Film planen (KI)
                </>
              )}
            </Button>
          </div>
        )}

        {storyboard && !rendering && (
          <>
            <StoryboardEditor
              storyboard={storyboard}
              musicTracks={musicTracks}
              onChange={handleStoryboardChange}
              sceneThumbnails={
                input
                  ? new Map(
                      input.items.map((it) => [
                        it.content_item_id,
                        { thumbnail_url: it.thumbnail_url, media_url: it.media_url, type: it.type },
                      ])
                    )
                  : undefined
              }
              eventCoverUrl={input?.event.cover_url}
            />
            <div className="flex flex-wrap gap-2">
              <Button
                onClick={handleSave}
                variant="outline"
                disabled={saving}
                size="sm"
              >
                {saving ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Speichere…
                  </>
                ) : (
                  <>
                    <Save className="mr-2 h-4 w-4" />
                    Speichern
                  </>
                )}
              </Button>
              <Button onClick={handleRender} className="flex-1">
                <Film className="mr-2 h-4 w-4" />
                Film rendern
              </Button>
            </div>
          </>
        )}

        {rendering && (
          <div className="space-y-3">
            <div className="text-sm font-medium">{progress?.message ?? "Starte…"}</div>
            <Progress value={progressPct} />
            <Button onClick={handleCancel} variant="outline" size="sm" className="w-full">
              Abbrechen
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
