"use client";

// PROJ-34: Lightweight storyboard editor — admin can rename title, change
// music track, edit overlay text per scene, and remove scenes. Reordering is
// kept simple (up/down buttons) to avoid pulling dnd-kit into yet another tree.

import { useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ArrowDown, ArrowUp } from "lucide-react";
import {
  SLIDESHOW_MAX_DURATION_MS,
  type Storyboard,
} from "@/lib/slideshow/storyboard-types";

interface MusicTrackOption {
  id: string;
  title: string;
  mood: string;
}

interface SceneThumb {
  thumbnail_url: string | null;
  media_url: string | null;
  type?: "photo" | "video" | "text" | "audio";
}

interface Props {
  storyboard: Storyboard;
  musicTracks: MusicTrackOption[];
  onChange: (next: Storyboard) => void;
  /** Optional map of content_item_id → thumbnail/media URL for preview in the scene list */
  sceneThumbnails?: Map<string, SceneThumb>;
  eventCoverUrl?: string | null;
}

export function StoryboardEditor({ storyboard, musicTracks, onChange, sceneThumbnails, eventCoverUrl }: Props) {
  const totalMs = useMemo(
    () => storyboard.scenes.reduce((s, sc) => s + sc.duration_ms, 0),
    [storyboard.scenes]
  );
  const overBudget = totalMs > SLIDESHOW_MAX_DURATION_MS;

  const updateScene = (idx: number, patch: Partial<Storyboard["scenes"][number]>) => {
    const next = { ...storyboard, scenes: storyboard.scenes.map((s, i) => (i === idx ? { ...s, ...patch } : s)) };
    onChange(next);
  };

  const moveScene = (idx: number, dir: -1 | 1) => {
    const j = idx + dir;
    if (j < 0 || j >= storyboard.scenes.length) return;
    const next = [...storyboard.scenes];
    [next[idx], next[j]] = [next[j], next[idx]];
    onChange({ ...storyboard, scenes: next });
  };

  const photoOptions = storyboard.scenes
    .filter((scene) => scene.type === "photo" && scene.content_item_id)
    .map((scene, index) => ({
      id: scene.content_item_id!,
      label: `Foto ${index + 1}`,
    }));

  const renderTitleCardEditor = (kind: "intro" | "outro", label: string) => {
    const card = storyboard[kind];
    const selectedUrl = card.content_item_id
      ? sceneThumbnails?.get(card.content_item_id)?.thumbnail_url ||
        sceneThumbnails?.get(card.content_item_id)?.media_url ||
        null
      : eventCoverUrl;
    return (
      <div className="space-y-3 rounded-md border border-border p-3">
        <Label>{label}</Label>
        {selectedUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={selectedUrl} alt={`${label} Vorschau`} className="aspect-video w-full rounded object-cover" />
        )}
        <Select
          value={card.content_item_id ?? "__event_cover__"}
          onValueChange={(value) =>
            onChange({
              ...storyboard,
              [kind]: { ...card, content_item_id: value === "__event_cover__" ? null : value },
            })
          }
        >
          <SelectTrigger aria-label={`${label} Bild wählen`}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__event_cover__">Event-Titelbild</SelectItem>
            {photoOptions.map((photo) => (
              <SelectItem key={photo.id} value={photo.id}>{photo.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Textarea
          value={card.text}
          onChange={(event) =>
            onChange({
              ...storyboard,
              [kind]: { ...card, text: event.target.value.slice(0, 160) },
            })
          }
          placeholder={`${label} Text`}
          rows={2}
          maxLength={160}
        />
      </div>
    );
  };


  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="sb-title">Filmtitel</Label>
        <Input
          id="sb-title"
          value={storyboard.title}
          onChange={(e) => onChange({ ...storyboard, title: e.target.value.slice(0, 120) })}
          maxLength={120}
        />
      </div>

      {renderTitleCardEditor("intro", "Startseite")}
      {renderTitleCardEditor("outro", "Schlussseite")}

      <div className="space-y-2">
        <Label htmlFor="sb-music">Musik</Label>
        <Select
          value={storyboard.music_track_id ?? ""}
          onValueChange={(v) => onChange({ ...storyboard, music_track_id: v })}
        >
          <SelectTrigger id="sb-music">
            <SelectValue placeholder="Track wählen" />
          </SelectTrigger>
          <SelectContent>
            {musicTracks.map((t) => (
              <SelectItem key={t.id} value={t.id}>
                {t.title} <span className="text-muted-foreground">— {t.mood}</span>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="flex items-center justify-between rounded-md border border-border bg-muted/40 p-3 text-sm">
        <span>
          Gesamtdauer: <strong>{(totalMs / 1000).toFixed(1)} s</strong> /{" "}
          {SLIDESHOW_MAX_DURATION_MS / 1000} s
        </span>
        {overBudget && (
          <span className="text-destructive font-medium">Zu lang!</span>
        )}
      </div>

      <div className="space-y-3">
        <Label>Szenen</Label>
        {storyboard.scenes.map((sc, i) => {
          const thumb = sc.content_item_id ? sceneThumbnails?.get(sc.content_item_id) : null;
          const thumbUrl = thumb?.thumbnail_url || thumb?.media_url || null;
          return (
            <div key={i} className="flex gap-3 rounded-md border border-border p-3">
              {thumbUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={thumbUrl}
                  alt={`Szene ${i + 1}`}
                  className="h-20 w-20 shrink-0 rounded object-cover bg-muted"
                />
              ) : (
                <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded bg-muted text-xs text-muted-foreground">
                  {sc.type}
                </div>
              )}
              <div className="flex-1 min-w-0 space-y-2">
                <div className="flex items-center justify-between gap-2">
                <div className="text-xs text-muted-foreground">
                  #{i + 1} · {sc.type === "photo" ? "Foto" : "Video"} · {(sc.duration_ms / 1000).toFixed(1)}s
                </div>
                <div className="flex gap-1">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7"
                    onClick={() => moveScene(i, -1)}
                    aria-label="Nach oben"
                    disabled={i === 0}
                  >
                    <ArrowUp className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7"
                    onClick={() => moveScene(i, 1)}
                    aria-label="Nach unten"
                    disabled={i === storyboard.scenes.length - 1}
                  >
                    <ArrowDown className="h-4 w-4" />
                  </Button>
                </div>
              </div>
              <Textarea
                value={sc.overlay_text}
                onChange={(e) => updateScene(i, { overlay_text: e.target.value.slice(0, 280) })}
                placeholder="Text-Overlay (max. 280 Zeichen)"
                rows={2}
                maxLength={280}
              />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
