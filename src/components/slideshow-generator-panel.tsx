"use client";

// PROJ-34: Main slideshow workflow panel inside the report editor.
// Steps: load existing storyboard → generate (LLM) → edit → render → preview
//        → upload to storage → publish for all members.

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { createClient } from "@supabase/supabase-js";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Sparkles, Film, Loader2, Download, Share2, Eye, Send, AlertCircle } from "lucide-react";
import { StoryboardEditor } from "@/components/storyboard-editor";
import { SlideshowPreviewPlayer } from "@/components/slideshow-preview-player";
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
  event: { id: string; name: string; description: string | null };
  agenda_item: { id: string; title: string; date: string };
  report_id: string;
  existing_storyboard: Storyboard | null;
  items: StoryboardInputItem[];
}

interface Props {
  eventId: string;
  agendaItemId: string;
  hasItems: boolean;
}

export function SlideshowGeneratorPanel({ eventId, agendaItemId, hasItems }: Props) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [input, setInput] = useState<InputData | null>(null);
  const [musicTracks, setMusicTracks] = useState<MusicTrackOption[]>([]);
  const [storyboard, setStoryboard] = useState<Storyboard | null>(null);
  const [generating, setGenerating] = useState(false);
  const [rendering, setRendering] = useState(false);
  const [progress, setProgress] = useState<RenderProgress | null>(null);
  const [blobUrl, setBlobUrl] = useState<string | null>(null);
  const [blob, setBlob] = useState<Blob | null>(null);
  const [renderedDurationSec, setRenderedDurationSec] = useState<number>(0);
  const [publishedUrl, setPublishedUrl] = useState<string | null>(null);
  const [publishing, setPublishing] = useState(false);
  const [abortCtrl, setAbortCtrl] = useState<AbortController | null>(null);

  const format: "portrait" | "landscape" = "portrait";

  const loadInput = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/events/${eventId}/reports/${agendaItemId}/storyboard`);
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Storyboard konnte nicht geladen werden.");
      }
      const data = (await res.json()) as { input: InputData; music_library: MusicTrackOption[] };
      setInput(data.input);
      setMusicTracks(data.music_library);
      if (data.input.existing_storyboard) {
        setStoryboard(data.input.existing_storyboard);
      }
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Fehler");
    } finally {
      setLoading(false);
    }
  }, [eventId, agendaItemId]);

  useEffect(() => {
    loadInput();
  }, [loadInput]);

  // Cleanup blob URL on unmount or new render
  useEffect(() => {
    return () => {
      if (blobUrl) URL.revokeObjectURL(blobUrl);
    };
  }, [blobUrl]);

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
      setStoryboard(data.storyboard as Storyboard);
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
    async (sb: Storyboard) => {
      try {
        await fetch(
          `/api/events/${eventId}/reports/${agendaItemId}/storyboard`,
          {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ storyboard: sb }),
          }
        );
      } catch {
        /* non-fatal */
      }
    },
    [eventId, agendaItemId]
  );

  const handleRender = useCallback(async () => {
    if (!storyboard || !input) return;
    setRendering(true);
    setBlob(null);
    if (blobUrl) {
      URL.revokeObjectURL(blobUrl);
      setBlobUrl(null);
    }
    setProgress(null);

    // Persist current storyboard before render
    await saveStoryboard(storyboard);

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
        agendaTitle: input.agenda_item.title,
        agendaDate: input.agenda_item.date,
        signal: ctrl.signal,
        onProgress: setProgress,
      });

      const url = URL.createObjectURL(result.blob);
      setBlob(result.blob);
      setBlobUrl(url);
      setRenderedDurationSec(Math.round(result.durationMs / 1000));
      toast.success("Film fertig!");
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
  }, [storyboard, input, format, blobUrl, saveStoryboard]);

  const handleCancel = useCallback(() => {
    abortCtrl?.abort();
  }, [abortCtrl]);

  const handleDownload = useCallback(() => {
    if (!blob) return;
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `film-${input?.agenda_item.title ?? "tag"}.webm`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(a.href);
  }, [blob, input]);

  const handleShare = useCallback(async () => {
    if (!blob) return;
    const file = new File([blob], `film-${input?.agenda_item.title ?? "tag"}.webm`, {
      type: blob.type,
    });
    if (typeof navigator !== "undefined" && navigator.canShare?.({ files: [file] })) {
      try {
        await navigator.share({
          files: [file],
          title: storyboard?.title ?? "Film",
          text: input?.event.name,
        });
      } catch {
        /* user cancelled */
      }
    } else {
      toast.error("Teilen wird vom Browser nicht unterstützt — bitte herunterladen.");
    }
  }, [blob, input, storyboard]);

  const handlePublish = useCallback(async () => {
    if (!blob || !input) return;
    setPublishing(true);
    try {
      // 1. Upload to Supabase Storage (slideshows bucket)
      const supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
      );
      const path = `${eventId}/${agendaItemId}.webm`;
      const { error: uploadErr } = await supabase.storage
        .from("slideshows")
        .upload(path, blob, {
          contentType: "video/webm",
          upsert: true,
        });
      if (uploadErr) throw uploadErr;
      const {
        data: { publicUrl },
      } = supabase.storage.from("slideshows").getPublicUrl(path);

      // 2. Mark as published
      const res = await fetch(
        `/api/events/${eventId}/reports/${agendaItemId}/publish-slideshow`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            slideshow_url: publicUrl,
            duration_sec: renderedDurationSec,
          }),
        }
      );
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Veröffentlichen fehlgeschlagen");
      }
      setPublishedUrl(publicUrl);
      toast.success("Für alle Teilnehmer veröffentlicht");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Upload fehlgeschlagen");
    } finally {
      setPublishing(false);
    }
  }, [blob, eventId, agendaItemId, input, renderedDurationSec]);

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
              KI plant aus deinen kuratierten Beiträgen einen 45-Sekunden-Film mit
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

        {storyboard && !rendering && !blobUrl && (
          <>
            <StoryboardEditor
              storyboard={storyboard}
              musicTracks={musicTracks}
              onChange={handleStoryboardChange}
            />
            <div className="flex flex-wrap gap-2">
              <Button
                onClick={handleGenerate}
                variant="outline"
                disabled={generating}
                size="sm"
              >
                {generating ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Neu planen…
                  </>
                ) : (
                  <>
                    <Sparkles className="mr-2 h-4 w-4" />
                    Neu planen
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

        {blobUrl && !rendering && (
          <div className="space-y-3">
            <SlideshowPreviewPlayer src={blobUrl} format={format} />
            <div className="text-xs text-muted-foreground">
              Dauer: {renderedDurationSec}s · Größe:{" "}
              {blob ? (blob.size / 1024 / 1024).toFixed(1) : "?"} MB
            </div>
            <div className="flex flex-wrap gap-2">
              <Button onClick={handleDownload} variant="outline" size="sm">
                <Download className="mr-2 h-4 w-4" />
                Herunterladen
              </Button>
              <Button onClick={handleShare} variant="outline" size="sm">
                <Share2 className="mr-2 h-4 w-4" />
                Teilen
              </Button>
              <Button onClick={handleRender} variant="ghost" size="sm">
                <Eye className="mr-2 h-4 w-4" />
                Neu rendern
              </Button>
            </div>
            {!publishedUrl && (
              <Button
                onClick={handlePublish}
                disabled={publishing}
                className="w-full"
              >
                {publishing ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Wird hochgeladen…
                  </>
                ) : (
                  <>
                    <Send className="mr-2 h-4 w-4" />
                    Für alle Teilnehmer veröffentlichen
                  </>
                )}
              </Button>
            )}
            {publishedUrl && (
              <Alert>
                <AlertDescription>
                  Veröffentlicht — alle Mitglieder sehen den Film im Event-Buch.
                </AlertDescription>
              </Alert>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
