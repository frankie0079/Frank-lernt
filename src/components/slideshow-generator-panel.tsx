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
import type { Storyboard, StoryboardInputItem } from "@/lib/slideshow/storyboard-types";

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
  onSlideshowPublished?: (slideshowUrl: string, durationSec: number) => void;
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

        const serverSb = data.input.existing_storyboard;
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
    [eventId, agendaItemId]
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
    setGenerating(true);
    try {
      const res = await fetch(
        `/api/events/${eventId}/reports/${agendaItemId}/storyboard`,
        { method: "POST" }
      );
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "KI-Generierung fehlgeschlagen");
      }
      const sb = data.storyboard as Storyboard;
      setStoryboard(sb);
      syncedStoryboardJsonRef.current = JSON.stringify(sb);
      toast.success("Storyboard erstellt");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Fehler");
    } finally {
      setGenerating(false);
    }
  }, [eventId, agendaItemId]);

  const handleStoryboardChange = useCallback(
    async (next: Storyboard) => {
      setStoryboard(next);
      // Debounced save would be nicer; for MVP we save on render instead.
    },
    []
  );

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

  const handleSave = useCallback(async () => {
    if (!storyboard) return;
    setSaving(true);
    try {
      await saveStoryboard(storyboard);
      toast.success("Gespeichert");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Speichern fehlgeschlagen");
    } finally {
      setSaving(false);
    }
  }, [storyboard, saveStoryboard]);

  const handleRender = useCallback(async () => {
    if (!storyboard || !input) return;
    setRendering(true);
    if (blobUrlRef.current) {
      URL.revokeObjectURL(blobUrlRef.current);
      blobUrlRef.current = null;
    }
    setProgress(null);

    // Persist current storyboard before render
    try {
      await saveStoryboard(storyboard);
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
      for (const it of input.items) {
        itemMeta.set(it.content_item_id, {
          url: it.media_url,
          thumbnail_url: it.thumbnail_url,
          type: it.type,
          author_name: it.author_name,
          author_avatar_url: it.author_avatar_url,
          caption: it.caption,
        });
      }

      const result = await renderSlideshow({
        storyboard,
        format,
        itemMeta,
        eventName: input.event.name,
        eventCoverUrl: input.event.cover_url,
        agendaTitle: input.agenda_item.title,
        agendaDate: input.agenda_item.date,
        signal: ctrl.signal,
        onProgress: setProgress,
      });

      blobUrlRef.current = URL.createObjectURL(result.blob);
      const durationSec = Math.round(result.durationMs / 1000);

      // Auto-upload + publish: the user just wants to see the film pinned
      // at the top of the curation page. We merge the old "Publish"
      // step into Render so there's no second click.
      setProgress({ phase: "finalizing", current: 100, total: 100, message: "Lade hoch…" });
      const supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
      );
      const path = `${eventId}/${agendaItemId}.${result.extension}`;
      const { error: uploadErr } = await supabase.storage
        .from("slideshows")
        .upload(path, result.blob, {
          contentType:
            result.blob.type ||
            (result.extension === "mp4" ? "video/mp4" : "video/webm"),
          upsert: true,
        });
      if (uploadErr) throw uploadErr;
      const {
        data: { publicUrl },
      } = supabase.storage.from("slideshows").getPublicUrl(path);

      // Cache-buster: the storage URL is stable across re-renders since we
      // upsert the same path. Append a timestamp so the browser + the
      // SlideshowDisplayCard load the fresh video.
      const cacheBustedUrl = `${publicUrl}?v=${Date.now()}`;

      const pubRes = await fetch(
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
      if (!pubRes.ok) {
        const data = await pubRes.json().catch(() => ({}));
        throw new Error(data.error || "Veröffentlichen fehlgeschlagen");
      }
      toast.success("Film fertig!");
      onSlideshowPublished?.(cacheBustedUrl, durationSec);
    } catch (err) {
      if (err instanceof Error && err.message === "Abgebrochen") {
        toast.message("Rendering abgebrochen");
      } else {
        toast.error(err instanceof Error ? err.message : "Rendering fehlgeschlagen");
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

        {hasItems && !storyboard && (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              KI plant aus deinen kuratierten Beiträgen einen 60-Sekunden-Film mit
              Kapiteln, Übergängen und Musik.
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
                        { thumbnail_url: it.thumbnail_url, media_url: it.media_url },
                      ])
                    )
                  : undefined
              }
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
